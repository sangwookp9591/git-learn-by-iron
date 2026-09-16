# 34 — main 에 직접 커밋해버렸다

> ### 이 시나리오에서 배우는 것
>
> - **배우는 명령** — `git log --oneline` · `git branch <이름>` · `git switch` · `git reset --hard origin/main` · `git stash` · `git cherry-pick` · `git reflog`
> - **배우는 개념** — **브랜치는 커밋을 가리키는 이름표일 뿐이다.** 커밋은 이미 만들어져 있고, 옮겨야 하는 건 이름표다. 로컬 `main`과 `origin/main`은 다른 이름표다.
> - **끝내면 할 수 있는 일** — 브랜치를 잘못 잡고 작업했어도 한 줄도 잃지 않고 제자리로 옮길 수 있고, 커밋 전인지 후인지에 따라 다른 방법을 고를 수 있다.

**난이도** 중급 · **선행 시나리오** 33 · **카탈로그** [G. 사고와 복구](catalog.md#g-사고와-복구)

---

## 상황

2주차 금요일 오전. PAY-272 티켓을 받고 두 시간 반 작업했다. 커밋도 세 개 만들었다. 푸시하려고 하니 거절당한다.

```
$ git push
remote: GitLab: You are not allowed to push code to protected branches on this project.
To gitlab.dalro.example:payments/dalro-payments.git
 ! [remote rejected] main -> main (pre-receive hook declined)
```

`main`이라고 적혀 있다. 브랜치를 안 판 것이다.

```
$ git status
On branch main
Your branch is ahead of 'origin/main' by 3 commits.
  (use "git push" to publish your local commits)

Changes not staged for commit:
        modified:   src/settlement/SettlementReport.ts
```

커밋 세 개에 더해 아직 커밋 안 한 변경도 있다.

## 대사

> **IRON** — JAY 님... 제가 브랜치를 안 파고 `main`에서 작업했어요. 커밋이 세 개고요.
>
> **JAY** — 괜찮아요. 푸시는 막혔죠?
>
> **IRON** — 네, 보호돼 있다고 나와요.
>
> **JAY** — 그럼 아무 일도 안 일어난 거예요. **제 컴퓨터 안에서만 벌어진 일이고, 밖으로는 안 나갔어요.** 보호 설정이 그래서 있는 거고요.
>
> **IRON** — 세 시간 작업한 건데 다시 해야 하나요?
>
> **JAY** — 아니요. 한 줄도 안 잃습니다. 그림부터 봅시다.

```
origin/main:  A ─ B ─ C
                      \
로컬 main:             D ─ E ─ F      ← 내가 만든 커밋 셋
                               +      ← 커밋 안 한 변경도 있음
```

> **JAY** — 지금 상태가 이래요. 커밋 D, E, F는 **이미 만들어져 있어요.** 문제는 그걸 `main`이라는 이름표가 가리키고 있다는 것뿐이에요.
>
> **IRON** — 그럼 커밋을 옮기는 건가요?
>
> **JAY** — 옮길 필요 없어요. **이름표를 하나 더 붙이면 돼요.**
>
> `git branch feature/PAY-272-settlement-report` 하시면, 지금 이 자리에 그 이름이 붙어요. 전환은 안 하고 이름만 붙는 거예요.
>
> **IRON** — 그럼 같은 자리에 이름이 두 개인 거네요.
>
> **JAY** — 네. `main`도 F를 가리키고, 새 브랜치도 F를 가리켜요. 그다음에 `main`만 원래 자리로 되돌리면 끝나요.

```
1) git branch feature/PAY-272-settlement-report

origin/main:  A ─ B ─ C
                      \
                       D ─ E ─ F   ← main, feature/PAY-272-settlement-report

2) git switch feature/PAY-272-settlement-report
3) git switch main
   git reset --hard origin/main

origin/main:  A ─ B ─ C            ← main
                      \
                       D ─ E ─ F   ← feature/PAY-272-settlement-report
```

> **IRON** — `reset --hard` 무섭다고 하셨잖아요.
>
> **JAY** — 맞아요. 워킹 트리까지 날려요. 그래서 **순서가 중요해요.** 이름표를 먼저 붙였으니까 D, E, F는 다른 이름이 붙잡고 있어요. `main`을 되돌려도 커밋이 안 떨어져요.
>
> 순서를 바꿔서 `reset` 먼저 하면 그때는 진짜 위험해요. 리플로그로 찾을 수는 있는데, **찾을 수 있는 거랑 안 잃는 거는 다르죠.**
>
> **IRON** — 아 그래서 브랜치 먼저요.
>
> **JAY** — 네. 사고 수습할 때 규칙이 하나 있어요. **뭘 하든 지금 위치에 이름부터 붙인다.** 9막에서도 같은 얘기 나올 거예요.

### 커밋 안 한 변경은 어떻게 하나

> **IRON** — 그런데 커밋 안 한 변경도 있는데요. `reset --hard` 하면 날아가는 거 아니에요?
>
> **JAY** — 좋은 질문이에요. 커밋 안 한 건 **어떤 브랜치에도 안 붙어 있어요.** 이름표로 못 붙잡아요.
>
> 두 가지 방법이 있어요. 새 브랜치로 전환하고 나서 거기서 커밋을 하시거나, 스태시로 잠깐 치워두고 나중에 꺼내시거나요.
>
> **IRON** — 어느 쪽이 나아요?
>
> **JAY** — 지금은 첫 번째요. 어차피 그 변경은 이 작업의 일부잖아요. 새 브랜치로 옮겨 가서 거기서 커밋하면 그냥 끝나요. 스태시는 **브랜치를 옮겨야 하는데 아직 커밋할 상태가 아닐 때** 쓰는 거고요.
>
> 순서 정리하면요. 브랜치 이름 붙이고 → 그 브랜치로 전환하고(**이때 커밋 안 한 변경은 따라옵니다**) → 거기서 남은 걸 커밋하고 → 그다음에 `main`으로 가서 되돌리는 거예요.
>
> **IRON** — 전환하면 안 커밋한 변경이 따라와요?
>
> **JAY** — 두 브랜치가 지금 같은 자리를 가리키고 있으니까요. 파일이 바뀔 이유가 없어요. 그대로 따라옵니다.

### 이미 푸시가 됐다면

> **IRON** — 만약 `main`이 보호가 안 돼 있어서 푸시까지 됐으면 어떻게 돼요?
>
> **JAY** — 그러면 얘기가 완전히 달라져요. 내 컴퓨터 안의 일이 아니라 **남이 이미 받아갈 수 있는 일**이 되니까요.
>
> 그땐 로컬 `main`을 되돌리는 걸로 안 끝나요. 리모트 `main`도 되돌려야 하는데, 공용 브랜치를 강제로 미는 건 팀 전체한테 영향이 가요. 그 경우엔 33번처럼 **리버트로 가는 게 보통 맞습니다.** 히스토리를 안 건드리고 취소 커밋을 얹는 거요.
>
> **IRON** — 되돌리는데 방법이 두 가지인 거네요.
>
> **JAY** — 기준은 하나예요. **남이 이미 받아갔는가.** 안 받아갔으면 조용히 고쳐도 되고, 받아갔으면 흔적을 남기며 되돌려야 해요. 그래서 `main`이 보호돼 있는 게 고마운 거고요. 선택지가 어려워지기 전에 막아준 거예요.

### 팀 얘기

> **JAY** — 그리고 이거 IRON 님만 그러는 거 아니에요. 저도 했어요.
>
> **IRON** — 정말요?
>
> **JAY** — 다들 한 번씩 해요. 그래서 프롬프트에 브랜치 이름 띄우는 설정을 다 걸어둬요. 터미널에 지금 브랜치가 항상 보이면 확 줄어요.
>
> 그리고 커밋할 때 `main`이면 막아주는 훅도 있어요. 팀에 제안해볼게요. **조심하는 것보다 안 되게 만드는 게 확실해요.**

## 학습자가 할 일

1. 지금 어느 브랜치에 있고 `origin/main`보다 몇 커밋 앞서 있는지 확인한다
2. 커밋 안 한 변경이 있는지도 함께 확인한다
3. **지금 위치에 브랜치 이름을 붙인다.** 전환은 아직 하지 않는다
4. 이름이 두 곳(원래 브랜치, 새 브랜치)에 붙어 같은 커밋을 가리키는 걸 확인한다
5. 새 브랜치로 전환하고, 커밋 안 한 변경이 따라왔는지 확인한다
6. 남은 변경을 그 브랜치에서 커밋한다
7. `main`으로 돌아가 `origin/main` 자리로 되돌린다
8. 되돌린 뒤에도 내 커밋 세 개가 새 브랜치에 그대로 있는지 확인한다
9. 새 브랜치를 푸시하고 MR을 연다
10. 프롬프트에 현재 브랜치가 보이도록 설정한다

## 배우는 명령

```
git status                                      # ahead 3, 커밋 안 한 변경 확인
git log --oneline origin/main..HEAD             # 내가 main에 얹은 커밋들
git log --oneline --graph --all -10

# 1. 이름부터 붙인다 (전환 안 함)
git branch feature/PAY-272-settlement-report
git log --oneline --decorate -4                 # 두 이름이 같은 커밋에 붙어 있다

# 2. 옮겨 가서 남은 변경 커밋
git switch feature/PAY-272-settlement-report
git status                                      # 변경이 따라왔다
git add src/settlement/SettlementReport.ts
git commit -m "feat(settlement): 정산 리포트 기간 필터 추가

Refs: PAY-272"

# 3. main만 되돌린다
git switch main
git reset --hard origin/main
git log --oneline -3                            # origin/main과 같은 자리

# 4. 확인
git log --oneline feature/PAY-272-settlement-report -5
git switch feature/PAY-272-settlement-report
git push -u origin feature/PAY-272-settlement-report
```

커밋 안 한 변경을 스태시로 옮기는 경우:

```
git stash push -m "PAY-272 리포트 필터 작업 중"
git switch -c feature/PAY-272-settlement-report
git stash pop
```

커밋 일부만 옮겨야 할 때 (`main`에 실수 커밋과 정상 커밋이 섞인 경우):

```
git switch -c feature/PAY-272-settlement-report origin/main
git cherry-pick <해시1> <해시2>
git switch main
git reset --hard origin/main
```

잘못 리셋했을 때:

```
git reflog -10
git reset --hard HEAD@{2}
```

## 왜 지금 이게 필요한가

**이건 거의 모든 사람이 한 번은 한다.** 그래서 교재에 넣을 값이 있는 게 아니라, **수습 방법이 직관과 반대라서** 넣는다.

신입의 직관은 이렇다. "잘못된 곳에 커밋했으니 그 커밋을 지우고, 브랜치를 새로 파서, 파일을 다시 복사해서, 다시 커밋한다." 실제로 이렇게 하는 사람을 본다. 세 시간 작업이면 수습에 한 시간이 든다.

맞는 방법은 이것이다. **커밋은 그대로 두고 이름표만 옮긴다.** 파일을 복사할 일도, 다시 커밋할 일도 없다. 명령 세 줄이면 끝난다.

이 차이는 명령을 몰라서 생기는 게 아니라 **브랜치가 뭔지에 대한 모델이 틀려서** 생긴다. 브랜치를 "커밋을 담는 폴더"로 이해하고 있으면 커밋을 옮겨야 한다고 생각한다. 브랜치가 **커밋을 가리키는 이름표**라는 걸 알면 이름표를 옮긴다는 발상이 나온다. 이 시나리오는 그 모델을 교정하는 자리다. 그래서 41번(브랜치를 지웠는데 되살려야 함)과 35번(엉뚱한 브랜치에서 작업함)이 이 뒤에 온다. 같은 모델의 다른 적용이다.

**`reset --hard`를 무섭지 않게 쓰는 법도 여기서 배운다.** 5막에서 "`--hard`는 위험하다"고 배웠다. 그런데 여기서는 `--hard`가 정답이다. 차이는 명령이 아니라 순서다. **이름표를 먼저 붙였기 때문에 안전한 것이다.** 이 순서를 몸에 넣어두면 39번, 40번의 복구 상황에서 같은 식으로 움직인다. 사고 수습의 첫 단계는 언제나 "지금 위치에 이름 붙이기"다.

커밋 안 한 변경을 따로 다룬 것도 의도다. **커밋은 이름표로 붙잡을 수 있지만 커밋 안 한 변경은 못 붙잡는다.** 이게 "커밋해두면 안 잃는다"는 감각으로 이어진다. 11번에서 배운 "되돌린 변경은 Git도 못 찾아준다"의 다른 면이다.

마지막으로 **"푸시까지 됐다면 얘기가 다르다"**를 대사에 넣은 이유. 이 시나리오가 쉬운 건 `main`이 보호돼 있어서다. 그 사실을 학습자가 알아야 보호 설정이 왜 있는지, 그리고 33번의 판단 기준("남이 이미 받아갔는가")이 왜 모든 되돌리기의 출발점인지가 연결된다.
