import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';
import { wait } from 'foxts/wait';

import { applyOverrides, validateSourceCatalog } from './lib/source-catalog';

interface PendingWrite { destination: string, content: string, previous: string | null }
const REVISION = /^[a-f0-9]{40}$/;
const NEWLINE = /\r?\n/;
const DOMAIN = /^[\w.-]+$/;

async function commitWrites(writes: PendingWrite[]) {
  const staged = writes.map((write, index) => ({ ...write, temporary: `${write.destination}.rulemesh-sync-${process.pid}-${index}` }));
  const applied: typeof staged = [];
  try {
    await Promise.all(staged.map(async write => { await fsp.mkdir(path.dirname(write.destination), { recursive: true }); await fsp.writeFile(write.temporary, write.content); }));
    for (let i = 0, len = staged.length; i < len; i++) {
      const write = staged[i];
      // eslint-disable-next-line no-await-in-loop -- apply and track each atomic rename before moving on
      await fsp.rename(write.temporary, write.destination);
      applied.push(write);
    }
  } catch (error) {
    for (let i = applied.length - 1; i >= 0; i--) {
      const write = applied[i];
      if (write.previous === null) {
        // eslint-disable-next-line no-await-in-loop -- undo in reverse application order
        await fsp.rm(write.destination, { force: true });
      } else {
        // eslint-disable-next-line no-await-in-loop -- undo in reverse application order
        await fsp.writeFile(write.destination, write.previous);
      }
    }
    throw error;
  } finally {
    await Promise.all(staged.map(write => fsp.rm(write.temporary, { force: true })));
  }
}

async function fetchRequired(url: string, headers: Record<string, string>, label: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response | undefined;
    try {
      // eslint-disable-next-line no-await-in-loop -- retry only after the previous attempt completes
      response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
    } catch (error) { lastError = error; }
    if (response) {
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) throw new Error(`${label}: ${response.status}`);
      lastError = new Error(`${label}: ${response.status}`);
      // eslint-disable-next-line no-await-in-loop -- dispose the failed response before retrying
      await response.body?.cancel();
    }
    if (attempt < 2) {
      // eslint-disable-next-line no-await-in-loop -- intentional exponential retry delay
      await wait(250 * (2 ** attempt));
    }
  }
  throw lastError;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const write = process.argv.includes('--write');
  const verifyPinned = process.argv.includes('--verify-pinned');
  const sourcesPath = path.join(root, 'sources/registry.json');
  const { sources, overrides } = await validateSourceCatalog(root);
  const headers: Record<string, string> = { 'User-Agent': 'RuleMesh source sync', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const previousRevision = sources.upstream.revision;
  let revision = previousRevision;
  if (!verifyPinned) {
    const commitResponse = await fetchRequired(`https://api.github.com/repos/${sources.upstream.repository}/commits/${sources.upstream.branch}`, headers, 'Unable to resolve upstream revision');
    const commit: unknown = await commitResponse.json();
    if (!commit || typeof commit !== 'object' || !('sha' in commit) || typeof commit.sha !== 'string' || !REVISION.test(commit.sha)) throw new Error('Resolved source revision is not an immutable SHA');
    revision = commit.sha;
  }
  let changed = false; const pendingWrites: PendingWrite[] = [];
  for (let i = 0, len = sources.files.length; i < len; i++) {
    const source = sources.files[i];
    const url = `https://raw.githubusercontent.com/${sources.upstream.repository}/${revision}/${source.path}`;
    // eslint-disable-next-line no-await-in-loop -- fixed GitHub source requests are deliberately rate limited
    const response = await fetchRequired(url, headers, `Unable to download ${source.category}`);
    const entries = new Set<string>();
    // eslint-disable-next-line no-await-in-loop -- consume this response before scheduling the next source
    const lines = (await response.text()).split(NEWLINE);
    for (let lineIndex = 0, lineCount = lines.length; lineIndex < lineCount; lineIndex++) {
      const line = lines[lineIndex].trim();
      if (!line || line[0] === '#') continue;
      if (line.startsWith('+.')) entries.add('.' + line.slice(2));
      else if (DOMAIN.test(line)) entries.add(line);
      else throw new Error(`Unsupported ${source.category} entry: ${line}`);
    }
    applyOverrides(source.category, entries, overrides);
    const content = [
      `# $ meta_title RuleMesh Ruleset - ${source.category}`,
      `# $ meta_description Synced from ${sources.upstream.repository}@${revision}.`,
      '# $ meta_description Provenance and license details: https://github.com/codingmesh/rulemesh/blob/main/THIRD_PARTY_NOTICES.md',
      '', ...[...entries].sort(), ''
    ].join('\n');
    const destination = path.join(root, 'Source/domainset', `${source.category}.conf`);
    let previous: string | null = null;
    try {
      // eslint-disable-next-line no-await-in-loop -- preserve the original of each pending write
      previous = await fsp.readFile(destination, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (previous !== content) { changed = true; pendingWrites.push({ destination, content, previous }); }
  }
  if (previousRevision !== revision) {
    changed = true;
    const content = JSON.stringify({ ...sources, upstream: { ...sources.upstream, revision } }, null, 2) + '\n';
    pendingWrites.push({ destination: sourcesPath, content, previous: await fsp.readFile(sourcesPath, 'utf8') });
  }
  if (write && changed) await commitWrites(pendingWrites);
  console.log(JSON.stringify({ previousRevision, upstreamRevision: revision, changed, written: write && changed }, null, 2));
  if (!write && changed) process.exitCode = 2;
}
if (require.main === module) void main().catch(error => { console.error(error); process.exitCode = 1; });
