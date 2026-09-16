import type { LessonRepo, StatusRow } from './repo.ts';

export interface CommitState {
  sha: string;
  message: string;
  parents: string[];
  author: { name: string; email: string; timestamp: number; timezoneOffset: number };
}

export interface RepoState {
  index: string[];
  worktree: string[];
  head: { sha: string; message: string } | null;
  branch: string | null;
  commits: CommitState[];
  status: StatusRow[];
}

/** Await writes before reading. Paths may be in both index and worktree after an edit following add. */
export async function readState(repo: LessonRepo): Promise<RepoState> {
  const status = await repo.status();
  const commits = (await repo.log()).map(({ oid, commit }) => ({
    sha: oid,
    message: commit.message.trimEnd(),
    parents: commit.parent,
    author: commit.author,
  }));
  return {
    index: status.filter(([, head, , stage]) => head !== stage).map(([path]) => path).sort(),
    worktree: status.filter(([, , workdir, stage]) => workdir !== stage).map(([path]) => path).sort(),
    head: commits[0] ? { sha: commits[0].sha, message: commits[0].message } : null,
    branch: (await repo.currentBranch()) ?? null,
    commits,
    status,
  };
}
