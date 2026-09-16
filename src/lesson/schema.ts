export const namespaces = ['index', 'worktree', 'head', 'branch', 'commit', 'reflog', 'remote'] as const;
export type AssertionValue = string | number | boolean;
export type Assertion = Record<string, AssertionValue>;
export interface Hint { when: string; say: string }
export interface LessonStep { say: string; assert: Assertion[]; hints: Hint[] }
export interface FixtureCommit { message: string; files: Record<string, string> }
export interface Setup {
  commits: FixtureCommit[];
  working_tree: { modified: Record<string, string>; untracked: Record<string, string>; staged: string[] };
  branch?: string;
  remote?: { branches: Record<string, { tracks?: boolean; at?: string; ahead?: FixtureCommit[] }> };
  dangling?: (FixtureCommit & { reason: string })[];
}
export interface Lesson {
  id: string;
  title: string;
  difficulty: '초급' | '중급' | '고급';
  scenario_beat: string;
  setup: string | Setup;
  intro: string;
  steps: LessonStep[];
  recap: string;
}
