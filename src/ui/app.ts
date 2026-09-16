import { loadLessons } from '../lesson/load.ts';
import { explainFailure } from '../lesson/assert.ts';
import { startLesson, type LessonRunner } from '../lesson/runner.ts';
import type { LessonEntry } from '../lesson/catalog.ts';
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

export function mountApp(root: HTMLElement): void {
  // Static shell only; lesson content, file names and terminal output use text nodes.
  root.innerHTML = `
    <a class="skip-link" href="#lesson-instructions">실습 지시로 바로가기</a>
    <header class="topbar">
      <a class="brand" href="#" aria-label="Git Learn 홈"><span class="brand-mark" aria-hidden="true">⑂</span><span>git<span class="brand-light">learn</span><small>BY IRON</small></span></a>
      <div class="header-caption">읽는 것에서, 해보는 것으로.</div>
      <div class="header-tools"><label class="sr-only" for="lesson-select">레슨 선택</label><select id="lesson-select"></select><button id="theme-toggle" class="icon-button" aria-label="다크 모드로 전환">◐</button></div>
    </header>
    <div id="app-status" class="app-status" role="status" aria-live="polite">실습 저장소를 준비하고 있어요…</div>
    <main class="workspace">
      <aside class="lesson-pane" aria-label="레슨 지시">
        <div class="lesson-eyebrow"><span id="difficulty" class="pill"></span><span>HANDS-ON LAB</span></div>
        <h1 id="lesson-title"></h1><p id="scenario" class="scenario"></p>
        <div class="progress-label"><span id="progress-label"></span><span id="progress-percent"></span></div>
        <progress id="lesson-progress" value="0" max="3" aria-label="레슨 진행률"></progress>
        <div id="lesson-intro" class="intro"></div>
        <section id="lesson-instructions" tabindex="-1"><div id="step-heading" class="step-heading"></div><div id="instructions" class="instruction-prose"></div></section>
        <div id="assessment" class="assessment" role="status" aria-live="polite"></div>
        <div id="hints" class="hints" aria-live="polite"></div>
        <div class="lesson-actions"><button id="hint-button" class="quiet-button">힌트 보기 <span aria-hidden="true">↗</span></button><button id="check-button" class="primary-button">상태 확인 <span aria-hidden="true">→</span></button></div>
        <div class="lesson-footer"><span>실수해도 괜찮아요. 다시 해보면 됩니다.</span><button id="restart-button" class="text-button">처음부터</button></div>
      </aside>
      <div class="workbench">
        <section class="panel source-panel" aria-labelledby="source-title"><header class="panel-header"><h2 id="source-title"><span aria-hidden="true">⑂</span> 소스 컨트롤</h2><span id="source-branch" class="branch-label"></span></header>
          <div class="source-content"><p class="panel-caption">이번 커밋에 담을 변경을 골라 보세요.</p><div id="staged-list"></div><div id="worktree-list"></div></div>
          <form id="commit-form" class="commit-form"><label class="sr-only" for="commit-message">커밋 메시지</label><input id="commit-message" placeholder="커밋 메시지를 입력하세요" autocomplete="off" maxlength="1000"><button id="commit-button" class="commit-button" type="submit">✓ 커밋하기</button></form>
        </section>
        <section class="panel graph-panel" aria-labelledby="graph-title"><header class="panel-header"><h2 id="graph-title"><span aria-hidden="true">⌘</span> 커밋 그래프</h2><span id="commit-count" class="muted"></span></header><div class="graph-content"><div id="head-label" class="head-label"></div><ol id="commit-graph" class="commit-graph"></ol><div class="graph-note"><span class="graph-dot"></span> 한 점이 하나의 커밋이에요.</div></div></section>
        <section class="terminal-panel" aria-labelledby="terminal-title"><header class="terminal-header"><h2 id="terminal-title"><span aria-hidden="true">›_</span> 터미널</h2><span class="terminal-local"><span></span> 로컬 실습</span><button id="clear-terminal" class="terminal-clear" aria-label="터미널 출력 지우기">지우기</button></header><div id="terminal-output" class="terminal-output" role="log" aria-live="polite" aria-relevant="additions"></div><form id="terminal-form" class="terminal-form"><span class="prompt" aria-hidden="true">❯</span><label class="sr-only" for="terminal-input">Git 명령어</label><input id="terminal-input" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="git status" aria-describedby="terminal-help"><button type="submit" class="terminal-submit" aria-label="명령어 실행">↵</button></form><div id="terminal-help" class="terminal-help"><span>명령어를 입력하고 Enter</span><span>↑ ↓ 이전 명령</span></div></section>
      </div>
    </main>
    <footer class="page-footer"><span>YOUR REPO. YOUR PACE.</span><span>버튼도, 명령어도. 같은 Git을 배웁니다.</span><span>새로고침하면 새 실습으로 시작합니다.</span></footer>
    <dialog id="file-dialog"><form method="dialog"><h2 id="file-dialog-title"></h2><button class="icon-button" aria-label="파일 닫기">×</button></form><pre id="file-content"></pre></dialog>`;

  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const catalog = loadLessons();
  const select = get<HTMLSelectElement>('lesson-select');
  const commandInput = get<HTMLInputElement>('terminal-input');
  const messageInput = get<HTMLInputElement>('commit-message');
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
    root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button:not(#theme-toggle), input, select').forEach((control) => { control.disabled = value; });
    root.setAttribute('aria-busy', String(value));
  }

  function output(text: string, kind = '') {
    const log = get('terminal-output');
    log.append(el('pre', kind, text));
    log.scrollTop = log.scrollHeight;
  }

  async function action(work: () => Promise<unknown>) {
    if (busy || !runner) return;
    lock(true);
    get('app-status').textContent = '';
    try { await work(); }
    catch (error) { get('app-status').textContent = `작업을 마치지 못했어요. ${error instanceof Error ? error.message : String(error)}`; }
    finally { lock(false); render(); }
  }

  function renderHints() {
    if (!runner || runner.unsupported) return;
    const hints = runner.hints();
    const signature = hints.map((hint) => hint.say).join('\n');
    if (signature === lastHintSignature) return;
    lastHintSignature = signature;
    get('hints').replaceChildren(...hints.map((hint, index) => {
      const card = el('div', 'hint');
      card.append(el('strong', '', `힌트 ${index + 1}`), prose(hint.say));
      return card;
    }));
  }

  function renderFiles(target: string, title: string, paths: string[], staged: boolean) {
    const list = get(target);
    const heading = el('div', 'file-group-heading');
    heading.append(el('h3', '', title), el('span', 'count-badge', String(paths.length)));
    list.replaceChildren(heading);
    if (!paths.length) list.append(el('p', 'empty-files', staged ? '아직 담긴 변경이 없어요.' : '남은 변경이 없어요.'));
    for (const path of paths) {
      const row = el('div', 'file-row');
      const status = runner!.state.status.find(([name]) => name === path);
      const kind = status?.[2] === 0 ? 'D' : status?.[1] === 0 ? 'U' : 'M';
      const file = el('button', 'file-name', path);
      file.title = `${path} 파일 보기`;
      file.onclick = () => void action(async () => {
        get('file-dialog-title').textContent = path;
        get('file-content').textContent = status?.[2] === 0 ? '이 파일은 작업 폴더에서 삭제되었습니다.' : await runner!.repo.readFile(path);
        get<HTMLDialogElement>('file-dialog').showModal();
      });
      const toggle = el('button', 'file-action', staged ? '−' : '+');
      toggle.setAttribute('aria-label', `${path} ${staged ? '스테이징 해제' : '스테이징'}`);
      toggle.title = staged ? '스테이징 해제 · 내용은 유지' : '스테이징';
      toggle.disabled = busy || runner!.complete || runner!.unsupported;
      toggle.onclick = () => void action(() => staged ? runner!.unstage(path) : runner!.stage(path));
      const badge = el('span', `file-status ${kind === 'U' ? 'untracked' : ''}`, kind);
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
    get('progress-label').textContent = runner.complete ? runner.skipped.length ? '미리보기 종료' : `${total}단계 모두 완료` : `STEP ${String(runner.currentStep + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
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
        const summary = el('div', 'completion-summary');
        summary.append(el('strong', '', `${total} / ${total} 단계 통과`), el('span', '', `커밋 ${state.commits.length}개 · 남겨 둔 변경 ${state.worktree.length}개`));
        get('instructions').append(summary);
      }
    } else {
      get('step-heading').append(el('span', 'step-number', String(runner.currentStep + 1).padStart(2, '0')), el('span', '', runner.unsupported ? '레슨 미리보기' : '직접 해보기'));
      get('instructions').append(prose(runner.step.say));
      if (runner.unsupported) {
        const note = el('div', 'unsupported-message');
        note.append(el('strong', '', '이 단계는 준비 중이에요.'), el('p', '', '지금은 안내를 읽고 다음 단계로 넘어갈 수 있습니다. 실습 통과로 기록하지 않아요.'));
        const details = el('details'); details.append(el('summary', '', '준비 상태 보기'));
        const list = el('ul'); runner.support[runner.currentStep].reasons.forEach((reason) => list.append(el('li', '', reason))); details.append(list); note.append(details);
        get('instructions').append(note);
      }
    }
    const assessment = get('assessment'); assessment.replaceChildren();
    if (runner.assessment) {
      if (runner.assessment.passed) assessment.append(el('p', 'success-feedback', '✓ 원하는 상태가 되었어요. 다음으로 넘어가세요.'));
      else runner.assessment.failures.forEach((failure) => assessment.append(el('p', 'failure-feedback', explainFailure(failure))));
    }
    get('check-button').textContent = runner.complete ? '다시 연습하기 ↻' : runner.unsupported ? '준비 중인 단계 건너뛰기 →' : runner.assessment?.passed ? runner.currentStep === total - 1 ? '실습 마치기 ✓' : '다음 단계 →' : '상태 확인 →';
    get<HTMLButtonElement>('hint-button').disabled = busy || runner.complete || runner.unsupported;
    get('hints').hidden = runner.complete || runner.unsupported;
    renderHints();
    get('source-branch').textContent = state.branch ?? 'HEAD';
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
      const info = el('div');
      info.append(el('strong', '', commit.message.split('\n')[0]), el('span', 'commit-author', `${commit.author.name} · ${new Date(commit.author.timestamp * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`));
      item.append(el('span', 'commit-node'), info, el('code', 'commit-sha', commit.sha.slice(0, 7)));
      return item;
    }));
  }

  async function openLesson(selected: LessonEntry) {
    if (busy) return;
    lock(true); entry = selected;
    get('app-status').textContent = '실습 저장소를 준비하고 있어요…';
    try {
      runner = await startLesson(selected.lesson, selected.setup, selected.support);
      history = []; historyIndex = 0; commandInput.value = ''; messageInput.value = ''; lastHintSignature = ''; get('hints').replaceChildren();
      get('terminal-output').replaceChildren();
      output('Git Learn에 오신 것을 환영합니다.\n명령어와 소스 컨트롤 버튼은 같은 저장소를 바꿉니다.', 'terminal-welcome');
      output('먼저 git status로 현재 상태를 살펴보세요.', 'terminal-muted');
      get('app-status').textContent = catalog.errors.length ? `${catalog.errors.length}개 레슨은 형식을 확인하는 중입니다.` : '';
    } catch (error) { runner = undefined; get('app-status').textContent = `레슨을 열지 못했어요. ${error instanceof Error ? error.message : String(error)}`; }
    finally { lock(false); render(); }
  }

  catalog.entries.forEach((item) => { const option = el('option', '', `${item.lesson.title}${item.support.some((step) => !step.supported) ? ' · 미리보기' : ''}`); option.value = item.lesson.id; select.append(option); });
  select.onchange = () => { const selected = catalog.entries.find((item) => item.lesson.id === select.value); if (selected) void openLesson(selected); };
  get('restart-button').onclick = () => { if (entry) void openLesson(entry); };
  get('check-button').onclick = () => {
    if (runner?.complete && entry) { void openLesson(entry); return; }
    void action(async () => {
      if (runner!.unsupported) runner!.skip();
      else if (runner!.assessment?.passed) await runner!.advance();
      else await runner!.check();
      if (!runner!.assessment) get('lesson-instructions').focus();
    });
  };
  get('hint-button').onclick = () => { runner?.requestHint(); renderHints(); };
  get('clear-terminal').onclick = () => get('terminal-output').replaceChildren();
  get('terminal-form').onsubmit = (event) => {
    event.preventDefault(); const command = commandInput.value.trim();
    if (!command || busy || !runner || runner.complete || runner.unsupported) return;
    commandInput.value = ''; history.push(command); historyIndex = history.length;
    output(`❯ ${command}`, 'terminal-command');
    void action(async () => { const result = await runner!.execute(command); if (result) output(result, result.startsWith('오류:') ? 'terminal-error' : ''); }).then(() => commandInput.focus());
  };
  commandInput.oninput = () => runner?.touch(); messageInput.oninput = () => runner?.touch();
  commandInput.onkeydown = (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault(); historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1))); commandInput.value = history[historyIndex] ?? '';
  };
  get('commit-form').onsubmit = (event) => {
    event.preventDefault();
    if (!runner || busy || runner.complete || runner.unsupported) return;
    void action(async () => { await runner!.commit(messageInput.value); messageInput.value = ''; });
  };
  const hintTimer = window.setInterval(() => { if (!busy) renderHints(); }, 1000);
  window.addEventListener('pagehide', () => clearInterval(hintTimer), { once: true });
  if (catalog.entries[0]) void openLesson(catalog.entries[0]);
  else { lock(true); get('app-status').textContent = '아직 열 수 있는 레슨이 없습니다. 콘텐츠 형식을 확인해 주세요.'; }
}
