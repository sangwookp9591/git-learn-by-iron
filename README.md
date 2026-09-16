# git-learn-by-iron

브라우저에서 실제 Git 객체·index·브랜치를 다루는 학습용 실행 엔진입니다. Vanilla TypeScript + Vite로 만든 레슨 워크벤치이며 지시·소스 컨트롤·커밋 그래프·터미널을 한 화면에서 사용합니다. `content/`는 별도 레슨 콘텐츠 영역입니다.

## 실행

Node.js 22.18 이상(또는 24 LTS)을 사용합니다.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

개발 서버 URL을 열면 “필요한 변경만 골라 담기” 실습이 시작됩니다. 소스 컨트롤의 +/− 버튼과 커밋 버튼, 또는 터미널 명령으로 진행하고 각 단계에서 상태 확인을 누릅니다. 브라우저 개발자 도구 콘솔에서는 `gitLearn`도 사용할 수 있습니다. Vite는 정적 파일 개발/빌드 도구이며 Git 엔진은 API 서버에 의존하지 않습니다. 페이지 로드 후 엔진은 오프라인에서도 동작합니다. 오프라인 첫 방문을 위한 서비스 워커는 포함하지 않습니다.

## API 사용

```ts
import { createRepo } from './src/engine/repo.ts';
import { readState } from './src/engine/state.ts';
import { parse } from './src/terminal/parse.ts';
import { run } from './src/terminal/run.ts';

const repo = await createRepo('lesson-01');
await repo.writeFile('hello.txt', '첫 번째 내용\n');
await run(repo, 'git add hello.txt');
console.log(await run(repo, 'git commit -m "첫 번째 커밋"'));
await repo.writeFile('hello.txt', '수정한 내용\n');
console.log(await readState(repo));
console.log(await run(repo, parse('git status')));
```

콘솔에서는 위 import 대신 `const { createRepo, readState, parse, run } = gitLearn`을 사용합니다. 모든 파일 변경·명령·상태 읽기를 순서대로 `await`하세요. 같은 저장소에 대한 병렬 명령 실행과 여러 탭의 동시 편집은 이번 API의 지원 범위가 아닙니다.

- `createRepo(lessonId)`: 레슨 ID마다 별도의 LightningFS IndexedDB 저장소를 생성하거나 재사용합니다. 초기 브랜치는 `main`이며 다시 열거나 `init()`을 호출해도 학습 내용을 지우지 않습니다.
- `repo.writeFile(path, text)`, `readFile(path)`, `removeFile(path)`: 저장소 루트 기준 상대 경로를 사용합니다. 하위 디렉터리는 자동 생성합니다. 절대 경로, `..`, `.git` 접근을 거부합니다.
- `repo.add(paths = '.')`, `unstage(paths = '.')`, `reset(paths = '.')`: 문자열 또는 경로 배열을 받습니다. `reset`은 HEAD 기준 스테이징 해제만 지원하며 파일 내용은 유지합니다.
- `repo.commit(message, author?)`: 스테이징된 변경만 커밋하고 SHA를 반환합니다. 빈 메시지와 빈 커밋은 거부합니다. 기본 작성자는 `학습자 <learner@example.invalid>`입니다.
- `repo.status()`: isomorphic-git의 `[path, HEAD, WORKDIR, STAGE]` 행렬입니다.
- `repo.log()`, `branch(name?)`, `currentBranch()`, `checkout(name, create?)`, `switch(name, create?)`: 실제 Git 이력과 로컬 브랜치를 다룹니다. `branch()`는 목록 조회, `branch(name)`은 생성입니다. 강제 checkout은 지원하지 않으며 덮어쓰기 충돌 시 기존 작업을 보호합니다.

파일 수정은 반드시 `repo.writeFile()`로 하세요. isomorphic-git의 초 단위 stat 캐시가 같은 길이의 빠른 수정을 놓치지 않도록 새 inode의 임시 파일을 쓴 뒤 교체합니다. `repo.fs`와 `repo.dir`는 고급 진단용이며 직접 쓰기는 이 보장을 우회합니다. 각 변경 API는 LightningFS 메타데이터까지 flush한 후 반환합니다.

