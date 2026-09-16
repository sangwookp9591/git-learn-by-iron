# 현업 시나리오 전체 지도

달로(Dalro) 결제팀에서 실제로 벌어지는 Git 상황을 한곳에 모았다. 명령어 목록이 아니라 **상황 목록**이다. 이 문서의 한 행이 곧 하나의 시나리오이고, 시나리오 상세 문서와 레슨은 여기서 번호를 따 간다.

읽는 법.

- **번호** — 시나리오 식별자다. 상세 문서 파일명(`번호-이름.md`)과 선행 관계가 이 번호를 쓴다. 번호 순서가 곧 학습 순서는 아니다. 학습 순서는 [learning-map.md](learning-map.md)에 따로 있다.
- **언제 벌어지는가** — 이 상황이 실제로 생기는 순간이다. 여기가 비어 있으면 그 시나리오는 교재에 넣을 이유가 없다.
- **난이도** — [difficulty.md](../difficulty.md)의 네 축(정답 경로의 수 / 힌트 시점 / 상황 제시 방식 / 안전망)으로 매긴 값이다. 명령이 어려워서 고급이 아니라, **학습자에게 넘기는 판단의 양**이 많아서 고급이다.
- **선행 시나리오** — 이걸 모르면 지금 시나리오의 설명이 말이 안 되는 것. `—`는 선행이 없다는 뜻이다.
- **배우는 명령 / 배우는 개념** — 명령은 손에 남는 것이고, 개념은 3개월 뒤에도 남는 것이다. 개념 칸이 비면 그 시나리오는 명령 암기 문제다.

용어 표기는 [glossary.md](../glossary.md)를 따른다. 새로 등장한 말은 문서 맨 아래 "어휘 추가 후보"에 모아뒀다.

**상세 문서가 있는 시나리오는 이름에 링크가 걸려 있다.** 나머지는 아직 표의 한 행으로만 존재한다.

---

## A. 받기와 시작

저장소를 손에 넣고 팀이 지금 무슨 상태인지 읽는 단계다. 여기서 잘못 잡으면(특히 1번의 `user.email`) 뒤에서 히스토리를 다시 쓰게 된다.

| 번호 | 시나리오 이름 | 언제 벌어지는가 | 난이도 | 선행 | 배우는 명령 | 배우는 개념 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 저장소를 클론하고 내 신원을 맞춘다 | 입사 첫날 오후, 계정 발급이 끝나고 개발 환경을 깐 직후 | 초급 | — | `git clone` · `git config user.name` · `git config user.email` · `git remote -v` · `git status` | 저장소·리모트·`origin`의 관계. 커밋 작성자는 서버가 아니라 내 로컬 설정에서 온다 |
| 2 | 브랜치 구조를 읽는다 | 클론 직후, 팀이 지금 뭘 하고 있는지 감을 잡아야 할 때 | 초급 | 1 | `git branch` · `git branch -a` · `git branch -vv` · `git log --oneline --graph --all` | 로컬 브랜치와 원격 추적 브랜치는 다른 것이다. 기본 브랜치가 보호돼 있다는 것의 의미 |
| 3 | 최신 `main`에서 작업 브랜치를 판다 | 티켓을 받고 코드를 건드리기 직전 | 초급 | 2 | `git switch main` · `git pull` · `git switch -c` · `git branch --show-current` | 브랜치는 작업을 격리하는 도구다. **분기점을 어디로 잡느냐가 나중에 겪을 충돌의 양을 정한다** |
| 4 | 남의 브랜치를 받아서 이어 작업한다 | 동료가 휴가를 갔고 그 사람 MR을 마저 끝내야 할 때 | 초급 | 2 | `git fetch origin` · `git switch <브랜치>` · `git switch -c <이름> origin/<브랜치>` · `git log --oneline origin/<브랜치>` | 원격 추적 브랜치에서 로컬 브랜치가 만들어지는 방식. 남이 만든 히스토리는 함부로 다시 쓰지 않는다 |

## B. 일상

하루에 여러 번 하는 일들이다. 명령 수는 적은데 **판단**이 계속 끼어든다. 무엇을 담을지, 커밋을 어디서 끊을지.

