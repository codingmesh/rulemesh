import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';
import { parse } from 'yaml';
import { PUBLIC_DIR, ROOT_DIR } from './constants/dir';

async function main() {
  async function exists(relative: string) { try { const stat = await fsp.stat(path.join(PUBLIC_DIR, relative)); return stat.isFile() && stat.size > 0; } catch { return false; } }
  const required = [
    'index.html', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', '.RULEMESH_RULESET_SERVER',
    'Shadowrocket/domainset/anthropic.conf', 'List/domainset/anthropic.conf', 'Clash/domainset/anthropic.txt', 'sing-box/domainset/anthropic.json',
    'Config/Shadowrocket/standard.conf', 'Config/Shadowrocket/advertising.conf', 'Config/Shadowrocket/standard.svg', 'Config/Shadowrocket/advertising.svg',
    'Config/surge/standard.conf.template', 'Config/surge/advertising.conf.template',
    'Config/mihomo/standard.yaml.template', 'Config/mihomo/advertising.yaml.template',
    'Config/singbox/standard.json.template', 'Config/singbox/advertising.json.template'
  ];
  for (let i = 0, len = required.length; i < len; i++) if (!await exists(required[i])) throw new Error(`Missing required artifact: ${required[i]}`);
  const index = await fsp.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  if (!index.includes('data-view="overview"') || !index.includes('data-view="rules"') || !index.includes('data-view="configs"') || !index.includes('<ul class="tree">')) throw new Error('Single entry must switch overview, rules and configs in place');
  if (index.includes('<summary>Config</summary>')) throw new Error('Config artifacts must remain outside the Sukka-style ruleset tree');
  if (index.includes('>Download<')) throw new Error('Configuration actions must describe URL or client import behavior');
  if (!index.includes('Open in Shadowrocket') || !index.includes('shadowrocket://config/add/https://codingmesh.github.io/ruleset/Config/Shadowrocket/standard.conf')) throw new Error('Shadowrocket must expose direct client import');
  if (!index.includes('Template URL') || !index.includes('must be composed with a node base before client import')) throw new Error('Non-importable templates must be labeled explicitly');
  for (const client of ['shadowrocket', 'surge', 'mihomo', 'singbox']) if (!index.includes(`data-client="${client}"`)) throw new Error(`Config switcher is missing ${client}`);
  const allPaths: string[] = [];
  async function walk(directory: string, prefix = ''): Promise<void> {
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative); else allPaths.push(relative);
    }
  }
  await walk(PUBLIC_DIR);
  if (allPaths.some(file => file.startsWith('rules/') || file.startsWith('configs/'))) throw new Error('Obsolete multi-page entry points remain published');
  if (allPaths.some(file => /\bmy_(?:direct|git|plus|proxy|reject|tw|us)\b/.test(file))) throw new Error('Personal upstream outputs remain published');
  if (allPaths.some(file => /\/(?:china|global)\.extra\./.test(file))) throw new Error('Redundant split source outputs remain published');
  const configFiles = allPaths.filter(file => file.startsWith('Config/') && /\.(?:conf|yaml|json)(?:\.template)?$/.test(file));
  const siteBase = 'https://codingmesh.github.io/ruleset/';
  for (let i = 0, len = configFiles.length; i < len; i++) {
    const file = configFiles[i]; const text = await fsp.readFile(path.join(PUBLIC_DIR, file), 'utf8');
    if (file.includes('/standard.') && /\/(?:advertising|reject|reject_extra|reject_phishing|reject-drop|reject-no-drop|reject-url-regex)\./.test(text)) throw new Error(`Advertising reference in standard config: ${file}`);
    for (const match of text.matchAll(/https:\/\/codingmesh\.github\.io\/ruleset\/([^\s,"']+)/g)) {
      const relative = match[1]; if (!await exists(relative)) throw new Error(`${file} references missing ${relative}`);
    }
    if (file.endsWith('.yaml.template')) parse(text);
    if (file.endsWith('.json.template')) JSON.parse(text);
  }
  const shadowStandard = await fsp.readFile(path.join(PUBLIC_DIR, 'Config/Shadowrocket/standard.conf'), 'utf8');
  const shadowAdvertising = await fsp.readFile(path.join(PUBLIC_DIR, 'Config/Shadowrocket/advertising.conf'), 'utf8');
  const anthropicPosition = shadowStandard.indexOf('/anthropic.conf');
  const aiClassicalPosition = shadowStandard.indexOf('/non_ip/ai.conf');
  const globalPosition = shadowStandard.indexOf('/global.conf');
  const firstIpPosition = shadowStandard.indexOf('/ip/');
  if (anthropicPosition < 0 || aiClassicalPosition < 0 || globalPosition < 0 || firstIpPosition < 0 || anthropicPosition > globalPosition || aiClassicalPosition > globalPosition || globalPosition > firstIpPosition) throw new Error('Routing order is not service -> generic -> IP');
  const advertisingPosition = shadowAdvertising.search(/\/(?:advertising|reject|reject_extra|reject_phishing)\./);
  if (advertisingPosition < 0) throw new Error('Advertising variant has no rejection resources');
  if (advertisingPosition > shadowAdvertising.indexOf('/global.conf')) throw new Error('Advertising rules must precede the global catch-all');
  if (!shadowStandard.includes('anthropic = select,ai,node-selection,DIRECT')) throw new Error('Shadowrocket service selector does not inherit the AI family');
  const surgeStandard = await fsp.readFile(path.join(PUBLIC_DIR, 'Config/surge/standard.conf.template'), 'utf8');
  if (!surgeStandard.includes('RuleMesh-anthropic = select,RuleMesh-ai,RuleMesh-Nodes,DIRECT')) throw new Error('Surge service selector does not inherit the AI family');
  const mihomoStandard = parse(await fsp.readFile(path.join(PUBLIC_DIR, 'Config/mihomo/standard.yaml.template'), 'utf8')) as { 'proxy-groups': Array<{ name: string, proxies: string[] }> };
  if (!mihomoStandard['proxy-groups'].some(group => group.name === 'RuleMesh-anthropic' && group.proxies[0] === 'RuleMesh-ai')) throw new Error('Mihomo service selector does not inherit the AI family');
  const singboxStandard = JSON.parse(await fsp.readFile(path.join(PUBLIC_DIR, 'Config/singbox/standard.json.template'), 'utf8')) as { outbounds: Array<{ tag?: string, outbounds?: string[] }> };
  if (!singboxStandard.outbounds.some(outbound => outbound.tag === 'RuleMesh-anthropic' && outbound.outbounds?.[0] === 'RuleMesh-ai')) throw new Error('sing-box service selector does not inherit the AI family');
  const sources = JSON.parse(await fsp.readFile(path.join(ROOT_DIR, 'sources/registry.json'), 'utf8')) as { upstream: { revision: string }, files: Array<{ category: string }> };
  if (!/^[a-f0-9]{40}$/.test(sources.upstream.revision)) throw new Error('Source revision is not immutable');
  for (let i = 0, len = sources.files.length; i < len; i++) {
    const sourcePath = path.join(ROOT_DIR, 'Source/domainset', `${sources.files[i].category}.conf`);
    const stat = await fsp.stat(sourcePath); if (stat.size === 0) throw new Error(`Empty source: ${sourcePath}`);
    const sourceText = await fsp.readFile(sourcePath, 'utf8');
    if (!sourceText.includes(`@${sources.upstream.revision}`)) throw new Error(`Source header is not pinned: ${sourcePath}`);
  }
  const anthropicSource = await fsp.readFile(path.join(ROOT_DIR, 'Source/domainset/anthropic.conf'), 'utf8');
  if (!anthropicSource.includes('.claude.app')) throw new Error('Owned Anthropic override was not reapplied');
  const maintained = JSON.parse(await fsp.readFile(path.join(ROOT_DIR, 'sources/maintained.json'), 'utf8')) as { schemaVersion: number, files: Array<{ path: string, revision: string, sourcePath: string, license: string, transformation: string }> };
  if (maintained.schemaVersion !== 1 || !maintained.files.length) throw new Error('Maintained source provenance is missing');
  const maintainedPaths = new Set<string>();
  for (let i = 0, len = maintained.files.length; i < len; i++) {
    const source = maintained.files[i];
    if (maintainedPaths.has(source.path)) throw new Error(`Duplicate maintained source provenance: ${source.path}`);
    maintainedPaths.add(source.path);
    if (!/^(?:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/.test(source.revision) || !source.sourcePath || !source.license || !source.transformation) throw new Error(`Incomplete maintained source provenance: ${source.path}`);
    const content = await fsp.readFile(path.join(ROOT_DIR, source.path), 'utf8');
    if (!content.includes(source.revision)) throw new Error(`Maintained source header is not pinned: ${source.path}`);
  }
  const manuallyMaintained = (await Promise.all([
    fsp.readdir(path.join(ROOT_DIR, 'Source/domainset')), fsp.readdir(path.join(ROOT_DIR, 'Source/non_ip')), fsp.readdir(path.join(ROOT_DIR, 'Source/ip'))
  ])).flat();
  if (manuallyMaintained.some(file => file.endsWith('.extra.conf'))) throw new Error('Redundant extra source files remain');
  const globalClassical = await fsp.readFile(path.join(ROOT_DIR, 'Source/non_ip/global.conf'), 'utf8');
  if (/^DOMAIN(?:-SUFFIX)?,/m.test(globalClassical)) throw new Error('Global domain rules are duplicated between domainset and non_ip');
  console.log(JSON.stringify({ status: 'pass', files: allPaths.length, configs: configFiles.length, pinnedSources: sources.files.length, revision: sources.upstream.revision }, null, 2));
}
void main();
