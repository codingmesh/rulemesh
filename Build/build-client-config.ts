/* eslint-disable vibe-proof/prefer-indexed-array-loop, vibe-proof/prefer-hoisted-regex, vibe-proof/no-chain-array-higher-order-functions, no-await-in-loop, @typescript-eslint/no-explicit-any, @typescript-eslint/array-type, sukka/unicorn/no-nested-ternary, sukka/prefer-foxts-object-size, sukka/unicorn/consistent-conditional-object-spread -- Configuration composition favors readable transformations over hot-loop micro-optimizations. */
import path from 'node:path';
import fsp from 'node:fs/promises';
import process from 'node:process';
import qrcode from 'qrcode';
import { parse, stringify } from 'yaml';

import { PUBLIC_DIR } from './constants/dir';
import { compareAndWriteFile } from './lib/create-file';
import { task } from './trace';

export type ConfigTarget = 'shadowrocket' | 'surge' | 'mihomo' | 'singbox';
type Partition = 'domainset' | 'non_ip' | 'ip';
type DefaultPolicy = 'PROXY' | 'DIRECT' | 'REJECT';
interface PolicyGroup { id: string, categories: string[], defaultPolicy: DefaultPolicy }
interface RuleReference { id: string, partition: Partition, policy: string, path: string, tag: string }

const SITE_BASE = process.env.RULEMESH_SITE_BASE ?? 'https://codingmesh.github.io/ruleset/';
const partitions: Partition[] = ['domainset', 'non_ip', 'ip'];
const serviceOrder = [
  'anthropic', 'openai', 'gemini', 'copilot', 'xai', 'perplexity', 'apple-intelligence', 'ai-other',
  'telegram', 'discord', 'whatsapp', 'twitter', 'instagram', 'facebook', 'reddit', 'youtube', 'netflix',
  'disney', 'hbo', 'primevideo', 'twitch', 'tiktok', 'spotify', 'bilibili-intl', 'bilibili', 'apple-cn',
  'icloud', 'apple-music', 'apple-tv', 'google-fcm', 'onedrive', 'npm', 'python', 'docker', 'github',
  'gitlab', 'jetbrains', 'developer', 'steam-cn', 'game-downloads', 'steam', 'epic-games', 'playstation',
  'xbox', 'nintendo'
];
const platformOrder = ['downloads', 'apple', 'google', 'microsoft', 'aws', 'digitalocean', 'cloudflare', 'games'];
const genericOrder = ['cdn-cn', 'cdn-global', 'china', 'global'];
export const policyGroups: PolicyGroup[] = [
  { id: 'anthropic', categories: ['anthropic'], defaultPolicy: 'PROXY' },
  { id: 'openai', categories: ['openai'], defaultPolicy: 'PROXY' },
  { id: 'gemini', categories: ['gemini'], defaultPolicy: 'PROXY' },
  { id: 'ai-other', categories: ['xai', 'perplexity', 'apple-intelligence', 'ai-other', 'ai'], defaultPolicy: 'PROXY' },
  { id: 'telegram', categories: ['telegram', 'telegram_asn', 'teleproto'], defaultPolicy: 'PROXY' },
  { id: 'social', categories: ['discord', 'whatsapp', 'twitter', 'instagram', 'facebook', 'reddit'], defaultPolicy: 'PROXY' },
  { id: 'youtube', categories: ['youtube'], defaultPolicy: 'PROXY' },
  { id: 'netflix', categories: ['netflix'], defaultPolicy: 'PROXY' },
  { id: 'streaming', categories: ['disney', 'hbo', 'primevideo', 'twitch', 'tiktok', 'spotify', 'bilibili-intl', 'stream', 'stream_us', 'stream_eu', 'stream_hk', 'stream_tw', 'stream_jp', 'stream_kr'], defaultPolicy: 'PROXY' },
  { id: 'developer', categories: ['copilot', 'npm', 'python', 'docker', 'github', 'gitlab', 'jetbrains', 'developer'], defaultPolicy: 'PROXY' },
  { id: 'apple', categories: ['icloud', 'icloud_private_relay', 'apple-music', 'apple-tv', 'apple', 'apple_cdn', 'apple_services'], defaultPolicy: 'DIRECT' },
  { id: 'google', categories: ['google-fcm', 'google'], defaultPolicy: 'PROXY' },
  { id: 'microsoft', categories: ['onedrive', 'microsoft'], defaultPolicy: 'DIRECT' },
  { id: 'games', categories: ['steam', 'epic-games', 'playstation', 'xbox', 'nintendo', 'games'], defaultPolicy: 'PROXY' },
  { id: 'downloads', categories: ['game-download', 'game-downloads', 'downloads', 'download', 'cdn-global', 'cdn', 'aws', 'cloudflare', 'digitalocean', 'speedtest', 'cloudmounter'], defaultPolicy: 'PROXY' },
  { id: 'china', categories: ['china', 'cdn-cn', 'apple-cn', 'apple_cn', 'steam-cn', 'bilibili', 'domestic', 'domestic_cdn', 'neteasemusic', 'sogouinput'], defaultPolicy: 'DIRECT' },
  { id: 'private', categories: ['private', 'private.resolve', 'lan'], defaultPolicy: 'DIRECT' },
  { id: 'advertising', categories: ['advertising', 'reject', 'reject_extra', 'reject_phishing', 'reject-drop', 'reject-no-drop', 'reject-url-regex', 'reject_sukka'], defaultPolicy: 'REJECT' },
  { id: 'fallback', categories: ['global', 'global_plus'], defaultPolicy: 'PROXY' }
];

