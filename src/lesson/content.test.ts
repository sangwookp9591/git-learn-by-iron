import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { inspectLesson, parseLesson, parseSetup } from './catalog.ts';
import { startLesson, type LessonRunner } from './runner.ts';
import { evaluateAssertions } from './assert.ts';
import { readState } from '../engine/state.ts';
import { run, laterLesson } from '../terminal/run.ts';
import { LessonRepo } from '../engine/repo.ts';

Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
globalThis.fetch = async () => { throw new Error('Network forbidden'); };

async function content(id: string) {
  const lesson = parseLesson(await readFile(new URL(`../../content/lessons/${id}.yaml`, import.meta.url), 'utf8'));
  const setup = parseSetup(await readFile(new URL(`../../content/${lesson.setup}.yaml`, import.meta.url), 'utf8'));
  assert.ok(inspectLesson(lesson, true).every((step) => step.supported));
  return startLesson(lesson, setup);
}
async function command(runner: LessonRunner, input: string) {
  const text = await runner.execute(input);
  assert.ok(!text.startsWith('오류:') && text !== laterLesson, `${input}: ${text}`);
  return text;
}
async function advance(runner: LessonRunner) {
  assert.deepEqual(await runner.check(), { passed: true, failures: [] }, `step ${runner.currentStep + 1}`);
  assert.equal(await runner.advance(), true);
}

const feature = 'feature/PAY-231-card-expiry';
const hotfix = 'hotfix/PAY-247-expiry-zero-based';
const validator = 'src/payment/PaymentValidator.ts';
const controller = 'src/payment/PaymentController.ts';

test('content first-branch completes all four steps with real origin ahead commits', async () => {
  const runner = await content('first-branch');
  assert.equal(runner.state.head?.behind, 2);
  assert.match(await command(runner, 'git status'), /behind 2/);
  assert.match(await command(runner, 'git branch -vv'), /origin\/main/);
  assert.match(await command(runner, 'git log origin/main'), /중복 승인/);
  await advance(runner);
  const before = runner.state.head?.sha;
  await command(runner, 'git fetch');
  assert.equal(runner.state.head?.sha, before);
  await command(runner, 'git pull');
  await advance(runner);
  await command(runner, `git switch -c ${feature}`);
  await advance(runner);
  assert.equal(await command(runner, 'git branch --show-current'), feature);
  await advance(runner);
  assert.equal(runner.complete, true);
  assert.deepEqual(runner.skipped, []);
  assert.equal(evaluateAssertions([{ 'head.behind': 0 }], runner.state).passed, false, 'untracked branch is not implicitly synchronized');
});

test('content first-commit-convention completes five steps using selective index, trailers and ignore', async () => {
  const runner = await content('first-commit-convention');
  await command(runner, `git add ${validator} ${controller} src/payment/__tests__/validator.test.ts`);
  await advance(runner);
  assert.match(await command(runner, 'git diff --staged'), /isExpired/);
  await advance(runner);
  await command(runner, 'git commit -m "fix(payment): 임시 제목" -m "Refs: PAY-231"');
  assert.equal((await runner.check()).passed, false);
  await command(runner, 'git commit --amend -m "feat(payment): 카드 만료일 검증 추가" -m "Refs: PAY-231"');
  await advance(runner);
  await runner.repo.writeFile('.gitignore', (await runner.repo.readFile('.gitignore')) + '\n.env.local\n');
  await command(runner, 'git add .gitignore');
  await command(runner, 'git commit -m "chore: .gitignore에 .env.local 추가" -m "Refs: PAY-231"');
  await advance(runner);
  assert.match(await command(runner, 'git show --stat HEAD~1'), /PaymentValidator/);
  assert.match(await command(runner, 'git log --oneline -3'), /feat\(payment\)/);
  await advance(runner);
  assert.equal(runner.complete, true);
  assert.deepEqual(runner.state.branchCommits?.length, 2);
});

