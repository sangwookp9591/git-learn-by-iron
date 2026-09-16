import type { RepoState } from '../engine/state.ts';
import { namespaces, type Assertion, type AssertionValue } from './schema.ts';

export interface Failure { assertion: string; expected: unknown; actual: unknown }
export interface Assessment { passed: boolean; failures: Failure[] }
export type Snapshot = RepoState;

export const aliases: Record<string, string> = {
  'index.staged': 'index.has', 'index.not_staged': 'index.lacks',
  'worktree.has_changes': 'worktree.dirty', 'head.on': 'branch.current',
  'commit.subject_matches': 'head.message.matches',
};
export const supportedAssertions = new Set([
  'index.has', 'index.lacks', 'index.empty', 'index.has_staged',
  'worktree.dirty', 'worktree.clean', 'head.moved', 'head.message.matches',
  'head.detached', 'branch.current', 'branch.exists', 'branch.absent', 'commit.count',
  'head.ahead', 'head.behind', 'branch.tracks', 'branch.base', 'remote.branch_head', 'reflog.contains',
  'commit.count_on_branch', 'commit.trailer', 'commit.trailer_missing', 'commit.touches', 'commit.not_touches',
  'commit.subject_on_branch', 'commit.subject_missing', 'worktree.contains', 'worktree.file_ignored',
  ...Object.keys(aliases),
]);