const categoryPolicy = new Map<string, string>();
for (let groupIndex = 0, groupLength = policyGroups.length; groupIndex < groupLength; groupIndex++) {
  const group = policyGroups[groupIndex];
  for (let categoryIndex = 0, categoryLength = group.categories.length; categoryIndex < categoryLength; categoryIndex++) {
    categoryPolicy.set(group.categories[categoryIndex], group.id);
  }
}

function validateSiteBase(base: string) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !base.endsWith('/')) {
    throw new Error('RuleMesh site base must be a plain HTTPS directory URL ending in /');
  }
}
function policyFor(category: string) { return categoryPolicy.get(category) ?? 'node-selection'; }
function orderedCategories(available: Set<string>, includeAdvertising: boolean) {
  const preferred = ['lan', 'private', ...serviceOrder, ...platformOrder, ...genericOrder];
  const selected: string[] = [];
  const excluded = (id: string) => !categoryPolicy.has(id) || id === 'direct' || (!includeAdvertising && policyFor(id) === 'advertising');
  for (let i = 0, len = preferred.length; i < len; i++) {
    const id = preferred[i];
    if (available.has(id) && !excluded(id)) selected.push(id);
  }
  const remaining = [...available].sort();
  for (let i = 0, len = remaining.length; i < len; i++) {
    const id = remaining[i];
    if (!selected.includes(id) && !excluded(id)) selected.push(id);
  }
  return selected;
}
function targetSpec(target: ConfigTarget) {
  if (target === 'surge') return { directory: 'List', extension: 'conf' };
  if (target === 'shadowrocket') return { directory: 'Shadowrocket', extension: 'conf' };
  if (target === 'mihomo') return { directory: 'Clash', extension: 'txt' };
  return { directory: 'sing-box', extension: 'json' };
}
async function idsFor(target: ConfigTarget, partition: Partition) {
  const spec = targetSpec(target);
  const directory = path.join(PUBLIC_DIR, spec.directory, partition);
  const entries = await fsp.readdir(directory);
  const ids = new Set<string>();
  for (let i = 0, len = entries.length; i < len; i++) {
    const suffix = `.${spec.extension}`;
    if (entries[i].endsWith(suffix)) ids.add(entries[i].slice(0, -suffix.length));
  }
  return ids;
}
export async function clientReferences(target: ConfigTarget, includeAdvertising: boolean, base = SITE_BASE): Promise<RuleReference[]> {
  validateSiteBase(base);
  const ids = await Promise.all(partitions.map(partition => idsFor(target, partition)));
  const all = new Set<string>();
  for (let i = 0; i < ids.length; i++) for (const id of ids[i]) all.add(id);
  const ordered = orderedCategories(all, includeAdvertising);
  const references: RuleReference[] = [];
  for (let partitionIndex = 0; partitionIndex < partitions.length; partitionIndex++) {
    const partition = partitions[partitionIndex];
    const spec = targetSpec(target);
    for (let idIndex = 0; idIndex < ordered.length; idIndex++) {
      const id = ordered[idIndex];
      if (!ids[partitionIndex].has(id)) continue;
      const relative = `${spec.directory}/${partition}/${id}.${spec.extension}`;
      references.push({ id, partition, policy: policyFor(id), path: relative, tag: `rulemesh-${partition}-${id}`.replaceAll('.', '-') });
    }
  }
  return references;
}
function activeGroups(includeAdvertising: boolean) {
  return policyGroups.filter(group => includeAdvertising || group.id !== 'advertising');
}
function groupChoices(group: PolicyGroup, nodePolicy: string, directPolicy: string, rejectPolicy: string) {
  if (group.defaultPolicy === 'DIRECT') return [directPolicy, nodePolicy];
  if (group.defaultPolicy === 'REJECT') return [rejectPolicy, nodePolicy, directPolicy];
  return [nodePolicy, directPolicy];
}
function parseIni(text: string) {
  const result = new Map<string, string[]>(); let current = '';
  for (const line of text.split(/\r?\n/)) {
    const match = /^\[([^\]]+)]\s*$/.exec(line.trim());
    if (match) { current = match[1]; if (!result.has(current)) result.set(current, []); } else {
      if (!result.has(current)) result.set(current, []); result.get(current)!.push(line);
    }
  }
  return result;
}
function renderIni(parts: Map<string, string[]>) {
  const chunks: string[] = [];
  for (const [name, lines] of parts) chunks.push(`${name ? `[${name}]\n` : ''}${lines.join('\n').trim()}\n`);
  return chunks.join('\n');
}
function plainObject(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected ${label} object`);
  return value as Record<string, any>;
}
function objectArray(value: unknown, label: string) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Expected ${label} array`);
  return value.map(item => plainObject(item, label));
}
function stringName(value: unknown, label: string) { if (typeof value !== 'string' || !value) throw new Error(`${label} must be a non-empty string`); return value; }

