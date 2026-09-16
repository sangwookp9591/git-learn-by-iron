import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { evaluateAssertions } from './assert.ts';
import { evaluateHint } from './hints.ts';
import { inspectLesson, parseLesson, parseSetup } from './catalog.ts';
import type { Assertion } from './schema.ts';
import { startLesson } from './runner.ts';

Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
const lesson = parseLesson(await readFile(new URL('../fixtures/staging-basics.lesson.yaml', import.meta.url), 'utf8'));
const setup = parseSetup(await readFile(new URL('../fixtures/staging-basics.setup.yaml', import.meta.url), 'utf8'));

test('index.has and index.lacks accept only login.js staging, not add .', async () => {
  const runner = await startLesson(lesson, setup);
  assert.equal((await runner.check()).passed, false);
  await runner.execute('git add .');
  const incorrect = await runner.check();
  assert.equal(incorrect.passed, false);
  assert.deepEqual(incorrect.failures.filter((failure) => failure.assertion === 'index.lacks').map((failure) => failure.expected), ['README.md', 'notes.txt']);
  await runner.unstage('README.md');
  await runner.unstage('notes.txt');
  assert.equal((await runner.check()).passed, true);
});

test('terminal git add and the actual UI staging handler receive identical assessments', async () => {
  const terminal = await startLesson(lesson, setup);
  const panel = await startLesson(lesson, setup);
  await terminal.execute('git add login.js');
  await panel.stage('login.js');
  assert.deepEqual(await terminal.check(), await panel.check());
  assert.deepEqual(await panel.check(), { passed: true, failures: [] });
  assert.deepEqual(terminal.state.index, panel.state.index);
});

test('head.moved detects a commit against the step snapshot, never a command string', async () => {
  const runner = await startLesson(lesson, setup);
  const before = structuredClone(runner.state);
  assert.equal(evaluateAssertions([{ 'head.moved': true }], before, before).passed, false);
  await runner.execute('git status');
  assert.equal(evaluateAssertions([{ 'head.moved': true }], runner.state, before).passed, false);
  await runner.stage('login.js');
  await runner.commit('fix: 빈 이름 로그인 방지');
  assert.equal(evaluateAssertions([{ 'head.moved': true }], runner.state, before).passed, true);
  assert.equal(evaluateAssertions([{ 'head.moved': true }], runner.state).passed, false);
});

test('runner preserves per-step baselines, rejects premature advance, and completes the fixture', async () => {
  const runner = await startLesson(lesson, setup);
  assert.equal(await runner.advance(), false);
  await runner.stage('login.js');
  assert.equal(await runner.advance(), true);
  assert.equal(runner.currentStep, 1);
  assert.equal((await runner.check()).passed, false);
  await runner.commit('fix: 빈 이름 로그인 방지');
  assert.equal(await runner.advance(), true);
  assert.equal(await runner.advance(), true);
  assert.equal(runner.complete, true);
  assert.equal(runner.skipped.length, 0);
  assert.deepEqual(runner.state.worktree, ['README.md', 'notes.txt']);
  assert.equal(runner.state.commits.length, 2);
});

test('snapshots include other branches and assertions fail closed for missing or invalid evidence', async () => {
  const runner = await startLesson(lesson, setup);
  await runner.execute('git branch feature');
  assert.equal(evaluateAssertions([{ 'branch.exists': 'feature' }, { 'branch.current': 'main' }], runner.state).passed, true);
  assert.equal(evaluateAssertions([{ 'commit.count': 1 }], runner.state).passed, true);
  const invalid: Assertion[] = [{ 'head.message.matches': '[' }, { 'remote.synced': true }, { 'reflog.contains': 'no evidence' }, { 'shell.executed': true }, { 'toString': true }];
  for (const assertion of invalid) {
    const result = evaluateAssertions([assertion], runner.state);
    assert.equal(result.passed, false);
    assert.equal(result.failures.length, 1);
  }
  assert.equal(evaluateAssertions([], runner.state).passed, false);
});

test('hints support state calls, quoted paths, comparisons, grouping and idle thresholds safely', async () => {
  const runner = await startLesson(lesson, setup);
  await runner.stage('README.md');
  const context = { state: runner.state, baseline: runner.baseline, idleMs: 44_999 };
  assert.equal(evaluateHint('index.has(README.md)', context), true);
  assert.equal(evaluateHint('index.has("README.md") && !index.has(login.js)', context), true);
  assert.equal(evaluateHint('(index.has(README.md) || index.has(login.js)) && branch.current == "main"', context), true);
  assert.equal(evaluateHint('idle(45s)', context), false);
  assert.equal(evaluateHint('idle(45s)', { ...context, idleMs: 45_000 }), true);
  assert.equal(evaluateHint('idle > 20s', context), true);
  assert.equal(evaluateHint('commit.count == 1', context), true);
  assert.equal(evaluateHint('!remote.fake(thing)', context), false);
  assert.equal(evaluateHint('globalThis.injected = true', context), false);
  assert.equal(evaluateHint('index.has("unclosed)', context), false);
  const freshRunner = await startLesson(lesson, setup);
  assert.equal(freshRunner.hints(freshRunner.lastActivity + 44_999).length, 0);
  assert.equal(freshRunner.hints(freshRunner.lastActivity + 45_000).length, 1);
  const requested = await startLesson(lesson, setup);
  assert.equal(requested.requestHint()?.when, 'idle(45s)');
  const advanced = await startLesson({ ...lesson, difficulty: '고급' }, setup);
  assert.equal(advanced.hints(advanced.lastActivity + 99_000).length, 0);
  assert.equal(advanced.requestHint()?.when, 'idle(45s)');
});

test('unavailable content steps are skipped as unsupported and never awarded a pass', async () => {
  const runner = await startLesson(lesson, null);
  assert.equal(runner.unsupported, true);
  assert.equal(await runner.advance(), false);
  await assert.rejects(runner.check(), /미리보기/);
  while (!runner.complete) assert.equal(runner.skip(), true);
  assert.equal(runner.skipped.length, lesson.steps.length);
  await assert.rejects(runner.check(), /미리보기/);
  assert.equal(runner.state.commits.length, 0);
  assert.equal(inspectLesson(lesson, true).every((step) => step.supported), true);
});


test('a passed check is invalidated if a later action changes the state', async () => {
  const runner = await startLesson(lesson, setup);
  await runner.stage('login.js');
  assert.equal((await runner.check()).passed, true);
  await runner.stage('README.md');
  assert.equal(runner.assessment, null);
  assert.equal(await runner.advance(), false);
  assert.equal(runner.currentStep, 0);
});
