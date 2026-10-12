import path from 'node:path';
import fsp from 'node:fs/promises';
import { parse, stringify } from 'yaml';
import { PUBLIC_DIR } from '../../constants/dir';
import { activePolicyGroups, groupChoices, orderedCategories, partitions, policyFor, unmappedCategories } from './routing-profile';
import type { ConfigTarget, Partition } from './routing-profile';
import { clientFor, SITE_BASE, validateSiteBase } from './clients';
import { readRuleMetadata } from '../rules/capabilities';
import type { ResolutionMode } from '../rules/capabilities';
import { nullthrow } from 'foxts/guard';

export interface RuleReference { id: string, partition: Partition, policy: string, path: string, tag: string }
const INI_SECTION = /^\[([^\]]+)]\s*$/;
const POLICY_PATH = /policy-path\s*=/;
const PROXY_NAME = /^([^#;=]+)=/;
const NEWLINE = /\r?\n/;
const DNS_SETTING = /^\s*(?:dns-server|encrypted-dns-server)\s*=/;

export async function clientReferences(target: ConfigTarget, advertising: boolean, base = SITE_BASE, root = PUBLIC_DIR): Promise<RuleReference[]> {
  validateSiteBase(base);
  const client = clientFor(target);
  const ids = await Promise.all(partitions.map(async partition => {
    const entries = await fsp.readdir(path.join(root, client.rulesDirectory, partition));
    const result = new Set<string>();
    const suffix = `.${client.rulesExtension}`;
    for (let i = 0, len = entries.length; i < len; i++) {
      if (entries[i].endsWith(suffix)) result.add(entries[i].slice(0, -suffix.length));
    }
    return result;
  }));
  const all = new Set(ids.flatMap(set => [...set]));
  const unmapped = unmappedCategories(all);
  if (unmapped.length) throw new Error(`Published ${target} categories have no routing policy: ${unmapped.join(', ')}`);
  const ordered = orderedCategories(all, advertising);
  const references: RuleReference[] = [];
  // Service specificity precedes broad categories across the two domain formats;
  // all destination IP sets remain after domain matching.
  const partitionGroups = [[0, 1], [2]];
  for (let groupIndex = 0, groupCount = partitionGroups.length; groupIndex < groupCount; groupIndex++) {
    const partitionGroup = partitionGroups[groupIndex];
    for (let i = 0, len = ordered.length; i < len; i++) {
      const id = ordered[i];
      for (let j = 0, count = partitionGroup.length; j < count; j++) {
        const index = partitionGroup[j];
        if (ids[index].has(id)) {
          const partition = partitions[index];
          references.push({ id, partition, policy: policyFor(id)!, path: `${client.rulesDirectory}/${partition}/${id}.${client.rulesExtension}`, tag: `rulemesh-${partition}-${id}`.replaceAll('.', '-') });
        }
      }
    }
  }
  return references;
}
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected ${label} object`);
  return value as Record<string, unknown>;
}
function objects(value: unknown, label: string): Array<Record<string, unknown>> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Expected ${label} array`);
  return value.map(item => object(item, label));
}
function name(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}
function validateNames(names: string[], label: string): void {
  const seen = new Set<string>();
  for (let i = 0, len = names.length; i < len; i++) {
    const value = names[i];
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    if (value.startsWith('RuleMesh-') || value.startsWith('rulemesh-')) throw new Error(`Reserved RuleMesh ${label}: ${value}`);
    seen.add(value);
  }
}
function parseIni(text: string): Map<string, string[]> {
  const parts = new Map<string, string[]>();
  let current = '';
  const lines = text.split(NEWLINE);
  for (let i = 0, len = lines.length; i < len; i++) {
    const match = INI_SECTION.exec(lines[i].trim());
    if (match) current = match[1];
    if (!parts.has(current)) parts.set(current, []);
    if (!match) parts.get(current)!.push(lines[i]);
  }
  return parts;
}
function renderIni(parts: Map<string, string[]>): string {
  const chunks: string[] = [];
  for (const [section, lines] of parts) chunks.push(`${section ? `[${section}]\n` : ''}${lines.join('\n').trim()}\n`);
  return chunks.join('\n');
}
export function assertNodeOnlySingboxRoute(route: Record<string, unknown>): void {
  if (objects(route.rules, 'route rules').length) throw new Error('sing-box node base must not contain route.rules; RuleMesh owns complete routing order');
}
export async function shadowrocketConfiguration(advertising: boolean, base = SITE_BASE, root = PUBLIC_DIR): Promise<string> {
  const references = await clientReferences('shadowrocket', advertising, base, root);
  const groups = activePolicyGroups(advertising);
  const variant = advertising ? 'advertising' : 'standard';
  const lines = [
    '# RuleMesh complete Shadowrocket configuration',
    '# Nodes remain in Home subscriptions; no credentials are embedded.', '', '[General]',
    `update-url = ${base}Config/Shadowrocket/${variant}.conf`,
    'dns-server = https://cloudflare-dns.com/dns-query#proxy', 'dns-direct-system = true',
    'dns-fallback-system = false', 'private-ip-answer = true', 'ipv6 = false', 'prefer-ipv6 = false',
    'udp-policy-not-supported-behaviour = REJECT', '', '[Proxy]', '', '[Proxy Group]',
    'node-selection = select,PROXY,use=true,policy-regex-filter=.*'
  ];
  for (let i = 0, len = groups.length; i < len; i++) lines.push(`${groups[i].id} = select,${groupChoices(groups[i], 'node-selection', 'DIRECT', 'REJECT').join(',')},PROXY,use=true,policy-regex-filter=.*`);
  lines.push('', '[Rule]');
  for (let i = 0, len = references.length; i < len; i++) lines.push(`RULE-SET,${base}${references[i].path},${references[i].policy}`);
  lines.push('GEOIP,CN,china', 'FINAL,fallback', '', '[Host]', 'localhost = 127.0.0.1', '*.local = server:system', '*.in-addr.arpa = server:system', '*.ip6.arpa = server:system');
  return lines.join('\n') + '\n';
}
async function surgeConfiguration(nodeBase: string, advertising: boolean, base: string, root: string): Promise<string> {
  const references = await clientReferences('surge', advertising, base, root);
  const parts = parseIni(nodeBase);
  const proxies = parts.get('Proxy') ?? [];
  const groups = parts.get('Proxy Group') ?? [];
  const proxyNames = proxies.flatMap(line => PROXY_NAME.exec(line)?.[1].trim() ?? []);
  const groupNames = groups.flatMap(line => PROXY_NAME.exec(line)?.[1].trim() ?? []);
  validateNames([...proxyNames, ...groupNames], 'policy name');
  const remoteGroups = groups.filter(line => POLICY_PATH.test(line));
  if (!proxyNames.length && !remoteGroups.length) throw new Error('Surge node base needs Proxy entries or policy-path');
  const includes = remoteGroups.map(line => `include-other-group=${PROXY_NAME.exec(line)![1].trim()}`);
  groups.push(['RuleMesh-Nodes = select', 'include-all-proxies=true', ...includes].join(','));
  const policies = activePolicyGroups(advertising);
  for (let i = 0, len = policies.length; i < len; i++) groups.push([`RuleMesh-${policies[i].id} = select`, ...groupChoices(policies[i], 'RuleMesh-Nodes', 'DIRECT', 'REJECT', 'RuleMesh-'), 'include-all-proxies=true', ...includes].join(','));
  parts.set('Proxy Group', groups);
  const rules = references.map(reference => `${reference.partition === 'domainset' ? 'DOMAIN-SET' : 'RULE-SET'},${base}${reference.path},RuleMesh-${reference.policy}`);
  rules.push('GEOIP,CN,RuleMesh-china', 'FINAL,RuleMesh-fallback');
  parts.set('Rule', rules);
  const general = parts.get('General') ?? [];
  if (!general.some(line => DNS_SETTING.test(line))) general.push('dns-server = system', 'encrypted-dns-server = https://cloudflare-dns.com/dns-query', 'encrypted-dns-follow-outbound-mode = true', 'ipv6 = false');
  parts.set('General', general);
  return renderIni(parts);
}
async function mihomoConfiguration(nodeBase: string, advertising: boolean, base: string, root: string): Promise<string> {
  const references = await clientReferences('mihomo', advertising, base, root);
  const document = object(parse(nodeBase), 'Mihomo config');
  const proxies = objects(document.proxies, 'proxies');
  const providers = object(document['proxy-providers'] ?? {}, 'proxy providers');
  const providerNames = Object.keys(providers);
  const proxyNames = proxies.map(proxy => name(proxy.name, 'proxy name'));
  const groups = objects(document['proxy-groups'], 'proxy groups');
  validateNames([...proxyNames, ...groups.map(group => name(group.name, 'group name'))], 'proxy or group name');
  if (!proxyNames.length && !providerNames.length) throw new Error('Mihomo node base needs proxies or proxy-providers');
  groups.push({ name: 'RuleMesh-Nodes', type: 'select', ...(proxyNames.length > 0 && { proxies: proxyNames }), ...(providerNames.length > 0 && { use: providerNames }) });
  const policies = activePolicyGroups(advertising);
  for (let i = 0, len = policies.length; i < len; i++) groups.push({ name: `RuleMesh-${policies[i].id}`, type: 'select', proxies: [...groupChoices(policies[i], 'RuleMesh-Nodes', 'DIRECT', 'REJECT', 'RuleMesh-'), ...proxyNames], ...(providerNames.length > 0 && { use: providerNames }) });
  const ruleProviders = object(document['rule-providers'] ?? {}, 'rule providers');
  validateNames(Object.keys(ruleProviders), 'rule provider');
  const rules: string[] = [];
  for (let i = 0, len = references.length; i < len; i++) {
    const reference = references[i];
    ruleProviders[reference.tag] = { type: 'http', behavior: reference.partition === 'domainset' ? 'domain' : 'classical', format: 'text', url: base + reference.path, path: `./rulemesh/${reference.tag}.txt`, interval: 86400 };
    rules.push(`RULE-SET,${reference.tag},RuleMesh-${reference.policy}`);
  }
  rules.push('GEOIP,CN,RuleMesh-china', 'MATCH,RuleMesh-fallback');
  return stringify({ ...document, mode: 'rule', 'proxy-groups': groups, 'rule-providers': ruleProviders, rules });
}
export async function singboxResolutionMode(reference: RuleReference, root = PUBLIC_DIR): Promise<ResolutionMode> {
  return (await readRuleMetadata(reference.id, reference.partition, root)).resolutionMode;
}
async function singboxConfiguration(nodeBase: string, advertising: boolean, base: string, root: string): Promise<string> {
  const references = await clientReferences('singbox', advertising, base, root);
  const document = object(JSON.parse(nodeBase), 'sing-box config');
  const outbounds = objects(document.outbounds, 'outbounds');
  validateNames(outbounds.map(outbound => name(outbound.tag, 'outbound tag')), 'outbound tag');
  const infrastructure = new Set(['direct', 'block', 'dns', 'selector', 'urltest']);
  const nodeTags: string[] = [];
  for (let i = 0, len = outbounds.length; i < len; i++) {
    if (!infrastructure.has(String(outbounds[i].type))) nodeTags.push(name(outbounds[i].tag, 'outbound tag'));
  }
  if (!nodeTags.length) throw new Error('sing-box node base needs at least one real outbound');
  outbounds.push({ type: 'direct', tag: 'RuleMesh-Direct' }, { type: 'selector', tag: 'RuleMesh-Nodes', outbounds: nodeTags });
  const policies = activePolicyGroups(advertising);
  for (let i = 0, len = policies.length; i < len; i++) {
    if (policies[i].defaultPolicy !== 'REJECT') outbounds.push({ type: 'selector', tag: `RuleMesh-${policies[i].id}`, outbounds: [...groupChoices(policies[i], 'RuleMesh-Nodes', 'RuleMesh-Direct', 'RuleMesh-Direct', 'RuleMesh-'), ...nodeTags] });
  }
  const route = object(document.route ?? {}, 'route');
  assertNodeOnlySingboxRoute(route);
  const existingSets = objects(route.rule_set, 'rule sets');
  validateNames(existingSets.map(set => name(set.tag, 'rule set tag')), 'rule set tag');
  const remoteSets = references.map(reference => ({ type: 'remote', tag: reference.tag, format: 'source', url: base + reference.path, update_interval: '1d', download_detour: 'RuleMesh-Nodes' }));
  const rules: Array<Record<string, unknown>> = [];
  const append = (reference: RuleReference) => {
    rules.push(reference.policy === 'advertising' ? { rule_set: [reference.tag], action: 'reject' } : { rule_set: [reference.tag], action: 'route', outbound: `RuleMesh-${reference.policy}` });
  };
  const ipReferences: RuleReference[] = [];
  for (let i = 0, len = references.length; i < len; i++) {
    if (references[i].partition === 'ip') ipReferences.push(references[i]);
    else append(references[i]);
  }
  const modes = await Promise.all(ipReferences.map(reference => singboxResolutionMode(reference, root)));
  for (let i = 0, len = ipReferences.length; i < len; i++) if (modes[i] !== 'resolve') append(ipReferences[i]);
  rules.push({ action: 'resolve' });
  for (let i = 0, len = ipReferences.length; i < len; i++) if (modes[i] === 'resolve') append(ipReferences[i]);
  const experimental = object(document.experimental ?? {}, 'experimental');
  const cacheFile = object(experimental.cache_file ?? {}, 'cache file');
  return JSON.stringify({ ...document, outbounds, route: { ...route, rule_set: [...existingSets, ...remoteSets], rules, final: 'RuleMesh-fallback' }, experimental: { ...experimental, cache_file: { ...cacheFile, enabled: cacheFile.enabled ?? true } } }, null, 2) + '\n';
}
export async function composeClientConfiguration(target: Exclude<ConfigTarget, 'shadowrocket'>, nodeBase: string, advertising = false, base = SITE_BASE, root = PUBLIC_DIR): Promise<string> {
  return composerFor(target).render(nodeBase, advertising, base, root);
}
export function sampleBase(target: Exclude<ConfigTarget, 'shadowrocket'>): string {
  return composerFor(target).sample();
}