async function shadowrocketConfiguration(includeAdvertising: boolean, base = SITE_BASE) {
  const references = await clientReferences('shadowrocket', includeAdvertising, base);
  const groups = activeGroups(includeAdvertising);
  const name = includeAdvertising ? 'advertising' : 'standard';
  const lines = [
    '# RuleMesh complete Shadowrocket configuration',
    '# Nodes remain in Home subscriptions; no credentials are embedded.', '', '[General]',
    `update-url = ${base}Config/Shadowrocket/${name}.conf`,
    'dns-server = https://cloudflare-dns.com/dns-query#proxy', 'dns-direct-system = true',
    'dns-fallback-system = false', 'private-ip-answer = true', 'ipv6 = false', 'prefer-ipv6 = false',
    'udp-policy-not-supported-behaviour = REJECT', '', '[Proxy]', '', '[Proxy Group]',
    'node-selection = select,policy-regex-filter=.*'
  ];
  for (let i = 0; i < groups.length; i++) lines.push(`${groups[i].id} = select,${groupChoices(groups[i], 'node-selection', 'DIRECT', 'REJECT').join(',')},PROXY`);
  lines.push('', '[Rule]');
  for (let i = 0; i < references.length; i++) lines.push(`RULE-SET,${base}${references[i].path},${references[i].policy}`);
  lines.push('GEOIP,CN,china', 'FINAL,fallback', '', '[Host]', 'localhost = 127.0.0.1', '*.local = server:system', '*.in-addr.arpa = server:system', '*.ip6.arpa = server:system');
  return { name, lines };
}
async function surgeConfiguration(nodeBase: string, includeAdvertising: boolean, base = SITE_BASE) {
  const references = await clientReferences('surge', includeAdvertising, base);
  const parts = parseIni(nodeBase); const proxies = parts.get('Proxy') ?? []; const groups = parts.get('Proxy Group') ?? [];
  if (!proxies.some(line => line.includes('=')) && !groups.some(line => /policy-path\s*=/.test(line))) throw new Error('Surge node base needs Proxy entries or policy-path');
  groups.push('RuleMesh-Nodes = select,include-all-proxies=true');
  for (const group of activeGroups(includeAdvertising)) groups.push(`RuleMesh-${group.id} = select,${groupChoices(group, 'RuleMesh-Nodes', 'DIRECT', 'REJECT').join(',')}`);
  parts.set('Proxy Group', groups);
  const rules: string[] = [];
  for (const reference of references) rules.push(`${reference.partition === 'domainset' ? 'DOMAIN-SET' : 'RULE-SET'},${base}${reference.path},RuleMesh-${reference.policy}`);
  rules.push('GEOIP,CN,RuleMesh-china', 'FINAL,RuleMesh-fallback'); parts.set('Rule', rules);
  const general = parts.get('General') ?? [];
  if (!general.some(line => /^\s*(?:dns-server|encrypted-dns-server)\s*=/.test(line))) general.push('dns-server = system', 'encrypted-dns-server = https://cloudflare-dns.com/dns-query', 'encrypted-dns-follow-outbound-mode = true', 'ipv6 = false');
  parts.set('General', general); return renderIni(parts);
}
async function mihomoConfiguration(nodeBase: string, includeAdvertising: boolean, base = SITE_BASE) {
  const references = await clientReferences('mihomo', includeAdvertising, base); const document = plainObject(parse(nodeBase), 'Mihomo config');
  const proxies = objectArray(document.proxies, 'proxies'); const providers = plainObject(document['proxy-providers'] ?? {}, 'proxy providers');
  const proxyNames = proxies.map(proxy => stringName(proxy.name, 'proxy name'));
  if (!proxyNames.length && !Object.keys(providers).length) throw new Error('Mihomo node base needs proxies or proxy-providers');
  const groups = objectArray(document['proxy-groups'], 'proxy groups');
  groups.push({ name: 'RuleMesh-Nodes', type: 'select', ...(proxyNames.length ? { proxies: proxyNames } : {}), ...(Object.keys(providers).length ? { use: Object.keys(providers) } : {}) });
  for (const group of activeGroups(includeAdvertising)) groups.push({ name: `RuleMesh-${group.id}`, type: 'select', proxies: groupChoices(group, 'RuleMesh-Nodes', 'DIRECT', 'REJECT') });
  const ruleProviders = plainObject(document['rule-providers'] ?? {}, 'rule providers'); const rules: string[] = [];
  for (const reference of references) {
    ruleProviders[reference.tag] = { type: 'http', behavior: reference.partition === 'domainset' ? 'domain' : 'classical', format: 'text', url: base + reference.path, path: `./rulemesh/${reference.tag}.txt`, interval: 86400 };
    rules.push(`RULE-SET,${reference.tag},RuleMesh-${reference.policy}`);
  }
  rules.push('GEOIP,CN,RuleMesh-china', 'MATCH,RuleMesh-fallback');
  return stringify({ ...document, mode: 'rule', 'proxy-groups': groups, 'rule-providers': ruleProviders, rules });
}
async function singboxConfiguration(nodeBase: string, includeAdvertising: boolean, base = SITE_BASE) {
  const references = await clientReferences('singbox', includeAdvertising, base); const document = plainObject(JSON.parse(nodeBase), 'sing-box config');
  const outbounds = objectArray(document.outbounds, 'outbounds'); const infrastructure = new Set(['direct', 'block', 'dns', 'selector', 'urltest']);
  const nodeTags = outbounds.filter(outbound => !infrastructure.has(String(outbound.type))).map(outbound => stringName(outbound.tag, 'outbound tag'));
  if (!nodeTags.length) throw new Error('sing-box node base needs at least one real outbound');
  if (!outbounds.some(outbound => outbound.tag === 'RuleMesh-Direct')) outbounds.push({ type: 'direct', tag: 'RuleMesh-Direct' });
  outbounds.push({ type: 'selector', tag: 'RuleMesh-Nodes', outbounds: nodeTags });
  for (const group of activeGroups(includeAdvertising)) if (group.defaultPolicy !== 'REJECT') outbounds.push({ type: 'selector', tag: `RuleMesh-${group.id}`, outbounds: groupChoices(group, 'RuleMesh-Nodes', 'RuleMesh-Direct', 'RuleMesh-Direct') });
  const route = plainObject(document.route ?? {}, 'route'); const existingSets = objectArray(route.rule_set, 'rule sets'); const existingRules = objectArray(route.rules, 'route rules');
  const remoteSets = references.map(reference => ({ type: 'remote', tag: reference.tag, format: 'source', url: base + reference.path, update_interval: '1d', download_detour: 'RuleMesh-Nodes' }));
  const rules: Record<string, unknown>[] = [...existingRules]; let resolved = false;
  for (const reference of references) {
    if (!resolved && reference.partition === 'ip') { rules.push({ action: 'resolve' }); resolved = true; }
    rules.push(categoryPolicy.get(reference.id) === 'advertising' ? { rule_set: [reference.tag], action: 'reject' } : { rule_set: [reference.tag], action: 'route', outbound: `RuleMesh-${reference.policy}` });
  }
  return JSON.stringify({ ...document, outbounds, route: { ...route, rule_set: [...existingSets, ...remoteSets], rules, final: 'RuleMesh-fallback' }, experimental: { ...plainObject(document.experimental ?? {}, 'experimental'), cache_file: { enabled: true } } }, null, 2) + '\n';
}