## 채점 상태 계약

`readState(repo)`는 JSON 직렬화 가능한 객체를 반환합니다.

| 필드 | 의미 |
| --- | --- |
| `index: string[]` | HEAD와 index가 다른 경로. 다음 커밋에 들어갈 변경이며 삭제도 포함 |
| `worktree: string[]` | index와 작업 파일이 다른 경로. 미추적·수정·삭제 포함 |
| `head: { sha, message } \| null` | 현재 HEAD 커밋. 첫 커밋 전에는 `null` |
| `branch: string \| null` | 현재 브랜치명 |
| `branches: string[]` | 로컬 브랜치 이름 목록. 현재 브랜치 이외의 존재 여부도 판정 가능 |
| `commits: CommitState[]` | 현재 HEAD에서 도달 가능한 커밋, 최신순. SHA·메시지·부모 SHA·작성자 포함 |
| `status: StatusRow[]` | 상태 출력에 쓰는 원본 행렬 |

`index`와 `worktree`는 정렬된 경로 배열입니다. add한 파일을 다시 수정하면 같은 경로가 두 배열 모두에 나옵니다. 변경 두 개와 신규 파일 하나 중 하나만 add하면 `index.length === 1`, `worktree.length === 2`이며, 커밋 후에도 나머지 두 파일은 dirty입니다. `commits`는 현재 브랜치 이력이며 모든 브랜치의 합집합이 아닙니다.

## 지원 명령

```text
git status
git add <경로...> | git add . | git add -A
git commit -m "메시지 안에 띄어쓰기"
git restore --staged <경로...>
git reset [HEAD] [경로...]
git log [--oneline]
git diff --name-only
git branch [이름]
git switch <이름> | git switch -c <이름>
git checkout <이름> | git checkout -b <이름>
```

작은/큰 따옴표, 역슬래시 이스케이프, `--` 뒤의 옵션처럼 생긴 파일명을 처리합니다. 셸 명령 실행·변수 확장·파이프·glob·remote Git·네트워크 전송은 제공하지 않습니다. 미지원 명령/옵션은 `이 명령은 뒤쪽 레슨에서 다룹니다.`를 반환하며 저장소를 바꾸지 않습니다. 잘못된 경로나 닫히지 않은 따옴표 같은 입력 오류는 `오류:`로 반환합니다. `diff --name-only`는 추적 중인 파일의 unstaged 변경만 출력합니다.

반환 문자열은 한국어 Git 상태/브랜치 출력 형식을 따르는 지원 명령 부분집합입니다. 전체 Git CLI 출력의 바이트 단위 복제는 아닙니다. 소비자는 결과를 `textContent` 등 텍스트로 렌더링하고 `innerHTML`로 삽입하지 않아야 합니다.

## 검증과 의존성

`npm test`는 Node 내장 테스트 러너로 실제 isomorphic-git + LightningFS를 실행합니다. Node에서는 `fake-indexeddb`로 IndexedDB만 대체하며 Git 연산은 모킹하지 않습니다. Node 25의 Web Locks에서 LightningFS가 남기는 10분 타이머를 피하기 위해 테스트는 IndexedDB mutex 경로를 사용합니다. 브라우저에서는 원래 Web Locks 경로를 사용합니다.

부분 스테이징 왕복, 한글 메시지 파싱, 초기 상태, 빈 커밋 방지, add 후 재수정, restore/reset, 삭제·하위 경로, 브랜치 이동과 충돌 보존, 레슨 격리, 경로 검증, 미지원 명령 무변경, ignore 및 동일 길이 수정이 검사됩니다.

런타임 의존성은 `isomorphic-git`, `@isomorphic-git/lightning-fs`, `buffer`, `yaml`입니다. `buffer`는 브라우저 ESM Git 구현에 필요한 Buffer 전역을 제공합니다. HTTP 어댑터나 LightningFS의 HTTP 백엔드는 구성하지 않습니다. IndexedDB는 현재 브라우저·origin에 저장되며 브라우저 사이트 데이터를 지우면 학습 기록도 지워집니다.


