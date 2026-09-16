# 17 — 머지 충돌 해결

> ### 이 시나리오에서 배우는 것
>
> - **배우는 명령** — `git merge` · `git status` · `git diff` · `git add` · `git merge --continue` · `git merge --abort` · `git log --merge`
> - **배우는 개념** — 충돌 표시를 읽는 법. 충돌은 Git이 못 고친 부분만 넘겨준 것이지 실패가 아니다. **충돌 해결은 한쪽을 고르는 게 아니라 두 변경이 같이 말이 되게 코드를 다시 쓰는 일이다.**
> - **끝내면 할 수 있는 일** — 충돌이 떴을 때 당황하지 않고 어디가 왜 부딪쳤는지 읽어낸 뒤, 양쪽 의도를 모두 살린 코드로 고쳐서 합치기를 끝낼 수 있다.

**난이도** 중급 · **선행 시나리오** 15 · **카탈로그** [D. 충돌](catalog.md#d-충돌)

---

## 상황

4일차 오후. `feature/PAY-224-idempotency`에서 멱등성 키 처리를 끝냈다. MR을 올리기 전에 최신 `main`을 한 번 합쳐두려고 머지를 실행했더니 멈춘다.

```
Auto-merging src/payment/PaymentService.ts
CONFLICT (content): Merge conflict in src/payment/PaymentService.ts
Automatic merge failed; fix conflicts and then commit the result.
```

`git status`를 보니 이렇다.

```
On branch feature/PAY-224-idempotency
You have unmerged paths.
  (fix conflicts and run "git commit")
  (use "git merge --abort" to abort the merge)

Changes to be committed:
        modified:   src/payment/PaymentRepository.ts
        modified:   src/payment/__tests__/idempotency.test.ts

Unmerged paths:
  (use "git add <file>..." to mark resolution)
        both modified:   src/payment/PaymentService.ts
```

## 대사

> **IRON** — 머지했는데 충돌이 났어요. 제가 뭘 잘못한 걸까요?
>
> **JAY** — 아니요. 그냥 같은 자리를 둘이 고친 거예요. JERRY 님이 어제 `PaymentService`에 재시도 로직을 넣었거든요. IRON 님도 같은 메서드를 고치셨고요.
>
> **IRON** — 그럼 머지가 실패한 건가요?
>
> **JAY** — 실패라기보단 **Git이 자기가 고칠 수 있는 데까지 고치고 나머지를 넘긴 거예요.** `status` 한번 보세요. 파일 세 개가 바뀌었는데 두 개는 이미 합쳐져서 담겨 있죠? 겹치지 않는 부분은 Git이 알아서 합쳐요. 진짜 겹친 데만 남긴 거예요.
>
> **IRON** — 그래서 `Unmerged paths`에 하나만 있는 거군요.
>
> **JAY** — 네. 지금 해야 할 일은 그 파일 하나예요. 열어보세요.

```ts
  async authorize(req: PaymentRequest): Promise<AuthorizeResult> {
<<<<<<< HEAD
    const key = req.headers['idempotency-key'];
    if (key) {
      const cached = await this.repo.findByIdempotencyKey(key);
      if (cached) return cached.result;
    }
    return this.gateway.authorize(req);
=======
    return this.retry.run(() => this.gateway.authorize(req), {
      attempts: 3,
      backoffMs: 200,
    });
>>>>>>> origin/main
  }
```

> **JAY** — 기호 세 개가 보이죠. `<<<<<<<`부터 `=======`까지가 지금 제 브랜치에 있던 코드예요. `HEAD`라고 적혀 있고요. `=======`부터 `>>>>>>>`까지가 합치려는 쪽, 그러니까 `origin/main`이에요. 표시에 이름이 적혀 있어서 헷갈릴 일이 없어요.
>
> **IRON** — 어느 쪽을 지워요?
>
> **JAY** — 지우는 문제가 아니에요. 위쪽은 "같은 키로 두 번 오면 캐시된 결과를 준다"는 거고, 아래쪽은 "게이트웨이 호출이 실패하면 세 번까지 재시도한다"는 거예요. **두 요구사항이 서로 반대되는 게 아니잖아요.** 둘 다 있어야 해요.
>
> **IRON** — 아... 그럼 제가 합쳐서 새로 써야 하네요.
>
> **JAY** — 그게 충돌 해결이에요. 어느 쪽을 고르는 버튼이 아니라 **코드를 다시 쓰는 일**이요. 그래서 자동으로 못 하는 거고요.
>
> 순서를 생각해보세요. 멱등성 키로 캐시를 먼저 보는 게 맞을까요, 재시도를 먼저 감싸는 게 맞을까요?
>
> **IRON** — 캐시가 먼저요. 이미 승인된 요청이면 게이트웨이를 아예 안 부르는 게 맞으니까요.
>
> **JAY** — 맞아요. 그러니까 캐시 확인을 먼저 두고, 캐시가 없을 때만 재시도로 감싸서 호출하는 거예요. 기호 세 줄은 다 지우시고요. **한 줄이라도 남으면 코드가 아니라 텍스트가 돼요.**

고쳐 쓴 결과.

```ts
  async authorize(req: PaymentRequest): Promise<AuthorizeResult> {
    const key = req.headers['idempotency-key'];
    if (key) {
      const cached = await this.repo.findByIdempotencyKey(key);
      if (cached) return cached.result;
    }
    return this.retry.run(() => this.gateway.authorize(req), {
      attempts: 3,
      backoffMs: 200,
    });
  }
```

> **IRON** — 이제 커밋하면 되나요?
>
> **JAY** — `add` 먼저요. 충돌 해결에서 `add`는 "이 파일 다 고쳤다"는 표시예요. 담는다기보다 도장 찍는 거에 가까워요. 그다음에 커밋하면 머지 커밋이 만들어지고요.
>
> **IRON** — 커밋 메시지는요?
>
> **JAY** — 머지 커밋은 Git이 기본 메시지를 채워줘요. 그대로 쓰셔도 되는데, 충돌이 있었으면 **어떻게 합쳤는지 한 줄 적어주시면 좋아요.** 나중에 이 머지 커밋을 보는 사람이 "왜 여기서 순서가 이렇게 됐지"를 안 뒤져도 되니까요.

커밋 직전.

> **JAY** — 아 그리고 커밋하기 전에 테스트 한번 돌리세요.
>
> **IRON** — 충돌만 고친 건데도요?
>
> **JAY** — **충돌 해결이 제일 자주 코드를 깨뜨려요.** 기호 지우다 중괄호 하나 같이 지우거나, 한쪽 변수 선언을 날려버리거나요. 컴파일은 되는데 로직이 반쯤 빠져 있는 경우도 많고요. 지금 두 사람 코드를 손으로 붙인 거라 아무도 안 본 조합이에요.
>
> 그리고 `git diff --check` 한번 쳐보시면 남은 충돌 표시가 있는지 잡아줘요. 이거 CI에 걸어두는 팀도 많아요.

DEREK 님이 지나가다 덧붙인다.

> **DEREK** — 나중에 "이 머지에서 뭐가 부딪쳤었지" 궁금하면 `git log --merge`로 양쪽 커밋만 뽑아볼 수 있어요. 충돌 중일 때만 되는 거라 지금 한번 쳐보세요.

## 학습자가 할 일

1. 머지를 실행하고 멈춘 지점에서 **Git이 이미 합쳐놓은 파일과 못 합친 파일을 구분**한다
2. 충돌한 파일을 열어 `HEAD` 쪽과 합치려는 쪽이 각각 무엇을 하려던 코드인지 읽는다
3. 양쪽이 서로 배타적인지, 둘 다 살려야 하는지 판단한다
4. 두 의도가 모두 살아 있는 코드로 다시 쓰고, 충돌 표시 세 줄을 전부 지운다
5. 남은 충돌 표시가 없는지 기계적으로 확인한다
6. 해결한 파일을 스테이징해 "해결했다"고 표시한다
7. 테스트를 돌려 합친 코드가 실제로 동작하는지 확인한다
8. 머지 커밋을 만들고, 메시지에 어떻게 합쳤는지 한 줄 남긴다

## 배우는 명령

```
git fetch origin
git merge origin/main
# CONFLICT

git status                              # Unmerged paths 확인
git diff                                # 충돌 부분만 보여준다
git log --merge --oneline               # 충돌에 관련된 양쪽 커밋
git diff --diff-filter=U --name-only    # 충돌 파일만 뽑기

# 파일 수정 (기호 세 줄 제거, 양쪽 의도 합치기)

git diff --check                        # 남은 충돌 표시 검사
git add src/payment/PaymentService.ts
git status                              # Unmerged paths가 비었는지
npm test
git merge --continue                    # 또는 git commit

git log --oneline --graph -5
git show --stat HEAD                    # 부모가 둘인 머지 커밋
```

막혔을 때:

```
git merge --abort                       # 머지 시작 전으로 완전히 복귀
git checkout --ours  src/payment/PaymentService.ts    # 내 쪽 원본으로 되돌리고 다시 시작
git checkout --theirs src/payment/PaymentService.ts   # 상대 쪽 원본으로 되돌리고 다시 시작
```

> `--ours`와 `--theirs`는 **고르는 용도가 아니라 다시 시작하는 용도**로 쓴다. 한쪽을 통째로 택하면 다른 쪽 변경이 조용히 사라진다. 19번에서 이 함정을 자세히 다룬다.

## 왜 지금 이게 필요한가

**충돌은 사고가 아니라 일상이다.** 이 문장을 신입 때 못 들으면, 충돌이 뜰 때마다 자기가 뭔가 잘못했다고 생각한다. 그러면 두 가지 중 하나가 된다. 충돌이 무서워서 브랜치를 며칠씩 안 합치거나(그래서 충돌이 더 커지거나), 아무거나 골라서 남의 코드를 조용히 지운다. 둘 다 더 큰 문제다.

여기서 배우는 핵심은 하나다. **충돌 해결은 선택이 아니라 작성이다.**

에디터들이 "Accept Current / Accept Incoming / Accept Both" 버튼을 달아둔 탓에 충돌이 객관식처럼 보인다. 그런데 이 시나리오의 코드를 보면 안다. 캐시 확인과 재시도는 서로 배타적이지 않고, "둘 다 받기" 버튼을 눌러도 순서가 틀리면 멱등성이 깨진다. **버튼으로 해결되는 충돌은 애초에 Git이 자동으로 합쳤을 것들이다.** 사람에게 넘어온 건 판단이 필요해서 넘어온 것이다.

`git status`를 먼저 보게 하는 것도 의도가 있다. 충돌이 나면 저장소 전체가 망가진 것처럼 느껴지는데, 실제로는 파일 세 개 중 하나만 남은 상태다. **문제의 크기를 정확히 재는 것이 당황하지 않는 첫 단계다.**

테스트를 강조하는 이유도 경험에서 온다. 충돌 해결 직후의 코드는 **아무도 본 적 없는 조합**이다. 양쪽 브랜치의 CI는 각자 통과했지만, 손으로 붙인 이 버전은 이 순간 처음 존재한다. 여기서 안 돌려보면 다음 사람이 운영에서 발견한다.

마지막으로 `--abort`를 명령 목록에 같이 둔 것도 일부러다. 18번에서 다시 나오지만 원칙은 지금 세운다. **되돌아갈 수 있다는 걸 알아야 손을 댄다.**
