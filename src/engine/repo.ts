import { Buffer } from 'buffer/index.js';
import LightningFS from '@isomorphic-git/lightning-fs';
import * as git from 'isomorphic-git';

// isomorphic-git's browser ESM build expects the Buffer global.
if (!('Buffer' in globalThis)) Object.assign(globalThis, { Buffer });

export type StatusRow = git.StatusRow;
export type Author = { name: string; email: string };
export const defaultAuthor: Author = { name: '학습자', email: 'learner@example.invalid' };

function pathInRepo(path: string): string {
  if (!path || path.startsWith('/') || /[\\\0]/.test(path)) {
    throw new Error('저장소 안의 상대 경로를 입력하세요.');
  }
  const parts = path.split('/').filter((part) => part && part !== '.');
  if (parts.some((part) => part === '..' || part.toLowerCase() === '.git')) {
    throw new Error('저장소 밖이나 .git 내부에는 접근할 수 없습니다.');
  }
  return parts.join('/') || '.';
}

function selectPaths(rows: StatusRow[], paths: string[]): StatusRow[] {
  const normalized = paths.map(pathInRepo);
  for (const path of normalized) {
    if (path !== '.' && !rows.some(([file]) => file === path || file.startsWith(`${path}/`))) {
      throw new Error(`'${path}' 경로명은 git이 아는 파일과 일치하지 않습니다.`);
    }
  }
  return rows.filter(([file]) => normalized.some((path) => path === '.' || file === path || file.startsWith(`${path}/`)));
}

export class LessonRepo {
  readonly fs: LightningFS;
  readonly dir = '/repo';

  readonly lessonId: string;

  constructor(lessonId: string) {
    this.lessonId = lessonId;
    if (!lessonId.trim() || lessonId.length > 128) throw new Error('올바른 레슨 ID를 입력하세요.');
    // Each lesson owns a separate IndexedDB database. No HTTP backend is configured.
    this.fs = new LightningFS(`git-learn-by-iron:${encodeURIComponent(lessonId)}`);
  }

  async init(): Promise<void> {
    try {
      await this.fs.promises.mkdir(this.dir);
    } catch (error) {
      if ((error as { code?: string }).code !== 'EEXIST') throw error;
    }
    try {
      await this.fs.promises.stat(`${this.dir}/.git/HEAD`);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') throw error;
      await git.init({ ...this.context, defaultBranch: 'main' });
      await this.fs.promises.flush();
    }
  }

  private get context() { return { fs: this.fs, dir: this.dir }; }

  async writeFile(path: string, contents: string): Promise<void> {
    const file = pathInRepo(path);
    if (file === '.') throw new Error('파일 경로를 입력하세요.');
    const parts = file.split('/');
    let parent = this.dir;
    for (const part of parts.slice(0, -1)) {
      parent += `/${part}`;
      try {
        await this.fs.promises.mkdir(parent);
      } catch (error) {
        if ((error as { code?: string }).code !== 'EEXIST') throw error;
      }
    }
    const target = `${this.dir}/${file}`;
    try {
      if (!(await this.fs.promises.lstat(target)).isFile()) throw new Error('일반 파일만 수정할 수 있습니다.');
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') throw error;
    }
    // isomorphic-git compares second-resolution stats. Replacing the inode also detects
    // equal-length edits within one second and keeps the old file until writing succeeds.
    const temporary = `${this.dir}/.git/write-${crypto.randomUUID()}`;
    try {
      await this.fs.promises.writeFile(temporary, contents, 'utf8');
      await this.fs.promises.rename(temporary, target);
      await this.fs.promises.flush();
    } finally {
      try { await this.fs.promises.unlink(temporary); }
      catch (error) { if ((error as { code?: string }).code !== 'ENOENT') throw error; }
    }
  }

  readFile(path: string): Promise<string> {
    return this.fs.promises.readFile(`${this.dir}/${pathInRepo(path)}`, 'utf8');
  }

  async removeFile(path: string): Promise<void> {
    await this.fs.promises.unlink(`${this.dir}/${pathInRepo(path)}`);
    await this.fs.promises.flush();
  }

  status(): Promise<StatusRow[]> {
    return git.statusMatrix({ ...this.context, refresh: false });
  }

  async add(paths: string | string[] = '.'): Promise<void> {
    const selected = selectPaths(await this.status(), typeof paths === 'string' ? [paths] : paths);
    for (const [filepath, , workdir] of selected) {
      if (workdir === 0) await git.remove({ ...this.context, filepath });
      else await git.add({ ...this.context, filepath });
    }
    await this.fs.promises.flush();
  }

  async unstage(paths: string | string[] = '.'): Promise<void> {
    const selected = selectPaths(await this.status(), typeof paths === 'string' ? [paths] : paths);
    for (const [filepath] of selected) await git.resetIndex({ ...this.context, filepath });
    await this.fs.promises.flush();
  }

  reset(paths: string | string[] = '.'): Promise<void> { return this.unstage(paths); }

  async commit(message: string, author: Author = defaultAuthor): Promise<string> {
    if (!message.trim()) throw new Error('커밋 메시지가 비어 있습니다.');
    if (!(await this.status()).some(([, head, , stage]) => head !== stage)) {
      throw new Error('커밋할 변경 사항이 없습니다.');
    }
    const sha = await git.commit({ ...this.context, message, author });
    await this.fs.promises.flush();
    return sha;
  }

  async log(): Promise<git.ReadCommitResult[]> {
    const branch = await this.currentBranch();
    if (branch && !(await this.branch()).includes(branch)) return [];
    return git.log(this.context);
  }

  async currentBranch(): Promise<string | undefined> { return (await git.currentBranch(this.context)) || undefined; }

  async branch(name?: string): Promise<string[]> {
    if (name !== undefined) {
      if (!(await this.log()).length) throw new Error('아직 커밋이 없어 브랜치를 만들 수 없습니다.');
      await git.branch({ ...this.context, ref: name });
      await this.fs.promises.flush();
    }
    return git.listBranches(this.context);
  }

  async checkout(name: string, create = false): Promise<void> {
    if (create) {
      // A branch at the current HEAD only moves the symbolic ref, preserving index/worktree.
      await git.branch({ ...this.context, ref: name, checkout: true });
      await this.fs.promises.flush();
      return;
    }
    if (!(await this.branch()).includes(name)) throw new Error(`'${name}' 브랜치를 찾을 수 없습니다.`);
    await git.checkout({ ...this.context, ref: name });
    await this.fs.promises.flush();
  }

  switch(name: string, create = false): Promise<void> { return this.checkout(name, create); }
}

const repositories = new Map<string, Promise<LessonRepo>>();

/** Open or initialize a persistent lesson repository. Reopening never resets progress. */
export function createRepo(lessonId: string): Promise<LessonRepo> {
  const existing = repositories.get(lessonId);
  if (existing) return existing;
  const pending = (async () => {
    const repo = new LessonRepo(lessonId);
    await repo.init();
    return repo;
  })();
  repositories.set(lessonId, pending);
  void pending.catch(() => repositories.delete(lessonId));
  return pending;
}