## 레슨과 채점

`src/fixtures/staging-basics.lesson.yaml`과 같은 경로의 setup YAML은 현재 엔진으로 완주 가능한 초급 실습입니다. `content/lessons/*.yaml`도 Vite glob으로 모두 찾아 레슨 선택에 노출합니다. 디렉터리의 파일 개수를 가정하지 않습니다. 콘텐츠를 추가한 뒤 개발 서버를 다시 열거나 빌드하면 목록에 포함됩니다.

`src/lesson/assert.ts`의 `evaluateAssertions(assertions, state, baseline?)`는 `readState()` 스냅샷만 받습니다. 명령 기록을 입력받지 않으므로 UI 버튼과 터미널이 같은 상태를 만들면 같은 판정을 받습니다. 결과는 `{ passed, failures: [{ assertion, expected, actual }] }`이며 명령어 문자열로 통과를 결정하지 않습니다.

최소 지원 단언은 `index.has`, `index.lacks`, `worktree.dirty`, `worktree.clean`, `head.moved`, `head.message.matches`, `branch.current`, `branch.exists`, `commit.count`입니다. `head.moved`는 해당 단계 진입 시 HEAD와 비교하며, `commit.count`는 현재 HEAD에서 도달 가능한 전체 커밋 수입니다. `worktree.clean`은 스테이징과 작업 폴더 양쪽에 미커밋 변경이 없는 상태입니다. `worktree.dirty: 파일명`은 그 파일에 미커밋 변경이 있는지를 판정합니다.

`index.empty`, `index.has_staged`, `head.detached`, `branch.absent`도 지원합니다. 네임스페이스는 index/worktree/head/branch/commit/reflog/remote 일곱 개로 제한하며, reflog/remote의 실제 데이터 수집·채점은 아직 제공하지 않습니다. 얇은 별칭 표와 현재 콘텐츠의 단계별 미지원 이유는 [검증 및 호환성 보고서](src/lesson/verification.md)에 있습니다.

현재 content fixture는 `working_tree`, `remote`, `dangling` 등을 사용합니다. 이 로더의 `{ commits: [{message, files}], worktree: {경로: 내용}, branch? }` 계약과 아직 정렬되지 않았으므로 해당 레슨은 미리보기로 열립니다. 미지원 단계는 이유를 표시하고 건너뛸 수 있으며, **미리보기 종료를 실습 통과로 기록하지 않습니다.** 콘텐츠 자체는 수정하지 않습니다.

힌트 조건은 `index.has(README.md)`, `!index.has("login.js")`, `idle(45s)`, `idle > 20s`, `&&`, `||`, 괄호와 비교식을 지원합니다. `eval`이나 명령 기록은 사용하지 않습니다. 직접 힌트를 요청하면 상태가 맞는 조건 또는 시간 기반 힌트 중 다음 것을 보여주며, 고급에서는 자동 노출을 하지 않습니다.

페이지 새로고침·레슨 선택·처음부터 버튼은 별도의 새 연습 저장소를 만듭니다. 이번 버전은 레슨 진행의 이어하기를 제공하지 않습니다. 동시에 여러 버튼이 실행되지 않도록 처리 중에는 조작을 잠그며, 상태가 바뀌면 이전 통과 판정을 폐기하고 다음 단계 진입 전 다시 검사합니다.

화면의 Google Fonts 요청은 IBM Plex Sans KR와 IBM Plex Mono 로딩에만 사용됩니다. Git 연산과 채점은 로컬에서 수행하며 네트워크에 저장소를 전송하지 않습니다. 레슨 내용·파일명·터미널 출력은 HTML이 아닌 텍스트로 렌더링합니다. 색상 토큰과 다크 모드는 `src/ui/style.css`에서 관리하며 터미널 배경은 두 모드 모두 `#0C1319`입니다.
