import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';
import { parse } from 'yaml';
import { PUBLIC_DIR, ROOT_DIR } from './constants/dir';

async function main() {
  async function exists(relative: string) { try { const stat = await fsp.stat(path.join(PUBLIC_DIR, relative)); return stat.isFile() && stat.size > 0; } catch { return false; } }
  const required = [
    'index.html', 'rules/index.html', 'configs/index.html', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', '.RULEMESH_RULESET_SERVER',
    'Shadowrocket/domainset/anthropic.conf', 'List/domainset/anthropic.conf', 'Clash/domainset/anthropic.txt', 'sing-box/domainset/anthropic.json',
    'Config/Shadowrocket/standard.conf', 'Config/Shadowrocket/advertising.conf', 'Config/Shadowrocket/standard.svg', 'Config/Shadowrocket/advertising.svg',
    'Config/surge/standard.conf.template', 'Config/surge/advertising.conf.template',
    'Config/mihomo/standard.yaml.template', 'Config/mihomo/advertising.yaml.template',
    'Config/singbox/standard.json.template', 'Config/singbox/advertising.json.template'
  ];
  for (let i = 0, len = required.length; i < len; i++) if (!await exists(required[i])) throw new Error(`Missing required artifact: ${required[i]}`);
  const index = await fsp.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  const rulesIndex = await fsp.readFile(path.join(PUBLIC_DIR, 'rules/index.html'), 'utf8');
  const configsIndex = await fsp.readFile(path.join(PUBLIC_DIR, 'configs/index.html'), 'utf8');
  if (index.includes('<ul class="tree">') || !index.includes('href="rules/"') || !index.includes('href="configs/"')) throw new Error('Home page must route users without embedding the rules tree');
  if (rulesIndex.includes('<summary>Config</summary>') || !rulesIndex.includes('<ul class="tree">')) throw new Error('Config must remain outside the Sukka-style ruleset tree');
  for (const client of ['Shadowrocket', 'Surge', 'Mihomo', 'sing-box']) if (!configsIndex.includes(client)) throw new Error(`Config page is missing ${client}`);
  const allPaths: string[] = [];
  async function walk(directory: string, prefix = ''): Promise<void> {
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative); else allPaths.push(relative);
    }
  }
  await walk(PUBLIC_DIR);
  if (allPaths.some(file => /\bmy_(?:direct|git|plus|proxy|reject|tw|us)\b/.test(file))) throw new Error('Personal upstream outputs remain published');
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
  const globalPosition = shadowStandard.indexOf('/global.conf');
  const firstIpPosition = shadowStandard.indexOf('/ip/');
  if (anthropicPosition < 0 || globalPosition < 0 || firstIpPosition < 0 || anthropicPosition > globalPosition || globalPosition > firstIpPosition) throw new Error('Routing order is not service -> generic -> IP');
  if (!/\/(?:advertising|reject|reject_extra|reject_phishing)\./.test(shadowAdvertising)) throw new Error('Advertising variant has no rejection resources');
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
  console.log(JSON.stringify({ status: 'pass', files: allPaths.length, configs: configFiles.length, pinnedSources: sources.files.length, revision: sources.upstream.revision }, null, 2));
}
void main();
