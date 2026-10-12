import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

interface SourceFile { category: string, path: string, license: string }
interface SourcesDocument { schemaVersion: number, upstream: { repository: string, branch: string, revision: string }, files: SourceFile[] }
interface SourceOverride { category: string, value: string, reason: string, evidence: string, checkedAt: string }
interface OverridesDocument { schemaVersion: number, add: SourceOverride[], remove: SourceOverride[] }
interface PendingWrite { destination: string, content: string, previous: string | null }

function validateOverride(override: SourceOverride) {
  if (!override.category || !/^\.?[a-z0-9_*-]+(?:\.[a-z0-9_*-]+)*$/i.test(override.value)) throw new Error(`Invalid source override: ${JSON.stringify(override)}`);
  if (!override.reason || !override.evidence.startsWith('https://') || !/^\d{4}-\d{2}-\d{2}$/.test(override.checkedAt)) throw new Error(`Incomplete source override evidence: ${override.category}:${override.value}`);
}

export function applyOverrides(category: string, entries: Set<string>, overrides: OverridesDocument) {
  const additions = new Set<string>();
  for (let i = 0, len = overrides.add.length; i < len; i++) {
    const override = overrides.add[i]; validateOverride(override);
    if (override.category === category) { entries.add(override.value); additions.add(override.value); }
  }
  for (let i = 0, len = overrides.remove.length; i < len; i++) {
    const override = overrides.remove[i]; validateOverride(override);
    if (override.category === category) {
      if (additions.has(override.value)) throw new Error(`Source override both adds and removes ${category}:${override.value}`);
      entries.delete(override.value);
    }
  }
}

async function commitWrites(writes: PendingWrite[]) {
  const staged = writes.map((write, index) => ({ ...write, temporary: `${write.destination}.rulemesh-sync-${process.pid}-${index}` }));
  const applied: typeof staged = [];
  try {
    await Promise.all(staged.map(async write => { await fsp.mkdir(path.dirname(write.destination), { recursive: true }); await fsp.writeFile(write.temporary, write.content); }));
    for (let i = 0, len = staged.length; i < len; i++) { const write = staged[i]; await fsp.rename(write.temporary, write.destination); applied.push(write); }
  } catch (error) {
    for (let i = applied.length - 1; i >= 0; i--) {
      const write = applied[i];
      if (write.previous === null) await fsp.rm(write.destination, { force: true }); else await fsp.writeFile(write.destination, write.previous);
    }
    throw error;
  } finally {
    await Promise.all(staged.map(write => fsp.rm(write.temporary, { force: true })));
  }
}

async function fetchRequired(url: string, headers: Record<string, string>, label: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) throw new Error(`${label}: ${response.status}`);
      lastError = new Error(`${label}: ${response.status}`);
    } catch (error) { lastError = error; }
    if (attempt < 2) await delay(250 * (2 ** attempt));
  }
  throw lastError;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const write = process.argv.includes('--write');
  const verifyPinned = process.argv.includes('--verify-pinned');
  const sourcesPath = path.join(root, 'sources/registry.json');
  const sources = JSON.parse(await fsp.readFile(sourcesPath, 'utf8')) as SourcesDocument;
  const overrides = JSON.parse(await fsp.readFile(path.join(root, 'sources/overrides.json'), 'utf8')) as OverridesDocument;
  if (overrides.schemaVersion !== 2 || !Array.isArray(overrides.add) || !Array.isArray(overrides.remove)) throw new Error('Unsupported sources/overrides.json schema');
  const headers: Record<string, string> = { 'User-Agent': 'RuleMesh source sync', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const previousRevision = sources.upstream.revision;
  let revision = previousRevision;
  if (!verifyPinned) {
    const commitResponse = await fetchRequired(`https://api.github.com/repos/${sources.upstream.repository}/commits/${sources.upstream.branch}`, headers, 'Unable to resolve upstream revision');
    revision = String((await commitResponse.json() as { sha: string }).sha);
  }
  let changed = false; const pendingWrites: PendingWrite[] = [];
  for (let i = 0, len = sources.files.length; i < len; i++) {
    const source = sources.files[i];
    const url = `https://raw.githubusercontent.com/${sources.upstream.repository}/${revision}/${source.path}`;
    const response = await fetchRequired(url, headers, `Unable to download ${source.category}`);
    const entries = new Set<string>();
    for (const rawLine of (await response.text()).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('+.')) entries.add('.' + line.slice(2));
      else if (/^[a-z0-9_.-]+$/i.test(line)) entries.add(line);
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
    let previous: string | null = null; try { previous = await fsp.readFile(destination, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
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
if (require.main === module) void main();
