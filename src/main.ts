import { createRepo } from './engine/repo.ts';
import { readState } from './engine/state.ts';
import { parse } from './terminal/parse.ts';
import { run } from './terminal/run.ts';
import { mountApp } from './ui/app.ts';

export const gitLearn = { createRepo, readState, parse, run };
Object.assign(globalThis, { gitLearn });

mountApp(document.getElementById('app')!);