| 번호 | 시나리오 이름 | 언제 벌어지는가 | 난이도 | 선행 | 배우는 명령 | 배우는 개념 |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | 변경 중에서 이번 커밋에 담을 것만 고른다 | 여러 파일을 한꺼번에 고쳐놓고 커밋하려 할 때 | 초급 | 3 | `git status` · `git diff` · `git add <경로>` · `git diff --staged` · `git restore --staged` | 스테이징 영역이 왜 따로 있는가. `git add .` 습관이 위험한 이유 |
| 6 | 커밋을 쪼갠다 | 리뷰어가 "커밋 좀 나눠주실 수 있을까요"라고 했을 때 | 중급 | 5 | `git reset --mixed HEAD~1` · `git add -p` · `git commit` · `git show --stat` | `reset`의 세 모드 차이. 헝크 단위 스테이징. **"하나만 되돌릴 수 있어야 한다"는 커밋 단위 기준** |
| 7 | 커밋을 합친다 | 리뷰 반영 커밋이 잔뜩 붙어 히스토리가 지저분해졌을 때 | 중급 | 6 | `git rebase -i HEAD~<n>`(`squash`/`fixup`) · `git commit --fixup` · `git rebase -i --autosquash` | 쪼개는 것과 합치는 것은 모순이 아니다. 리뷰 단위와 히스토리 단위는 목적이 다르다 |
| 8 | 커밋 메시지를 고친다 | 커밋하고 나서 오타나 티켓 번호 누락을 발견했을 때 | 초급 | 5 | `git commit --amend` · `git rebase -i`의 `reword` · `git push --force-with-lease` | 커밋을 고치면 해시가 바뀐다. 푸시 전이면 공짜, 푸시 후면 비용이 붙는다 |
| 9 | `.gitignore`로 안 올라갈 것을 막는다 | `git status`에 `.env.local`이나 빌드 산출물이 계속 뜰 때 | 초급 | 5 | `.gitignore` 작성 · `git check-ignore -v` · `git status --ignored` | 추적 중인 파일과 추적 안 되는 파일의 구분. ignore 규칙의 우선순위 |
| 10 | 이미 커밋된 파일을 추적에서 뺀다 | ignore를 늦게 추가해서 이미 올라간 파일이 남아 있을 때 | 중급 | 9 | `git rm --cached` · `git commit` · `git check-ignore -v` | **`.gitignore`는 이미 추적 중인 파일에 소급 적용되지 않는다.** 이걸 모르면 "ignore에 넣었는데 왜 계속 뜨죠"에서 멈춘다 |
| 11 | 커밋하기 전에 변경을 되돌린다 | 시험 삼아 고쳐본 코드를 원래대로 돌릴 때 | 초급 | 5 | `git restore <파일>` · `git restore --staged` · `git diff` · `git clean -n` → `git clean -fd` | 워킹 트리·인덱스·HEAD 세 곳의 상태. **커밋 안 한 변경을 버리면 Git도 못 찾아준다** |

## C. 동기화

리모트와 내 로컬을 맞추는 일이다. 신입이 제일 자주 사고 내는 구간이고, 사고의 대부분은 `git pull`을 명령이 아니라 버튼처럼 쓰기 때문에 난다.

| 번호 | 시나리오 이름 | 언제 벌어지는가 | 난이도 | 선행 | 배우는 명령 | 배우는 개념 |
| --- | --- | --- | --- | --- | --- | --- |
| 12 | `git pull`이 그냥 된다 (패스트 포워드) | 아침에 출근해서 `main`을 최신으로 맞출 때 | 초급 | 3 | `git pull` · `git log --oneline -5` · `git status` | 패스트 포워드는 합치는 게 아니라 이름표가 앞으로 밀리는 것이다 |
| 13 | [`git pull` 했더니 자동으로 머지 커밋이 생겼다](13-pull-made-a-merge-commit.md) | 내 커밋이 있는 상태에서 아무 생각 없이 `pull`을 쳤을 때 | 중급 | 12 | `git pull` · `git log --graph` · `git reset --hard ORIG_HEAD` · `git pull --rebase` · `git pull --ff-only` · `git config pull.ff only` | `pull` = `fetch` + `merge`. 히스토리가 갈라졌다는 것의 의미. 머지 커밋이 생기는 조건 |
| 14 | fetch와 pull을 구분해서 쓴다 | 리모트 상황만 확인하고 내 브랜치는 안 건드리고 싶을 때 | 초급 | 12 | `git fetch origin` · `git log --oneline HEAD..origin/main` · `git diff HEAD origin/main` · `git status` | `fetch`는 원격 추적 ref만 갱신한다. 내려받는 것과 합치는 것은 별개 동작이다 |
| 15 | `main`이 앞서가서 내 브랜치가 뒤처졌다 | 브랜치 판 지 며칠 지나 MR에 충돌 경고가 떴을 때 | 중급 | 14 | `git fetch origin` · `git rebase origin/main` · `git merge origin/main` · `git log --oneline --graph --all` | 분기점. 리베이스는 커밋을 옮기는 게 아니라 **다시 쓰는** 것이다 |
| 16 | 리베이스와 머지 중에 고른다 | 팀 규칙이 없거나, 규칙은 있는데 지금 상황이 애매할 때 | 중급 | 15 | `git rebase` · `git merge --no-ff` · `git log --graph` · `git config pull.rebase` | 일직선 히스토리 vs 실제 순서 보존의 트레이드오프. **남과 공유된 브랜치는 리베이스하지 않는다** |

