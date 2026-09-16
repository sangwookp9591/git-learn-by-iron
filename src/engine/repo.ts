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

  get context() { return { fs: this.fs, dir: this.dir }; }

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

  async commit(message: string, author: Author = defaultAuthor, amend = false): Promise<string> {
    if (!message.trim()) throw new Error('커밋 메시지가 비어 있습니다.');
    if (!amend && !(await this.status()).some(([, head, , stage]) => head !== stage)) {
      throw new Error('커밋할 변경 사항이 없습니다.');
    }
    const old = await this.headOid();
    if (amend && !old) throw new Error('수정할 커밋이 없습니다.');
    const original = amend ? (await git.readCommit({ ...this.context, oid: old! })).commit.author : author;
    const sha = await git.commit({ ...this.context, message, author: original, committer: author, amend });
    await this.recordHead(old, sha, `commit${amend ? ' (amend)' : ''}: ${message.split('\n')[0]}`);
    return sha;
  }

  async log(ref = 'HEAD'): Promise<git.ReadCommitResult[]> {
    const branch = await this.currentBranch();
    if (ref === 'HEAD' && branch && !(await this.branch()).includes(branch)) return [];
    return git.log({ ...this.context, ref: await this.resolve(ref) });
  }

  async currentBranch(): Promise<string | undefined> { return (await git.currentBranch(this.context)) || undefined; }

  async branch(name?: string, start = 'HEAD'): Promise<string[]> {
    if (name !== undefined) {
      if (!(await this.log()).length) throw new Error('아직 커밋이 없어 브랜치를 만들 수 없습니다.');
      await git.branch({ ...this.context, ref: name, object: await this.resolve(start) });
      await this.fs.promises.flush();
    }
    return git.listBranches(this.context);
  }

  async checkout(name: string, create = false): Promise<void> {
    const old = await this.headOid();
    if (create) {
      // A branch at the current HEAD only moves the symbolic ref, preserving index/worktree.
      await git.branch({ ...this.context, ref: name, checkout: true });
      await this.recordHead(old, old, `checkout: moving to ${name}`);
      return;
    }
    const ref = (await this.branch()).includes(name) ? name : await this.resolve(name);
    await git.checkout({ ...this.context, ref });
    await this.recordHead(old, await this.resolve('HEAD'), `checkout: moving to ${name}`);
  }

  async headOid(): Promise<string | null> {
    try { return await git.resolveRef({ ...this.context, ref: 'HEAD' }); }
    catch (error) { if ((error as { code?: string }).code === 'NotFoundError') return null; throw error; }
  }

  async resolve(ref: string): Promise<string> {
    const ancestry = /^(.*?)(?:~(\d+)|\^(\d*))$/.exec(ref);
    if (ancestry) {
      let oid = await this.resolve(ancestry[1]);
      const count = ancestry[2] === undefined ? 1 : Number(ancestry[2]);
      if (count > 10000) throw new Error('커밋 범위가 너무 큽니다.');
      for (let i = 0; i < count; i++) {
        const parents = (await git.readCommit({ ...this.context, oid })).commit.parent;
        oid = parents[ancestry[2] === undefined ? Number(ancestry[3] || 1) - 1 : 0];
        if (!oid) throw new Error('해당 부모 커밋이 없습니다.');
      }
      return oid;
    }
    const logRef = /^HEAD@\{(\d+)\}$/.exec(ref);
    if (logRef) {
      const entry = (await this.reflog())[Number(logRef[1])];
      if (!entry) throw new Error('해당 reflog 항목이 없습니다.');
      return entry.sha;
    }
    const oid = /^[a-f0-9]{4,40}$/.test(ref)
      ? await git.expandOid({ ...this.context, oid: ref })
      : await git.resolveRef({ ...this.context, ref });
    await git.readCommit({ ...this.context, oid });
    return oid;
  }

  async recordHead(old: string | null, sha: string | null, reason: string): Promise<void> {
    if (!sha) { await this.fs.promises.flush(); return; }
    const path = `${this.dir}/.git/logs`;
    try { await this.fs.promises.mkdir(path); }
    catch (error) { if ((error as { code?: string }).code !== 'EEXIST') throw error; }
    const previous = await this.internalText('logs/HEAD');
    const line = `${old ?? '0'.repeat(40)} ${sha} ${defaultAuthor.name} <${defaultAuthor.email}> ${Math.floor(Date.now() / 1000)} +0000\t${reason.replace(/[\r\n\t]/g, ' ')}\n`;
    await this.fs.promises.writeFile(`${path}/HEAD`, previous + line, 'utf8');
    await this.fs.promises.flush();
  }

  async internalText(path: string): Promise<string> {
    try { return await this.fs.promises.readFile(`${this.dir}/.git/${path}`, 'utf8'); }
    catch (error) { if ((error as { code?: string }).code === 'ENOENT') return ''; throw error; }
  }

  async reflog(): Promise<{ sha: string; old: string; reason: string; message: string }[]> {
    const lines = (await this.internalText('logs/HEAD')).trim().split('\n').filter(Boolean).reverse();
    return Promise.all(lines.map(async (line) => {
      const [old, sha] = line.split(' ');
      return { old, sha, reason: line.split('\t')[1], message: (await git.readCommit({ ...this.context, oid: sha })).commit.message.trimEnd() };
    }));
  }

  async treeFiles(ref: string): Promise<Record<string, string>> {
    const oid = await this.resolve(ref);
    const files: Record<string, string> = Object.create(null);
    await git.walk({ ...this.context, trees: [git.TREE({ ref: oid })], map: async (path, [entry]) => {
      if (entry && await entry.type() === 'blob') files[path] = (await entry.oid())!;
    } });
    return files;
  }

  async changedFiles(ref: string): Promise<string[]> {
    const oid = await this.resolve(ref);
    const parent = (await git.readCommit({ ...this.context, oid })).commit.parent[0];
    const before = parent ? await this.treeFiles(parent) : {};
    const after = await this.treeFiles(oid);
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((path) => before[path] !== after[path]).sort();
  }

  async blobText(ref: string, path: string): Promise<string> {
    const oid = await this.resolve(ref);
    return new TextDecoder().decode((await git.readBlob({ ...this.context, oid, filepath: pathInRepo(path) })).blob);
  }

  async stageContent(path: string, content: string): Promise<void> {
    const filepath = pathInRepo(path);
    if (filepath === '.') throw new Error('파일 경로를 입력하세요.');
    const oid = await git.writeBlob({ ...this.context, blob: new TextEncoder().encode(content) });
    await git.updateIndex({ ...this.context, filepath, oid, mode: 0o100644, add: true });
    await this.fs.promises.flush();
  }

  async resetTo(ref: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed', reason = `reset: moving to ${ref}`): Promise<void> {
    const oid = await this.resolve(ref);
    const old = await this.headOid();
    const branch = await this.currentBranch();
    // Checkout first: a failed checkout must not move the branch pointer.
    if (mode === 'hard') await git.checkout({ ...this.context, ref: oid, force: true, noUpdateHead: true });
    if (mode === 'mixed') {
      const paths = new Set([...(await git.listFiles(this.context)), ...Object.keys(await this.treeFiles(oid))]);
      for (const filepath of paths) await git.resetIndex({ ...this.context, filepath, ref: oid });
    }
    await git.writeRef({ ...this.context, ref: branch ? `refs/heads/${branch}` : 'HEAD', value: oid, force: true });
    await this.recordHead(old, oid, reason);
  }

  async deleteBranch(name: string, force = false): Promise<void> {
    if (name === await this.currentBranch()) throw new Error('현재 브랜치는 삭제할 수 없습니다.');
    const oid = await this.resolve(name);
    if (!force && !(await this.log()).some((entry) => entry.oid === oid)) throw new Error('병합되지 않은 브랜치입니다. 삭제하려면 -D를 사용하세요.');
    await git.deleteBranch({ ...this.context, ref: name });
    await this.fs.promises.flush();
  }

  async requireClean(): Promise<void> {
    if ((await this.status()).some(([, head, work, stage]) => head !== stage || work !== stage)) throw new Error('작업 내용을 먼저 커밋하거나 보관하세요.');
  }

  async connectOrigin(): Promise<LessonRepo> {
    const existing = await this.origin();
    if (existing) return existing;
    const id = `origin:${crypto.randomUUID()}`;
    const remote = await createRepo(id);
    await git.setConfig({ ...this.context, path: 'remote.origin.url', value: `local:${id}` });
    await this.fs.promises.flush();
    return remote;
  }

  async origin(): Promise<LessonRepo | null> {
    const url = await git.getConfig({ ...this.context, path: 'remote.origin.url' });
    return typeof url === 'string' && url.startsWith('local:') ? createRepo(url.slice(6)) : null;
  }

  async track(branch: string, remoteBranch = branch): Promise<void> {
    await git.setConfig({ ...this.context, path: `branch.${branch}.remote`, value: 'origin' });
    await git.setConfig({ ...this.context, path: `branch.${branch}.merge`, value: `refs/heads/${remoteBranch}` });
    await this.fs.promises.flush();
  }

  async upstream(branch: string): Promise<string | null> {
    const remote = await git.getConfig({ ...this.context, path: `branch.${branch}.remote` });
    const merge = await git.getConfig({ ...this.context, path: `branch.${branch}.merge` });
    return remote === 'origin' && typeof merge === 'string' ? `origin/${merge.replace(/^refs\/heads\//, '')}` : null;
  }

  /** Transfer only reachable Git objects; refs, index and worktree remain independent. */
  async copyObjectsTo(target: LessonRepo, oid: string, seen = new Set<string>()): Promise<void> {
    if (seen.has(oid)) return;
    seen.add(oid);
    const object = await git.readObject({ ...this.context, oid, format: 'content' });
    if (object.type === 'commit') {
      const { commit } = await git.readCommit({ ...this.context, oid });
      for (const child of [commit.tree, ...commit.parent]) await this.copyObjectsTo(target, child, seen);
    } else if (object.type === 'tree') {
      for (const child of (await git.readTree({ ...this.context, oid })).tree) {
        if (child.type !== 'commit') await this.copyObjectsTo(target, child.oid, seen);
      }
    }
    if (object.type === 'deflated' || object.type === 'wrapped') throw new Error('Git 객체 형식이 잘못되었습니다.');
    await git.writeObject({ ...target.context, type: object.type, object: object.object, format: 'content' });
  }

  async fetch(): Promise<void> {
    const remote = await this.origin();
    if (!remote) throw new Error('origin 저장소가 없습니다.');
    const seen = new Set<string>();
    for (const branch of await remote.branch()) {
      const oid = await remote.resolve(branch);
      await remote.copyObjectsTo(this, oid, seen);
      await git.writeRef({ ...this.context, ref: `refs/remotes/origin/${branch}`, value: oid, force: true });
    }
    await this.fs.promises.flush();
  }

  async divergence(ref: string, upstream: string): Promise<{ ahead: number; behind: number }> {
    const local = new Set((await this.log(ref)).map(({ oid }) => oid));
    const remote = new Set((await this.log(upstream)).map(({ oid }) => oid));
    return { ahead: [...local].filter((oid) => !remote.has(oid)).length, behind: [...remote].filter((oid) => !local.has(oid)).length };
  }

  async pull(remoteBranch?: string): Promise<void> {
    await this.requireClean();
    const branch = await this.currentBranch();
    if (!branch) throw new Error('브랜치로 이동한 뒤 pull 하세요.');
    const upstream = remoteBranch ? `origin/${remoteBranch}` : await this.upstream(branch);
    if (!upstream) throw new Error('추적 브랜치가 없습니다.');
    await this.fetch();
    const old = await this.resolve('HEAD');
    const result = await git.merge({ ...this.context, theirs: upstream, author: defaultAuthor, noUpdateBranch: true });
    if (result.oid && result.oid !== old) await this.resetTo(result.oid, 'hard', result.fastForward ? 'pull: Fast-forward' : 'pull: merge');
  }

  async push(remoteBranch?: string, options: { upstream?: boolean; force?: boolean; lease?: boolean } = {}): Promise<void> {
    const remote = await this.origin();
    if (!remote) throw new Error('origin 저장소가 없습니다.');
    const branch = await this.currentBranch();
    if (!branch) throw new Error('브랜치로 이동한 뒤 push 하세요.');
    const source = remoteBranch ?? branch;
    if (!(await this.branch()).includes(source)) throw new Error(`로컬 브랜치가 없습니다: ${source}`);
    const tracking = await this.upstream(source);
    const name = remoteBranch ?? tracking?.replace(/^origin\//, '') ?? (options.upstream ? branch : null);
    if (!name) throw new Error('추적 브랜치가 없습니다. git push -u origin <브랜치>로 연결하세요.');
    // Validate before transferring objects or changing either ref.
    if (!name || /(^[./]|\.\.|[ ~^:?*\[\\\x00-\x20]|\/$|\.$|@\{|\/\/|\.lock(?:\/|$))/.test(name)) throw new Error('올바른 브랜치 이름을 입력하세요.');
    const oid = await this.resolve(source);
    const remoteOid = (await remote.branch()).includes(name) ? await remote.resolve(name) : null;
    if (options.lease) {
      let expected: string | null = null;
      const refs = await git.listBranches({ ...this.context, remote: 'origin' });
      if (refs.includes(name)) expected = await this.resolve(`origin/${name}`);
      if (expected !== remoteOid) throw new Error('[rejected] stale info: origin이 마지막 fetch 이후 변경되었습니다.');
    } else if (!options.force && remoteOid && !(await this.log(source)).some((entry) => entry.oid === remoteOid)) {
      throw new Error('[rejected] non-fast-forward: 리모트 이력을 먼저 확인하세요.');
    }
    await this.copyObjectsTo(remote, oid);
    await git.writeRef({ ...remote.context, ref: `refs/heads/${name}`, value: oid, force: true });
    await remote.fs.promises.flush();
    await git.writeRef({ ...this.context, ref: `refs/remotes/origin/${name}`, value: oid, force: true });
    if (options.upstream) await this.track(source, name);
    await this.fs.promises.flush();
  }

  async cherryPick(refs: string[], resume?: 'continue' | 'abort'): Promise<void> {
    const path = `${this.dir}/.git/CHERRY_PICK_SEQUENCE`;
    const saved = await this.internalText('CHERRY_PICK_SEQUENCE');
    let sequence: { start: string; oids: string[] };
    if (resume) {
      if (!saved) throw new Error('진행 중인 cherry-pick이 없습니다.');
      sequence = JSON.parse(saved);
      if (resume === 'abort') {
        await this.resetTo(sequence.start, 'hard', 'cherry-pick: abort');
        await this.fs.promises.unlink(path);
        await this.fs.promises.flush();
        return;
      }
      const original = (await git.readCommit({ ...this.context, oid: sequence.oids[0] })).commit;
      await this.commit(original.message, original.author);
      sequence.oids.shift();
    } else {
      if (saved) throw new Error('cherry-pick --continue 또는 --abort로 먼저 마무리하세요.');
      await this.requireClean();
      sequence = { start: await this.resolve('HEAD'), oids: await Promise.all(refs.map((ref) => this.resolve(ref))) };
    }
    while (sequence.oids.length) {
      await this.fs.promises.writeFile(path, JSON.stringify(sequence), 'utf8');
      const oid = sequence.oids[0];
      const old = await this.resolve('HEAD');
      try {
        const sha = await git.cherryPick({ ...this.context, oid, committer: defaultAuthor, abortOnConflict: false });
        await this.recordHead(old, sha, `cherry-pick: ${(await git.readCommit({ ...this.context, oid })).commit.message.split('\n')[0]}`);
      } catch (error) {
        await this.fs.promises.flush();
        if ((error as { code?: string }).code === 'MergeConflictError') throw new Error('cherry-pick 충돌: 파일을 해결하고 add한 뒤 --continue, 취소하려면 --abort 하세요.');
        throw error;
      }
      sequence.oids.shift();
    }
    if (saved || refs.length) await this.fs.promises.unlink(path);
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