test('content split-commits completes four steps, rejects normal push and accepts lease', async () => {
  const runner = await content('split-commits');
  await command(runner, 'git reset --mixed HEAD~1');
  await advance(runner);
  const working = await runner.repo.readFile(validator);
  await runner.repo.stageContent(validator, working);
  assert.equal(await runner.repo.readFile(validator), working);
  await command(runner, 'git commit -m "feat(payment): 카드 만료일 검증 추가" -m "Refs: PAY-231"');
  await advance(runner);
  await command(runner, 'git add -A');
  await command(runner, 'git commit -m "fix(payment): 만료 카드 요청에 400 반환" -m "Refs: PAY-231"');
  await advance(runner);
  assert.match(await runner.execute('git push'), /non-fast-forward/);
  assert.equal((await runner.check()).passed, false);
  await command(runner, 'git push --force-with-lease');
  await advance(runner);
  assert.equal(runner.complete, true);
  assert.equal(runner.state.remote.branches[feature], runner.state.head?.sha);
});

test('content recovery finds three reflog commits, restores each and preserves colleague commit', async () => {
  const runner = await content('force-push-recovery');
  const original = runner.state.head!.sha;
  assert.equal(runner.state.commits.some(({ message }) => message.startsWith('refactor(payment)')), false);
  await command(runner, 'git branch backup/before-recovery');
  await advance(runner);
  const reflog = await command(runner, 'git reflog');
  assert.match(reflog, /강제 푸시로 브랜치에서 떨어져 나감/);
  const lost = runner.state.reflog.filter(({ reason }) => reason.startsWith('리베이스 전')).reverse();
  assert.equal(lost.length, 3);
  for (const commit of lost) assert.match(await command(runner, `git show ${commit.sha.slice(0, 7)} --stat`), /src\/payment/);
  await advance(runner);
  // Both advertised recovery entry points resolve a hash that is not on any branch.
  await command(runner, `git branch recovered ${lost[2].sha.slice(0, 7)}`);
  await command(runner, `git reset --hard ${lost[2].sha.slice(0, 7)}`);
  assert.equal((await runner.check()).passed, false, 'lost-only history must fail');
  await command(runner, 'git reset --hard backup/before-recovery');
  await command(runner, `git cherry-pick ${lost.map(({ sha }) => sha.slice(0, 7)).join(' ')}`);
  assert.ok(runner.state.commits.some(({ sha }) => sha === original));
  assert.match(await runner.repo.readFile('src/payment/ExpiryMonth.ts'), /ZERO_BASED_GATEWAYS/);
  assert.match(await runner.repo.readFile('src/payment/PaymentHistoryRepository.ts'), /PaymentHistoryRepository/);
  await advance(runner);
  await command(runner, 'git push --force-with-lease');
  await command(runner, 'git branch -D backup/before-recovery');
  await advance(runner);
  assert.equal(runner.complete, true);
  assert.equal(runner.state.remote.branches[hotfix], runner.state.head?.sha);
  assert.deepEqual(runner.skipped, []);
});

test('lease compares live origin to last fetch and fetch does not overwrite local work', async () => {
  const runner = await content('split-commits');
  const remote = (await runner.repo.origin())!;
  await remote.checkout(feature);
  await remote.writeFile('colleague.txt', 'do not lose this');
  await remote.add('.');
  const colleague = await remote.commit('feat: 동료 변경');
  await runner.repo.writeFile('local.txt', 'local');
  await runner.repo.add('local.txt');
  await runner.repo.commit('feat: 로컬 변경');
  const local = await readState(runner.repo);
  assert.match(await run(runner.repo, 'git push --force-with-lease'), /stale info/);
  assert.deepEqual(await readState(runner.repo), local);
  assert.equal(await remote.resolve(feature), colleague);
  await command(runner, 'git fetch');
  assert.equal(runner.state.head?.sha, local.head?.sha);
  assert.equal(runner.state.head?.ahead, 1);
  assert.equal(runner.state.head?.behind, 1);
  await runner.repo.writeFile(validator, 'uncommitted work');
  const dirty = await readState(runner.repo);
  assert.match(await run(runner.repo, 'git pull'), /먼저 커밋/);
  assert.deepEqual(await readState(runner.repo), dirty);
  await command(runner, 'git push --force-with-lease');
  assert.equal(await remote.resolve(feature), local.head?.sha);
  await remote.writeFile('colleague.txt', 'new remote change');
  await remote.add('.');
  await remote.commit('feat: 새 동료 변경');
  await command(runner, 'git push --force');
  assert.equal(await remote.resolve(feature), local.head?.sha);
  const reopened = new LessonRepo(runner.repo.lessonId);
  await reopened.init();
  assert.equal((await readState(reopened)).remote.branches[feature], local.head?.sha);
});

