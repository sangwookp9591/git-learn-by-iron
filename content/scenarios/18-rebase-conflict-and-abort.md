# 18 — 리베이스 도중 충돌, 그리고 --abort 로 원위치

> ### 이 시나리오에서 배우는 것
>
> - **배우는 명령** — `git rebase origin/main` · `git status` · `git add` · `git rebase --continue` · `git rebase --skip` · `git rebase --abort` · `git reflog` · `git push --force-with-lease`
> - **배우는 개념** — 리베이스는 커밋을 하나씩 다시 얹는다. 그래서 충돌이 커밋 개수만큼 날 수 있고, `HEAD`가 가리키는 쪽이 머지와 반대로 느껴진다. **포기하고 원위치하는 길이 항상 열려 있다.**
> - **끝내면 할 수 있는 일** — 리베이스 도중 멈춰도 지금 몇 번째 커밋을 얹는 중인지 파악해 이어갈 수 있고, 엉켰다 싶으면 한 줄로 시작 전 상태로 완전히 되돌릴 수 있다.

**난이도** 중급 · **선행 시나리오** 17 · **카탈로그** [D. 충돌](catalog.md#d-충돌) · **함께 다루는 시나리오** 20

---

## 상황

4일차 오전. `feature/PAY-231-card-expiry` MR에 충돌 경고가 떴다. 어제 저녁 JERRY 님이 검증 로직을 리팩터링해서 `main`에 넣었다. 팀 규칙대로 리베이스로 따라잡으려는데, 커밋이 세 개라 세 번 멈출 수 있다.

```
$ git rebase origin/main
Auto-merging src/payment/PaymentValidator.ts
CONFLICT (content): Merge conflict in src/payment/PaymentValidator.ts
error: could not apply 7f2a91c... feat(payment): 카드 만료일 검증 추가
hint: Resolve all conflicts manually, mark them as resolved with
hint: "git add/rm <conflicted_files>", then run "git rebase --continue".
hint: You can instead skip this commit: run "git rebase --skip".
hint: To abort and get back to the state before "git rebase", run "git rebase --abort".
Could not apply 7f2a91c... feat(payment): 카드 만료일 검증 추가
```

## 대사

> **IRON** — 어제 머지 충돌은 한 번 고치고 끝났는데, 이건 "커밋 3개 중 1번째"라고 나와요.
>
> **JAY** — 리베이스는 방식이 달라요. 머지는 양쪽 결과를 한 번에 합쳐요. 리베이스는 **내 커밋을 하나씩 순서대로 다시 얹어요.** 그래서 최악의 경우 세 번 멈춰요.
>
> **IRON** — 세 번요? 그럼 같은 충돌을 세 번 고쳐요?
>
> **JAY** — 비슷한 자리를 여러 번 고치게 될 수도 있어요. 그게 리베이스가 귀찮은 이유고, 그래서 **커밋 수가 많고 충돌이 클 것 같으면 머지가 나을 때도 있어요.** 그건 16번에서 고르는 얘기를 따로 하고요. 지금은 세 개니까 해봅시다.

파일을 연다.

```ts
<<<<<<< HEAD
  private validate(req: PaymentRequest): ValidationResult {
    return this.rules.reduce(
      (acc, rule) => acc.merge(rule.check(req)),
      ValidationResult.ok(),
    );
=======
  validateExpiry(card: Card): boolean {
    const now = new Date();
    return card.expiryYear > now.getFullYear()
      || (card.expiryYear === now.getFullYear() && card.expiryMonth >= now.getMonth() + 1);
>>>>>>> 7f2a91c (feat(payment): 카드 만료일 검증 추가)
```

> **IRON** — 어제랑 위아래가 반대인 것 같은데요. `HEAD`가 제 코드 아니었나요?
>
> **JAY** — 그게 리베이스에서 제일 헷갈리는 부분이에요. 지금 `HEAD`는 **제가 올라가고 있는 바닥**이에요. 최신 `main`이요. 아래가 지금 얹으려는 제 커밋이고요.
>
> 생각해보면 당연해요. 리베이스는 `main` 위에 서서 제 커밋을 하나씩 가져다 붙이는 거잖아요. 서 있는 자리가 `HEAD`죠.
>
> **IRON** — 그래서 `--ours`가 `main`이 되는 거네요.
>
> **JAY** — 맞아요. 그래서 리베이스 중에 `--ours` `--theirs` 쓰면 열에 아홉은 반대로 씁니다. **표시에 적힌 커밋 해시랑 메시지를 보세요.** 아래쪽에 `7f2a91c feat(payment): 카드 만료일 검증 추가`라고 제 커밋 제목이 박혀 있잖아요. 그게 제일 확실해요.
>
> **IRON** — 어느 쪽을 남겨요?
>
> **JAY** — 어제랑 같아요. 둘 다요. JERRY 님이 검증을 규칙 객체로 바꿔놨으니까, 제 만료일 검증도 그 구조 안에 규칙 하나로 들어가야 해요. **구조가 바뀐 위에 내 의도를 다시 구현하는 거예요.**

고쳐 쓴 뒤.

> **JAY** — `add` 하시고 `rebase --continue` 하세요. **커밋은 하지 마시고요.**
>
> **IRON** — 왜요?
>
> **JAY** — 리베이스 중에는 Git이 커밋을 대신 만들어요. 원래 커밋 메시지를 그대로 쓰고요. 여기서 `git commit`을 따로 치면 커밋이 하나 더 생겨서 순서가 꼬여요.

두 번째 커밋에서 또 멈춘다.

```
error: could not apply 4d81c6b... fix(payment): 만료 카드 요청에 400 반환
```

> **IRON** — 또 났어요. 이번엔 컨트롤러 쪽이에요.
>
> **JAY** — 지금 어디까지 왔는지 `status`로 보세요. "Last commands done (2 commands)" 이런 식으로 몇 개째인지 알려줘요.

세 번째에서 이상한 게 뜬다.

```
error: could not apply 3c02af9... test(payment): 만료일 경계값 테스트 추가
```

파일을 열어보니 충돌 표시 안쪽 양쪽이 사실상 같은 내용이다. JERRY 님이 리팩터링하면서 같은 테스트를 이미 넣어놨다.

> **IRON** — 이건 제 커밋이 이미 들어가 있는 거랑 똑같은데요. JERRY 님이 같은 테스트를 쓰셨어요.
>
> **JAY** — 그럼 이 커밋은 얹을 게 없어요. `--skip` 하시면 이 커밋을 빼고 다음으로 넘어가요.
>
> **IRON** — 제 커밋이 없어지는 건가요?
>
> **JAY** — 이 리베이스 결과에서는 빠져요. 내용은 이미 `main`에 있으니까 코드는 손해가 없고요. 근데 **`--skip`은 조심해서 쓰세요.** "내용이 이미 있다"고 확신할 때만이에요. 충돌이 귀찮아서 건너뛰면 내 변경이 조용히 사라집니다. 아마 이게 리베이스에서 제일 흔한 사고일 거예요.

세 번째 커밋을 건너뛰고 리베이스가 끝났다. 그런데 테스트를 돌려보니 깨진다.

> **IRON** — 테스트가 두 개 깨져요. 충돌 고치다가 뭘 잘못한 것 같은데 어디서 잘못했는지 모르겠어요. 세 번을 고쳐서요.
>
> **JAY** — 그럼 되돌리죠. 아직 푸시 안 하셨죠?
>
> **IRON** — 네.
>
> **JAY** — `git rebase --abort` 하세요. **리베이스 시작 전 상태로 완전히 돌아갑니다.** 제 커밋 세 개 다 원래 모습으로 돌아오고, 워킹 트리도 그대로예요.
>
> **IRON** — 리베이스가 이미 끝났는데도요?
>
> **JAY** — 아, 끝났으면 `--abort`는 안 돼요. 그건 리베이스 **중일 때만** 쓰는 거예요. 끝난 뒤에는 리플로그로 돌아갑니다.
>
> ```
> $ git reflog -6
> a44e01b HEAD@{0}: rebase (finish): returning to refs/heads/feature/PAY-231-card-expiry
> a44e01b HEAD@{1}: rebase (pick): fix(payment): 만료 카드 요청에 400 반환
> f19c882 HEAD@{2}: rebase (pick): feat(payment): 카드 만료일 검증 추가
> e7b1d55 HEAD@{3}: rebase (start): checkout origin/main
> 3c02af9 HEAD@{4}: commit: test(payment): 만료일 경계값 테스트 추가
> ```
>
> **JAY** — `rebase (start)` 바로 위 줄, `HEAD@{4}`가 리베이스 시작 전 제 브랜치 끝이에요. 거기로 리셋하면 리베이스 안 한 상태가 돼요. `ORIG_HEAD`도 같은 데를 가리키고 있을 거고요.
>
> **IRON** — 그럼 한 번 더 해야 하네요.
>
> **JAY** — 네. 근데 **처음부터 다시 하는 게 세 번 고친 걸 뒤지는 것보다 빨라요.** 이번엔 한 커밋 끝날 때마다 테스트 돌려보세요. 어디서 깨졌는지 바로 알 수 있어요.
>
> **IRON** — 리베이스 중간에 테스트를 돌려도 돼요?
>
> **JAY** — 돼요. 멈춘 상태에서 워킹 트리는 정상이에요. 그리고 커밋마다 자동으로 테스트 돌리는 옵션도 있어요. `--exec`요. 세 커밋이면 손으로 하는 게 편한데, 열 개쯤 되면 이게 낫습니다.

다시 해서 성공한 뒤.

> **JAY** — 커밋 해시가 전부 바뀌었어요. 내용은 같은데 바닥이 달라졌으니까 다른 커밋이 된 거예요. 그래서 그냥 푸시하면 거절당해요. `--force-with-lease` 쓰셔야 하고요.
>
> 그리고 이 브랜치 저 말고 아무도 안 받아갔죠? 남이 받아간 브랜치를 리베이스하면 그 사람이 똑같은 일을 겪어요. 9막에서 볼 그 사고가 정확히 그거예요.

## 학습자가 할 일

1. 리베이스를 시작하고 멈춘 지점에서 **지금 몇 번째 커밋을 얹는 중인지** 확인한다
2. 충돌 표시에서 `HEAD` 쪽이 무엇인지 확인한다 — 머지 때와 무엇이 달라졌는지 말로 설명해본다
3. 리팩터링된 구조 위에 내 의도를 다시 구현하고 충돌 표시를 지운다
4. 스테이징하고 리베이스를 계속한다 (**커밋하지 않는다**)
5. 두 번째 충돌도 같은 방식으로 처리한다
6. 세 번째에서 "이미 반영된 커밋"임을 확인하고 건너뛴다 — 건너뛰기 전에 **내용이 정말 이미 있는지** 근거를 확인한다
7. 테스트가 깨진 것을 확인하고, 리베이스 시작 전으로 되돌린다
8. 다시 리베이스하되 커밋마다 테스트를 돌려 어느 단계에서 깨지는지 좁힌다
9. 해시가 전부 바뀐 것을 확인하고 안전하게 푸시한다

## 배우는 명령

```
git fetch origin
git log --oneline HEAD..origin/main     # 저쪽에만 있는 커밋
git log --oneline origin/main..HEAD     # 내 쪽에만 있는 커밋 (몇 번 멈출지 가늠)

git rebase origin/main
# CONFLICT

git status                              # 몇 번째 커밋인지, 어느 파일인지
git diff                                # 충돌 부분
git add src/payment/PaymentValidator.ts
git rebase --continue                   # commit 하지 않는다

# 이미 반영된 커밋일 때 (근거를 확인한 뒤에만)
git log --oneline origin/main --grep="경계값"
git rebase --skip

# 중간에 검증하기
npm test
git rebase --exec "npm test" origin/main   # 커밋마다 자동 실행

# 포기하고 원위치
git rebase --abort                      # 리베이스 "중"일 때만

# 이미 끝난 리베이스를 되돌리기
git reflog -10
git reset --hard ORIG_HEAD
# 또는
git reset --hard HEAD@{4}

git log --oneline -5                    # 해시가 바뀐 것 확인
git push --force-with-lease
```

다른 작업의 원위치 명령도 같은 계열이다. 셋을 묶어서 외운다.

```
git merge --abort
git rebase --abort
git cherry-pick --abort
```

## 왜 지금 이게 필요한가

17번에서 충돌 표시 읽는 법을 배웠다. 여기서는 **같은 충돌이 리베이스에서는 다르게 느껴진다**는 것을 배운다. 차이가 두 개다.

**하나. 여러 번 멈춘다.** 머지는 결과 대 결과라 한 번이면 끝난다. 리베이스는 커밋을 하나씩 다시 얹으니까 커밋 수만큼 멈출 수 있다. 이걸 모르면 두 번째 충돌에서 "아까 고쳤는데 왜 또 나오지"로 무너진다. 그리고 이 사실이 16번(리베이스와 머지 중 고르기)의 판단 근거가 된다. **커밋이 많고 충돌이 클 것 같으면 머지가 싸다.**

**둘. `HEAD`가 반대다.** 머지에서 `HEAD`는 내 브랜치였는데 리베이스에서는 올라가는 바닥이다. 헷갈린 채로 `--ours`를 쓰면 남의 코드나 내 코드 한쪽이 통째로 사라진다. 대사에서 **"표시에 적힌 커밋 해시와 제목을 보라"**고 한 게 유일하게 안 헷갈리는 방법이다.

그리고 이 시나리오의 절반은 **`--abort`에 관한 것**이다. 카탈로그 20번(충돌 해결을 포기하고 원위치)을 따로 떼지 않고 여기서 같이 다루는 이유가 있다. 원위치는 그것만 떼어놓으면 배울 게 없는 명령이다. **세 번 고치다 엉켰고 어디서 틀렸는지 모르겠는 상태**를 겪어야 `--abort`가 왜 고마운 명령인지 안다.

여기서 같이 잡아야 할 감각이 하나 더 있다. **포기하고 다시 하는 게 뒤지는 것보다 빠를 때가 있다.** 신입은 이미 들인 시간이 아까워서 계속 파고든다. 리베이스는 원위치가 한 줄이라 다시 하는 비용이 거의 없다. 이걸 알면 판단이 빨라진다.

`--skip`을 사고 사례와 함께 소개한 것도 의도다. `--continue`보다 치기 쉬워서 충돌이 귀찮을 때 손이 간다. 그런데 이건 **내 변경을 조용히 버리는 명령**이다. 명령 목록에 넣되 반드시 "근거를 확인한 뒤에만"이라는 조건을 붙여야 한다.
