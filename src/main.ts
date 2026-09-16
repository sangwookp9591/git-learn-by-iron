// UI 없이 브라우저 콘솔에서 엔진을 검증하기 위한 진입점입니다.
import { createRepo } from './engine/repo.ts';
import { readState } from './engine/state.ts';
import { parse } from './terminal/parse.ts';
import { run } from './terminal/run.ts';

export const gitLearn = { createRepo, readState, parse, run };
Object.assign(globalThis, { gitLearn });
