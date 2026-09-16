import { readProgress, writeProgress, resumeAttempt, type Attempt } from './progress.ts';
import { loadLessons } from '../lesson/load.ts';
import { evaluateHint } from '../lesson/hints.ts';
import { explainFailure } from '../lesson/assert.ts';
import { startLesson, type LessonRunner } from '../lesson/runner.ts';
import type { LessonEntry } from '../lesson/catalog.ts';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';
import './style.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function prose(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const block of text.trimEnd().split(/\n\s*\n/)) {
    if (/^\s{4}\S/.test(block)) {
      const pre = el('pre', 'instruction-code');
      pre.append(el('code', '', block.replace(/^ {4}/gm, '')));
      fragment.append(pre);
    } else {
      const p = el('p');
      block.trim().split('`').forEach((part, index) => p.append(index % 2 ? el('code', 'inline-code', part) : document.createTextNode(part)));
      fragment.append(p);
    }
  }
  return fragment;
}

// Suggestions are display-only; grading still receives only repository snapshots.
function suggestCommand(command: string): string | undefined {
  const words = command.trim().split(/\s+/);
  if (words[0] !== 'git' || !words[1] || words[1].length > 32) return;
  const names = 'status add commit restore reset log diff show branch switch checkout fetch pull push reflog cherry-pick merge rm check-ignore'.split(' ');
  if (names.includes(words[1])) return;
  const distance = (target: string) => {
    let row = Array.from({ length: target.length + 1 }, (_, i) => i);
    for (const [i, char] of [...words[1]].entries()) {
      const next = [i + 1];
      for (let j = 0; j < target.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(char !== target[j])));
      row = next;
    }
    return row[target.length];
  };
  const ranked = names.map(name => ({name, distance: distance(name)})).sort((a,b) => a.distance - b.distance);
  if (ranked[0].distance <= 2 && ranked[0].distance < ranked[1].distance) return `git ${ranked[0].name}`;
}

