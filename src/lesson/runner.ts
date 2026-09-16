import * as git from 'isomorphic-git';
import { createRepo, type LessonRepo } from '../engine/repo.ts';
import { readState } from '../engine/state.ts';
import { parse, type ParsedCommand } from '../terminal/parse.ts';
import { run, type Editor } from '../terminal/run.ts';
import { evaluateAssertions, type Assessment, type Snapshot } from './assert.ts';
import { evaluateHint } from './hints.ts';
import { inspectLesson, type StepSupport } from './catalog.ts';
import type { Hint, Lesson, Setup } from './schema.ts';

export class LessonRunner {
  readonly lesson: Lesson;
  readonly repo: LessonRepo;
  state: Snapshot;
  baseline: Snapshot;
  currentStep = 0;
  lastActivity = Date.now();
  assessment: Assessment | null = null;
  readonly support: StepSupport[];
  readonly skipped: { step: number; reasons: string[] }[] = [];
  readonly commands: ParsedCommand[] = [];
  lastOutput = '';
  private revealed = new Set<number>();

  constructor(lesson: Lesson, repo: LessonRepo, state: Snapshot, support = inspectLesson(lesson, true)) {
    this.lesson = lesson;
    this.support = support;
    this.repo = repo;
    this.state = state;
    this.baseline = structuredClone(state);
  }

  get complete(): boolean { return this.currentStep >= this.lesson.steps.length; }
  get unsupported(): boolean { return !this.complete && !this.support[this.currentStep].supported; }
  get step() { return this.lesson.steps[this.currentStep]; }

  touch(): void { this.lastActivity = Date.now(); }

  async refresh(): Promise<void> {
    this.state = await readState(this.repo);
    this.assessment = null;
  }

  async execute(command: string, editor?: Editor): Promise<string> {
    this.touch();
    const output = await run(this.repo, command, editor);
    try { this.commands.push(parse(command)); } catch { /* Invalid syntax is not a command. */ }
    this.lastOutput = output;
    await this.refresh();
    return output;
  }

  // These are the exact handlers used by the source-control buttons.
  async stage(path: string): Promise<void> {
    this.touch();
    await this.repo.add(path);
    await this.refresh();
  }

  async unstage(path: string): Promise<void> {
    this.touch();
    await this.repo.unstage(path);
    await this.refresh();
  }

  async commit(message: string): Promise<void> {
    this.touch();
    await this.repo.commit(message);
    await this.refresh();
  }

  async check(): Promise<Assessment> {
    await this.refresh();
    if (this.unsupported || (this.complete && this.skipped.length)) throw new Error('이 레슨은 미리보기입니다. 건너뛴 단계를 통과로 판정하지 않습니다.');
    this.assessment = this.complete ? { passed: true, failures: [] } : evaluateAssertions(this.step.assert, this.state, this.baseline);
    return this.assessment;
  }

  async advance(): Promise<boolean> {
    if (this.complete || this.unsupported || !(await this.check()).passed) return false;
    this.currentStep++;
    this.baseline = structuredClone(this.state);
    this.assessment = null;
    this.revealed.clear();
    this.touch();
    return true;
  }

  skip(): boolean {
    if (!this.unsupported) return false;
    this.skipped.push({ step: this.currentStep + 1, reasons: this.support[this.currentStep].reasons });
    this.currentStep++;
    this.baseline = structuredClone(this.state);
    this.assessment = null;
    this.revealed.clear();
    this.touch();
    return true;
  }

  hints(now = Date.now()): Hint[] {
    if (this.complete) return [];
    const context = { state: this.state, baseline: this.baseline, idleMs: Math.max(0, now - this.lastActivity), commands: this.commands, lastOutput: this.lastOutput };
    this.step.hints.forEach((hint, index) => {
      if (this.lesson.difficulty !== '고급' && evaluateHint(hint.when, context)) this.revealed.add(index);
    });
    return this.step.hints.filter((_, index) => this.revealed.has(index));
  }

  requestHint(): Hint | undefined {
    if (this.complete) return undefined;
    const context = { state: this.state, baseline: this.baseline, idleMs: Infinity, requested: true, commands: this.commands, lastOutput: this.lastOutput };
    const next = this.step.hints.findIndex((hint, index) => !this.revealed.has(index) && evaluateHint(hint.when, context));
    if (next < 0) return undefined;
    this.revealed.add(next);
    return this.step.hints[next];
  }
}

/** Every attempt gets its own local repository; restarting cannot alter another lesson. */
export async function startLesson(lesson: Lesson, setup: Setup | null, support = inspectLesson(lesson, !!setup)): Promise<LessonRunner> {
  const repo = await createRepo(`lesson:${lesson.id}:${crypto.randomUUID()}`);
  if (setup) {
    const commitFiles = async (target: LessonRepo, commit: Setup['commits'][number]) => {
      for (const [path, content] of Object.entries(commit.files)) await target.writeFile(path, content);
      await target.add('.');
      return target.commit(commit.message);
    };
    const subjects = new Map<string, string[]>();
    for (const commit of setup.commits) {
      const oid = await commitFiles(repo, commit);
      const subject = commit.message.split('\n')[0];
      subjects.set(subject, [...subjects.get(subject) ?? [], oid]);
    }
    const head = await repo.headOid();
    if (setup.branch && setup.branch !== 'main') await repo.switch(setup.branch, true);
    if (setup.remote) {
      const remote = await repo.connectOrigin();
      for (const [name, spec] of Object.entries(setup.remote.branches)) {
        const candidates = spec.at && spec.at !== 'head' ? subjects.get(spec.at) : head ? [head] : [];
        if (candidates?.length !== 1) throw new Error(`remote.${name}.at 분기점을 유일하게 찾을 수 없습니다: ${spec.at ?? 'head'}`);
        const base = candidates[0];
        await repo.copyObjectsTo(remote, base);
        await git.writeRef({ ...remote.context, ref: `refs/heads/${name}`, value: base, force: true });
        await remote.checkout(name);
        for (const commit of spec.ahead ?? []) await commitFiles(remote, commit);
        // Local branches remain at the clone point; ahead commits exist only on origin.
        if (name !== await repo.currentBranch()) await git.writeRef({ ...repo.context, ref: `refs/heads/${name}`, value: base, force: true });
        if (spec.tracks) await repo.track(name);
      }
      await repo.fetch();
    }
    if (setup.dangling?.length) {
      if (!head) throw new Error('dangling 커밋에는 기존 히스토리가 필요합니다.');
      // The incident's surviving tip is the colleague's commit; lost work forks before it.
      const parent = (await git.readCommit({ ...repo.context, oid: head })).commit.parent[0];
      await repo.resetTo(parent ?? head, 'hard');
      for (const commit of setup.dangling) {
        const old = await repo.headOid();
        const oid = await commitFiles(repo, commit);
        await repo.recordHead(old, oid, commit.reason);
      }
      await repo.resetTo(head, 'hard', 'pull: Fast-forward');
    }
    for (const [path, content] of Object.entries({ ...setup.working_tree.modified, ...setup.working_tree.untracked })) await repo.writeFile(path, content);
    if (setup.working_tree.staged.length) await repo.add(setup.working_tree.staged);
  }
  return new LessonRunner(lesson, repo, await readState(repo), support);
}
