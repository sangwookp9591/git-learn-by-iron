# git-learn-by-iron

브라우저에서 실제 Git 객체·index·브랜치를 다루는 학습용 실행 엔진입니다. Vanilla TypeScript + Vite이며 UI와 레슨 화면은 포함하지 않습니다. `content/`는 별도 레슨 콘텐츠 영역입니다.

## 실행

Node.js 22.18 이상(또는 24 LTS)을 사용합니다.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

개발 서버 URL의 화면은 비어 있습니다. 브라우저 개발자 도구 콘솔에서 `gitLearn`을 사용할 수 있습니다. Vite는 정적 파일 개발/빌드 도구이며 애플리케이션 API 서버는 없습니다. 페이지 로드 후 엔진은 오프라인에서도 동작합니다. 오프라인 첫 방문을 위한 서비스 워커는 포함하지 않습니다.

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

런타임 의존성은 `isomorphic-git`, `@isomorphic-git/lightning-fs`, `buffer`입니다. `buffer`는 브라우저 ESM Git 구현에 필요한 Buffer 전역을 제공합니다. HTTP 어댑터나 LightningFS의 HTTP 백엔드는 구성하지 않습니다. IndexedDB는 현재 브라우저·origin에 저장되며 브라우저 사이트 데이터를 지우면 학습 기록도 지워집니다.
