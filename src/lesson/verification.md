# 레슨 UI·채점 검증 및 콘텐츠 호환성

검증일: 2026-09-16. content 파일은 읽기 전용으로 조사했으며 아래 표는 당시 디렉터리를 순회한 스냅샷입니다.

## 실행 결과

- PASS: npm test 18건(기존 엔진 10건 + 레슨 8건), npm run build.
- PASS: 1440px 실제 브라우저에서 두 가지 경로로 3단계 완료 화면 확인.
- 경로 A: 터미널 git add . → 상태 불일치·복구 안내 확인 → UI − 버튼으로 README.md와 notes.txt 제외 → UI 커밋 → 터미널 git status → 완료.
- 경로 B: UI + 버튼으로 login.js만 스테이징 → 터미널 커밋 → 완료.
- 두 경로의 실제 결과: 스테이징 0개, dirty README.md/notes.txt 2개, 커밋 2개, 3/3 단계 통과.
- PASS: 커밋 전 head.moved 실패 안내, 커밋 후 통과; 브라우저 페이지 오류 및 콘솔 오류 0건.
- PASS: 다크 모드와 390px 모바일에서 확인, 가로 넘침 없음, 모바일 + 버튼으로 스테이징·통과 확인.
- PASS: Google Fonts 서체 계산값 IBM Plex Sans KR/IBM Plex Mono, 터미널 배경은 두 모드 모두 rgb(12,19,25).
- PASS: 콘텐츠 미리보기 전체 단계 건너뛰기, 완료 시 실습 통과가 아닌 미리보기 종료임을 확인.

화면 증거: [완료 화면](../ui/evidence/completed-light.png), [다크 모드](../ui/evidence/workbench-dark.png), [모바일](../ui/evidence/workbench-mobile.png).

## 채점 경계

단언 평가기는 현재 readState 스냅샷과 단계 시작 스냅샷만 받습니다. 터미널 문자열, UI 클릭 기록, command_used는 판정 입력이 아닙니다. 잘못된 정규식·없는 상태 증거·모르는 단언은 통과시키지 않습니다. catalog의 예제 명령 검사는 작성된 레슨의 지원 가능성만 분류하며 학습자의 명령을 검사하지 않습니다.

## 별칭 매핑

| 콘텐츠 별칭 | 정식 단언 |
| --- | --- |
| index.staged | index.has |
| index.not_staged | index.lacks |
| worktree.has_changes | worktree.dirty |
| head.on | branch.current |
| commit.subject_matches | head.message.matches |

commit.subject_matches는 호환성을 위해 메시지 첫 줄에만 정규식을 적용합니다. commit.count_on_branch는 전체 이력 개수와 의미가 달라 임의로 commit.count에 연결하지 않았습니다.

## 미지원 단계 목록

현재 content 레슨의 총 17개 단계입니다. 생성된 fixture는 모두 working_tree와 remote 등 별도 계약을 사용하므로 현재 로더는 이를 임의 축약하지 않습니다. 내장 staging-basics 레슨 3단계는 별도 승인된 src/fixtures 계약으로 모두 지원합니다.

| 레슨 파일 | 단계 | 상태 | 이유 |
| --- | ---: | --- | --- |
| first-branch.yaml | 1 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day2 |
| first-branch.yaml | 2 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day2<br>미지원 상태 조건: head.behind, branch.tracks<br>미지원 예제: git pull |
| first-branch.yaml | 3 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day2<br>미지원 상태 조건: branch.base |
| first-branch.yaml | 4 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day2<br>미지원 예제: git branch --show-current |
| first-commit-convention.yaml | 1 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day2-afternoon |
| first-commit-convention.yaml | 2 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day2-afternoon<br>미지원 예제: git diff --staged |
| first-commit-convention.yaml | 3 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day2-afternoon<br>미지원 상태 조건: commit.trailer, commit.touches, commit.not_touches<br>미지원 예제: git commit |
| first-commit-convention.yaml | 4 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day2-afternoon<br>미지원 상태 조건: worktree.file_ignored, commit.touches, commit.not_touches |
| first-commit-convention.yaml | 5 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day2-afternoon<br>미지원 상태 조건: commit.count_on_branch<br>미지원 예제: git log --oneline -3<br>미지원 예제: git show --stat HEAD<br>미지원 예제: git show --stat HEAD~1 |
| force-push-recovery.yaml | 1 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-force-push-incident |
| force-push-recovery.yaml | 2 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-force-push-incident<br>미지원 상태 조건: reflog.contains |
| force-push-recovery.yaml | 3 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-force-push-incident<br>미지원 상태 조건: commit.subject_on_branch, worktree.contains |
| force-push-recovery.yaml | 4 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-force-push-incident<br>미지원 상태 조건: remote.branch_head, head.ahead |
| split-commits.yaml | 1 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day3-review<br>미지원 상태 조건: commit.count_on_branch |
| split-commits.yaml | 2 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day3-review<br>미지원 상태 조건: commit.count_on_branch, commit.touches, commit.not_touches, commit.trailer |
| split-commits.yaml | 3 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day3-review<br>미지원 상태 조건: commit.count_on_branch, commit.touches, commit.trailer |
| split-commits.yaml | 4 | UNSUPPORTED | 현재 로더와 다른 초기 저장소 형식: fixtures/dalro-payments-day3-review<br>미지원 상태 조건: remote.branch_head, head.behind, head.ahead, commit.count_on_branch |

## 정렬 작업에 남은 사항

- content fixture의 working_tree.modified/untracked/staged와 로더의 worktree를 정렬하고, remote·dangling·브랜치 기준 커밋 수를 실제 스냅샷에 반영하는 계약을 정의해야 합니다.
- 위 표의 Git 기능과 상태 단언은 지원 전까지 unsupported로 유지해야 합니다. 단계 건너뛰기는 점수나 통과로 취급하지 않습니다.
- content/difficulty.md의 명령 경로 제한 설명은 이번에 승인된 상태 기반 판정 원칙과 다르므로 콘텐츠 정렬 시 수정 대상입니다.
- 다음 힌트 조건은 데이터나 사건 기록이 없어 자동 평가하지 않습니다. command_used 기반 조건은 상태 기반 대안으로 바꾸어야 합니다.

- `branch.exists("backup/before-recovery") && remote.branch_head("hotfix/PAY-247-expiry-zero-based")`
- `branch.exists("backup/before-recovery") == false && command_used("reset --hard")`
- `cherry_pick_conflict`
- `command_used("push --force")`
- `commit.count_on_branch != 2`
- `commit.count_on_branch == 0`
- `commit.count_on_branch == 1`
- `commit.subject_missing("perf(payment): 결제 내역 조회 인덱스 추가")`
- `commit.touches(".env.local")`
- `commit.touches("src/payment/PaymentController.ts")`
- `commit.trailer_missing("Refs")`
- `head.behind > 0`
- `index.has_staged && commit.count_on_branch == 1`
- `push_rejected`
- `worktree.clean == true && commit.count_on_branch == 1`
- `worktree.file_ignored(".env.local") == false`

이번 범위에서는 content 수정, remote Git, reflog, hunk staging, 이전 커밋 수정, 진행 이어하기를 구현하지 않았습니다. Google Fonts는 요청된 외부 서체 로딩이며 Git 연산은 로컬입니다. 의존성 설치의 npm 감사는 취약점 0건이었으나 별도 Endor 위험 증거는 도구 미제공으로 미확인입니다.