export async function composeClientConfiguration(target: Exclude<ConfigTarget, 'shadowrocket'>, nodeBase: string, includeAdvertising = false, base = SITE_BASE) {
  if (target === 'surge') return surgeConfiguration(nodeBase, includeAdvertising, base);
  if (target === 'mihomo') return mihomoConfiguration(nodeBase, includeAdvertising, base);
  return singboxConfiguration(nodeBase, includeAdvertising, base);
}
function sampleBase(target: Exclude<ConfigTarget, 'shadowrocket'>) {
  if (target === 'surge') return '[General]\n\n[Proxy]\nREPLACE-ME = http, replace.invalid, 1\n';
  if (target === 'mihomo') return stringify({ proxies: [{ name: 'REPLACE-ME', type: 'http', server: 'replace.invalid', port: 1 }] });
  return JSON.stringify({ dns: { servers: [{ type: 'local', tag: 'local' }], final: 'local' }, outbounds: [{ type: 'http', tag: 'REPLACE-ME', server: 'replace.invalid', server_port: 1 }], route: {} });
}

export const buildClientConfig = task(require.main === module, __filename)(async (span) => {
  validateSiteBase(SITE_BASE); const writes: Array<Promise<void>> = [];
  for (const advertising of [false, true]) {
    const shadowrocket = await shadowrocketConfiguration(advertising); const variant = advertising ? 'advertising' : 'standard';
    const shadowDir = path.join(PUBLIC_DIR, 'Config', 'Shadowrocket');
    writes.push(compareAndWriteFile(span, shadowrocket.lines, path.join(shadowDir, `${variant}.conf`)));
    const svg = await qrcode.toString(`shadowrocket://config/add/${SITE_BASE}Config/Shadowrocket/${variant}.conf`, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 });
    writes.push(compareAndWriteFile(span, svg.trim().split('\n'), path.join(shadowDir, `${variant}.svg`)));
    for (const target of ['surge', 'mihomo', 'singbox'] as const) {
      const content = await composeClientConfiguration(target, sampleBase(target), advertising);
      const extension = target === 'mihomo' ? 'yaml' : target === 'singbox' ? 'json' : 'conf';
      writes.push(compareAndWriteFile(span, content.trimEnd().split('\n'), path.join(PUBLIC_DIR, 'Config', target, `${variant}.${extension}.template`)));
    }
  }
  writes.push(compareAndWriteFile(span, ['# RuleMesh client configurations', '', 'Shadowrocket configs are directly importable. Surge, Mihomo and sing-box files are complete structural templates; compose them with a private node base using the source repository CLI.'], path.join(PUBLIC_DIR, 'Config', 'README.md')));
  await Promise.all(writes);
});
