// 학습 기록 서버.
// 브라우저에서 도는 레슨 러너가 결과를 여기로 보내고, SQLite 파일에 남는다.
// 의존성 없이 node 내장 모듈만 쓴다 (package.json은 다른 작업자 소유라 건드리지 않는다).

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const HERE = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.PROGRESS_DB ?? resolve(HERE, '../data/progress.db')
const PORT = Number(process.env.PROGRESS_PORT ?? 4000)

mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec(readFileSync(resolve(HERE, 'schema.sql'), 'utf8'))
console.log(`[progress] db: ${DB_PATH}`)

const q = {
  upsertLearner: db.prepare(
    `INSERT INTO learner (id, name) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET name = COALESCE(excluded.name, learner.name)`
  ),
  startRun: db.prepare(
    `INSERT INTO run (learner_id, lesson_id, difficulty) VALUES (?, ?, ?)`
  ),
  finishRun: db.prepare(
    `UPDATE run
        SET status = ?, finished_at = datetime('now'),
            duration_ms = ?, hint_count = ?, error_count = ?
      WHERE id = ?`
  ),
  saveStep: db.prepare(
    `INSERT INTO step_result (run_id, step_index, passed, attempts, failed_assert, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(run_id, step_index) DO UPDATE SET
       passed        = excluded.passed,
       attempts      = step_result.attempts + 1,
       failed_assert = excluded.failed_assert,
       duration_ms   = excluded.duration_ms,
       recorded_at   = datetime('now')`
  ),
  saveHint: db.prepare(
    `INSERT INTO hint_shown (run_id, step_index, hint_index, trigger) VALUES (?, ?, ?, ?)`
  ),
  saveCommand: db.prepare(
    `INSERT INTO command_log (run_id, step_index, command, exit_code) VALUES (?, ?, ?, ?)`
  ),
  history: db.prepare(
    `SELECT id, lesson_id, difficulty, status, started_at, finished_at,
            duration_ms, hint_count, error_count
       FROM run
      WHERE learner_id = ? AND lesson_id = ?
      ORDER BY started_at DESC
      LIMIT 20`
  ),
  progress: db.prepare(
    `SELECT lesson_id, difficulty, status, started_at, duration_ms, hint_count
       FROM latest_run
      WHERE learner_id = ?
      ORDER BY started_at DESC`
  ),
  runSteps: db.prepare(
    `SELECT step_index, passed, attempts, failed_assert, duration_ms
       FROM step_result WHERE run_id = ? ORDER BY step_index`
  ),
  stuckSteps: db.prepare(
    `SELECT lesson_id, step_index, SUM(attempts) AS attempts, COUNT(*) AS runs
       FROM step_result s JOIN run r ON r.id = s.run_id
      WHERE r.learner_id = ? AND s.passed = 0
      GROUP BY lesson_id, step_index
      ORDER BY attempts DESC
      LIMIT 10`
  ),
}

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
}

const send = (res, code, body) => res.writeHead(code, HEADERS).end(JSON.stringify(body))

async function readJson(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const routes = {
  'GET /health': () => ({ ok: true, db: DB_PATH }),

  'POST /api/runs': (body) => {
    const { learnerId, learnerName = null, lessonId, difficulty } = body
    if (!learnerId || !lessonId || !difficulty) throw new HttpError(400, 'learnerId, lessonId, difficulty가 필요합니다')
    q.upsertLearner.run(learnerId, learnerName)
    const { lastInsertRowid } = q.startRun.run(learnerId, lessonId, difficulty)
    return { runId: Number(lastInsertRowid) }
  },

  'POST /api/steps': (body) => {
    const { runId, stepIndex, passed, attempts = 1, failedAssert = null, durationMs = null } = body
    if (runId == null || stepIndex == null) throw new HttpError(400, 'runId, stepIndex가 필요합니다')
    q.saveStep.run(runId, stepIndex, passed ? 1 : 0, attempts, failedAssert, durationMs)
    return { ok: true }
  },

  'POST /api/hints': (body) => {
    const { runId, stepIndex, hintIndex, trigger = '' } = body
    if (runId == null || stepIndex == null || hintIndex == null) throw new HttpError(400, 'runId, stepIndex, hintIndex가 필요합니다')
    q.saveHint.run(runId, stepIndex, hintIndex, trigger)
    return { ok: true }
  },

  'POST /api/commands': (body) => {
    const { runId, stepIndex, command, exitCode = null } = body
    if (runId == null || !command) throw new HttpError(400, 'runId, command가 필요합니다')
    q.saveCommand.run(runId, stepIndex ?? 0, command, exitCode)
    return { ok: true }
  },

  'POST /api/runs/finish': (body) => {
    const { runId, status = 'passed', durationMs = null, hintCount = 0, errorCount = 0 } = body
    if (runId == null) throw new HttpError(400, 'runId가 필요합니다')
    q.finishRun.run(status, durationMs, hintCount, errorCount, runId)
    return { ok: true, steps: q.runSteps.all(runId) }
  },
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return res.writeHead(204, HEADERS).end()

    const url = new URL(req.url, 'http://localhost')
    const key = `${req.method} ${url.pathname}`

    if (key === 'GET /api/history') {
      const learnerId = url.searchParams.get('learnerId')
      const lessonId = url.searchParams.get('lessonId')
      if (!learnerId || !lessonId) throw new HttpError(400, 'learnerId, lessonId 쿼리가 필요합니다')
      return send(res, 200, { runs: q.history.all(learnerId, lessonId) })
    }

    if (key === 'GET /api/progress') {
      const learnerId = url.searchParams.get('learnerId')
      if (!learnerId) throw new HttpError(400, 'learnerId 쿼리가 필요합니다')
      return send(res, 200, {
        lessons: q.progress.all(learnerId),
        stuck: q.stuckSteps.all(learnerId),
      })
    }

    const handler = routes[key]
    if (!handler) throw new HttpError(404, `no route: ${key}`)

    const body = req.method === 'POST' ? await readJson(req) : {}
    return send(res, 200, handler(body))
  } catch (err) {
    const status = err.status ?? 500
    if (status === 500) console.error('[progress]', err)
    send(res, status, { error: err.message })
  }
})

server.listen(PORT, '0.0.0.0', () => console.log(`[progress] listening on :${PORT}`))

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { db.close(); server.close(() => process.exit(0)) })
}
