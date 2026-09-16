-- gitlearn 학습 기록 스키마
-- 이전 결과를 남겨두기 위한 최소 구조다. 레슨 한 번 실행 = run 한 줄.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 학습자. 로그인 개념이 없으므로 브라우저가 만든 아이디를 그대로 받는다.
CREATE TABLE IF NOT EXISTS learner (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 레슨 한 번의 시도.
CREATE TABLE IF NOT EXISTS run (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id   TEXT NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
  lesson_id    TEXT NOT NULL,
  difficulty   TEXT NOT NULL CHECK (difficulty IN ('초급','중급','고급')),
  status       TEXT NOT NULL DEFAULT 'in_progress'
                 CHECK (status IN ('in_progress','passed','failed','abandoned')),
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at  TEXT,
  duration_ms  INTEGER,
  hint_count   INTEGER NOT NULL DEFAULT 0,
  error_count  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_run_learner_lesson ON run(learner_id, lesson_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_status         ON run(status);

-- 스텝별 결과. 어느 단언에서 막혔는지가 다음 출제에 쓰인다.
CREATE TABLE IF NOT EXISTS step_result (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id        INTEGER NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  step_index    INTEGER NOT NULL,
  passed        INTEGER NOT NULL CHECK (passed IN (0,1)),
  attempts      INTEGER NOT NULL DEFAULT 1,
  failed_assert TEXT,
  duration_ms   INTEGER,
  recorded_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (run_id, step_index)
);

-- 어떤 힌트가 언제 떴는지. 힌트 설계를 고칠 때 이 표를 본다.
CREATE TABLE IF NOT EXISTS hint_shown (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      INTEGER NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  step_index  INTEGER NOT NULL,
  hint_index  INTEGER NOT NULL,
  trigger     TEXT NOT NULL,
  shown_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hint_run ON hint_shown(run_id);

-- 학습자가 실제로 친 명령. 고급 레슨의 진단 경로를 분석하는 데 쓴다.
CREATE TABLE IF NOT EXISTS command_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      INTEGER NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  step_index  INTEGER NOT NULL,
  command     TEXT NOT NULL,
  exit_code   INTEGER,
  ran_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_command_run ON command_log(run_id);

-- 레슨별 최신 결과 한 줄씩. "이전 결과"를 보여줄 때 이걸 읽는다.
CREATE VIEW IF NOT EXISTS latest_run AS
SELECT r.*
FROM run r
JOIN (
  SELECT learner_id, lesson_id, MAX(started_at) AS started_at
  FROM run
  GROUP BY learner_id, lesson_id
) m
  ON m.learner_id = r.learner_id
 AND m.lesson_id  = r.lesson_id
 AND m.started_at = r.started_at;