## D. 충돌

충돌은 사고가 아니라 일상이다. 이 구간의 목표는 충돌을 안 나게 하는 게 아니라, 났을 때 당황하지 않는 것이다.

| 번호 | 시나리오 이름 | 언제 벌어지는가 | 난이도 | 선행 | 배우는 명령 | 배우는 개념 |
| --- | --- | --- | --- | --- | --- | --- |
| 17 | [머지 충돌을 해결한다](17-merge-conflict.md) | 최신 `main`을 내 브랜치로 머지하다 멈췄을 때 | 중급 | 15 | `git merge` · `git status` · `git diff` · `git add` · `git merge --continue` · `git merge --abort` | 충돌 표시 읽는 법. **충돌 해결은 한쪽을 고르는 게 아니라 코드를 다시 쓰는 일이다** |
| 18 | [리베이스 도중 충돌, 그리고 `--abort`로 원위치](18-rebase-conflict-and-abort.md) | 앞서간 `main` 위로 내 커밋을 옮기다 멈췄을 때 | 중급 | 17 | `git rebase origin/main` · `git status` · `git add` · `git rebase --continue` · `git rebase --skip` · `git rebase --abort` · `git reflog` | 리베이스는 커밋을 하나씩 다시 얹는다. `HEAD` 쪽이 머지와 반대로 느껴지는 이유. **포기할 수 있다는 걸 알아야 시도를 한다** |
| 19 | 같은 파일 여러 곳에서 충돌이 난다 | 동료가 같은 파일을 통째로 리팩터링한 뒤 | 중급 | 17 | `git diff --diff-filter=U` · `git checkout --ours/--theirs` · `git diff --check` · `git mergetool` · 테스트 실행 | 충돌 덩어리마다 판단이 다르다. **해결 후 검증까지가 충돌 해결이다** |
| 20 | 충돌 해결을 포기하고 원위치로 돌아간다 | 해결하다 엉켜서 내가 뭘 고쳤는지도 모르겠을 때 | 초급 | 17 | `git merge --abort` · `git rebase --abort` · `git cherry-pick --abort` · `git reset --merge` · `git reflog` | 중간 상태에서 빠져나오는 길은 항상 있다. 되돌아갈 수 있다는 사실 자체가 학습 내용이다 |

## E. 협업

Git 명령보다 GitLab의 절차가 더 많이 나오는 구간이다. **어디까지가 Git이고 어디부터가 GitLab인지**를 여기서 가른다.

