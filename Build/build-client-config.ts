/* eslint-disable vibe-proof/prefer-indexed-array-loop, vibe-proof/prefer-hoisted-regex, vibe-proof/no-chain-array-higher-order-functions, no-await-in-loop, @typescript-eslint/no-explicit-any, @typescript-eslint/array-type, sukka/unicorn/no-nested-ternary, sukka/prefer-foxts-object-size, sukka/unicorn/consistent-conditional-object-spread -- Configuration composition favors readable transformations over hot-loop micro-optimizations. */
import path from 'node:path';
import fsp from 'node:fs/promises';
import process from 'node:process';
import qrcode from 'qrcode';
import { parse, stringify } from 'yaml';

import { PUBLIC_DIR, ROOT_DIR } from './constants/dir';
import { compareAndWriteFile } from './lib/create-file';
import { activePolicyGroups, groupChoices, orderedCategories, partitions, policyFor, unmappedCategories } from './lib/client-config/routing-profile';
import type { ConfigTarget, Partition } from './lib/client-config/routing-profile';
import { task } from './trace';
import { MIHOMO_UNSUPPORTED_RULE_TYPES } from './lib/writing-strategy/clash';
import { SINGBOX_UNSUPPORTED_RULE_TYPES } from './lib/writing-strategy/singbox';

interface RuleReference { id: string, partition: Partition, policy: string, path: string, tag: string }
interface CapabilityGap { category: string, partition: Partition, type: string, count: number, examples: string[] }
type ResolutionMode = 'existing-only' | 'resolve' | 'mixed-existing-only';
interface CapabilityApproval { schemaVersion: number, checkedAt: string, rationale: Record<string, string>, gaps: { mihomo: string[], singbox: string[] } }

const SITE_BASE = process.env.RULEMESH_SITE_BASE ?? 'https://codingmesh.github.io/ruleset/';
const IP_RULE_TYPES = new Set(['IP-CIDR', 'IP-CIDR6', 'IP-ASN', 'GEOIP']);

function validateSiteBase(base: string) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !base.endsWith('/')) {
    throw new Error('RuleMesh site base must be a plain HTTPS directory URL ending in /');
  }
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
  const unmapped = unmappedCategories(all);
  if (unmapped.length) throw new Error(`Published ${target} categories have no routing policy: ${unmapped.join(', ')}`);
  const ordered = orderedCategories(all, includeAdvertising);
  const references: RuleReference[] = [];
  const spec = targetSpec(target);
  // Preserve category precedence across domainset and classical non-IP files;
  // then evaluate every IP set. This prevents a broad global domain rule from
  // preceding a service-specific classical rule while retaining domain-before-IP.
  for (let idIndex = 0; idIndex < ordered.length; idIndex++) {
    const id = ordered[idIndex];
    for (let partitionIndex = 0; partitionIndex < 2; partitionIndex++) {
      const partition = partitions[partitionIndex];
      if (ids[partitionIndex].has(id)) {
        const relative = `${spec.directory}/${partition}/${id}.${spec.extension}`;
        references.push({ id, partition, policy: policyFor(id)!, path: relative, tag: `rulemesh-${partition}-${id}`.replaceAll('.', '-') });
      }
    }
  }
  for (let idIndex = 0; idIndex < ordered.length; idIndex++) {
    const id = ordered[idIndex];
    if (ids[2].has(id)) {
      const partition = partitions[2];
      const relative = `${spec.directory}/${partition}/${id}.${spec.extension}`;
      references.push({ id, partition, policy: policyFor(id)!, path: relative, tag: `rulemesh-${partition}-${id}`.replaceAll('.', '-') });
    }
  }
  return references;
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

export function assertNodeOnlySingboxRoute(route: Record<string, any>) {
  const rules = objectArray(route.rules, 'route rules');
  if (rules.length) throw new Error('sing-box node base must not contain route.rules; RuleMesh owns complete routing order');
}

