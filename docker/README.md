# 로컬에서 학습 환경 띄우기

노드 버전을 맞추고, 픽스처용 git을 깔고, 학습 기록을 남길 자리를 만드는
일을 전부 컨테이너 안에서 한다. 노트북에 필요한 건 Docker 하나다.

## 시작하기

```bash
git pull
docker compose up
```

빌드까지 처음 한 번은 2~3분 걸린다. 다 뜨면 브라우저에서 연다.

```
http://localhost:5173
```

## 뭐가 뜨는가

| 서비스 | 포트 | 하는 일 |
| --- | --- | --- |
| `app` | 5173 | 레슨 러너 화면 |
| `progress` | 4000 | 학습 기록 API. SQLite에 결과를 남긴다 |

`app`은 `progress`가 살아난 다음에 뜬다. 기록 서버가 죽은 채로 레슨을
시작하면 결과가 안 남으니 순서를 강제해 뒀다.

> `app`은 `src/`의 레슨 러너가 들어와야 화면이 뜬다. 아직 작업 중이라면
> 기록 서버만 따로 띄워서 확인할 수 있다.
>
> ```bash
> docker compose up progress
> curl localhost:4000/health
> ```

## 이전 결과는 어디에 남나

```
./data/progress.db
```

호스트 디렉터리에 그대로 남는 SQLite 파일이다. `docker compose down`으로
컨테이너를 내려도, 이미지를 다시 빌드해도 기록은 그대로다.

개인 기록이라 저장소에는 올라가지 않는다 (`data/.gitignore`).

### 기록을 직접 들여다보기

```bash
# 레슨별 마지막 결과
sqlite3 data/progress.db "SELECT lesson_id, difficulty, status, duration_ms, hint_count FROM latest_run;"

# 자주 막히는 스텝
sqlite3 data/progress.db "
  SELECT lesson_id, step_index, SUM(attempts) AS attempts
    FROM step_result s JOIN run r ON r.id = s.run_id
   WHERE s.passed = 0
   GROUP BY lesson_id, step_index
   ORDER BY attempts DESC;"

# 어떤 힌트가 실제로 떴나
sqlite3 data/progress.db "SELECT step_index, hint_index, trigger, shown_at FROM hint_shown ORDER BY shown_at DESC LIMIT 20;"
```

`sqlite3`가 없으면 컨테이너 안에서 실행한다.

```bash
docker compose exec progress node -e "
  const {DatabaseSync}=require('node:sqlite');
  const db=new DatabaseSync('/app/data/progress.db');
  console.table(db.prepare('SELECT * FROM latest_run').all());
"
```

### 처음부터 다시 하고 싶으면

```bash
rm data/progress.db*
```

기록만 지워진다. 레슨 내용은 그대로다.

## 기록 API

레슨 러너가 부르는 엔드포인트다. 직접 호출해서 확인해도 된다.

| 메서드 | 경로 | 하는 일 |
| --- | --- | --- |
| `GET`  | `/health` | 살아 있는지, DB 경로가 어디인지 |
| `POST` | `/api/runs` | 레슨 시작. `{learnerId, lessonId, difficulty}` → `{runId}` |
| `POST` | `/api/steps` | 스텝 결과. 같은 스텝을 다시 보내면 `attempts`가 올라간다 |
| `POST` | `/api/hints` | 힌트가 떴을 때. 어떤 조건으로 떴는지까지 남긴다 |
| `POST` | `/api/commands` | 학습자가 실제로 친 명령 |
| `POST` | `/api/runs/finish` | 레슨 종료. `status`는 `passed`/`failed`/`abandoned` |
| `GET`  | `/api/history?learnerId=&lessonId=` | 그 레슨의 지난 시도 20개 |
| `GET`  | `/api/progress?learnerId=` | 레슨별 최신 결과 + 자주 막힌 스텝 |

확인해 보려면:

```bash
curl localhost:4000/health
curl "localhost:4000/api/progress?learnerId=iron"
```

## 자주 겪는 문제

**5173 포트가 이미 쓰이고 있다**
`docker-compose.yml`의 `ports`를 `"5174:5173"`처럼 바꾼다. 컨테이너 안쪽
포트는 그대로 둔다.

**코드를 고쳤는데 화면이 안 바뀐다**
`.:/app` 바인드 마운트가 걸려 있어 소스는 바로 반영된다. 다만
`package.json`이 바뀌었으면 의존성을 다시 깔아야 한다.

```bash
docker compose build --no-cache
docker compose up
```

**`node_modules` 관련 에러가 난다**
호스트와 컨테이너의 네이티브 모듈이 섞인 경우다. 이름 붙은 볼륨을 지운다.

```bash
docker compose down -v
docker compose up --build
```

**`progress`가 계속 재시작한다**
`./data` 쓰기 권한 문제일 때가 많다.

```bash
docker compose logs progress
```

## Docker 없이 돌리기

가능하다. Node 22.18 이상이 필요하다.

```bash
npm ci
node --experimental-sqlite docker/progress-server.mjs &   # Node 24 이상은 플래그 불필요
npx vite
```

`--experimental-sqlite`는 Node 22 기준이다. Node 24부터는 `node:sqlite`가
기본으로 열려 있어 플래그 없이 실행한다. 이 버전 차이를 매번 신경 쓰지
않으려고 이미지를 `node:22.18-alpine`으로 고정해 뒀다.