| 번호 | 시나리오 이름 | 언제 벌어지는가 | 난이도 | 선행 | 배우는 명령 | 배우는 개념 |
| --- | --- | --- | --- | --- | --- | --- |
| 21 | MR을 올린다 | 커밋이 쌓였고 리뷰를 받아야 할 때 | 초급 | 3 | `git push -u origin <브랜치>` · `git branch -vv` · `git log --oneline origin/<브랜치>` | 추적 브랜치가 만들어지는 순간. **MR은 Git 기능이 아니라 GitLab이 얹은 협업 절차다** |
| 22 | Draft로 먼저 올리고 Ready로 바꾼다 | 구현은 미완인데 방향만 먼저 확인받고 싶을 때 | 초급 | 21 | `git push` · MR Draft ↔ Ready 전환 | 리뷰를 요청하는 시점을 내가 고를 수 있다. 완성 전에 올리는 것과 리뷰를 조르는 것은 다르다 |
| 23 | [내가 남의 MR을 리뷰한다](23-reviewing-someone-elses-mr.md) | 동료가 나를 리뷰어로 걸었을 때 | 중급 | 21 | `git fetch origin` · `git switch --detach origin/<브랜치>` · `git log --oneline main..origin/<브랜치>` · `git diff main...origin/<브랜치>` · `git show` · `git switch -` | 두 점 `..`과 세 점 `...`의 차이. 리뷰는 최종 디프가 아니라 **커밋 순서**로 읽는다 |
| 24 | [리뷰 코멘트를 받고 반영한다](24-applying-review-comments.md) | LGTM 대신 수정 요청이 달렸을 때 | 중급 | 23 | `git add -p` · `git commit --fixup` · `git rebase -i --autosquash` · `git commit` | 리뷰 반영을 새 커밋으로 남길지 원래 커밋에 접을지의 판단 기준 |
| 25 | 반영한 것을 다시 올린다 (재푸시) | 반영 커밋을 만든 직후 | 중급 | 24 | `git push` · `git push --force-with-lease` · `git log --oneline origin/<브랜치>..HEAD` | 히스토리를 고쳤으면 그냥 푸시는 거절된다. **`--force`와 `--force-with-lease`의 차이** |
| 26 | [CI가 깨졌다](26-ci-is-red.md) | MR 파이프라인에 빨간불이 떴을 때 | 중급 | 21 | `git log --oneline origin/main..HEAD` · `git stash` · `git switch --detach` · `git commit --amend` · `git push --force-with-lease` | 내 커밋이 깬 것과 원래 깨져 있던 것을 가르는 법. 리뷰 요청 전에 초록불을 만드는 게 매너인 이유 |
| 27 | 승인 후 머지 전략을 고른다 | 승인 2개가 찼고 CI도 초록불일 때 | 중급 | 16 | 스쿼시 머지 · 머지 커밋 · 리베이스 머지 · `git log --oneline -10` | 리뷰 단위와 `main` 히스토리 단위는 다르다. 전략에 정답은 없고 **팀이 하나로 정해서 지키는 것**이 답이다 |

## F. 릴리즈

주 단위로 반복되는 절차다. 여기서 붙여둔 태그가 G구간(사고와 복구)의 출발점이 된다.

| 번호 | 시나리오 이름 | 언제 벌어지는가 | 난이도 | 선행 | 배우는 명령 | 배우는 개념 |
| --- | --- | --- | --- | --- | --- | --- |
| 28 | 태그를 붙이고 버전을 정한다 | 금요일 오전 릴리즈 | 초급 | 27 | `git tag -a` · `git tag -l` · `git show <태그>` · `git push origin <태그>` | SemVer와 커밋 타입의 대응(`feat`→마이너, `fix`→패치). 어노테이티드 태그와 라이트웨이트 태그. **태그는 커밋과 따로 푸시한다** |
| 29 | 릴리즈 노트를 만든다 | 태그를 붙이기 직전 | 초급 | 28 | `git log --oneline v1.8.0..HEAD` · `git log --grep` · `git shortlog -sn` · `git log --format` | 커밋 컨벤션의 값이 여기서 회수된다. 릴리즈 노트를 손으로 긁어모으는 일이 사라진다 |
| 30 | 릴리즈 브랜치를 운영한다 | 다음 스프린트 작업과 이번 릴리즈 검증이 겹칠 때 | 고급 | 28 | `git switch -c release/1.10` · `git merge` · `git cherry-pick` · `git tag -a` | 코드 프리즈. **브랜치 전략은 취향이 아니라 배포 주기가 정한다** |
| 31 | 핫픽스를 낸다 | 배포 직후 운영 장애가 터졌을 때 | 중급 | 28 | `git fetch origin --tags` · `git switch -c hotfix/<티켓> v1.9.0` · `git commit` · `git tag -a v1.9.1` · `git push origin v1.9.1` | **브랜치를 어디서 따느냐가 무엇이 배포되는지를 정한다.** `main`에서 따면 검증 안 된 커밋이 새벽에 나간다 |
| 32 | 핫픽스를 `main`에도 반영한다 (체리픽) | 핫픽스 배포가 끝난 직후 | 중급 | 31 | `git cherry-pick <해시>` · `git log --oneline` · `git cherry -v main hotfix/<티켓>` | 체리픽은 브랜치가 아니라 커밋 하나만 옮긴다. **반영을 빠뜨리면 다음 배포에 같은 버그가 부활한다** |