async function shadowrocketConfiguration(includeAdvertising: boolean, base = SITE_BASE) {
  const references = await clientReferences('shadowrocket', includeAdvertising, base);
  const groups = activePolicyGroups(includeAdvertising);
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
  for (const group of activePolicyGroups(includeAdvertising)) groups.push(`RuleMesh-${group.id} = select,${groupChoices(group, 'RuleMesh-Nodes', 'DIRECT', 'REJECT', 'RuleMesh-').join(',')}`);
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
  for (const group of activePolicyGroups(includeAdvertising)) groups.push({ name: `RuleMesh-${group.id}`, type: 'select', proxies: groupChoices(group, 'RuleMesh-Nodes', 'DIRECT', 'REJECT', 'RuleMesh-') });
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
  for (const group of activePolicyGroups(includeAdvertising)) if (group.defaultPolicy !== 'REJECT') outbounds.push({ type: 'selector', tag: `RuleMesh-${group.id}`, outbounds: groupChoices(group, 'RuleMesh-Nodes', 'RuleMesh-Direct', 'RuleMesh-Direct', 'RuleMesh-') });
  const route = plainObject(document.route ?? {}, 'route'); assertNodeOnlySingboxRoute(route); const existingSets = objectArray(route.rule_set, 'rule sets');
  const remoteSets = references.map(reference => ({ type: 'remote', tag: reference.tag, format: 'source', url: base + reference.path, update_interval: '1d', download_detour: 'RuleMesh-Nodes' }));
  const rules: Record<string, unknown>[] = [];
  const appendReference = (reference: RuleReference) => rules.push(policyFor(reference.id) === 'advertising' ? { rule_set: [reference.tag], action: 'reject' } : { rule_set: [reference.tag], action: 'route', outbound: `RuleMesh-${reference.policy}` });
  for (let i = 0, len = references.length; i < len; i++) if (references[i].partition !== 'ip') appendReference(references[i]);
  const ipReferences = references.filter(reference => reference.partition === 'ip');
  const resolutionModes = await Promise.all(ipReferences.map(reference => singboxResolutionMode(reference)));
  for (let i = 0, len = ipReferences.length; i < len; i++) if (resolutionModes[i] !== 'resolve') appendReference(ipReferences[i]);
  rules.push({ action: 'resolve' });
  for (let i = 0, len = ipReferences.length; i < len; i++) if (resolutionModes[i] === 'resolve') appendReference(ipReferences[i]);
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

async function capabilityGaps(target: 'mihomo' | 'singbox') {
  const references = await clientReferences(target, true);
  const unsupported = target === 'mihomo' ? MIHOMO_UNSUPPORTED_RULE_TYPES : SINGBOX_UNSUPPORTED_RULE_TYPES;
  const gaps: CapabilityGap[] = [];
  for (let referenceIndex = 0, referenceLength = references.length; referenceIndex < referenceLength; referenceIndex++) {
    const reference = references[referenceIndex];
    const source = path.join(PUBLIC_DIR, 'List', reference.partition, `${reference.id}.conf`);
    let text: string; try { text = await fsp.readFile(source, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    const byType = new Map<string, string[]>();
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.charCodeAt(0) === 35 || line.includes('ruleset.marker.')) continue;
      let type = line.slice(0, Math.max(0, line.indexOf(',')));
      if (target === 'singbox' && type === 'PROCESS-NAME' && /[*?]/.test(line.slice(line.indexOf(',') + 1))) type = 'PROCESS-NAME-WILDCARD';
      if (!unsupported.has(type)) continue;
      const examples = byType.get(type) ?? []; examples.push(line); byType.set(type, examples);
    }
    for (const [type, examples] of byType) gaps.push({ category: reference.id, partition: reference.partition, type, count: examples.length, examples: examples.slice(0, 3) });
    if (target === 'singbox' && reference.partition === 'ip' && await singboxResolutionMode(reference) === 'mixed-existing-only') gaps.push({ category: reference.id, partition: reference.partition, type: 'MIXED-RESOLUTION', count: 1, examples: ['Mixed no-resolve and resolve-allowed inputs are conservatively evaluated before DNS resolution.'] });
  }
  return gaps;
}

async function singboxResolutionMode(reference: RuleReference): Promise<ResolutionMode> {
  const source = path.join(PUBLIC_DIR, 'List', reference.partition, `${reference.id}.conf`);
  const text = await fsp.readFile(source, 'utf8'); let existingOnly = 0; let resolve = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.charCodeAt(0) === 35 || line.includes('ruleset.marker.')) continue;
    const type = line.slice(0, Math.max(0, line.indexOf(',')));
    if (!IP_RULE_TYPES.has(type)) continue;
    if (line.endsWith(',no-resolve')) existingOnly++; else resolve++;
  }
  return existingOnly && resolve ? 'mixed-existing-only' : existingOnly ? 'existing-only' : 'resolve';
}

async function validateCapabilityGaps(gaps: { mihomo: CapabilityGap[], singbox: CapabilityGap[] }) {
  const approval = JSON.parse(await fsp.readFile(path.join(ROOT_DIR, 'sources/capability-gaps-approved.json'), 'utf8')) as CapabilityApproval;
  if (approval.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(approval.checkedAt)) throw new Error('Invalid capability gap approval');
  for (const target of ['mihomo', 'singbox'] as const) {
    const actual = gaps[target].map(gap => `${gap.partition}/${gap.category}:${gap.type}`).sort();
    const expected = [...approval.gaps[target]].sort();
    const added = actual.filter(key => !expected.includes(key)); const removed = expected.filter(key => !actual.includes(key));
    if (added.length || removed.length) throw new Error(`Unreviewed ${target} capability gap change; added=[${added.join(', ')}], removed=[${removed.join(', ')}]`);
    for (let i = 0, len = actual.length; i < len; i++) { const type = actual[i].slice(actual[i].lastIndexOf(':') + 1); if (!approval.rationale[type]) throw new Error(`Capability gap ${type} has no approval rationale`); }
  }
  return approval;
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
      writes.push(compareAndWriteFile(span, content.trimEnd().split('\n'), path.join(PUBLIC_DIR, 'Config', target, `${variant}.${extension}`)));
    }
  }
  writes.push(compareAndWriteFile(span, [
    '# RuleMesh client configurations', '',
    'Shadowrocket configs are directly importable. Surge, Mihomo and sing-box files are complete structural templates; compose them with a private node base using the source repository CLI.', '',
    'Policy hierarchy:', '',
    '1. Choose the default node in the root node selector.',
    '2. AI, social and streaming family selectors inherit that choice.',
    '3. Anthropic, OpenAI, Gemini, Telegram, YouTube and Netflix inherit their family and may be overridden independently.',
    '4. Private and mainland China traffic default to direct. Global fallback defaults to the root node selector.',
    '5. The advertising profile evaluates reject rules before private, service, domestic and global rules; the standard profile contains no advertising rules.', '',
    'Target-specific omissions that cannot be represented natively are listed in capability-gaps.json.'
  ], path.join(PUBLIC_DIR, 'Config', 'README.md')));
  const targets = { mihomo: await capabilityGaps('mihomo'), singbox: await capabilityGaps('singbox') };
  const approval = await validateCapabilityGaps(targets);
  const gaps = { schemaVersion: 1, reviewedAt: approval.checkedAt, targets };
  writes.push(compareAndWriteFile(span, JSON.stringify(gaps, null, 2).split('\n'), path.join(PUBLIC_DIR, 'Config', 'capability-gaps.json')));
  await Promise.all(writes);
});