test('push -u, partial staging, amend and reset modes preserve the appropriate trees', async () => {
  const runner = await content('first-branch');
  await command(runner, 'git switch -c feature/check');
  await command(runner, 'git push -u origin feature/check');
  assert.equal(runner.state.tracking['feature/check'], 'origin/feature/check');
  await command(runner, 'git switch main');
  await command(runner, 'git push -u origin feature/check');
  assert.equal(runner.state.tracking.main, 'origin/main');
  assert.match(await runner.execute('git push origin nonexistent'), /로컬 브랜치가 없습니다/);
  await command(runner, 'git switch feature/check');
  await runner.repo.writeFile('partial.txt', 'first\nsecond\n');
  await runner.repo.stageContent('partial.txt', 'first\n');
  await command(runner, 'git commit -m "feat: 부분 변경"');
  const first = runner.state.head!.sha;
  assert.equal(await runner.repo.blobText('HEAD', 'partial.txt'), 'first\n');
  assert.equal(await runner.repo.readFile('partial.txt'), 'first\nsecond\n');
  await command(runner, 'git add partial.txt');
  await command(runner, 'git commit --amend -m "feat: 전체 변경"');
  assert.notEqual(runner.state.head!.sha, first);
  assert.equal(runner.state.commits.length, 4);
  await command(runner, 'git reset --soft HEAD~1');
  assert.deepEqual(runner.state.index, ['partial.txt']);
  await command(runner, 'git reset');
  assert.deepEqual(runner.state.index, []);
  assert.deepEqual(runner.state.worktree, ['partial.txt']);
  const recovered = runner.state.reflog.find(({ reason }) => reason.startsWith('commit (amend)'))!.sha;
  await command(runner, `git reset --hard ${recovered}`);
  assert.equal(await runner.repo.readFile('partial.txt'), 'first\nsecond\n');
  const before = await readState(runner.repo);
  assert.match(await run(runner.repo, 'git reset --hard deadbeef'), /^오류:/);
  assert.deepEqual(await readState(runner.repo), before);
  await assert.rejects(runner.repo.stageContent('../escape', 'bad'));
  assert.deepEqual(await readState(runner.repo), before);
});

test('unified fixture schema rejects the legacy shape and malformed remote/dangling values', () => {
  assert.throws(() => parseSetup({ commits: [], worktree: {} }), /working_tree/);
  const base = { commits: [], working_tree: { modified: {}, untracked: {}, staged: [] } };
  assert.throws(() => parseSetup({ ...base, remote: { branches: { main: { ahead: 2 } } } }), /remote/);
  assert.throws(() => parseSetup({ ...base, dangling: [{ message: 'lost', files: {} }] }), /dangling/);
});

test('merge recovery is also accepted; grading does not require cherry-pick', async () => {
  const runner = await content('force-push-recovery');
  await command(runner, 'git branch backup/before-recovery'); await advance(runner); await advance(runner);
  const lost = runner.state.reflog.find(({ reason }) => reason.includes('마지막 커밋'))!;
  await command(runner, `git branch recovered ${lost.sha}`);
  await command(runner, 'git merge recovered');
  await advance(runner);
  assert.equal(runner.state.commits[0].parents.length, 2);
});