## G. 사고와 복구

혼자서는 못 빠져나오는 구간이다. 여기 있는 건 전부 "겪기 전에 한 번 봐둬야 하는" 것들이다.

| 번호 | 시나리오 이름 | 언제 벌어지는가 | 난이도 | 선행 | 배우는 명령 | 배우는 개념 |
| --- | --- | --- | --- | --- | --- | --- |
| 33 | 커밋을 되돌린다 — revert와 reset 중에 고른다 | "그 커밋만 빼주실 수 있을까요" 요청을 받았을 때 | 중급 | 25 | `git revert` · `git reset --soft/--mixed/--hard` · `git reflog` · `git push --force-with-lease` | 흔적을 남기며 되돌리기 vs 히스토리에서 지우기. **판단 기준은 "남이 이미 이걸 받아갔는가"** |
| 34 | [`main`에 직접 커밋해버렸다](34-committed-straight-to-main.md) | 브랜치 파는 걸 잊고 두 시간 작업한 뒤 | 중급 | 33 | `git branch <새브랜치>` · `git reset --hard origin/main` · `git switch` · `git log --oneline` · `git reflog` | **브랜치는 커밋을 가리키는 이름표일 뿐이다.** 커밋은 이미 있고, 이름표만 옮기면 된다 |
| 35 | 엉뚱한 브랜치에서 작업했다 | 커밋까지 해놓고 브랜치를 잘못 봤다는 걸 알았을 때 | 중급 | 34 | `git switch -c` · `git cherry-pick` · `git reset --hard` · `git stash` · `git stash pop` | 커밋 전과 후에 옮기는 방법이 다르다. 커밋 전이면 스태시, 후면 체리픽이나 브랜치 이름표 |
| 36 | [비밀키를 커밋했고 아직 푸시 전이다](36-secret-committed-not-pushed.md) | 커밋하고 `git show` 보다가 발견했을 때 | 중급 | 9 | `git reset --mixed HEAD~1` · `git rm --cached` · `.gitignore` · `git commit --amend` · `git log -p -- <파일>` | 푸시 전이면 히스토리를 조용히 고칠 수 있다. 다만 **키는 커밋된 순간 이미 폐기 대상**이라는 판단은 별개다 |
| 37 | 비밀키를 이미 푸시했다 | CI 로그나 동료 제보로 뒤늦게 알게 됐을 때 | 고급 | 36 | `git filter-repo` · `git push --force-with-lease` · 팀 전원 재클론 안내 · 키 폐기·회전 절차 | **원격에 나간 비밀은 히스토리를 지워도 유출로 취급한다.** Git 작업보다 키 회전이 먼저다 |
| 38 | 대용량 파일을 커밋했다 | 클론이 갑자기 느려지거나 푸시가 용량으로 거부될 때 | 고급 | 37 | `git count-objects -vH` · `git rev-list --objects --all` · `git filter-repo` · Git LFS | 커밋을 지워도 객체는 남는다. 저장소 크기는 현재 파일이 아니라 **히스토리 전체**가 만든다 |
| 39 | force push로 남의 커밋을 날렸다 | 브랜치를 잘못 보고 강제로 밀었을 때 | 고급 | 25 | `git reflog` · `git branch backup/<이름>` · `git cherry-pick` · `git push --force-with-lease` | `--force`와 `--force-with-lease`의 차이가 사고로 회수된다. **복구 전에 안전지대부터 만든다** |
| 40 | 내 커밋이 사라졌다 | `pull` 했더니 어제 올린 커밋이 로그에 없을 때 | 고급 | 39 | `git reflog` · `git reflog show <브랜치>` · `git fsck --lost-found` · `git reset --hard ORIG_HEAD` · `git cherry-pick` | **커밋은 참조가 끊길 뿐 바로 지워지지 않는다.** 이걸 아는 사람과 모르는 사람의 하루가 다르다 |
| 41 | 브랜치를 지웠는데 되살려야 한다 | 머지된 줄 알고 `-D`로 지웠을 때 | 중급 | 40 | `git reflog` · `git branch <이름> <해시>` · `git fsck --lost-found` | 브랜치 삭제는 커밋을 지우는 게 아니라 이름표를 떼는 것이다 |
| 42 | 태그를 잘못 찍었다 | 엉뚱한 커밋에 `v1.9.0`을 붙여 이미 푸시한 뒤 | 중급 | 28 | `git tag -d` · `git push origin --delete <태그>` · `git tag -a -f` · `git fetch --tags --prune-tags` | **남이 받아간 태그를 옮기면 각자 다른 코드를 같은 버전이라 부르게 된다.** 지우는 것보다 다음 번호로 올리는 게 나을 때가 많다 |
| 43 | 머지를 통째로 되돌려야 한다 | 머지해서 들어간 기능 전체를 빼기로 결정됐을 때 | 고급 | 33 | `git revert -m 1 <머지커밋>` · `git log --graph` · 재머지 시 "리버트의 리버트" | 머지 커밋은 부모가 둘이라 되돌리는 데 방향이 필요하다. **한 번 리버트한 브랜치는 그냥 다시 머지해도 안 들어온다** |

