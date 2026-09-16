# git-learn-by-iron

브라우저 안에서 실제 Git 객체·index·브랜치·원격 저장소를 다루는 학습 워크벤치입니다. Vanilla TypeScript + Vite, isomorphic-git, LightningFS를 사용합니다. Git 연산은 API 서버나 외부 Git 호스팅에 의존하지 않습니다.

## 실행

Node.js 22.18 이상을 사용합니다.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

레슨 선택에서 초급 「첫 티켓, 첫 브랜치」·「첫 커밋과 컨벤션」, 중급 「리뷰 요청대로 커밋 쪼개기」, 고급 「사라진 커밋 되찾기」를 고를 수 있습니다. 기존 「필요한 변경만 골라 담기」도 유지합니다. 첫 방문은 「변경 골라 담기」 온보딩으로 시작합니다. 랜딩의 실제 터미널에서 Enter나 바로 시작하기를 누르면 같은 저장소·출력을 가진 네 패널 워크벤치가 열립니다. 0~6단계에서 파일 확인, 버튼과 명령으로 골라 담기, staged diff, 기능 커밋, 그래프 확인, .gitignore 별도 커밋까지 진행합니다. 변경 단계는 상태를 만족하면 자동 진행하고 관찰 단계는 확인 버튼을 사용합니다. 새로고침·나가기·레슨 전환 후 같은 저장소와 중단한 단계로 이어갑니다. 처음부터 버튼과 완료한 레슨의 재실행만 새 저장소를 만듭니다. 오프라인 첫 방문용 서비스 워커는 제공하지 않습니다.

## 실습 조작

- 소스 컨트롤의 +/− 버튼 또는 `git add` / `git restore --staged`로 변경을 선택합니다.
- 여러 줄 커밋 메시지를 입력하거나 터미널에서 `git commit`으로 메시지 편집기를 엽니다. `git commit --amend`는 기존 메시지를 채워 엽니다.
- 파일 편집에 상대 경로를 입력하면 `.gitignore`를 포함한 파일을 수정하거나 만들 수 있습니다.
- `git add -p <파일>`은 이번 커밋에 담을 **파일 내용**을 편집하는 창을 엽니다. 선택한 내용만 index에 쓰고 작업 파일은 보존합니다. 네이티브 Git의 y/n/s 문답과 patch 문법 대신 내용 편집 방식을 사용합니다.
- 터미널은 아래 Git 명령 부분집합을 실행합니다. 일반 셸·파이프·변수 확장·외부 네트워크·`npm test`는 실행하지 않습니다. 레슨 코드의 테스트 실행과 이 앱 자체의 `npm test`는 별개입니다.

```text
git status
git add <경로...> | git add . | git add -A | git add -p <파일>
git commit [-m "제목" [-m "본문·꼬리말"]] [--amend] [--no-edit]
git restore [--staged] <경로...>
git reset [HEAD] [경로...] | git reset [--soft|--mixed|--hard] [커밋]
git log [--oneline] [--graph] [-3] [origin/브랜치|main..HEAD|커밋]
git diff [--staged|--cached] [--name-only] [파일]
git show [--stat] [커밋]
git branch [이름 [커밋]] | git branch -vv | git branch --show-current
git branch -d <이름> | git branch -D <이름>
git switch <이름> | git switch -c <이름>
git checkout <브랜치|해시> | git checkout -b <이름>
git fetch [origin] | git pull [origin [브랜치]]
git push [-u] [origin [브랜치]] [--force|--force-with-lease]
git reflog
git cherry-pick <해시...> | git cherry-pick --continue | git cherry-pick --abort
git merge <브랜치|해시>
git rm --cached <파일...> | git check-ignore [-v] <파일...>
```