test('cherry-pick conflict can be resolved and continued, or aborted without losing the starting tree', async () => {
  const runner = await content('first-branch');
  await runner.repo.writeFile('conflict.txt', 'base\n'); await runner.repo.add('.'); await runner.repo.commit('base');
  await command(runner, 'git switch -c side');
  await runner.repo.writeFile('conflict.txt', 'side\n'); await runner.repo.add('.');
  const side = await runner.repo.commit('side change');
  await command(runner, 'git switch main');
  await runner.repo.writeFile('conflict.txt', 'main\n'); await runner.repo.add('.'); await runner.repo.commit('main change');
  const start = (await readState(runner.repo)).head!.sha;
  assert.match(await runner.execute(`git cherry-pick ${side}`), /cherry-pick 충돌/);
  assert.match(await runner.repo.readFile('conflict.txt'), /<<<<<<< HEAD/);
  await command(runner, 'git cherry-pick --abort');
  assert.equal(runner.state.head!.sha, start);
  assert.equal(await runner.repo.readFile('conflict.txt'), 'main\n');
  assert.match(await runner.execute(`git cherry-pick ${side}`), /cherry-pick 충돌/);
  await runner.repo.writeFile('conflict.txt', 'main and side\n'); await runner.repo.add('conflict.txt');
  await command(runner, 'git cherry-pick --continue');
  assert.equal(await runner.repo.readFile('conflict.txt'), 'main and side\n');
  assert.deepEqual(runner.state.worktree, []);
  assert.equal(runner.state.head!.message, 'side change');
});

test('runner command hints cannot affect the readState grading contract', async () => {
  const runner = await content('split-commits');
  const before = await readState(runner.repo);
  await runner.execute('git push --force');
  const hints = runner.lesson.steps.at(-1)!.hints;
  const force = hints.find(({ when }) => when.includes('command_used'))!;
  const { evaluateHint } = await import('./hints.ts');
  assert.equal(evaluateHint(force.when, { state: runner.state, idleMs: 0, commands: runner.commands }), true);
  assert.equal(evaluateHint(force.when, { state: runner.state, idleMs: 0 }), false);
  assert.deepEqual(await readState(runner.repo), before, 'a no-op force push leaves all grading evidence unchanged');
  assert.equal('commands' in runner.state, false);
  assert.equal('lastOutput' in runner.state, false);
});


test('authored Korean prose is byte-for-byte preserved and every content assertion is canonical', async () => {
  const hashes: Record<string, string> = {
    'first-branch': 'aa3e0a747e322288fb2d8043addef355f63bb7b2810bb25ed94a17f72d77f9da',
    'first-commit-convention': 'd9e8f298dea79855f1de2a5ea248ecbba4636a589421423a09bd27da0a58ca90',
    'force-push-recovery': '617741bd11772699315d2850a430d9f6d58aeb37ff0ec402822b6349451ee1bf',
    'split-commits': 'a8adc97e0f91c77b4032f69d7d284482973f77767b79a82ee40acb60fe9693d5',
  };
  const { aliases } = await import('./assert.ts');
  let steps = 0;
  for (const [id, hash] of Object.entries(hashes)) {
    const lesson = parseLesson(await readFile(new URL(`../../content/lessons/${id}.yaml`, import.meta.url), 'utf8'));
    const prose = JSON.stringify({ intro: lesson.intro, recap: lesson.recap, steps: lesson.steps.map(s => ({ say: s.say, hints: s.hints.map(h => h.say) })) });
    assert.equal(createHash('sha256').update(prose).digest('hex'), hash, id);
    for (const step of lesson.steps) for (const assertion of step.assert) assert.equal(Object.hasOwn(aliases, Object.keys(assertion)[0]), false);
    steps += lesson.steps.length;
  }
  assert.equal(steps, 17);
  const { evaluateHint } = await import('./hints.ts');
  const runner = await content('first-commit-convention');
  await runner.repo.writeFile('extra.txt', 'example'); await runner.repo.add('extra.txt');
  await runner.repo.commit('feat(payment): 마침표.\n\nRefs: PAY-231');
  await runner.refresh();
  const periodHint = runner.lesson.steps[2].hints.find(({ say }) => say.includes('제목 끝에 마침표'))!;
  assert.equal(evaluateHint(periodHint.when, { state: runner.state, idleMs: 0 }), true);
  const unknown = { ...runner.lesson, steps: [{ ...runner.lesson.steps[0], say: '    git rebase main' }] };
  assert.equal(inspectLesson(unknown, true)[0].supported, false);

});
