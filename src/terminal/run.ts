import * as git from 'isomorphic-git';
import type { LessonRepo } from '../engine/repo.ts';
import { readState, type RepoState, type CommitState } from '../engine/state.ts';
import { parse, type ParsedCommand } from './parse.ts';

export const laterLesson = '이 명령은 뒤쪽 레슨에서 다룹니다.';

function formatStatus(state: RepoState): string {
  const lines = [`현재 브랜치 ${state.branch ?? '(HEAD 분리됨)'}`];
  const upstream = state.branch ? state.tracking[state.branch] : undefined;
  if (upstream) lines.push(`추적 ${upstream} · ahead ${state.head?.ahead ?? '?'} · behind ${state.head?.behind ?? '?'}`);
  if (!state.head) lines.push('', '아직 커밋이 없습니다');
  const staged = state.status.filter(([, head, , stage]) => head !== stage);
  const unstaged = state.status.filter(([, , workdir, stage]) => stage !== 0 && workdir !== stage);
  const untracked = state.status.filter(([, , workdir, stage]) => stage === 0 && workdir !== 0);
  if (staged.length) {
    lines.push('', '커밋할 변경 사항:', '  (스테이지 해제하려면 "git restore --staged <파일>..."을 사용하십시오)', '');
    for (const [path, head, , stage] of staged) lines.push(`\t${stage === 0 ? '삭제함' : head === 0 ? '새 파일' : '수정함'}:     ${path}`);
  }
  if (unstaged.length) {
    lines.push('', '커밋하도록 정하지 않은 변경 사항:', '  (무엇을 커밋할지 바꾸려면 "git add <파일>..."을 사용하십시오)', '');
    for (const [path, , workdir] of unstaged) lines.push(`\t${workdir === 0 ? '삭제함' : '수정함'}:     ${path}`);
  }
  if (untracked.length) {
    lines.push('', '추적하지 않는 파일:', '  (커밋할 사항에 포함하려면 "git add <파일>..."을 사용하십시오)', '');
    for (const [path] of untracked) lines.push(`\t${path}`);
  }
  if (!staged.length && !unstaged.length && !untracked.length) {
    lines.push('', state.head ? '커밋할 사항 없음, 작업 폴더 깨끗함' : '커밋할 사항 없음 (파일을 만들거나 복사하고 "git add"를 사용하면 추적합니다)');
  }
  return lines.join('\n');
}

function formatDate(author: CommitState['author']): string {
  const date = new Date((author.timestamp - author.timezoneOffset * 60) * 1000);
  const offset = Math.abs(author.timezoneOffset);
  const zone = `${author.timezoneOffset <= 0 ? '+' : '-'}${String(Math.floor(offset / 60)).padStart(2, '0')}${String(offset % 60).padStart(2, '0')}`;
  return `${'Sun Mon Tue Wed Thu Fri Sat'.split(' ')[date.getUTCDay()]} ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[date.getUTCMonth()]} ${date.getUTCDate()} ${date.toISOString().slice(11, 19)} ${date.getUTCFullYear()} ${zone}`;
}

const supportedOptions: Record<string, string[]> = {
  status: [], add: ['-A', '--all', '-p'], commit: ['-m', '--message', '--amend', '--no-edit'],
  restore: ['--staged'], reset: ['--soft', '--mixed', '--hard'], log: ['--oneline', '--graph'], diff: ['--name-only', '--staged', '--cached'],
  branch: ['-vv', '--show-current', '-D', '-d'], switch: ['-c'], checkout: ['-b'],
  push: ['-u', '--set-upstream', '--force', '-f', '--force-with-lease'], pull: [], fetch: [], reflog: [],
  show: ['--stat'], 'cherry-pick': ['--continue', '--abort'], merge: [], rm: ['--cached'], 'check-ignore': ['-v'],
};

export type Editor = (title: string, initial: string) => Promise<string | null>;

