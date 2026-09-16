import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRepo } from '../engine/repo.ts';
import { readState } from '../engine/state.ts';
import { parse, tokenize } from '../terminal/parse.ts';
import { laterLesson, run } from '../terminal/run.ts';

// LightningFS Web Locks leave a 10-minute timeout in Node 25; test the IDB mutex path.
Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });

// A missing file must never become an HTTP fallback or a remote Git operation.
globalThis.fetch = async () => { throw new Error('Network forbidden in engine tests'); };

const fresh = () => createRepo(crypto.randomUUID());

async function seeded() {
  const repo = await fresh();
  await repo.writeFile('a.txt', 'original a');
  await repo.writeFile('b.txt', 'original b');
  await repo.add('.');
  await repo.commit('첫 커밋');
  return repo;
}

test('required round trip: partial staging, commit, log and two remaining dirty files', async () => {
  const repo = await seeded();
  await repo.writeFile('a.txt', 'changed a with more content');
  await repo.writeFile('b.txt', 'changed b with more content');
  await repo.writeFile('new.txt', 'untracked');
  await repo.add('a.txt');
  const before = await readState(repo);
  assert.deepEqual(before.index, ['a.txt']);
  assert.deepEqual(before.worktree, ['b.txt', 'new.txt']);
  assert.equal(before.branch, 'main');
  assert.equal(before.head?.message, '첫 커밋');
  assert.equal(before.commits.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(before)), before);
  const status = await run(repo, 'git status');
  for (const heading of ['현재 브랜치 main', '커밋할 변경 사항:', '커밋하도록 정하지 않은 변경 사항:', '추적하지 않는 파일:']) assert.ok(status.includes(heading));
  assert.equal(await run(repo, 'git diff --name-only'), 'b.txt');
  const sha = await repo.commit('한 파일만 커밋');
  const after = await readState(repo);
  assert.deepEqual(after.index, []);
  assert.deepEqual(after.worktree, ['b.txt', 'new.txt']);
  assert.equal(after.commits.length, 2);
  assert.equal(after.head?.sha, sha);
  assert.equal(after.head?.message, '한 파일만 커밋');
  assert.match(await run(repo, 'git log --oneline'), /한 파일만 커밋\n[0-9a-f]{7} 첫 커밋/);
});

test('parser preserves quoted messages, escapes, empty values and literal path options', () => {
  assert.deepEqual(parse('git commit -m "메시지 안에 띄어쓰기"'), {
    program: 'git', subcommand: 'commit', options: { '-m': '메시지 안에 띄어쓰기' }, paths: [],
  });
  assert.equal(parse("git commit -m '작은 따옴표 메시지'").options['-m'], '작은 따옴표 메시지');
  assert.deepEqual(tokenize('git add "some file.txt" another\\ file.txt'), ['git', 'add', 'some file.txt', 'another file.txt']);
  assert.deepEqual(parse('git add -- -notes.txt').paths, ['-notes.txt']);
  assert.equal(parse('git commit --message="one two"').options['--message'], 'one two');
  assert.equal(parse('git commit -m ""').options['-m'], '');
  assert.deepEqual(tokenize(`a"b c"d 'literal \\ value'`), ['ab cd', 'literal \\ value']);
  assert.throws(() => parse('git commit -m "unclosed'), /따옴표/);
  assert.throws(() => parse('git commit -m'), /값/);
});

test('initial state, first commit, literal Korean command output and empty commit rejection', async () => {
  const repo = await fresh();
  const empty = await readState(repo);
  assert.equal(empty.head, null);
  assert.equal(empty.branch, 'main');
  assert.deepEqual(empty.commits, []);
  assert.match(await run(repo, 'git log'), /아직 커밋이 없습니다/);
  await repo.writeFile('hello world.txt', 'hello');
  assert.equal(await run(repo, 'git add "hello world.txt"'), '');
  assert.match(await run(repo, 'git commit -m "메시지 안에 띄어쓰기"'), /최상위 커밋.*메시지 안에 띄어쓰기/);
  assert.equal((await readState(repo)).head?.message, '메시지 안에 띄어쓰기');
  assert.match(await run(repo, 'git log'), /Author: 학습자/);
  assert.match(await run(repo, 'git status'), /작업 폴더 깨끗함/);
  assert.match(await run(repo, 'git commit -m ""'), /메시지가 비어/);
  assert.match(await run(repo, 'git commit -m again'), /커밋할 변경 사항이 없습니다/);
  assert.equal((await repo.log()).length, 1);
});

test('a staged file edited again appears in both state sets; unstage keeps file content', async () => {
  const repo = await seeded();
  await repo.writeFile('a.txt', 'staged edit');
  await repo.add('a.txt');
  await repo.writeFile('a.txt', 'later working tree edit');
  assert.deepEqual((await readState(repo)).index, ['a.txt']);
  assert.deepEqual((await readState(repo)).worktree, ['a.txt']);
  assert.equal(await run(repo, 'git restore --staged a.txt'), '');
  assert.deepEqual((await readState(repo)).index, []);
  assert.equal(await repo.readFile('a.txt'), 'later working tree edit');
  await repo.add('.');
  assert.match(await run(repo, 'git reset'), /리셋/);
  assert.deepEqual((await readState(repo)).index, []);
  assert.equal(await repo.readFile('a.txt'), 'later working tree edit');
});

