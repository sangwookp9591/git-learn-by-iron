# 레슨 실행·채점 검증

검증일: 2026-09-16. 대상: `content/lessons/*.yaml` 네 레슨. **기존 UNSUPPORTED 17단계 → 0단계**, 실제 브라우저 17/17단계 통과, 건너뛰기 0건입니다.

## 실행 증거

| 확인 | 결과 | 증거 |
| --- | --- | --- |
| 기존 엔진/레슨 테스트 18건 | PASS | `npm test`, 기존 파일의 테스트 이름·보호 성질 유지 |
| 신규 테스트 11건 | PASS | `src/lesson/content.test.ts`, 실제 Git 객체와 fake-indexeddb 사용; fetch 차단 |
| 전체 테스트 | PASS | 29 tests, 29 pass, 0 fail/skip/todo |
| 타입 검사와 제품 빌드 | PASS | `npm run build` → tsc + Vite 성공 |
| 실제 브라우저 완주 | PASS | Chromium 152.0.7977.83, 1440×1100, `http://127.0.0.1:4173/` |
| 콘솔·페이지 오류 | PASS | 완주 스크립트에서 수집한 오류 0건 |
| 모바일 편집기 | PASS | 390×844, document scrollWidth 375, dialog x=18/width=339; 열기·취소 동작 |
| 한국어 원문 | PASS | 수정 전 HEAD와 intro/recap/steps.say/hints.say 문자열 비교 동일; SHA-256 회귀 테스트 |
| 보호된 디자인 파일 | PASS | `src/styles/**`, `docs/design-system.md` diff 없음 |

브라우저는 실제 터미널 입력·레슨 선택·상태 확인 버튼·커밋 및 파일 편집기를 조작했습니다. 상태 주입이나 단계 건너뛰기는 사용하지 않았습니다. [재현 스크립트](../ui/evidence/play-lessons.js), [실행 결과 JSON](../ui/evidence/play-results.json).

## 이전 17개 미지원 단계의 해소

아래 모든 행은 Node 통합 테스트와 브라우저 플레이에서 PASS입니다. `inspectLesson`은 정식 단언과 터미널이 공유하는 명령 옵션 지원표로 분류하며 미지원 명령 검사를 없애지 않았습니다 (`src/lesson/catalog.ts:51`, `src/terminal/run.ts:68`). 별도 테스트에서 `git rebase main` 예제는 여전히 unsupported임을 확인합니다.

| 레슨 | 단계 | 실제 확인한 상태/동작 | 결과 |
| --- | ---: | --- | --- |
| first-branch | 1 | 확장 fixture 로딩, clean main, origin/main보다 behind 2 | PASS |
| first-branch | 2 | pull로 원격의 두 객체를 가져와 behind 0, origin/main 추적 | PASS |
| first-branch | 3 | feature 생성, 현재 브랜치·main tip 도달 가능·attached HEAD | PASS |
| first-branch | 4 | branch --show-current, clean, main 보존 | PASS |
| first-commit-convention | 1 | 기능 파일 세 개만 index에 있고 .env.local 제외 | PASS |
| first-commit-convention | 2 | diff --staged에서 index blob의 실제 추가 코드 확인 | PASS |
| first-commit-convention | 3 | 브라우저 bare commit 편집기, feat 제목·Refs 꼬리말·변경 파일 | PASS |
| first-commit-convention | 4 | .gitignore 편집 후 별도 chore 커밋, .env.local ignored·미추적 | PASS |
| first-commit-convention | 5 | main 제외 커밋 2개, show HEAD/HEAD~1·log -3, clean | PASS |
| split-commits | 1 | reset --mixed HEAD~1, 코드 보존·index empty·main 제외 1개 | PASS |
| split-commits | 2 | add -p 내용 편집기로 Validator만 담아 feat+Refs, Controller 제외 | PASS |
| split-commits | 3 | Controller를 fix+Refs로 별도 커밋, main 제외 3개·clean | PASS |
| split-commits | 4 | 일반 push non-fast-forward 거부, lease push 성공·ahead/behind 0 | PASS |
| force-push-recovery | 1 | backup 브랜치 생성, 원래 hotfix tip 보존 | PASS |
| force-push-recovery | 2 | reflog의 유실 세 해시를 출력에서 찾아 각 show --stat 확인 | PASS |
| force-push-recovery | 3 | reset 단독 복구는 JAY 유실로 실패; backup 복귀 후 세 cherry-pick으로 양쪽 보존 | PASS |
| force-push-recovery | 4 | origin 실제 tip=HEAD·ahead 0·clean, backup 삭제 후 완료 | PASS |

## 완료 화면 네 장

