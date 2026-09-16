import type { LessonRepo } from '../engine/repo.ts';
import { readState, type RepoState, type CommitState } from '../engine/state.ts';
import { parse, type ParsedCommand } from './parse.ts';

export const laterLesson = '이 명령은 뒤쪽 레슨에서 다룹니다.';

function formatStatus(state: RepoState): string {
  const lines = [`현재 브랜치 ${state.branch ?? '(HEAD 분리됨)'}`];
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
  status: [], add: ['-A', '--all'], commit: ['-m', '--message'],
  restore: ['--staged'], reset: [], log: ['--oneline'], diff: ['--name-only'],
  branch: [], switch: ['-c'], checkout: ['-b'],
};

/** Return terminal text; callers render it as text, never HTML. Await each command. */
export async function run(repo: LessonRepo, input: string | ParsedCommand): Promise<string> {
  try {
    const command = typeof input === 'string' ? parse(input) : input;
    const { program, subcommand, options, paths } = command;
    if (!program) return '';
    const allowed = Object.hasOwn(supportedOptions, subcommand) ? supportedOptions[subcommand] : undefined;
    if (program !== 'git' || !allowed || Object.keys(options).some((key) => !allowed.includes(key))) return laterLesson;
    for (const [key, value] of Object.entries(options)) {
      if (!['-m', '--message', '-c', '-b'].includes(key) && value !== true) return laterLesson;
    }
    switch (subcommand) {
      case 'status':
        return paths.length ? laterLesson : formatStatus(await readState(repo));
      case 'add':
        if (!paths.length && !options['-A'] && !options['--all']) return '지정한 경로가 없습니다.\n힌트: 모두 추가하려면 "git add ."을 사용하세요.';
        await repo.add(paths.length ? paths : '.');
        return '';
      case 'commit': {
        if (paths.length || (options['-m'] !== undefined && options['--message'] !== undefined)) return laterLesson;
        const message = options['-m'] ?? options['--message'];
        if (typeof message !== 'string') throw new Error('"git commit -m \"메시지\"" 형식으로 입력하세요.');
        const before = await readState(repo);
        const sha = await repo.commit(message);
        return `[${before.branch ?? 'HEAD 분리됨'}${before.head ? '' : ' (최상위 커밋)'} ${sha.slice(0, 7)}] ${message.split('\n')[0]}\n ${before.index.length}개 파일 변경`;
      }
      case 'restore':
        if (!options['--staged']) return laterLesson;
        if (!paths.length) throw new Error('스테이지 해제할 파일 경로를 입력하세요.');
        await repo.unstage(paths);
        return '';
      case 'reset': {
        const targets = paths[0] === 'HEAD' ? paths.slice(1) : paths;
        await repo.reset(targets.length ? targets : '.');
        const changes = (await repo.status()).filter(([, , workdir, stage]) => stage !== 0 && workdir !== stage);
        return changes.length ? `리셋 뒤에 스테이징하지 않은 변경 사항:\n${changes.map(([path, , workdir]) => `${workdir === 0 ? 'D' : 'M'}\t${path}`).join('\n')}` : '';
      }
      case 'log': {
        if (paths.length) return laterLesson;
        const state = await readState(repo);
        if (!state.head) throw new Error(`현재 '${state.branch}' 브랜치에 아직 커밋이 없습니다.`);
        return state.commits.map((commit) => options['--oneline']
          ? `${commit.sha.slice(0, 7)} ${commit.message.split('\n')[0]}`
          : `commit ${commit.sha}\nAuthor: ${commit.author.name} <${commit.author.email}>\nDate:   ${formatDate(commit.author)}\n\n${commit.message.split('\n').map((line) => `    ${line}`).join('\n')}\n`).join('\n');
      }
      case 'diff':
        if (!options['--name-only'] || paths.length) return laterLesson;
        return (await repo.status()).filter(([, , workdir, stage]) => stage !== 0 && workdir !== stage).map(([path]) => path).join('\n');
      case 'branch': {
        if (paths.length > 1) return laterLesson;
        const branches = await repo.branch(paths[0]);
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
