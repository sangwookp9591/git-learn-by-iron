import { parse as parseYaml } from 'yaml';
import { supportedAssertions } from './assert.ts';
import type { Lesson, Setup } from './schema.ts';

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function texts(value: unknown): value is Record<string, string> {
  return object(value) && Object.values(value).every((item) => typeof item === 'string');
}

export function parseSetup(raw: string | unknown): Setup {
  const data: unknown = typeof raw === 'string' ? parseYaml(raw) : raw;
  if (!object(data) || !Array.isArray(data.commits) || !texts(data.worktree)
    || (data.branch !== undefined && typeof data.branch !== 'string')
    || data.commits.some((commit) => !object(commit) || typeof commit.message !== 'string' || !texts(commit.files))) {
    throw new Error('초기 저장소의 commits, worktree 형식을 확인하세요.');
  }
  return data as unknown as Setup;
}

export function parseLesson(raw: string): Lesson {
  const data: unknown = parseYaml(raw);
  if (!object(data) || !['id', 'title', 'scenario_beat', 'intro', 'recap'].every((key) => typeof data[key] === 'string' && data[key].trim())
    || !['초급', '중급', '고급'].includes(String(data.difficulty))
    || !(typeof data.setup === 'string' || object(data.setup))
    || !Array.isArray(data.steps) || !data.steps.length) throw new Error('레슨의 필수 정보를 확인하세요.');
  for (const step of data.steps) {
    if (!object(step) || typeof step.say !== 'string' || !Array.isArray(step.assert) || !step.assert.length
      || step.assert.some((assertion) => !object(assertion) || Object.keys(assertion).length !== 1 || !Object.values(assertion).every((value) => ['string', 'number', 'boolean'].includes(typeof value)))
      || !Array.isArray(step.hints) || step.hints.some((hint) => !object(hint) || typeof hint.when !== 'string' || typeof hint.say !== 'string')) {
      throw new Error('단계의 say, assert, hints 형식을 확인하세요.');
    }
  }
  return data as unknown as Lesson;
}

export interface StepSupport { supported: boolean; reasons: string[] }
export interface LessonEntry { lesson: Lesson; setup: Setup | null; source: string; support: StepSupport[] }

/** Capability inspection of authored lessons; learner commands never participate in grading. */
export function inspectLesson(lesson: Lesson, setupAvailable: boolean, setupIssue?: string): StepSupport[] {
  return lesson.steps.map((step) => {
    const reasons: string[] = [];
    if (!setupAvailable) reasons.push(setupIssue ?? `초기 저장소 fixture 없음: ${String(lesson.setup)}`);
    const unknown = step.assert.flatMap((assertion) => Object.keys(assertion)).filter((key) => !supportedAssertions.has(key));
    if (unknown.length) reasons.push(`미지원 상태 조건: ${[...new Set(unknown)].join(', ')}`);
    const commands = [...step.say.matchAll(/^\s*git\s+([^\n]+)/gm)].map((match) => match[1].trim());
    for (const command of commands) {
      if (/^(pull|push|reflog|rebase|cherry-pick|show|rm|check-ignore)\b/.test(command)
        || /^commit\s*$/.test(command) || /^commit\s+--amend/.test(command)
        || /^diff\s+--(staged|cached)/.test(command) || /^add\s+-p/.test(command)
        || /^branch\s+--show-current/.test(command) || /^reset\s+--(soft|mixed|hard)/.test(command)
        || /^log\s+.*\s-\d/.test(command)) reasons.push(`미지원 예제: git ${command}`);
    }
    return { supported: reasons.length === 0, reasons };
  });
}