| 레슨 | 완료 화면 | 최종 표시 |
| --- | --- | --- |
| 첫 티켓, 첫 브랜치 | [first-branch-completed.png](../ui/evidence/first-branch-completed.png) | 4/4, 커밋 5개, 남은 변경 0개 |
| 첫 커밋과 컨벤션 | [first-commit-convention-completed.png](../ui/evidence/first-commit-convention-completed.png) | 5/5, 커밋 6개, 남은 변경 0개 |
| 리뷰 요청대로 커밋 쪼개기 | [split-commits-completed.png](../ui/evidence/split-commits-completed.png) | 4/4, 커밋 6개, 남은 변경 0개 |
| 사라진 커밋 되찾기 | [force-push-recovery-completed.png](../ui/evidence/force-push-recovery-completed.png) | 4/4, 커밋 6개, 남은 변경 0개 |

스크린샷은 실제 픽셀로 확인했습니다. 마지막 브라우저 실행에서 찾은 유실 커밋의 축약 SHA는 `33bec18`, `2006aec`, `7c8eb1f`이며 매 실습의 커밋 시간에 따라 달라집니다. `git reset --hard 7c8eb1f`만 하면 JAY perf 커밋 단언이 실패하고, `backup/before-recovery`로 돌아와 세 해시를 오래된 순서대로 cherry-pick하면 네 커밋 모두 도달 가능합니다.

## 구현 계약과 추가 회귀

- **통일 fixture:** `src/lesson/schema.ts:6`, `src/lesson/catalog.ts:13`, `src/lesson/runner.ts:120`. 평면 `worktree`는 거부하고 모든 fixture는 `working_tree.modified/untracked/staged`를 사용합니다. `at`은 head 또는 유일한 제목 첫 줄을 가리키며 `ahead`는 별도 원격 저장소 위에 쌓습니다.
- **사고 분기점:** `src/lesson/runner.ts:152`. dangling 세 커밋은 JAY perf 직전 커밋에서 갈라집니다. 기존 fixture의 의도에 대한 coordinator 확인을 반영했으며 `reason`을 실제 reflog 항목에 기록합니다. 세 객체는 초기 HEAD나 로컬 main에서 도달하지 않습니다.
- **원격:** `src/engine/repo.ts:323`, `src/engine/repo.ts:341`, `src/engine/repo.ts:353`. origin의 실제 Git 객체와 ref를 별도 IndexedDB에 보관합니다. fetch로 HEAD/index/작업 파일이 보존되고 dirty pull이 거부됩니다. 일반 push·force·lease를 각각 검증했습니다. 마지막 fetch 이후 origin을 직접 전진시킨 테스트에서 lease가 stale info로 거부되고 양쪽 상태를 보존합니다. `push -u origin <다른 로컬 브랜치>`도 지정한 브랜치를 올립니다.
- **reflog·reset·amend:** `src/engine/repo.ts:125`, `src/engine/repo.ts:215`, `src/engine/repo.ts:253`. 원래 SHA가 기록에 남고 축약 SHA/HEAD@{n}/HEAD~n로 복구할 수 있습니다. soft는 index/작업 파일, mixed는 작업 파일을 보존하고 hard는 대상 트리를 복원합니다. amend는 부모 수/이력 길이를 늘리지 않고 메시지·index를 새 커밋으로 반영합니다. 잘못된 해시와 안전하지 않은 경로는 상태 무변경으로 거부합니다.
- **다른 정답 경로:** `content.test.ts`의 merge recovery는 reflog tip에 recovered 브랜치를 만든 뒤 merge해 같은 복구 단언을 통과합니다. cherry-pick 명령 사용을 채점 조건으로 요구하지 않습니다. 충돌 발생 시 파일을 해결해 add → --continue하는 경로와 --abort로 원래 트리를 복원하는 경로도 실제 검사했습니다.
- **index 읽기:** 설치된 isomorphic-git의 STAGE walker는 content()를 제공하지 않습니다. index entry의 oid로 실제 blob을 읽도록 수정했고 diff --staged에서 추가된 구현 코드가 보이는 회귀 테스트로 검증했습니다.
- **부분 스테이징:** `src/engine/repo.ts:245`. `stageContent`는 blob과 index만 수정합니다. 한 파일의 첫 줄만 커밋하고 작업 파일의 두 줄은 유지되는 테스트로 확인했습니다.

