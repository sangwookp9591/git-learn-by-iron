async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:4173/');
  const ready = () => page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'false');
  await ready();
  const results = [];
  async function open(id) {
    await page.locator('#lesson-select').selectOption(id);
    await ready();
    if (await page.locator('#app-status').innerText()) throw new Error(await page.locator('#app-status').innerText());
  }
  async function command(text, expectedError = false) {
    const count = await page.locator('#terminal-output pre').count();
    await page.locator('#terminal-input').fill(text);
    await page.locator('#terminal-input').press('Enter');
    await ready();
    const output = (await page.locator('#terminal-output pre').allTextContents()).slice(count + 1).join('\n');
    if (!expectedError && /^(오류:|이 명령은 뒤쪽)/m.test(output)) throw new Error(`${text}: ${output}`);
    if (expectedError && !output.includes('[rejected]')) throw new Error(`Expected rejection: ${output}`);
    return output;
  }
  async function next() {
    await page.locator('#check-button').click(); await ready();
    if (!(await page.locator('#assessment').innerText()).includes('원하는 상태')) throw new Error(await page.locator('#assessment').innerText());
    await page.locator('#check-button').click(); await ready();
  }
  async function complete(id, steps) {
    if (await page.locator('.completion-title').innerText() !== '실습을 마쳤어요') throw new Error(`Not completed: ${id}`);
    if (!(await page.locator('.completion-summary').innerText()).includes(`${steps} / ${steps}`)) throw new Error(`Missing passes: ${id}`);
    const screenshot = `/Users/iron/orca/projects/gitlearn/src/ui/evidence/${id}-completed.png`;
    // Wait for the progress element's 200 ms shadow-pseudo transition before capture.
    await page.waitForTimeout(250);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ id, steps, screenshot, summary: await page.locator('.completion-summary').innerText() });
  }
  const validator = 'src/payment/PaymentValidator.ts';
  const controller = 'src/payment/PaymentController.ts';
  const feature = 'feature/PAY-231-card-expiry';
  await open('first-branch');
  await command('git status'); await next();
  await command('git pull'); await command('git log --oneline -5'); await next();
  await command(`git switch -c ${feature}`); await next();
  await command('git branch --show-current'); await next();
  await complete('first-branch', 4);

  await open('first-commit-convention');
  await command(`git add ${validator} ${controller} src/payment/__tests__/validator.test.ts`); await next();
  const diff = await command('git diff --staged');
  if (!diff.includes('+') || !diff.includes('isExpired')) throw new Error('Staged blob missing');
  await next();
  // Exercise the actual browser commit editor opened by bare git commit.
  await page.locator('#terminal-input').fill('git commit');
  await page.locator('#terminal-input').press('Enter');
  await page.locator('#edit-dialog').waitFor({ state: 'visible' });
  await page.locator('#edit-content').fill('feat(payment): 카드 만료일 검증 추가\n\nRefs: PAY-231');
  await page.locator('#edit-dialog button[value="save"]').click(); await ready(); await next();
  await page.locator('#file-path').fill('.gitignore');
  await page.locator('#file-form button').click();
  await page.locator('#edit-dialog').waitFor({ state: 'visible' });
  const ignore = await page.locator('#edit-content').inputValue();
  await page.locator('#edit-content').fill(ignore + '\n.env.local\n');
  await page.locator('#edit-dialog button[value="save"]').click(); await ready();
  await command('git add .gitignore');
  await command('git commit -m "chore: .gitignore에 .env.local 추가" -m "Refs: PAY-231"'); await next();
  await command('git log --oneline -3'); await command('git show --stat HEAD'); await command('git show --stat HEAD~1'); await next();
  await complete('first-commit-convention', 5);

  await open('split-commits');
  await command('git show --stat HEAD'); await command('git reset --mixed HEAD~1'); await next();
  await page.locator('#terminal-input').fill(`git add -p ${validator}`);
  await page.locator('#terminal-input').press('Enter');
  await page.locator('#edit-dialog').waitFor({ state: 'visible' });
  if (!(await page.locator('#edit-content').inputValue()).includes('isExpired')) throw new Error('Patch editor missing validator');
  await page.locator('#edit-dialog button[value="save"]').click(); await ready();
  await command('git commit -m "feat(payment): 카드 만료일 검증 추가" -m "Refs: PAY-231"'); await next();
  await command('git add -A');
  await command('git commit -m "fix(payment): 만료 카드 요청에 400 반환" -m "Refs: PAY-231"'); await next();
  await command('git push', true);
  await command('git push --force-with-lease'); await next();
  await complete('split-commits', 4);

  await open('force-push-recovery');
  await command('git status'); await command('git log --oneline');
  await command('git branch backup/before-recovery'); await next();
  const reflog = await command('git reflog');
  const lost = reflog.split('\n').filter(line => line.includes('리베이스 전')).map(line => line.match(/^[a-f0-9]{7}/)?.[0]).reverse();
  if (lost.length !== 3 || lost.some(hash => !hash)) throw new Error(`Expected 3 lost commits: ${reflog}`);
  for (const hash of lost) await command(`git show ${hash} --stat`);
  await next();
  // Exercise reset recovery, verify it loses JAY, then restore the backup and recover both sides.
  await command(`git reset --hard ${lost[2]}`);
  await page.locator('#check-button').click(); await ready();
  if (!(await page.locator('#assessment').innerText()).includes('perf(payment)')) throw new Error('Lost-only recovery should fail');
  await command('git reset --hard backup/before-recovery');
  await command(`git cherry-pick ${lost.join(' ')}`);
  const recovered = await command('git log --oneline --graph -10');
  if (!recovered.includes('perf(payment)') || !recovered.includes('게이트웨이 코드 매핑 보정')) throw new Error('Incomplete recovery');
  await next();
  await command('git push --force-with-lease');
  await command('git branch -D backup/before-recovery'); await next();
  await complete('force-push-recovery', 4);
  return { results, lost, errors };
}