test('unstage works before the first commit; add -A and add . stage deletions and nested files', async () => {
  const empty = await fresh();
  await empty.writeFile('new.txt', 'new');
  await empty.add('.');
  await empty.unstage('.');
  assert.deepEqual((await readState(empty)).index, []);
  assert.deepEqual((await readState(empty)).worktree, ['new.txt']);
  const repo = await seeded();
  await repo.removeFile('a.txt');
  await repo.writeFile('folder/new.txt', 'new');
  assert.equal(await run(repo, 'git add -A'), '');
  assert.deepEqual((await readState(repo)).index, ['a.txt', 'folder/new.txt']);
  assert.deepEqual((await readState(repo)).worktree, []);
  await repo.unstage('.');
  await repo.add('.');
  await repo.commit('delete and add');
  assert.deepEqual((await readState(repo)).worktree, []);
});

test('branch creation preserves staged/dirty state and switching restores committed content', async () => {
  const repo = await seeded();
  await repo.writeFile('a.txt', 'feature content');
  await repo.add('a.txt');
  assert.match(await run(repo, 'git switch -c feature'), /새로 만든 'feature'/);
  assert.deepEqual((await readState(repo)).index, ['a.txt']);
  await repo.commit('feature commit');
  assert.match(await run(repo, 'git switch main'), /'main' 브랜치로/);
  assert.equal(await repo.readFile('a.txt'), 'original a');
  assert.match(await run(repo, 'git checkout feature'), /'feature' 브랜치로/);
  assert.equal(await repo.readFile('a.txt'), 'feature content');
  assert.equal(await run(repo, 'git branch backup'), '');
  assert.match(await run(repo, 'git branch'), /\* feature/);
  assert.match(await run(repo, 'git checkout -b next'), /새로 만든 'next'/);
  await repo.writeFile('a.txt', 'do not overwrite this dirty content');
  assert.match(await run(repo, 'git switch main'), /^오류:/);
  assert.equal(await repo.currentBranch(), 'next');
  assert.equal(await repo.readFile('a.txt'), 'do not overwrite this dirty content');
});

test('isolated lesson repositories reopen without losing progress', async () => {
  const repo = await seeded();
  const other = await fresh();
  assert.equal(await createRepo(repo.lessonId), repo);
  await repo.init();
  assert.equal((await repo.log()).length, 1);
  assert.equal((await readState(other)).head, null);
  await assert.rejects(other.readFile('a.txt'));
});

test('unsupported commands/options cannot mutate state; unsafe paths are rejected', async () => {
  const repo = await seeded();
  await repo.writeFile('a.txt', 'keep my changes');
  const before = await readState(repo);
  for (const cmd of ['git push --mirror', 'git clone https://example.invalid/repo', 'git reset --keep', 'git commit -am shortcut', 'git add -f .', 'git switch -C main', 'git log --oneline=false', 'git cherry-pick -m', 'git toString']) {
    assert.equal(await run(repo, cmd), laterLesson);
    assert.deepEqual(await readState(repo), before);
  }
  for (const path of ['../escape', '/absolute', '.git/config', 'x/../../escape', 'x/.git/HEAD']) {
    await assert.rejects(repo.writeFile(path, 'forbidden'));
    assert.match(await run(repo, `git add "${path}"`), /^오류:/);
  }
  assert.match(await run(repo, 'git add a.txt missing.txt'), /^오류:/);
  assert.deepEqual((await readState(repo)).index, []);
});

test('gitignore is respected and same-length edits are detected', async () => {
  const repo = await seeded();
  await repo.writeFile('a.txt', 'changed aa');
  assert.deepEqual((await readState(repo)).worktree, ['a.txt']);
  await repo.writeFile('.gitignore', 'ignored/\n');
  await repo.writeFile('ignored/private.txt', 'not staged');
  await repo.add('.');
  assert.deepEqual((await readState(repo)).index, ['.gitignore', 'a.txt']);
});


test('unborn switch -c works while branch creation requires a commit', async () => {
  const repo = await fresh();
  assert.match(await run(repo, 'git branch invalid-before-commit'), /^오류:/);
  assert.match(await run(repo, 'git switch -c draft'), /새로 만든 'draft'/);
  assert.equal((await readState(repo)).branch, 'draft');
  await repo.writeFile('file.txt', 'first');
  await repo.add('.');
  await repo.commit('draft commit');
  assert.deepEqual(await repo.branch(), ['draft']);
  assert.match(await run(repo, 'git log'), /Date:   [A-Za-z]{3} [A-Za-z]{3} [0-9]{1,2} [0-9:]{8} [0-9]{4} [+-][0-9]{4}/);
});