커밋·checkout·cherry-pick 구현은 설치된 isomorphic-git 1.42.2 타입/소스 및 공식 [commit](https://isomorphic-git.org/docs/en/commit), [checkout](https://isomorphic-git.org/docs/en/checkout), [cherryPick](https://isomorphic-git.org/docs/en/cherryPick) API를 확인해 사용했습니다.

## 단언과 힌트 경계

`src/engine/state.ts:30`은 refs/config/commit/tree/blob/reflog/작업 파일에서만 스냅샷을 만듭니다. `src/lesson/assert.ts:24`와 `src/lesson/runner.ts:75`의 채점 입력은 현재 및 단계 시작 스냅샷 두 개뿐입니다. 터미널 문자열이나 명령 실행 여부는 채점하지 않습니다. 원격·reflog의 없는 증거는 실패하고, 추적 대상이 없는 head의 ahead/behind는 null입니다.

| 정식 단언 | 상태에서의 의미 |
| --- | --- |
| head.ahead / head.behind | upstream과 HEAD의 도달 가능한 SHA 집합 차이 개수 |
| branch.tracks | 현재 branch의 config에 기록된 upstream 이름 |
| branch.base | 지정한 로컬 branch tip이 HEAD 이력의 조상인지 |
| remote.branch_head | 지정한 origin branch의 실제 현재 tip과 HEAD가 같은지 |
| reflog.contains | 실제 reflog에 연결된 커밋 메시지·설명 포함 또는 SHA 일치 |
| commit.count_on_branch | HEAD에서 도달하고 main에서는 도달하지 않는 커밋 수 |
| commit.touches / not_touches | HEAD와 첫 부모의 트리를 비교한 변경 경로 |
| commit.trailer / trailer_missing | 메시지 마지막 문단의 trailer 행 일치/키 부재 |
| commit.subject_on_branch / subject_missing | HEAD에서 도달하는 커밋 제목의 부분문자열 존재/부재 |
| worktree.contains / file_ignored | 실제 작업 파일 존재 / 미추적 파일의 ignore 적용 |

기존 단언 동사는 모두 유지합니다. 아래 별칭은 엔진 호환성을 위해 남겼고 콘텐츠의 assert/when은 정식 이름으로 바꿨습니다. `head.message.matches`는 메시지 전체를 검사하므로 제목 끝 마침표 힌트의 정규식은 첫 줄에 한정하도록 바꿔 기존 의미를 보존했습니다.

| 기존 별칭 | 정식 단언 |
| --- | --- |
| index.staged | index.has |
| index.not_staged | index.lacks |
| worktree.has_changes | worktree.dirty |
| head.on | branch.current |
| commit.subject_matches | head.message.matches |

`command_used`는 coordinator가 확정한 구분에 따라 **runner에만 있는** 파싱된 명령 기록을 힌트에서 참조합니다 (`src/lesson/runner.ts:21`, `src/lesson/hints.ts:78`). `push_rejected`와 `cherry_pick_conflict`도 힌트용 결과 문맥입니다. 기록/출력은 readState에 없으며, 같은 상태에 서로 다른 명령 기록을 붙여도 채점이 달라지지 않는 회귀를 두었습니다. 이번에 requested로 내린 힌트는 없습니다.

## 남은 범위와 정직한 한계

- 요청한 네 레슨의 미지원 단계와 미완료 acceptance는 **없습니다**. 별도 호스팅 CI·원격 서버·실제 Git 호스팅 push는 수행하지 않았습니다.
- `git add -p`는 파일의 staging 내용을 직접 편집하는 방식입니다. 원문의 y/n/s 문답·hunk 분할 UI는 구현하지 않았습니다. 현재 split fixture의 Validator에는 문장에서 언급하는 별도 에러 메시지 상수 변경이 없고, Validator와 Controller 파일을 분리하면 작성된 단언과 교육 목적을 만족합니다. fixture와 한국어 원문은 변경하지 않았습니다.
- 일반 셸과 브라우저 터미널의 `npm test`는 미지원입니다. 고급 힌트의 npm test 문장을 수정하거나 가짜 성공 출력을 반환하지 않았습니다. 이번 PASS는 앱 엔진/채점 회귀와 Git 복구 상태를 검증한 것이며 fixture의 결제 테스트를 브라우저 안에서 실행했다는 주장은 하지 않습니다.
- diff는 파일 전체 교체 형태이며 show --stat은 변경 파일 목록·파일 수, log --graph는 단순 표시입니다. merge/pull 충돌은 변경 없이 거부하며 복잡한 merge-conflict 편집 UI는 별도 범위입니다. cherry-pick 충돌 복구는 구현·테스트했습니다.
- `.git/logs/HEAD`에는 유실 커밋이 남지만 네이티브 Git의 reflog 만료/GC는 구현하지 않았습니다. 탭 간 동시 명령은 기존 API와 동일하게 지원하지 않습니다.
- `src/styles/**`와 디자인 문서는 수정하지 않았습니다. UI의 CSS import 순서와 `src/ui/style.css`의 편집기 규칙만 변경했습니다. 의존성·lockfile 변경도 없습니다.