/** Read only snapshots. Neither commands nor the UI action that produced them enter this API. */
export function evaluateAssertions(assertions: Assertion[], state: Snapshot, baseline?: Snapshot): Assessment {
  const failures: Failure[] = [];
  for (const assertion of assertions) {
    const entries = Object.entries(assertion);
    if (entries.length !== 1) {
      failures.push({ assertion: 'schema', expected: '단언마다 조건 하나', actual: assertion });
      continue;
    }
    const [sourceKey, expected] = entries[0];
    const key = Object.hasOwn(aliases, sourceKey) ? aliases[sourceKey] : sourceKey;
    let actual: unknown;
    let passed = false;
    if (!namespaces.includes(key.split('.')[0] as typeof namespaces[number]) || !supportedAssertions.has(key)) {
      failures.push({ assertion: sourceKey, expected, actual: '이 상태 조건은 아직 판정할 수 없습니다.' });
      continue;
    }
    switch (key) {
      case 'index.has':
      case 'index.lacks':
        actual = state.index;
        passed = typeof expected === 'string' && (key === 'index.has' ? state.index.includes(expected) : !state.index.includes(expected));
        break;
      case 'index.empty': actual = state.index.length === 0; passed = actual === expected; break;
      case 'index.has_staged': actual = state.index.length > 0; passed = actual === expected; break;
      case 'worktree.dirty':
      case 'worktree.clean': {
        const dirty = [...new Set([...state.index, ...state.worktree])];
        actual = dirty;
        if (typeof expected === 'string') passed = key === 'worktree.dirty' ? dirty.includes(expected) : !dirty.includes(expected);
        else if (typeof expected === 'boolean') {
          actual = key === 'worktree.clean' ? dirty.length === 0 : dirty.length > 0;
          passed = actual === expected;
        }
        break;
      }
      case 'head.moved':
        actual = baseline ? state.head?.sha !== baseline.head?.sha : '비교할 단계 시작 상태가 없습니다.';
        passed = !!baseline && typeof expected === 'boolean' && actual === expected;
        break;
      case 'head.message.matches':
        actual = sourceKey === 'commit.subject_matches' ? state.head?.message.split('\n')[0] ?? null : state.head?.message ?? null;
        if (typeof expected === 'string' && typeof actual === 'string') {
          try { passed = new RegExp(expected, 'u').test(actual); }
          catch { actual = '정규식 형식을 확인하세요.'; }
        }
        break;
      case 'head.detached': actual = state.branch === null; passed = actual === expected; break;
      case 'branch.current': actual = state.branch; passed = actual === expected; break;
      case 'branch.exists':
      case 'branch.absent':
        actual = state.branches ?? '브랜치 목록이 상태에 없습니다.';
        passed = !!state.branches && typeof expected === 'string' && (key === 'branch.exists' ? state.branches.includes(expected) : !state.branches.includes(expected));
        break;
      case 'head.ahead':
      case 'head.behind':
        actual = key === 'head.ahead' ? state.head?.ahead : state.head?.behind;
        passed = typeof actual === 'number' && typeof expected === 'number' && actual === expected;
        break;
      case 'branch.tracks':
        actual = state.branch ? state.tracking?.[state.branch] : null;
        passed = typeof expected === 'string' && actual === expected;
        break;
      case 'branch.base':
        actual = typeof expected === 'string' ? state.branchHeads?.[expected] : undefined;
        passed = typeof actual === 'string' && state.commits.some(({ sha }) => sha === actual);
        break;
      case 'remote.branch_head':
        actual = typeof expected === 'string' ? state.remote?.branches[expected.replace(/^origin\//, '')] : undefined;
        passed = typeof actual === 'string' && !!state.head && actual === state.head.sha;
        break;
      case 'reflog.contains':
        actual = state.reflog;
        passed = typeof expected === 'string' && !!state.reflog?.some((entry) => entry.message.includes(expected) || entry.reason.includes(expected) || entry.sha === expected);
        break;
      case 'commit.count_on_branch':
        actual = state.branchCommits?.length;
        passed = typeof actual === 'number' && typeof expected === 'number' && actual === expected;
        break;
      case 'commit.touches':
      case 'commit.not_touches':
        actual = state.commits[0]?.files;
        passed = typeof expected === 'string' && !!actual && (key === 'commit.touches' ? (actual as string[]).includes(expected) : !(actual as string[]).includes(expected));
        break;
      case 'commit.trailer':
      case 'commit.trailer_missing': {
        actual = state.head?.message.trimEnd().split(/\n\s*\n/).slice(1).at(-1)?.split('\n') ?? [];
        const trailers = (actual as string[]).filter((line) => /^[A-Za-z][A-Za-z-]*: .+/.test(line));
        passed = typeof expected === 'string' && !!state.head && (key === 'commit.trailer'
          ? trailers.includes(expected) : !trailers.some((line) => line.startsWith(`${expected}:`)));
        break;
      }
      case 'commit.subject_on_branch':
      case 'commit.subject_missing': {
        actual = state.commits.map(({ message }) => message.split('\n')[0]);
        const found = typeof expected === 'string' && (actual as string[]).some((subject) => subject.includes(expected));
        passed = typeof expected === 'string' && !!state.head && (key === 'commit.subject_on_branch' ? found : !found);
        break;
      }
      case 'worktree.contains':
      case 'worktree.file_ignored':
        actual = key === 'worktree.contains' ? state.files : state.ignored;
        passed = typeof expected === 'string' && Array.isArray(actual) && actual.includes(expected);
        break;
      case 'commit.count': actual = state.commits.length; passed = typeof expected === 'number' && actual === expected; break;
    }
    if (!passed) failures.push({ assertion: sourceKey, expected, actual });
  }
  if (!assertions.length) failures.push({ assertion: 'schema', expected: '하나 이상의 상태 조건', actual: [] });
  return { passed: failures.length === 0, failures };
}

/** Explain the mismatch with a reversible next action, without labelling the learner wrong. */
export function explainFailure(failure: Failure): string {
  const path = String(failure.expected);
  switch (aliases[failure.assertion] ?? failure.assertion) {
    case 'index.has': return `${path}이(가) 아직 스테이징되지 않았어요. 파일 옆 + 버튼이나 git add로 담아 주세요.`;
    case 'index.lacks': return `${path}이(가) 함께 담겨 있어요. − 버튼이나 git restore --staged로 빼면 파일 내용은 그대로 남아요.`;
    case 'head.moved': return '아직 이 단계에서 새 커밋이 만들어지지 않았어요. 담긴 파일을 확인하고 메시지와 함께 커밋하세요.';
    case 'head.message.matches': return `최근 커밋 메시지가 요청한 형식과 달라요. 현재 메시지: ${String(failure.actual)}. git commit --amend로 메시지를 고칠 수 있어요.`;
    case 'branch.current': return `현재 브랜치는 ${String(failure.actual)}입니다. git switch ${path}로 이동하거나, 아직 없으면 git switch -c ${path}로 만드세요.`;
    case 'branch.exists': return `${path} 브랜치가 아직 없어요. git branch ${path}로 만들 수 있어요.`;
    case 'commit.count': return `현재 커밋은 ${String(failure.actual)}개이고 목표는 ${path}개예요. 그래프를 확인하고 부족한 작업만 커밋하세요. 너무 많이 만들었다면 처음부터 다시 시작할 수 있어요.`;
    case 'worktree.clean': return '아직 커밋하지 않은 변경이 남아 있어요. 소스 컨트롤에서 남은 파일을 확인하고, 지시에 맞게 담거나 커밋하세요.';
    case 'worktree.dirty': return `${typeof failure.expected === 'string' ? path : '작업 파일'}의 변경이 남아 있어야 해요. 이미 커밋했다면 처음부터 다시 시작할 수 있어요.`;
    case 'index.empty': return '스테이징된 파일이 남아 있어요. − 버튼으로 빼면 수정 내용은 보존됩니다.';
    default: return `${failure.assertion} 조건을 확인하세요. 목표: ${String(failure.expected)}, 현재: ${JSON.stringify(failure.actual) ?? '증거 없음'}. git status와 git log로 상태를 확인하세요.`;
  }
}

export function matches(key: string, expected: AssertionValue, state: Snapshot, baseline?: Snapshot): boolean {
  return evaluateAssertions([{ [key]: expected }], state, baseline).passed;
}