해시는 축약형, `HEAD~1`, `HEAD@{0}`도 사용할 수 있습니다. `--stat`은 변경 파일 목록과 파일 수를 표시합니다. diff는 파일 전체 교체 형태이며 log/graph 출력은 학습용 요약입니다. 전체 Git CLI의 출력 복제는 아닙니다. 미지원 명령·옵션은 `이 명령은 뒤쪽 레슨에서 다룹니다.`, 실패한 작업은 `오류:`를 반환합니다.

## 엔진 API

```ts
import { createRepo } from './src/engine/repo.ts';
import { readState } from './src/engine/state.ts';
import { run } from './src/terminal/run.ts';

const repo = await createRepo('lesson-01');
await repo.writeFile('hello.txt', '첫 번째 내용\n');
await run(repo, 'git add hello.txt');
await run(repo, 'git commit -m "feat: 첫 파일 추가"');
console.log(await readState(repo));
```

개발자 콘솔의 `gitLearn`에는 `createRepo`, `readState`, `parse`, `run`이 있습니다. 쓰기·명령·상태 읽기는 같은 저장소에서 순서대로 `await`해야 합니다. 동시 명령과 여러 탭의 동시 편집은 지원 범위가 아닙니다.

`createRepo(id)`는 레슨별 IndexedDB를 다시 열어도 초기화하지 않습니다. `writeFile`, `readFile`, `removeFile`, `add`, `unstage`, `commit`, `branch`, `checkout`, `switch`를 제공합니다. `reset(paths)`는 기존 스테이징 해제 API이고, `resetTo(ref, mode)`가 HEAD 이동 API입니다. `commit(message, author?, amend?)`, `stageContent(path, text)`, `fetch`, `pull`, `push`, `reflog`, `cherryPick`도 사용할 수 있습니다.

파일 경로의 절대 경로·`..`·`.git` 접근은 거부합니다. `writeFile`은 임시 inode를 교체해 같은 초에 같은 길이로 수정해도 감지합니다. 변경 API는 LightningFS 메타데이터를 flush한 뒤 반환합니다. 직접 `repo.fs`에 쓰는 진단 코드는 이 보장을 우회합니다. 파일명·레슨·터미널 출력은 HTML 대신 텍스트로 렌더링합니다.

## 하나의 fixture 스키마

`content/fixtures/*.yaml`과 `src/fixtures/*.setup.yaml`은 모두 아래 계약을 사용합니다. 이전 평면 `worktree` 형식은 거부합니다.

```yaml
branch: main
commits:
  - message: 'feat: 시작'
    files:
      hello.txt: "hello\n"
remote:
  branches:
    main:
      tracks: true
      at: head
      ahead:
        - message: 'fix: 인사 보정'
          files:
            hello.txt: "hello world\n"
working_tree:
  modified: {}
  untracked: {}
  staged: []
```

`commits`와 `ahead`는 순서대로 쌓이고 `files`는 그 커밋의 변경 파일입니다. `remote.branches.<이름>.at`은 생략/`head`이면 기본 commits의 마지막 커밋, 그 외에는 **유일한 커밋 제목 첫 줄**입니다. 찾을 수 없거나 중복되면 오류입니다. `ahead`는 그 지점 위의 원격 전용 커밋입니다. 로컬 브랜치는 분기점에 남고 `tracks: true`는 해당 로컬 브랜치를 origin에 연결합니다. `working_tree`는 커밋·원격·유실 커밋 구성을 끝낸 뒤 적용합니다.

`dangling`은 `{message, files, reason}` 배열입니다. 사고 fixture에서는 살아 있는 마지막 JAY perf 커밋의 **직전 커밋**에서 세 커밋을 순서대로 만들고, 브랜치를 원래 tip으로 되돌립니다. 실제 Git 객체와 `.git/logs/HEAD`만 남으며 `reason`은 reflog 설명에 기록됩니다. 부모가 없는 단일 기본 커밋이면 그 커밋에서 분기합니다.

## 원격과 채점 상태

