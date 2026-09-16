export const namespaces = ['index', 'worktree', 'head', 'branch', 'commit', 'reflog', 'remote'] as const;
export type AssertionValue = string | number | boolean;
export type Assertion = Record<string, AssertionValue>;
export interface Hint { when: string; say: string }
export interface LessonStep { say: string; assert: Assertion[]; hints: Hint[] }
export interface Setup {
  commits: { message: string; files: Record<string, string> }[];
  worktree: Record<string, string>;
  branch?: string;
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
