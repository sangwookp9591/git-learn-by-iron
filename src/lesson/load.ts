import { inspectLesson, parseLesson, parseSetup, type LessonEntry } from './catalog.ts';

const lessons = {
  ...import.meta.glob('../fixtures/*.lesson.yaml', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('/content/lessons/*.yaml', { query: '?raw', import: 'default', eager: true }),
};
const setups = {
  ...import.meta.glob('../fixtures/*.setup.yaml', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('/content/fixtures/**/*.{yaml,yml,json}', { query: '?raw', import: 'default', eager: true }),
};

export function loadLessons(): { entries: LessonEntry[]; errors: string[] } {
  const entries: LessonEntry[] = [];
  const errors: string[] = [];
  for (const [source, raw] of Object.entries(lessons).sort(([a], [b]) => a.localeCompare(b))) {
    try {
      const lesson = parseLesson(String(raw));
      if (entries.some((entry) => entry.lesson.id === lesson.id)) throw new Error(`중복 레슨 ID: ${lesson.id}`);
      const setupRaw = typeof lesson.setup === 'string' ? setups[`../fixtures/${lesson.setup}`]
        ?? setups[`/content/${lesson.setup}`] ?? setups[`/content/${lesson.setup}.yaml`] : undefined;
      let setup = null;
      let setupIssue: string | undefined;
      try { setup = typeof lesson.setup === 'object' ? parseSetup(lesson.setup) : setupRaw ? parseSetup(String(setupRaw)) : null; }
      catch { setupIssue = `현재 로더와 다른 초기 저장소 형식: ${String(lesson.setup)}`; }
      entries.push({ lesson, setup, source, support: inspectLesson(lesson, !!setup, setupIssue) });
    } catch (error) {
      errors.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // Keep the original lesson prose intact; share the onboarding's executable examples.
  const onboarding = entries.find(entry => entry.lesson.id === 'onboarding')?.lesson;
  for (const { lesson } of entries) {
    if (lesson.difficulty !== '초급') continue;
    lesson.steps.forEach((step, index) => {
      if (step.solution) return;
      if (lesson.id === 'first-commit-convention' && onboarding) {
        step.solution = structuredClone(onboarding.steps[[2, 3, 4, 6, 5][index]].solution);
      } else {
        const commands = [...step.say.replace(/\\\n\s*/g, ' ').matchAll(/^ {4}(git [^\n]+)/gm)].map(match => match[1].trim());
        if (commands.length) step.solution = { commands };
      }
    });
  }
  entries.sort((a, b) => Number(!!b.setup) - Number(!!a.setup) || ['초급', '중급', '고급'].indexOf(a.lesson.difficulty) - ['초급', '중급', '고급'].indexOf(b.lesson.difficulty) || a.lesson.id.localeCompare(b.lesson.id));
  return { entries, errors };
}