## H. 추적

"이 코드 왜 이래요"와 "언제부터 깨졌어요"에 답하는 구간이다. 쓸 일이 자주 있진 않은데, 쓸 순간에 모르면 반나절이 날아간다.

| 번호 | 시나리오 이름 | 언제 벌어지는가 | 난이도 | 선행 | 배우는 명령 | 배우는 개념 |
| --- | --- | --- | --- | --- | --- | --- |
| 44 | blame으로 이 줄이 왜 이런지 찾는다 | 이상해 보이는 코드를 지우기 전에 | 중급 | 2 | `git blame -L` · `git blame -w -C` · `git show <해시>` · `git log -p -- <파일>` | **코드의 이유는 코드에 없다.** 커밋 메시지와 티켓에 있다. 컨벤션이 여기서 또 회수된다 |
| 45 | bisect로 버그가 들어온 커밋을 찾는다 | 언제부터 깨졌는지 아무도 기억 못 할 때 | 고급 | 44 | `git bisect start` · `git bisect good/bad` · `git bisect run <스크립트>` · `git bisect reset` | 이분 탐색으로 후보를 반씩 줄인다. **재현 스크립트가 있어야 자동으로 돌릴 수 있다** |
| 46 | 특정 파일의 변경 이력을 추적한다 | "이 설정값 누가 언제 바꿨죠" 질문을 받았을 때 | 중급 | 44 | `git log --follow -- <파일>` · `git log -S"문자열"` · `git log -G` · `git log --oneline --stat -- <경로>` | 파일 이름이 바뀌어도 이력은 이어 붙일 수 있다. 파일 기준 검색과 **내용 기준 검색**은 다른 명령이다 |

## I. 정리

쌓이면 느려지고 헷갈리는 것들을 치우는 구간이다.

| 번호 | 시나리오 이름 | 언제 벌어지는가 | 난이도 | 선행 | 배우는 명령 | 배우는 개념 |
| --- | --- | --- | --- | --- | --- | --- |
| 47 | 스태시로 급하게 브랜치를 바꾼다 | 작업 중인데 핫픽스 요청이 끼어들었을 때 | 초급 | 11 | `git stash push -m` · `git stash list` · `git stash pop` · `git stash apply` · `git stash drop` · `git stash -u` | 스태시는 임시 보관이지 저장소가 아니다. **쌓아두면 뭐가 뭔지 모르게 되니 메시지를 붙인다** |
| 48 | 오래된 브랜치를 정리한다 | 머지 끝난 브랜치가 수십 개 쌓였을 때 | 초급 | 27 | `git branch --merged` · `git branch -d` · `git push origin --delete` · `git fetch --prune` · `git remote prune origin` | 브랜치는 로컬·리모트·원격 추적 **세 곳에 따로 있다.** 한 곳만 지우면 나머지가 남는다 |
| 49 | 저장소 상태를 점검하고 정리한다 | 클론이 느려지거나 이상 동작이 보일 때 | 고급 | 48 | `git count-objects -vH` · `git gc` · `git prune` · `git fsck` · `git maintenance` | reflog 만료 기간이 곧 복구 가능 기간이다. **정리를 세게 하면 복구 창구가 닫힌다** |
| 50 | 브랜치 두 개를 동시에 열어둔다 (워크트리) | 리뷰와 내 작업을 하루에 열 번 왔다 갔다 해야 할 때 | 고급 | 47 | `git worktree add` · `git worktree list` · `git worktree remove` · `git worktree prune` | 저장소 하나에 체크아웃이 여러 개 있을 수 있다. 스태시로 버티던 상황이 통째로 사라진다 |