origin은 같은 브라우저 안의 **별도 LightningFS 저장소**입니다. 실제 commit/tree/blob 객체를 복사하고 refs를 갱신합니다. HTTP 어댑터는 사용하지 않습니다. `fetch`는 원격 추적 ref만 갱신하고 로컬 HEAD·index·작업 파일을 바꾸지 않습니다. `pull`은 clean 상태에서 fast-forward 또는 충돌 없는 병합을 수행합니다.

일반 push는 원격 tip이 로컬 이력의 조상이 아니면 거부합니다. `--force`는 덮어쓰고, `--force-with-lease`는 마지막 fetch/push로 알고 있던 추적 SHA와 origin의 **현재 SHA**가 같을 때만 허용합니다. 중간에 동료 커밋이 생기면 `stale info`로 거부합니다. 원격도 브라우저 사이트 데이터 삭제 시 사라집니다.

`readState(repo)`는 JSON 스냅샷입니다. 채점기는 이 스냅샷과 단계 시작 스냅샷만 받습니다.

| 필드 | 의미 |
| --- | --- |
| `index`, `worktree`, `status` | HEAD↔index, index↔작업 파일 변경 경로와 원본 상태 행렬 |
| `head` | SHA, 메시지, 추적 이력 기준 ahead/behind; 추적 기준이 없으면 거리는 null |
| `branch`, `branches`, `branchHeads` | 현재 브랜치, 로컬 브랜치 목록과 실제 tip SHA |
| `tracking` | 로컬 브랜치별 origin 추적 이름 |
| `remote.branches` | 별도 origin 저장소의 현재 branch SHA |
| `remote.trackingHeads` | 마지막 fetch/push로 갱신한 로컬 원격 추적 SHA |
| `commits` | HEAD에서 도달 가능한 커밋: SHA·메시지·부모·작성자·첫 부모 대비 변경 파일 |
| `branchCommits` | HEAD에서는 도달하고 main에서는 도달하지 않는 커밋; main/기준 없음은 null |
| `reflog` | 실제 reflog의 SHA·이전 SHA·설명·Git 객체에서 읽은 커밋 메시지 |
| `files`, `ignored` | 작업 파일 목록과 추적되지 않으면서 ignore 규칙에 맞는 파일 |

정식 DSL은 기존 `index.has/lacks/empty/has_staged`, `worktree.dirty/clean`, `head.moved/message.matches/detached`, `branch.current/exists/absent`, `commit.count`를 유지합니다. `head.ahead/behind`, `branch.tracks/base`, `remote.branch_head`, `reflog.contains`, `commit.count_on_branch/trailer/trailer_missing/touches/not_touches/subject_on_branch/subject_missing`, `worktree.contains/file_ignored`를 추가했습니다.

`branch.base: main`은 현재 이력에 main tip이 포함되는지, `remote.branch_head: 이름`은 해당 origin branch와 HEAD의 SHA가 같은지 확인합니다. `commit.count`는 전체 도달 가능한 이력이고 `commit.count_on_branch`는 main을 제외한 이력입니다. 없는 증거를 0이나 통과로 취급하지 않습니다. 조건별 자세한 의미와 검증은 [verification.md](src/lesson/verification.md)에 있습니다.

힌트는 상태 비교·함수·논리식·idle·requested를 지원합니다. `command_used`, `push_rejected`, `cherry_pick_conflict`는 runner에만 있는 명령/결과 문맥을 사용합니다. 그 기록은 `readState()`에 들어가지 않으며 채점기로 전달되지 않습니다. 고급 힌트는 요청할 때만 표시됩니다. 단계 이동 전 다시 상태를 검사하고 상태 변경 시 이전 통과를 폐기합니다.

## 검증

`npm test`는 Node 내장 러너로 Git 엔진을 실제 실행하고 IndexedDB만 fake-indexeddb로 대체합니다. 기존 29건과 온보딩·저장 복원 회귀 2건, 총 31건입니다. 기존 미지원 보호 테스트의 push/reset-hard 예시는 이제 미지원인 push-mirror/reset-keep으로 교체했으며 무변경·안전 경로 보호 검사는 유지합니다.

