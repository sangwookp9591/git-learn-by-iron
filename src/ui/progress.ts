import { createRepo } from '../engine/repo.ts';
import { readState } from '../engine/state.ts';
import { LessonRunner } from '../lesson/runner.ts';
import type { LessonEntry } from '../lesson/catalog.ts';

export interface Attempt {
  lesson: string; repo: string; step: number; baseline: LessonRunner['baseline'];
  log: { text: string; kind: string }[]; history: string[];
  helped: number[]; assisted: number[]; updated: number; completed?: number;
}
export interface Progress { attempts: Record<string, Attempt>; current?: string }
const key = 'git-learn-progress-v1';
export function readProgress(): Progress {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!data || typeof data.attempts !== 'object' || !data.attempts) return { attempts: {} };
    const attempts: Record<string, Attempt> = {};
    for (const [id, a] of Object.entries(data.attempts) as [string, Attempt][]) {
      if (a && a.lesson === id && typeof a.repo === 'string' && a.repo.startsWith(`lesson:${id}:`)
        && Number.isInteger(a.step) && a.step >= 0 && a.baseline && Array.isArray(a.baseline.commits)
        && Array.isArray(a.log) && a.log.every(x => typeof x.text === 'string' && typeof x.kind === 'string')
        && Array.isArray(a.history) && a.history.every(x => typeof x === 'string')
        && Array.isArray(a.helped) && Array.isArray(a.assisted) && Number.isFinite(a.updated)) attempts[id] = a;
    }
    return { attempts, current: typeof data.current === 'string' ? data.current : undefined };
  } catch { return { attempts: {} }; }
}
export function writeProgress(progress: Progress): boolean {
  try { localStorage.setItem(key, JSON.stringify(progress)); return true; }
  catch { return false; }
}
export async function resumeAttempt(entry: LessonEntry, attempt: Attempt): Promise<LessonRunner> {
  if (attempt.step > entry.lesson.steps.length) throw new Error('저장된 단계가 현재 레슨과 맞지 않습니다.');
  const repo = await createRepo(attempt.repo);
  const state = await readState(repo);
  if (!state.head) throw new Error('저장된 연습 저장소를 찾을 수 없습니다.');
  const runner = new LessonRunner(entry.lesson, repo, state, entry.support);
  runner.currentStep = attempt.step;
  runner.baseline = attempt.baseline;
  return runner;
}
