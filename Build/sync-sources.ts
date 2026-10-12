import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';

interface SourceFile { category: string, path: string, license: string }
interface SourcesDocument { schemaVersion: number, upstream: { repository: string, branch: string, revision: string }, files: SourceFile[] }
interface OverridesDocument { schemaVersion: number, add: Array<{ category: string, value: string }> }

async function main() {
  const root = path.resolve(__dirname, '..');
  const write = process.argv.includes('--write');
  const verifyPinned = process.argv.includes('--verify-pinned');
  const sourcesPath = path.join(root, 'sources/registry.json');
  const sources = JSON.parse(await fsp.readFile(sourcesPath, 'utf8')) as SourcesDocument;
  const overrides = JSON.parse(await fsp.readFile(path.join(root, 'sources/overrides.json'), 'utf8')) as OverridesDocument;
  const headers = { 'User-Agent': 'RuleMesh source sync', Accept: 'application/vnd.github+json' };
  let revision = sources.upstream.revision;
  if (!verifyPinned) {
    const commitResponse = await fetch(`https://api.github.com/repos/${sources.upstream.repository}/commits/${sources.upstream.branch}`, { headers });
    if (!commitResponse.ok) throw new Error(`Unable to resolve upstream revision: ${commitResponse.status}`);
    revision = String((await commitResponse.json() as { sha: string }).sha);
  }
  let changed = false;
  for (let i = 0, len = sources.files.length; i < len; i++) {
    const source = sources.files[i];
    const url = `https://raw.githubusercontent.com/${sources.upstream.repository}/${revision}/${source.path}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Unable to download ${source.category}: ${response.status}`);
    const entries = new Set<string>();
    for (const rawLine of (await response.text()).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('+.')) entries.add('.' + line.slice(2));
      else if (/^[a-z0-9_.-]+$/i.test(line)) entries.add(line);
      else throw new Error(`Unsupported ${source.category} entry: ${line}`);
    }
    for (let overrideIndex = 0, overrideLength = overrides.add.length; overrideIndex < overrideLength; overrideIndex++) {
      const override = overrides.add[overrideIndex]; if (override.category === source.category) entries.add(override.value);
    }
    const content = [
      `# $ meta_title RuleMesh Ruleset - ${source.category}`,
      `# $ meta_description Synced from ${sources.upstream.repository}@${revision}.`,
      '# $ meta_description Provenance and license details: https://github.com/codingmesh/rulemesh/blob/main/THIRD_PARTY_NOTICES.md',
      '', ...[...entries].sort(), ''
    ].join('\n');
    const destination = path.join(root, 'Source/domainset', `${source.category}.conf`);
    let previous = ''; try { previous = await fsp.readFile(destination, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (previous !== content) { changed = true; if (write) await fsp.writeFile(destination, content); }
  }
  if (sources.upstream.revision !== revision) { changed = true; if (write) { sources.upstream.revision = revision; await fsp.writeFile(sourcesPath, JSON.stringify(sources, null, 2) + '\n'); } }
  console.log(JSON.stringify({ previousRevision: sources.upstream.revision, upstreamRevision: revision, changed, written: write && changed }, null, 2));
  if (!write && changed) process.exitCode = 2;
}
void main();