// Format behavior lives here; delivery paths/schemes remain in clients.ts.
// A new ConfigTarget must provide both its renderer and node-base sample.
const composers: Record<Exclude<ConfigTarget, 'shadowrocket'>, {
  render: (nodeBase: string, advertising: boolean, base: string, root: string) => Promise<string>,
  sample: () => string
}> = {
  surge: {
    render: surgeConfiguration,
    sample: () => '[General]\n\n[Proxy]\nREPLACE-ME = http, replace.invalid, 1\n'
  },
  mihomo: {
    render: mihomoConfiguration,
    sample: () => stringify({ proxies: [{ name: 'REPLACE-ME', type: 'http', server: 'replace.invalid', port: 1 }] })
  },
  singbox: {
    render: singboxConfiguration,
    sample: () => JSON.stringify({ dns: { servers: [{ type: 'local', tag: 'local' }], final: 'local' }, outbounds: [{ type: 'http', tag: 'REPLACE-ME', server: 'replace.invalid', server_port: 1 }], route: {} })
  }
};
function composerFor(target: Exclude<ConfigTarget, 'shadowrocket'>) {
  if (clientFor(target).role !== 'template') throw new Error(`${target} does not accept a composed node base`);
  return nullthrow(composers[target], `Missing configuration composer: ${target}`);
}