---

## 분포

| 난이도 | 개수 | 번호 |
| --- | --- | --- |
| 초급 | 17 | 1, 2, 3, 4, 5, 8, 9, 11, 12, 14, 20, 21, 22, 28, 29, 47, 48 |
| 중급 | 24 | 6, 7, 10, 13, 15, 16, 17, 18, 19, 23, 24, 25, 26, 27, 31, 32, 33, 34, 35, 36, 41, 42, 44, 46 |
| 고급 | 9 | 30, 37, 38, 39, 40, 43, 45, 49, 50 |
| **합계** | **50** | |

중급이 절반 가까이인 게 맞다. [difficulty.md](../difficulty.md) 기준으로 중급은 **"할 일은 분명한데 방법은 학습자가 고르는"** 단계인데, 현업 Git 상황 대부분이 정확히 여기에 해당한다. 초급은 손에 익히는 구간이고, 고급은 진단부터 시작하는 구간이라 수가 적은 게 정상이다.

## 기존 교재와의 대응

[scenario-week1.md](../scenario-week1.md)의 9막은 이 카탈로그에서 다음 번호에 해당한다. 1주차 교재가 **50개 중 어디를 이미 밟았는지**를 보는 표다.

| 1주차 막 | 카탈로그 번호 |
| --- | --- |
| 1막 저장소 받기 | 1, 2 |
| 2막 첫 티켓과 첫 브랜치 | 3 |
| 3막 첫 커밋과 컨벤션 | 5, 9 |
| 4막 첫 MR | 21 |
| 5막 리뷰 반영하고 커밋 쪼개기 | 6, 24, 25 |
| 6막 main이 앞서갔다 | 14, 15, 18 |
| 7막 스쿼시 머지와 릴리즈 태그 | 27, 28, 29, 48 |
| 8막 운영 장애 | 31, 32 |
| 9막 동료의 force push 사고 | 39, 40 |

1주차가 끝나도 **50개 중 20개**를 밟는다. 나머지 30개가 이 카탈로그를 따로 만든 이유다.

## 어휘 추가 후보

[glossary.md](../glossary.md)에 없는데 이 카탈로그에서 쓴 말이다. glossary는 이 워커가 고치지 않았다. 반영 여부는 어휘 기준표 담당이 판단한다.

| 영어 | 이 문서에서 쓴 표기 | 방식(제안) | 근거 |
| --- | --- | --- | --- |
| SemVer / semantic versioning | SemVer | 원문 | `v1.9.0` 형식과 함께 쓰이는 약어다. "유의적 버전"은 문서에서만 보인다 |
| draft (MR 상태) | Draft | 원문 | GitLab·GitHub 버튼 이름 그대로다. "초안 MR"이라고 쓰는 팀은 드물다 |
| ready (MR 상태) | Ready | 원문 | Draft와 짝이라 같은 방식으로 간다 |
| pipeline | 파이프라인 | 음차 | "CI 파이프라인"이 한 덩어리로 굳었다 |
| code freeze | 코드 프리즈 | 음차 | "코드 동결"은 아무도 안 쓴다 |
| Git LFS | Git LFS | 원문 | 제품 이름이다 |
| worktree (명령) | 워크트리 | 음차 | glossary에 이미 있다. 여기서는 그 표기를 그대로 썼다 |
| filter-repo | `git filter-repo` | 원문 | 외부 도구 이름이라 번역하지 않는다 |
| detached HEAD로 보기 | 디태치드 HEAD | 음차 | glossary 표기를 그대로 썼다 |
| rotate (키) | 키 회전 | 번역 | 보안 쪽에서는 "로테이션"도 쓰이는데 "키 회전"이 더 많이 통한다 |
