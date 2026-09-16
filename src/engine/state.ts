import * as git from 'isomorphic-git';
import type { LessonRepo, StatusRow } from './repo.ts';

export interface CommitState {
  sha: string;
  message: string;
  parents: string[];
  author: { name: string; email: string; timestamp: number; timezoneOffset: number };
  files: string[];
}

export interface RepoState {
  index: string[];
  worktree: string[];
  head: { sha: string; message: string; ahead: number | null; behind: number | null } | null;
  branch: string | null;
  branches: string[];
  branchHeads: Record<string, string>;
  tracking: Record<string, string>;
  remote: { branches: Record<string, string>; trackingHeads: Record<string, string> };
  reflog: { sha: string; old: string; reason: string; message: string }[];
  files: string[];
  ignored: string[];
  branchCommits: string[] | null;
  commits: CommitState[];
  status: StatusRow[];
}

/** Read Git objects, config, refs, reflog and files; never learner command history. */
export async function readState(repo: LessonRepo): Promise<RepoState> {
  const status = await repo.status();
  const commits: CommitState[] = [];
  for (const { oid, commit } of await repo.log()) commits.push({
    sha: oid, message: commit.message.trimEnd(), parents: commit.parent, author: commit.author,
    files: await repo.changedFiles(oid),
  });
  const branch = (await repo.currentBranch()) ?? null;
  const branches = await repo.branch();
  const branchHeads: Record<string, string> = Object.create(null);
  const tracking: Record<string, string> = Object.create(null);
  for (const name of branches) {
    branchHeads[name] = await repo.resolve(name);
    const upstream = await repo.upstream(name);
    if (upstream) tracking[name] = upstream;
  }
  const remote: RepoState['remote'] = { branches: Object.create(null), trackingHeads: Object.create(null) };
  const origin = await repo.origin();
  if (origin) for (const name of await origin.branch()) remote.branches[name] = await origin.resolve(name);
  for (const name of await git.listBranches({ ...repo.context, remote: 'origin' })) remote.trackingHeads[`origin/${name}`] = await repo.resolve(`origin/${name}`);
  const upstream = branch ? tracking[branch] : undefined;
  const distance = upstream && remote.trackingHeads[upstream] && commits.length ? await repo.divergence('HEAD', upstream) : { ahead: null, behind: null };
  const files: string[] = [];
  const visit = async (dir: string) => {
    for (const name of await repo.fs.promises.readdir(`${repo.dir}${dir ? '/' + dir : ''}`)) {
      if (!dir && name === '.git') continue;
      const path = dir ? `${dir}/${name}` : name;
      if ((await repo.fs.promises.stat(`${repo.dir}/${path}`)).isDirectory()) await visit(path);
      else files.push(path);
    }
  };
  await visit('');
  const indexed = new Set(await git.listFiles(repo.context));
  const ignored: string[] = [];
  for (const filepath of files) if (!indexed.has(filepath) && await git.isIgnored({ ...repo.context, filepath })) ignored.push(filepath);
  const base = branch && branch !== 'main' && branchHeads.main ? new Set((await repo.log('main')).map(({ oid }) => oid)) : null;
  return {
    index: status.filter(([, head, , stage]) => head !== stage).map(([path]) => path).sort(),
    worktree: status.filter(([, , workdir, stage]) => workdir !== stage).map(([path]) => path).sort(),
    head: commits[0] ? { sha: commits[0].sha, message: commits[0].message, ...distance } : null,
    branch, branches, branchHeads: { ...branchHeads }, tracking: { ...tracking },
    remote: { branches: { ...remote.branches }, trackingHeads: { ...remote.trackingHeads } },
    reflog: await repo.reflog(), files: files.sort(), ignored: ignored.sort(),
    branchCommits: base ? commits.filter(({ sha }) => !base.has(sha)).map(({ sha }) => sha) : null,
    commits, status,
  };
}