export function mountApp(root: HTMLElement): void {
  // Static shell only; lesson content, file names and terminal output use text nodes.
  root.innerHTML = `
    <a class="skip-link" href="#lesson-instructions">실습 지시로 바로가기</a>
    <header class="topbar">
      <a class="brand" href="#" aria-label="Git Learn 홈"><span class="brand-mark" aria-hidden="true">⑂</span><span>git<span class="brand-light">learn</span><small>BY IRON</small></span></a>
      <div class="header-caption">읽는 것에서, 해보는 것으로.</div>
      <div class="header-tools"><button id="catalog-button" class="button button--quiet">전체 목록</button><button id="login-button" class="button button--quiet">로그인</button><label class="sr-only" for="lesson-select">레슨 선택</label><select id="lesson-select" class="input"></select><button id="theme-toggle" class="button button--secondary button--icon" aria-label="다크 모드로 전환">◐</button></div>
    </header>
    <div id="app-status" class="app-status" role="status" aria-live="polite">실습 저장소를 준비하고 있어요…</div>
    <section id="home-screen" class="home-screen">
      <div id="landing-copy" class="landing-copy"><p class="eyebrow">GIT LEARN / 첫 번째 실습</p><h1>브라우저에서 진짜 Git을 칩니다.</h1><p>달로 결제팀에 입사한 첫 주부터, 밤에 장애가 나는 날까지.</p><button id="start-button" class="button button--primary">바로 시작하기</button><small>Enter를 눌러도 시작합니다. 설치나 가입은 필요 없습니다.</small></div>
      <div id="returning-copy" hidden></div>
    </section>
    <section id="catalog-screen" class="screen" hidden tabindex="-1"></section>
    <section id="completion-screen" class="screen" hidden tabindex="-1"></section>
    <section id="account-screen" class="screen" hidden tabindex="-1"><h1 id="account-title">계정 만들고 진도 저장하기</h1><p>계정 서비스는 아직 연결되지 않았습니다. 현재 진도는 이 브라우저에서만 이어갈 수 있습니다.</p><form id="account-form" class="account-form"><label for="account-email">이메일</label><input id="account-email" class="input" type="email" autocomplete="email" required><button class="button button--primary">연결 상태 확인</button></form><p id="account-status" role="status"></p><button id="account-back" class="button button--secondary">학습으로 돌아가기</button></section>
    <main class="workspace">
      <aside class="panel lesson-pane" aria-label="레슨 지시">
        <div class="lesson-eyebrow"><span id="difficulty" class="badge badge--accent"></span><span>HANDS-ON LAB</span></div>
        <h1 id="lesson-title"></h1><p id="scenario" class="scenario"></p>
        <div class="progress-label"><span id="progress-label"></span><span id="progress-percent"></span></div>
        <progress class="progress" id="lesson-progress" value="0" max="3" aria-label="레슨 진행률"></progress>
        <div id="lesson-intro" class="intro"></div>
        <section id="lesson-instructions" tabindex="-1"><div id="step-heading" class="step-heading"></div><div id="instructions" class="instruction-prose"></div></section>
        <div id="assessment" class="assessment" role="status" aria-live="polite"></div>
        <div id="hints" class="hints" aria-live="polite"></div>
        <div class="lesson-actions"><button id="hint-button" class="button button--quiet">힌트 보기</button><button id="check-button" class="button button--primary">상태 확인 <span aria-hidden="true">→</span></button></div>
        <div class="lesson-footer"><button id="leave-button" class="button button--quiet">나가기</button><button id="restart-button" class="button button--quiet text-button">처음부터</button></div>
      </aside>
      <div class="workbench">
        <section class="panel source-panel" aria-labelledby="source-title"><header class="panel__header"><h2 id="source-title" class="panel__title"><span aria-hidden="true">⑂</span> 소스 컨트롤</h2><span id="source-branch" class="chip branch-label"></span></header>
          <div class="panel__body source-content"><p class="field__hint panel-caption">이번 커밋에 담을 변경을 골라 보세요.</p><form id="file-form"><label class="field__label" for="file-path">파일 편집</label><input class="input" id="file-path" value=".gitignore" aria-label="편집할 파일 경로"><button class="button button--secondary" type="submit">열기</button></form><div id="staged-list"></div><div id="worktree-list"></div></div>
          <form id="commit-form" class="commit-form"><label class="sr-only" for="commit-message">커밋 메시지</label><textarea class="input" id="commit-message" placeholder="커밋 메시지를 입력하세요" rows="3" maxlength="4000"></textarea><button id="commit-button" class="button button--primary commit-button" type="submit">✓ 커밋하기</button></form>
        </section>
        <section class="panel graph-panel" aria-labelledby="graph-title"><header class="panel__header"><h2 id="graph-title" class="panel__title"><span aria-hidden="true">⌘</span> 커밋 그래프</h2><span id="commit-count" class="chip"></span></header><div class="panel__body graph-content"><div id="head-label" class="chip head-label"></div><ol id="commit-graph" class="commit-graph"></ol><div class="graph-note"><span class="graph-dot"></span> 한 점이 하나의 커밋이에요.</div></div></section>
        <section class="panel panel--terminal terminal-panel" aria-labelledby="terminal-title"><header class="panel__header"><h2 id="terminal-title" class="panel__title"><span aria-hidden="true">›_</span> 터미널</h2><span class="terminal-local"><span></span> 로컬 실습</span><button id="clear-terminal" class="button button--quiet terminal-clear" aria-label="터미널 출력 지우기">지우기</button></header><div id="terminal-output" class="terminal-output" role="log" aria-live="polite" aria-relevant="additions"></div><form id="terminal-form" class="terminal-form"><span class="terminal-output__prompt prompt" aria-hidden="true">❯</span><label class="sr-only" for="terminal-input">Git 명령어</label><input id="terminal-input" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="git status" aria-describedby="terminal-help"><button type="submit" class="button button--secondary button--icon terminal-submit" aria-label="명령어 실행">↵</button></form><div id="terminal-help" class="terminal-help"><span>Enter로 실행 · 지우고 다른 명령을 쳐도 됩니다</span><span>↑ ↓ 이전 명령</span></div></section>
      </div>
    </main>
    <footer class="page-footer"><span>YOUR REPO. YOUR PACE.</span><span>버튼도, 명령어도. 같은 Git을 배웁니다.</span><span>진도는 이 브라우저에 저장됩니다.</span></footer>
    <dialog id="file-dialog"><form method="dialog"><h2 id="file-dialog-title"></h2><button class="button button--secondary button--icon" aria-label="파일 닫기">×</button></form><pre id="file-content"></pre></dialog>
    <dialog id="edit-dialog" aria-labelledby="edit-title"><form method="dialog"><h2 id="edit-title"></h2><label for="edit-content">내용</label><textarea class="input" id="edit-content" rows="18" cols="80" spellcheck="false"></textarea><div><button class="button button--secondary" value="cancel">취소</button><button class="button button--primary" value="save">저장</button></div></form></dialog>`;

  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const catalog = loadLessons();
  const select = get<HTMLSelectElement>('lesson-select');
  const commandInput = get<HTMLInputElement>('terminal-input');
  const messageInput = get<HTMLTextAreaElement>('commit-message');
  const progress = readProgress();
  let screen: 'landing' | 'workbench' | 'returning' | 'catalog' | 'complete' | 'account' = 'landing';
  let previousScreen: 'landing' | 'workbench' | 'returning' | 'catalog' | 'complete' | 'account' = 'landing';
  let log: Attempt['log'] = [];
  let helped: number[] = [];
  let assisted: number[] = [];
  let visibleHints = 0;
  let failed = false;
  let answerAt = 0;
  let answerFailed = false;
  let storageAvailable = true;
  let visualSignature = '';
  let runner: LessonRunner | undefined;
  let entry: LessonEntry | undefined;
  let busy = false;
  let history: string[] = [];
  let historyIndex = 0;
  let lastHintSignature = '';
  let theme: 'light' | 'dark' = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try { const stored = localStorage.getItem('git-learn-theme'); if (stored === 'light' || stored === 'dark') theme = stored; } catch { /* Storage is optional for theme preferences. */ }
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    get('theme-toggle').setAttribute('aria-label', theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환');
  }
  applyTheme();
  get('theme-toggle').onclick = () => {
    theme = theme === 'light' ? 'dark' : 'light';
    applyTheme();
    try { localStorage.setItem('git-learn-theme', theme); } catch { /* The selected theme still applies. */ }
  };

  function lock(value: boolean) {
    busy = value;
    root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('button:not(#theme-toggle), input, select, textarea').forEach((control) => { control.disabled = value; });
    root.setAttribute('aria-busy', String(value));
  }

  async function edit(title: string, initial: string): Promise<string | null> {
    const dialog = get<HTMLDialogElement>('edit-dialog');
    get('edit-title').textContent = title;
    const content = get<HTMLTextAreaElement>('edit-content');
    content.value = initial;
    dialog.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>('button, textarea').forEach((control) => { control.disabled = false; });
    dialog.returnValue = 'cancel';
    dialog.showModal();
    content.focus();
    return new Promise((resolve) => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'save' ? content.value : null), { once: true }));
  }

  function output(text: string, kind = '') {
    const terminal = get('terminal-output');
    terminal.append(el('pre', kind, text));
    log.push({ text, kind });
    terminal.scrollTop = terminal.scrollHeight;
  }


  function save() {
    if (!runner || !entry || screen === 'landing') return;
    const previous = progress.attempts[entry.lesson.id];
    progress.current = entry.lesson.id;
    progress.attempts[entry.lesson.id] = {
      lesson: entry.lesson.id, repo: runner.repo.lessonId, step: runner.currentStep,
      baseline: runner.baseline, log, history, helped, assisted, updated: Date.now(),
      completed: runner.complete ? previous?.completed ?? Date.now() : undefined,
    };
    storageAvailable = writeProgress(progress);
    root.querySelector('.page-footer span:last-child')!.textContent = storageAvailable
      ? '진도는 이 브라우저에 저장됩니다.' : '진도를 저장할 수 없습니다. 현재 화면에서는 계속 실습할 수 있습니다.';
  }
  function resetHelp() { visibleHints = 0; failed = false; answerAt = 0; answerFailed = false; lastHintSignature = ''; }
  function show(next: typeof screen) {
    screen = next; root.dataset.screen = next;
    get('home-screen').hidden = next !== 'landing' && next !== 'returning';
    get('landing-copy').hidden = next !== 'landing'; get('returning-copy').hidden = next !== 'returning';
    get('catalog-screen').hidden = next !== 'catalog'; get('completion-screen').hidden = next !== 'complete';
    get('account-screen').hidden = next !== 'account';
    root.querySelector<HTMLElement>('.workspace')!.hidden = next !== 'landing' && next !== 'workbench';
    select.hidden = next !== 'workbench'; get('login-button').hidden = next === 'workbench';
    if (next === 'workbench' || next === 'landing') requestAnimationFrame(() => commandInput.focus({ preventScroll: true }));
    if (next === 'returning') renderReturning();
    if (next === 'catalog') renderCatalog();
    if (next === 'complete') renderCompletion();
    if (['catalog','complete','account'].includes(next)) get(next === 'complete' ? 'completion-screen' : `${next}-screen`).focus({ preventScroll: true });
  }
  function button(text: string, click: () => void, primary = false) {
    const b = el('button', `button button--${primary ? 'primary' : 'secondary'}`, text); b.onclick = click; return b;
  }
  const order = ['onboarding', 'first-branch', 'first-commit-convention', 'split-commits', 'force-push-recovery'];
  function nextEntry() {
    const id = entry?.lesson.id ?? 'onboarding';
    return catalog.entries.find(x => x.lesson.id === order[order.indexOf(id) + 1]);
  }
  function account(title: string) { previousScreen = screen; get('account-title').textContent = title; show('account'); }
  function renderCompletion() {
    if (!runner || !entry) return;
    const panel = get('completion-screen'); panel.replaceChildren(el('p', 'eyebrow', '실습 결과'), el('h1', '', `${entry.lesson.id === 'onboarding' ? '첫 레슨' : entry.lesson.title}을 끝냈습니다.`));
    panel.append(el('p', '', entry.lesson.recap));
    const commits = el('ol', 'completion-commits');
    runner.state.commits.slice(0, Math.max(0, runner.state.commits.length - (entry.setup?.commits.length ?? 0))).forEach(c => commits.append(el('li', 'card', `${c.sha.slice(0, 7)} · ${c.message.split('\n')[0]}`)));
    panel.append(commits, el('h2', '', '실행한 명령'));
    panel.append(el('pre', 'instruction-code', [...new Set(history)].join('\n') || '소스 컨트롤 버튼으로 실행했습니다.'));
    const review = [...new Set([...helped, ...assisted])];
    if (review.length) panel.append(el('p', 'card', `다시 볼 것: ${review.map(n => `${n}단계${assisted.includes(n) ? ' (대신 실행)' : ' (힌트)'}`).join(', ')}`));
    panel.append(el('p', '', storageAvailable ? '지금 진도는 이 브라우저에만 저장돼 있습니다. 브라우저 데이터를 지우면 사라지고 다른 기기에서는 이어지지 않습니다.' : '브라우저 저장소에 접근할 수 없어 진도가 저장되지 않았습니다. 이 화면에서는 계속 학습할 수 있습니다.'));
    const signup = el('div', 'screen-actions');
    signup.append(button('계정 만들고 진도 저장하기', () => account('계정 만들고 진도 저장하기')), button('나중에 하기', () => { signup.replaceChildren(el('p', '', '가입 없이 다음 레슨을 진행할 수 있습니다.')); }));
    panel.append(signup, el('p', 'field__hint', '계정 서비스 연결 전입니다. 기기 간 저장은 아직 제공하지 않습니다.'));
    const next = nextEntry();
    panel.append(button(next ? `다음 레슨 · ${next.lesson.title}` : '전체 목록', () => next ? void chooseLesson(next) : show('catalog'), true));
  }
  function renderReturning() {
    const panel = get('returning-copy'); panel.replaceChildren(el('h1', '', '이어서 해봅니다.'));
    const current = progress.current && progress.attempts[progress.current];
    const selected = catalog.entries.find(x => x.lesson.id === (current && !current.completed ? current.lesson : order[order.indexOf(current ? current.lesson : 'onboarding') + 1]));
    const target = selected ?? catalog.entries.find(x => x.lesson.id === 'onboarding')!;
    const attempt = progress.attempts[target.lesson.id];
    const card = button(`이어서 하기 · ${target.lesson.title}`, () => void chooseLesson(target), true); card.classList.add('resume-card');
    panel.append(card, el('p', 'field__hint', `${attempt?.step ?? 0} / ${target.lesson.steps.length}단계 · ${target.lesson.difficulty}`));
    const done = Object.values(progress.attempts).filter(a => a.completed);
    panel.append(el('p', 'field__hint', `지금까지 ${done.length}개 · ` + ['초급','중급','고급'].map(d => `${d} ${done.filter(a => catalog.entries.find(x => x.lesson.id === a.lesson)?.lesson.difficulty === d).length}`).join(' · ')));
    panel.append(button('전체 목록', () => show('catalog')));
    const predecessor: Record<string, string> = { 'first-commit-convention':'first-branch', 'split-commits': progress.attempts.onboarding?.completed ? 'onboarding' : 'first-commit-convention' };
    const review = progress.attempts[predecessor[target.lesson.id]];
    if (review?.completed && Date.now() - review.completed >= 10 * 86400000 && (review.helped.length >= 2 || review.assisted.length)) {
      const lesson = catalog.entries.find(x => x.lesson.id === review.lesson)!;
      panel.append(el('p', '', '전에 확인했던 내용을 다시 볼까요?'), button(lesson.lesson.title, () => void openLesson(lesson, false)));
    }
    if (current && Date.now() - current.updated >= 30 * 86400000) panel.append(el('p', 'field__hint', '마지막 실습 후 한 달이 지났습니다. 앞 레슨을 잠깐 다시 보셔도 됩니다. 그대로 이어갈 수도 있습니다.'));
  }
  function renderCatalog() {
    const panel = get('catalog-screen'); panel.replaceChildren(el('h1', '', '어떤 일을 해볼까요'));
    const groups = [
      ['입문: 저장소 안에서 길을 찾는다', '필요한 변경만 골라 기록하고 개인 설정은 제외할 수 있습니다.', ['onboarding','first-branch','first-commit-convention','selective-staging']],
      ['혼자 쓰기: 내 히스토리를 내 손으로 만든다', '한 덩어리의 작업을 따로 되돌릴 수 있는 커밋으로 나눌 수 있습니다.', ['split-commits']],
      ['팀에서 쓰기: 남의 코드와 내 코드를 합친다', '원격 변경을 확인하고 내 작업과 합칠 수 있습니다.', []],
      ['사고 대응: 되돌리고 되살린다', '사라진 기록을 찾아 동료의 작업을 보존하며 복구할 수 있습니다.', ['force-push-recovery']],
      ['추적과 정리: 원인을 찾고 뒤를 치운다', '변경의 원인을 추적하고 저장소를 정리할 수 있습니다.', []],
    ] as const;
    const seen = new Set<string>();
    groups.forEach(([title, outcome, ids], i) => {
      const group = el('section', 'catalog-group'); group.append(el('h2', '', `${i + 1}. ${title}`), el('p', '', outcome));
      const entries = catalog.entries.filter(x => (ids as readonly string[]).includes(x.lesson.id) || i === 0 && !order.includes(x.lesson.id)).sort((a,b) => order.indexOf(a.lesson.id) - order.indexOf(b.lesson.id));
      entries.forEach(item => {
        if (seen.has(item.lesson.id)) return; seen.add(item.lesson.id);
        const row = el('div', 'card lesson-card');
        const numbers: Record<string,string> = { onboarding:'05', 'first-branch':'03', 'first-commit-convention':'05', 'split-commits':'06', 'force-push-recovery':'40' };
        row.append(el('span', 'badge badge--accent', `${item.lesson.difficulty} · ${item.lesson.id === 'onboarding' ? '약 9' : item.lesson.difficulty === '초급' ? '약 10' : '약 15'}분`));
        row.append(button(`${numbers[item.lesson.id] ?? '연습'} · ${item.lesson.title}`, () => void chooseLesson(item)));
        const prerequisites: Record<string, [string, string]> = { 'first-branch':['02', ''], 'first-commit-convention':['03', 'first-branch'], 'split-commits':['05', progress.attempts.onboarding?.completed ? 'onboarding' : 'first-commit-convention'], 'force-push-recovery':['39', ''] };
        const prerequisite = prerequisites[item.lesson.id];
        if (prerequisite && !progress.attempts[prerequisite[1]]?.completed) row.append(el('p', 'field__hint', `${prerequisite[0]}번을 먼저 하시는 걸 권합니다. 바로 시작해도 됩니다.`));
        if (progress.attempts[item.lesson.id]?.completed) row.append(el('span', 'field__hint', '완료'));
        group.append(row);
      });
      if (!entries.length) group.append(el('p', 'field__hint', '이 묶음의 실행 가능한 레슨은 준비 중입니다.'));
      panel.append(group);
    });
  }
  async function chooseLesson(selected: LessonEntry) {
    if (busy) return;
    const completed = Object.values(progress.attempts).filter(a => a.completed).length;
    if (completed >= 3 && !progress.attempts[selected.lesson.id]?.completed) { account('세 레슨을 완료했습니다. 이어서 하려면 계정 연결이 필요합니다.'); return; }
    if (runner && entry?.lesson.id === selected.lesson.id && !runner.complete) { show('workbench'); return; }
    await openLesson(selected, true);
  }

  async function action(work: () => Promise<unknown>) {
    if (busy || !runner) return;
    lock(true);
    get('app-status').textContent = '';
    try { await work(); }
    catch (error) { failed = true; if (answerAt) answerFailed = true; get('app-status').textContent = `작업을 마치지 못했어요. ${error instanceof Error ? error.message : String(error)}`; }
    finally { lock(false); render(); save(); }
  }

  function renderHints() {
    if (!runner || runner.unsupported || runner.complete || screen !== 'workbench') return;
    const beginner = runner.lesson.difficulty === '초급';
    if (!visibleHints && (beginner && Date.now() - runner.lastActivity >= 20000 || runner.lesson.difficulty !== '고급' && failed)) visibleHints = 1;
    const hints = runner.step.hints.slice(0, visibleHints).map(hint => evaluateHint(hint.when, {
      state: runner!.state, baseline: runner!.baseline, idleMs: Infinity, requested: true,
      commands: runner!.commands, lastOutput: runner!.lastOutput,
    }) ? hint : { ...hint, say: '지시문의 예제를 한 줄씩 실행하고 상태 확인을 눌러 보세요. 현재 상태에 적용할 추가 수정은 없습니다.' });
    get('hint-button').textContent = `힌트 보기 (${Math.min(visibleHints, runner.step.hints.length)}/${runner.step.hints.length})`;
    const canAssist = answerAt > 0 && (answerFailed || Date.now() - answerAt >= 20000);
    const signature = `${runner.currentStep}:${visibleHints}:${answerAt}:${canAssist}`;
    if (signature === lastHintSignature) return; lastHintSignature = signature;
    if (visibleHints > helped.filter(n => n === runner!.currentStep).length) { while (helped.filter(n => n === runner!.currentStep).length < visibleHints) helped.push(runner.currentStep); save(); }
    get('hints').replaceChildren(...hints.map((hint, index) => {
      const card = el('div', 'feedback feedback--hint hint'); card.append(el('strong', '', `힌트 ${index + 1}`), prose(hint.say)); return card;
    }));
    const solution = runner.step.solution;
    if (beginner && visibleHints >= runner.step.hints.length && solution) {
      get('hints').append(button('정답 보기', () => { answerAt = Date.now(); renderHints(); }));
      if (answerAt) {
        const text = Object.entries(solution.files ?? {}).map(([path, content]) => `${path} 내용:\n${content}`).concat(solution.commands).join('\n');
        get('hints').append(el('pre', 'instruction-code', text), el('p', '', '직접 실행한 뒤 상태를 확인하세요.'));
        if (canAssist) get('hints').append(button('이 단계만 대신 하기', () => void action(async () => {
          const step = runner!.currentStep;
          if (runner!.lesson.id === 'onboarding' && [2,4,6].includes(step) && runner!.state.head?.sha !== runner!.baseline.head?.sha) {
            const command = `git reset --mixed ${runner!.baseline.head!.sha}`;
            output(`❯ ${command}`, 'terminal-output__prompt'); history.push(command); output(await runner!.execute(command));
          }
          for (const [path, content] of Object.entries(solution.files ?? {})) {
            const existing = runner!.state.files.includes(path) ? await runner!.repo.readFile(path) : '';
            const next = path === '.gitignore' ? `${existing.trimEnd()}\n.env.local\n` : content;
            await runner!.repo.writeFile(path, next); output(`파일 저장: ${path}\n${next}`);
          }
          for (const command of solution.commands) { output(`❯ ${command}`, 'terminal-output__prompt'); history.push(command); output(await runner!.execute(command, edit)); }
          await runner!.refresh();
          if ((await runner!.check()).passed) {
            assisted.push(step); output(`이 단계를 대신 실행했습니다. 위 명령과 소스 컨트롤·그래프의 변화를 확인하세요.`);
            await advanceStep();
          } else { failed = true; output('현재 상태가 목표와 다릅니다. 상태 확인 결과를 따라 정리한 뒤 다시 실행하세요.'); }
        })));
      }
    }
  }
  async function advanceStep() {
    if (await runner!.advance()) { resetHelp(); if (runner!.complete) { save(); show('complete'); } }
  }
  async function afterMutation() {
    if (!runner || runner.complete) return;
    if (runner.lesson.id === 'onboarding' && [2,4,6].includes(runner.currentStep)) {
      if ((await runner.check()).passed) await advanceStep();
      else {
        if (runner.state.index.includes('.env.local') || [4,6].includes(runner.currentStep) && runner.state.head?.sha !== runner.baseline.head?.sha) { failed = true; if (answerAt) answerFailed = true; }
        runner.assessment = null;
      }
    }
  }
  function renderFiles(target: string, title: string, paths: string[], staged: boolean) {
    const list = get(target);
    const heading = el('div', 'file-group-heading');
    heading.append(el('h3', '', title), el('span', 'chip', String(paths.length)));
    list.replaceChildren(heading);
    if (!paths.length) list.append(el('p', 'empty-files', staged ? '아직 담긴 변경이 없어요.' : '남은 변경이 없어요.'));
    for (const path of paths) {
      const row = el('div', 'list-row file-row');
      const status = runner!.state.status.find(([name]) => name === path);
      const kind = status?.[2] === 0 ? 'D' : status?.[1] === 0 ? 'U' : 'M';
      const file = el('button', 'button button--quiet list-row__label file-name', path);
      file.title = `${path} 파일 보기`;
      file.onclick = () => void action(async () => {
        get('file-dialog-title').textContent = path;
        get('file-content').textContent = status?.[2] === 0 ? '이 파일은 작업 폴더에서 삭제되었습니다.' : await runner!.repo.readFile(path);
        get<HTMLDialogElement>('file-dialog').showModal();
      });
      const toggle = el('button', 'button button--secondary button--icon file-action', staged ? '−' : '+');
      toggle.setAttribute('aria-label', `${path} ${staged ? '스테이징 해제' : '스테이징'}`);
      toggle.title = staged ? '스테이징 해제 · 내용은 유지' : '스테이징';
      toggle.disabled = busy || runner!.complete || runner!.unsupported;
      toggle.onclick = () => void action(async () => { await (staged ? runner!.unstage(path) : runner!.stage(path)); output(`${staged ? '스테이징 해제' : '스테이징'}: ${path}`, 'terminal-output__muted'); await afterMutation(); });
      const badge = el('span', `badge badge--${staged ? 'staged' : kind === 'U' ? 'untracked' : 'modified'}`, kind);
      badge.setAttribute('aria-label', kind === 'U' ? '새 파일' : kind === 'D' ? '삭제' : '수정');
      row.append(el('span', 'file-icon', '≡'), file, badge, toggle);
      list.append(row);
    }
  }

  function render() {
    if (!runner || !entry) return;
    const { lesson, state } = runner;
    const total = lesson.steps.length;
    get('difficulty').textContent = lesson.difficulty;
    get('lesson-title').textContent = lesson.title;
    get('scenario').textContent = lesson.scenario_beat;
    get('progress-label').textContent = runner.complete ? runner.skipped.length ? '미리보기 종료' : `${total}단계 모두 완료` : `STEP ${String(runner.currentStep).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    get('progress-percent').textContent = `${Math.round(runner.currentStep / total * 100)}%`;
    const progress = get<HTMLProgressElement>('lesson-progress'); progress.max = total; progress.value = runner.currentStep;
    get('lesson-intro').replaceChildren(prose(lesson.intro));
    get('lesson-intro').hidden = runner.currentStep > 0;
    get('instructions').replaceChildren();
    get('step-heading').replaceChildren();
    if (runner.complete) {
      get('step-heading').append(el('span', 'completion-mark', runner.skipped.length ? '↗' : '✓'));
      get('instructions').append(el('h2', 'completion-title', runner.skipped.length ? '미리보기를 마쳤어요' : '실습을 마쳤어요'), prose(lesson.recap));
      if (runner.skipped.length) {
        get('instructions').append(el('p', 'unsupported-message', `${runner.skipped.length}개 단계는 준비 중이라 건너뛰었어요. 실습 통과로 기록하지 않았습니다.`));
      } else {
        const summary = el('div', 'card completion-summary');
        summary.append(el('strong', '', `${total} / ${total} 단계 통과`), el('span', '', `커밋 ${state.commits.length}개 · 남겨 둔 변경 ${state.worktree.length}개`));
        get('instructions').append(summary);
      }
    } else {
      get('step-heading').append(el('span', 'step-number', String(runner.currentStep).padStart(2, '0')), el('span', '', runner.unsupported ? '레슨 미리보기' : '직접 해보기'));
      get('instructions').append(prose(runner.step.say));
      if (runner.unsupported) {
        const note = el('div', 'unsupported-message');
        note.append(el('strong', '', '이 단계는 준비 중이에요.'), el('p', '', '아직 실행할 수 없는 단계입니다. 전체 목록에서 다른 레슨을 선택할 수 있습니다.'));
        const details = el('details'); details.append(el('summary', '', '준비 상태 보기'));
        const list = el('ul'); runner.support[runner.currentStep].reasons.forEach((reason) => list.append(el('li', '', reason))); details.append(list); note.append(details);
        get('instructions').append(note);
      }
    }
    const assessment = get('assessment'); assessment.replaceChildren();
    if (runner.assessment) {
      if (runner.assessment.passed) assessment.append(el('p', 'feedback feedback--success', '✓ 원하는 상태가 되었어요. 다음으로 넘어가세요.'));
      else runner.assessment.failures.forEach((failure) => assessment.append(el('p', 'feedback feedback--error', explainFailure(failure))));
    }
    get('check-button').textContent = runner.complete ? '다시 연습하기' : runner.unsupported ? '준비 중' : runner.lesson.id === 'onboarding' && [1,3,5].includes(runner.currentStep) ? '확인했습니다 · 다음 단계' : runner.assessment?.passed ? '다음 단계' : '상태 확인';
    get<HTMLButtonElement>('check-button').disabled = busy || runner.unsupported;
    get<HTMLButtonElement>('hint-button').disabled = busy || runner.complete || runner.unsupported;
    get('hints').hidden = runner.complete || runner.unsupported;
    renderHints();
    get('source-branch').textContent = state.branch ?? 'HEAD';
    get('file-form').hidden = lesson.id === 'onboarding' && runner.currentStep < 6;
    get('commit-form').hidden = lesson.id === 'onboarding' && runner.currentStep !== 4;
    renderFiles('staged-list', '스테이징된 변경', state.index, true);
    renderFiles('worktree-list', '변경 사항', state.worktree, false);
    get<HTMLButtonElement>('commit-button').disabled = busy || !state.index.length || runner.complete || runner.unsupported;
    messageInput.disabled = busy || runner.complete || runner.unsupported;
    commandInput.disabled = busy || runner.complete || runner.unsupported;
    get<HTMLFormElement>('terminal-form').querySelector<HTMLButtonElement>('button')!.disabled = commandInput.disabled;
    get('commit-count').textContent = `${state.commits.length}개 커밋`;
    get('head-label').textContent = entry.setup ? `HEAD → ${state.branch ?? '분리된 HEAD'}` : '실습 저장소 준비 중';
    get('commit-graph').replaceChildren(...state.commits.map((commit, index) => {
      const item = el('li', index === 0 ? 'current-commit' : '');
      const info = el('button', 'button button--quiet graph-commit');
      info.setAttribute('aria-label', `커밋 보기 ${commit.message.split('\n')[0]}`);
      info.onclick = () => { get('file-dialog-title').textContent = commit.message.split('\n')[0]; get('file-content').textContent = commit.message + '\n\n' + commit.files.join('\n'); get<HTMLDialogElement>('file-dialog').showModal(); };
      info.append(el('strong', '', commit.message.split('\n')[0]), el('span', 'commit-author', `${commit.author.name} · ${new Date(commit.author.timestamp * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`));
      item.append(el('span', 'commit-node'), info, el('code', 'commit-sha', commit.sha.slice(0, 7)));
      return item;
    }));
    const signature = JSON.stringify([state.index, state.worktree, state.head?.sha]);
    if (visualSignature && visualSignature !== signature) {
      root.querySelectorAll('.file-row, .current-commit').forEach(node => { node.classList.add('state-changed'); });
    }
    visualSignature = signature;
  }

  async function openLesson(selected: LessonEntry, resume = false, landing = false) {
    if (busy) return;
    lock(true); entry = selected;
    get('app-status').textContent = '실습 저장소를 준비하고 있어요…';
    try {
      const attempt = resume ? progress.attempts[selected.lesson.id] : undefined;
      runner = attempt && !attempt.completed ? await resumeAttempt(selected, attempt) : await startLesson(selected.lesson, selected.setup, selected.support);
      log = []; helped = attempt && !attempt.completed ? [...attempt.helped] : []; assisted = attempt && !attempt.completed ? [...attempt.assisted] : []; resetHelp(); visualSignature = '';
      select.value = selected.lesson.id;
      history = []; historyIndex = 0; commandInput.value = ''; messageInput.value = ''; lastHintSignature = ''; get('hints').replaceChildren();
      get('terminal-output').replaceChildren();
      if (attempt && !attempt.completed) {
        for (const row of attempt.log) output(row.text, row.kind);
        history = [...attempt.history]; historyIndex = history.length;
      } else output('달로 결제팀 / 연습 저장소\nEnter를 누르면 현재 상태를 확인합니다.', 'terminal-output__muted');
      commandInput.value = landing ? 'git status' : '';
      show(landing ? 'landing' : 'workbench');
      get('app-status').textContent = catalog.errors.length ? `${catalog.errors.length}개 레슨은 형식을 확인하는 중입니다.` : '';
    } catch (error) { runner = undefined; get('app-status').textContent = `레슨을 열지 못했어요. ${error instanceof Error ? error.message : String(error)}`; get('app-status').append(button('새 연습 저장소로 시작', () => void openLesson(selected))); }
    finally { lock(false); render(); if (!landing) save(); commandInput.focus({ preventScroll: true }); }
  }

  catalog.entries.forEach((item) => { const option = el('option', '', `${item.lesson.difficulty} · ${item.lesson.title}${item.support.some((step) => !step.supported) ? ' · 미리보기' : ''}`); option.value = item.lesson.id; select.append(option); });
  select.onchange = () => { const selected = catalog.entries.find((item) => item.lesson.id === select.value); if (selected) void chooseLesson(selected); };
  get('restart-button').onclick = () => { if (entry) void openLesson(entry); };
  get('check-button').onclick = () => {
    if (runner?.complete && entry) { void openLesson(entry); return; }
    void action(async () => {
      if (runner!.unsupported) return;
      if (runner!.assessment?.passed || runner!.lesson.id === 'onboarding' && [1,3,5].includes(runner!.currentStep)) await advanceStep();
      else await runner!.check();
      if (runner!.assessment && !runner!.assessment.passed) { failed = true; if (answerAt) answerFailed = true; }
      if (!runner!.assessment) get('lesson-instructions').focus();
    });
  };
  get('hint-button').onclick = () => { if (runner && !runner.complete) visibleHints = Math.min(visibleHints + 1, runner.step.hints.length); renderHints(); };
  get('clear-terminal').onclick = () => { get('terminal-output').replaceChildren(); log = []; save(); };
  get('terminal-form').onsubmit = (event) => {
    event.preventDefault(); const command = commandInput.value.trim();
    if (!command || busy || !runner || runner.complete || runner.unsupported) return;
    commandInput.value = ''; history.push(command); historyIndex = history.length;
    output(`❯ ${command}`, 'terminal-output__prompt');
    void action(async () => {
      if (!performance.getEntriesByName('onboarding-first-command').length) performance.mark('onboarding-first-command');
      const result = await runner!.execute(command, edit);
      const error = /^(오류:|이 명령은 뒤쪽)|\[rejected\]/m.test(result);
      if (result) output(result, error ? 'terminal-output__error' : '');
      const suggestion = error ? suggestCommand(command) : undefined;
      if (suggestion) output(`${suggestion}를 찾으시나요?`, 'terminal-output__muted');
      if (error) { failed = true; if (answerAt) answerFailed = true; }
      if (screen === 'landing' || runner!.lesson.id === 'onboarding' && runner!.currentStep === 0) {
        show('workbench');
        if (!error && (await runner!.check()).passed) {
          performance.mark('onboarding-first-success');
          await advanceStep();
          get('terminal-output').scrollTop = 0;
        }
      } else if (!error) await afterMutation();
    }).then(() => commandInput.focus({ preventScroll: true }));
  };
  root.addEventListener('input', () => runner?.touch());
  commandInput.onkeydown = (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault(); historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1))); commandInput.value = history[historyIndex] ?? '';
  };
  get('file-form').onsubmit = (event) => {
    event.preventDefault();
    void action(async () => {
      const path = get<HTMLInputElement>('file-path').value.trim();
      const initial = runner!.state.files.includes(path) ? await runner!.repo.readFile(path) : '';
      const content = await edit(path, initial);
      if (content !== null) { await runner!.repo.writeFile(path, content); await runner!.refresh(); await afterMutation(); }
    });
  };
  get('commit-form').onsubmit = (event) => {
    event.preventDefault();
    if (!runner || busy || runner.complete || runner.unsupported) return;
    void action(async () => { await runner!.commit(messageInput.value); output(`커밋: ${messageInput.value}`, 'terminal-output__muted'); messageInput.value = ''; await afterMutation(); });
  };
  const hintTimer = window.setInterval(() => { if (!busy) renderHints(); }, 1000);
  window.addEventListener('pagehide', () => clearInterval(hintTimer), { once: true });
  get('start-button').onclick = () => get<HTMLFormElement>('terminal-form').requestSubmit();
  get('catalog-button').onclick = () => { if (!busy) { save(); show('catalog'); } };
  get('leave-button').onclick = () => { save(); show('returning'); };
  root.querySelector<HTMLAnchorElement>('.brand')!.onclick = event => { event.preventDefault(); if (!busy) { save(); show(progress.current ? 'returning' : 'landing'); } };
  get('login-button').onclick = () => account('로그인');
  get('account-back').onclick = () => show(previousScreen);
  get('account-form').onsubmit = event => { event.preventDefault(); get('account-status').textContent = '계정 서버가 연결되지 않아 생성·로그인하지 못했습니다. 이메일은 저장하거나 전송하지 않았습니다.'; };
  const first = catalog.entries.find(x => x.lesson.id === 'onboarding');
  if (progress.current && progress.attempts[progress.current]) { get('app-status').textContent = ''; show('returning'); }
  else if (first) void openLesson(first, false, true);
  else { lock(true); get('app-status').textContent = '아직 열 수 있는 레슨이 없습니다. 콘텐츠 형식을 확인해 주세요.'; }
}