// ponytail: full-file replacement diffs; use minimal hunks if lesson files grow large.
function diffText(path: string, before: string, after: string): string {
  if (before === after) return '';
  const a = before ? before.replace(/\n$/, '').split('\n') : [];
  const b = after ? after.replace(/\n$/, '').split('\n') : [];
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -${a.length ? 1 : 0},${a.length} +${b.length ? 1 : 0},${b.length} @@\n${a.map((line) => '-' + line).concat(b.map((line) => '+' + line)).join('\n')}`;
}

async function indexText(repo: LessonRepo, path: string): Promise<string> {
  let content = '';
  await git.walk({ ...repo.context, trees: [git.STAGE()], map: async (name, [entry]) => {
    if (name === path && entry) content = new TextDecoder().decode((await git.readBlob({ ...repo.context, oid: (await entry.oid())! })).blob);
  } });
  return content;
}

/** Authored-example capability check only; this never scores a learner action. */
export function supportsCommand(input: string | ParsedCommand): boolean {
  try {
    const { program, subcommand, options } = typeof input === 'string' ? parse(input) : input;
    const allowed = Object.hasOwn(supportedOptions, subcommand) ? supportedOptions[subcommand] : undefined;
    return program === 'git' && !!allowed && Object.entries(options).every(([key, value]) =>
      (allowed.includes(key) || subcommand === 'log' && /^-\d+$/.test(key))
      && (['-m', '--message', '-c', '-b'].includes(key) ? typeof value === 'string' : value === true));
  } catch { return false; }
}

/** Return terminal text; callers render it as text, never HTML. Await each command. */
export async function run(repo: LessonRepo, input: string | ParsedCommand, editor?: Editor): Promise<string> {
  try {
    const command = typeof input === 'string' ? parse(input) : input;
    const { program, subcommand, options, paths } = command;
    if (!program) return '';
    if (!supportsCommand(command)) return laterLesson;
    switch (subcommand) {
      case 'status':
        return paths.length ? laterLesson : formatStatus(await readState(repo));
      case 'add':
        if (options['-p']) {
          if (paths.length !== 1 || Object.keys(options).length !== 1) throw new Error('부분 스테이징할 파일 하나를 입력하세요.');
          if (!editor) return '부분 스테이징 편집기를 열어 커밋에 담을 내용만 남기세요.';
          const content = await editor(`부분 스테이징: ${paths[0]} — 이번 커밋에 담을 내용만 남기세요`, await repo.readFile(paths[0]));
          if (content !== null) await repo.stageContent(paths[0], content);
          return content === null ? '취소했습니다.' : '편집한 내용만 스테이징했습니다. 작업 파일은 유지됩니다.';
        }
        if (!paths.length && !options['-A'] && !options['--all']) return '지정한 경로가 없습니다.\n힌트: 모두 추가하려면 "git add ."을 사용하세요.';
        await repo.add(paths.length ? paths : '.');
        return '';
      case 'commit': {
        if (paths.length || (options['-m'] !== undefined && options['--message'] !== undefined)) return laterLesson;
        let message: string | boolean | undefined = options['-m'] ?? options['--message'];
        if (options['--no-edit'] && (!options['--amend'] || message !== undefined)) throw new Error('--no-edit는 메시지 없이 --amend와 사용하세요.');
        if (message === undefined) {
          const initial = options['--amend'] ? (await repo.log())[0]?.commit.message.trimEnd() ?? '' : '';
          if (options['--no-edit']) message = initial;
          else if (editor) message = await editor(options['--amend'] ? '최근 커밋 수정' : '커밋 메시지', initial) ?? undefined;
          else throw new Error('커밋 메시지가 필요합니다. git commit -m "제목" -m "Refs: 티켓"을 사용하세요.');
          if (message === undefined) return '취소했습니다.';
        }
        if (typeof message !== 'string') throw new Error('커밋 메시지를 입력하세요.');
        const before = await readState(repo);
        const sha = await repo.commit(message, undefined, !!options['--amend']);
        return `[${before.branch ?? 'HEAD 분리됨'}${before.head ? '' : ' (최상위 커밋)'} ${sha.slice(0, 7)}] ${message.split('\n')[0]}\n ${before.index.length}개 파일 변경`;
      }
      case 'restore':
        if (!options['--staged']) {
          if (!paths.length) throw new Error('복원할 파일을 입력하세요.');
          const rows = await repo.status();
          const selected = rows.filter(([path]) => paths.includes('.') || paths.includes(path));
          for (const [path, , , stage] of selected) if (stage) await repo.writeFile(path, await indexText(repo, path));
          return '';
        }
        if (!paths.length) throw new Error('스테이지 해제할 파일 경로를 입력하세요.');
        await repo.unstage(paths);
        return '';
      case 'reset': {
        const modes = ['soft', 'mixed', 'hard'].filter((mode) => options[`--${mode}`]);
        if (modes.length > 1) throw new Error('reset 모드는 하나만 선택하세요.');
        if (modes.length || paths.length === 1 && paths[0] !== 'HEAD' && paths[0] !== '.' && !(await repo.status()).some(([path]) => path === paths[0] || path.startsWith(`${paths[0]}/`))) {
          if (paths.length > 1) throw new Error('reset 대상 커밋 하나를 입력하세요.');
          await repo.resetTo(paths[0] ?? 'HEAD', (modes[0] ?? 'mixed') as 'soft' | 'mixed' | 'hard');
          return `HEAD 위치: ${(await repo.resolve('HEAD')).slice(0, 7)}`;
        }
        const targets = paths[0] === 'HEAD' ? paths.slice(1) : paths;
        await repo.reset(targets.length ? targets : '.');
        const changes = (await repo.status()).filter(([, , workdir, stage]) => stage !== 0 && workdir !== stage);
        return changes.length ? `리셋 뒤에 스테이징하지 않은 변경 사항:\n${changes.map(([path, , workdir]) => `${workdir === 0 ? 'D' : 'M'}\t${path}`).join('\n')}` : '';
      }
      case 'log': {
        if (paths.length > 1) return laterLesson;
        const [exclude, include] = paths[0]?.includes('..') ? paths[0].split('..') : [undefined, paths[0]];
        let commits = await repo.log(include || 'HEAD');
        if (!commits.length) throw new Error(`현재 '${await repo.currentBranch()}' 브랜치에 아직 커밋이 없습니다.`);
        if (exclude) { const skip = new Set((await repo.log(exclude)).map(({ oid }) => oid)); commits = commits.filter(({ oid }) => !skip.has(oid)); }
        const limit = Object.keys(options).find((key) => /^-\d+$/.test(key));
        if (limit) commits = commits.slice(0, Number(limit.slice(1)));
        return commits.map(({ oid, commit }) => options['--oneline']
          ? `${options['--graph'] ? '* ' : ''}${oid.slice(0, 7)} ${commit.message.split('\n')[0]}`
          : `commit ${oid}\nAuthor: ${commit.author.name} <${commit.author.email}>\nDate:   ${formatDate(commit.author)}\n\n${commit.message.trimEnd().split('\n').map((line) => `    ${line}`).join('\n')}\n`).join('\n');
      }
      case 'diff': {
        if (paths.length > 1) return laterLesson;
        const staged = options['--staged'] || options['--cached'];
        const rows = (await repo.status()).filter(([path, head, work, stage]) => (!paths.length || path === paths[0]) && (staged ? head !== stage : stage !== 0 && work !== stage));
        if (options['--name-only']) return rows.map(([path]) => path).join('\n');
        const diffs: string[] = [];
        for (const [path, head, work, stage] of rows) {
          const before = staged ? head ? await repo.blobText('HEAD', path) : '' : stage ? await indexText(repo, path) : '';
          const after = staged ? stage ? await indexText(repo, path) : '' : work ? await repo.readFile(path) : '';
          diffs.push(diffText(path, before, after));
        }
        return diffs.join('\n');
      }
      case 'show': {
        if (paths.length > 1) return laterLesson;
        const oid = await repo.resolve(paths[0] ?? 'HEAD');
        const commit = (await git.readCommit({ ...repo.context, oid })).commit;
        const files = await repo.changedFiles(oid);
        const details: string[] = [];
        const beforeFiles = commit.parent[0] ? await repo.treeFiles(commit.parent[0]) : {};
        const afterFiles = await repo.treeFiles(oid);
        for (const path of files) {
          if (options['--stat']) details.push(` ${path}`);
          else details.push(diffText(path, beforeFiles[path] ? await repo.blobText(commit.parent[0], path) : '', afterFiles[path] ? await repo.blobText(oid, path) : ''));
        }
        return `commit ${oid}\n${commit.message}\n${details.join('\n')}\n ${files.length}개 파일 변경`;
      }
      case 'fetch':
      case 'pull':
        if (paths.length > (subcommand === 'fetch' ? 1 : 2) || paths.length && paths[0] !== 'origin') return laterLesson;
        if (subcommand === 'fetch') await repo.fetch(); else await repo.pull(paths[1]);
        return subcommand === 'fetch' ? 'origin의 최신 이력을 가져왔습니다.' : '현재 브랜치를 origin과 동기화했습니다.';
      case 'push':
        if (paths.length > 2 || paths.length && paths[0] !== 'origin') return laterLesson;
        await repo.push(paths[1], { upstream: !!(options['-u'] || options['--set-upstream']), force: !!(options['--force'] || options['-f']), lease: !!options['--force-with-lease'] });
        return 'origin에 반영했습니다.';
      case 'reflog':
        if (paths.length) return laterLesson;
        return (await repo.reflog()).map((entry, index) => `${entry.sha.slice(0, 7)} HEAD@{${index}}: ${entry.reason} · ${entry.message.split('\n')[0]}`).join('\n');
      case 'cherry-pick':
        if (options['--continue'] && options['--abort'] || Object.keys(options).length && paths.length) return laterLesson;
        if (!paths.length && !Object.keys(options).length) throw new Error('복구할 커밋 해시를 입력하세요.');
        await repo.cherryPick(paths, options['--continue'] ? 'continue' : options['--abort'] ? 'abort' : undefined);
        return '커밋을 현재 브랜치 위에 복구했습니다.';
      case 'merge': {
        if (paths.length !== 1) return laterLesson;
        await repo.requireClean();
        const result = await git.merge({ ...repo.context, theirs: await repo.resolve(paths[0]), author: { name: '학습자', email: 'learner@example.invalid' }, noUpdateBranch: true });
        if (result.oid) await repo.resetTo(result.oid, 'hard', `merge: ${paths[0]}`);
        return '병합했습니다.';
      }
      case 'rm':
        if (!options['--cached'] || !paths.length) return laterLesson;
        // Validate every path before touching the index.
        for (const path of paths) { await repo.readFile(path); if (!(await git.listFiles(repo.context)).includes(path)) throw new Error(`추적 중인 파일이 아닙니다: ${path}`); }
        for (const filepath of paths) await git.remove({ ...repo.context, filepath });
        await repo.fs.promises.flush();
        return '';
      case 'check-ignore': {
        if (!paths.length) return laterLesson;
        const state = await readState(repo);
        return paths.filter((path) => state.ignored.includes(path)).map((path) => options['-v'] ? `.gitignore\t${path}` : path).join('\n');
      }
      case 'branch': {
        if (options['--show-current']) return paths.length ? laterLesson : await repo.currentBranch() ?? '';
        if (options['-D'] || options['-d']) {
          if (paths.length !== 1) return laterLesson;
          await repo.deleteBranch(paths[0], !!options['-D']);
          return `브랜치 ${paths[0]} 삭제`;
        }
        if (options['-vv']) {
          if (paths.length) return laterLesson;
          const state = await readState(repo);
          const lines: string[] = [];
          for (const name of state.branches) {
            const up = state.tracking[name];
            const distance = up && state.remote.trackingHeads[up] ? await repo.divergence(name, up) : null;
            lines.push(`${name === state.branch ? '*' : ' '} ${name} ${state.branchHeads[name].slice(0, 7)}${up ? ` [${up}${distance ? `: ahead ${distance.ahead}, behind ${distance.behind}` : ': gone'}]` : ''} ${(await repo.log(name))[0].commit.message.split('\n')[0]}`);
          }
          return lines.join('\n');
        }
        if (paths.length > 2) return laterLesson;
        const branches = await repo.branch(paths[0], paths[1]);
        if (paths.length) return '';
        const current = await repo.currentBranch();
        return branches.map((branch) => `${branch === current ? '*' : ' '} ${branch}`).join('\n');
      }
      case 'switch':
      case 'checkout': {
        const newBranch = options[subcommand === 'switch' ? '-c' : '-b'];
        if (newBranch !== undefined && paths.length) return laterLesson;
        if (newBranch === undefined && paths.length !== 1) throw new Error('이동할 브랜치 이름을 입력하세요.');
        const name = typeof newBranch === 'string' ? newBranch : paths[0];
        if (!name) throw new Error('브랜치 이름을 입력하세요.');
        const previous = await repo.currentBranch();
        await repo.switch(name, newBranch !== undefined);
        return newBranch !== undefined ? `새로 만든 '${name}' 브랜치로 전환합니다` : previous === name ? `이미 '${name}'에 있습니다` : `'${name}' 브랜치로 전환합니다`;
      }
      default: return laterLesson;
    }
  } catch (error) {
    return `오류: ${error instanceof Error ? error.message : String(error)}`;
  }
}