네 레슨의 17단계는 실제 브라우저에서도 처음부터 완료까지 플레이했습니다. [재현 스크립트](src/ui/evidence/play-lessons.js)는 Playwright의 page를 받는 함수이며 터미널/버튼/편집기로만 조작합니다. 완료 화면과 한계는 [검증 보고서](src/lesson/verification.md)에 있습니다. `src/styles`의 토큰 → 기본 → 컴포넌트 CSS를 순서대로 가져오고 기존 워크벤치 레이아웃은 `src/ui/style.css`가 담당합니다.


## 온보딩과 진도 저장

레슨의 단계·단계 시작 스냅샷·저장소 식별자·터미널 기록·힌트 사용은 `localStorage`의 `git-learn-progress-v1`에 저장합니다. 실제 Git 객체·index·작업 파일은 기존 LightningFS의 IndexedDB에 남습니다. 저장소 식별자로 동일 저장소를 다시 열며 초기 fixture를 덮어쓰지 않습니다. localStorage 접근·파싱·쓰기 실패는 처리하고 저장 불가 사실을 알리면서 현재 실습을 계속합니다. IndexedDB 데이터가 사라졌다면 복원 실패를 알리고 새 연습 저장소로 시작할 수 있습니다. 여러 탭이 같은 실습을 동시에 편집하는 병합·잠금은 제공하지 않습니다.

초급은 20초 무입력 또는 실패 후 첫 힌트를 펼칩니다. 중급은 실패 후, 고급은 요청 시에만 펼칩니다. 정답과 대신 실행은 초급에만 있으며, 대신 실행은 정답을 본 뒤 다시 실패하거나 20초 동안 진행하지 못했을 때 나타납니다. 실행 내역을 터미널에 남기고 실제 상태로 재채점합니다. 온보딩에서 잘못 만든 커밋은 단계 시작점으로 mixed reset한 뒤 다시 담습니다. 작업 파일은 보존하며 .gitignore에는 규칙을 덧붙입니다. 건너뛰기는 UI에서 제공하지 않습니다.

계정 만들기·로그인은 화면과 흐름만 구현했습니다. 이메일은 저장하거나 전송하지 않고, 계정을 만들었다고 표시하지 않습니다. 가입 전 세 레슨을 마치면 새로운 레슨을 시작할 때 계정 연결 안내로 이동하며 완료한 레슨은 다시 열 수 있습니다. 서버 연결 전에는 네 번째 새 레슨을 해제하지 않습니다. 실제 가입, 인증 세션, 사용자별 진도 저장, 기기 간 동기화와 서버의 권한 검사는 별도 연동 지점입니다. `docker/progress-server.mjs`는 이번 작업에 연결하지 않았습니다. 로컬 진도를 서버 인증이나 권한 증거로 사용하면 안 됩니다.

다섯 학습 묶음을 표시하되 실행 가능한 기존 레슨과 온보딩만 선택할 수 있습니다. 아직 YAML이 없는 묶음은 준비 중으로 표시합니다. 현재 50개 시나리오 전체를 구현한 상태는 아닙니다. 예상 시간은 설계값이고 실제 학습자 소요 시간·이탈률·전환율은 측정하지 않았습니다.

온보딩 회귀 검증은 `npm test`의 신규 두 건과 [브라우저 완주 스크립트](src/ui/evidence/onboarding/play-onboarding.js), [안전망·저장 실패 검증](src/ui/evidence/onboarding/check-safety.js)에 있습니다. 두 브라우저 스크립트는 Playwright의 `page`를 인자로 받고 별도 브라우저 컨텍스트에서 `http://127.0.0.1:4177/`을 엽니다. 기존 29건을 유지해 총 31건이며, 화면별 증거와 측정 한계는 [온보딩 구현 보고서](src/ui/evidence/onboarding/REPORT.md)에 기록합니다.
