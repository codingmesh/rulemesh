import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { PUBLIC_DIR } from './constants/dir';
import { clients, configPath, importUrl, SITE_BASE, variants } from './lib/client-config/clients';
import { clientReferences, singboxResolutionMode } from './lib/client-config/configuration';
import type { RuleReference } from './lib/client-config/configuration';
import type { ResolutionMode } from './lib/rules/capabilities';
import { capabilityGaps, validateCapabilityGaps } from './lib/client-config/capability-gaps';
import { validateSourceCatalog } from './lib/source-catalog';

const HASH = /^[a-f0-9]{64}$/;
const LOCAL_URL = new RegExp(RegExp.escape(SITE_BASE) + String.raw`([^\s,"']+)`, 'g');
interface FileRecord { path: string, producer: string, size: number, sha256: string }
function object(value: unknown, label: string): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), `Invalid ${label}`);
  return value as Record<string, unknown>;
}
function records(value: unknown, label: string): Array<Record<string, unknown>> {
  assert(Array.isArray(value), `Invalid ${label}`);
  return value.map(item => object(item, label));
}
function names(items: Array<Record<string, unknown>>, key: string): Set<string> {
  const result = new Set<string>();
  for (let i = 0, len = items.length; i < len; i++) {
    const name = items[i][key];
    assert(typeof name === 'string' && !result.has(name), `Missing or duplicate ${key}: ${String(name)}`);
    result.add(name);
  }
  return result;
}
/** Validate the delivered routing plan, including order, actions and DNS phase. */
export function assertSingboxRouting(document: Record<string, unknown>, references: RuleReference[], modes: Map<string, ResolutionMode>): void {
  const route = object(document.route, 'route');
  const sets = records(route.rule_set, 'rule sets');
  names(sets, 'tag');
  const outbounds = names(records(document.outbounds, 'outbounds'), 'tag');
  assert(outbounds.has('RuleMesh-Nodes'), 'Missing rule-set download outbound');
  const expectedOrder = [
    ...references.filter(reference => reference.partition !== 'ip'),
    ...references.filter(reference => reference.partition === 'ip' && modes.get(reference.tag) !== 'resolve'),
    null,
    ...references.filter(reference => reference.partition === 'ip' && modes.get(reference.tag) === 'resolve')
  ];
  const rules = records(route.rules, 'route rules');
  assert.equal(rules.length, expectedOrder.length, 'Unexpected sing-box routing conditions');
  for (let i = 0, len = expectedOrder.length; i < len; i++) {
    const reference = expectedOrder[i];
    if (!reference) {
      assert.deepEqual(rules[i], { action: 'resolve' }, 'sing-box DNS resolution phase differs');
      continue;
    }
    assert(reference.partition !== 'ip' || modes.has(reference.tag), `Missing resolution mode: ${reference.tag}`);
    const expected = reference.policy === 'advertising'
      ? { rule_set: [reference.tag], action: 'reject' }
      : { rule_set: [reference.tag], action: 'route', outbound: `RuleMesh-${reference.policy}` };
    assert.deepEqual(rules[i], expected, `sing-box routing order/action differs: ${reference.tag}`);
    if (reference.policy !== 'advertising') assert(outbounds.has(`RuleMesh-${reference.policy}`));
    const set = sets.find(set => set.tag === reference.tag);
    assert(set, `Missing rule set: ${reference.tag}`);
    assert.deepEqual(set, { type: 'remote', tag: reference.tag, format: 'source', url: SITE_BASE + reference.path, update_interval: '1d', download_detour: 'RuleMesh-Nodes' }, `sing-box resource differs: ${reference.tag}`);
  }
  assert.equal(sets.length, references.length, 'Unexpected sing-box resources');
  assert.equal(route.final, 'RuleMesh-fallback');
  assert(outbounds.has(route.final), 'Missing final outbound');
}
export async function acceptArtifacts(root = PUBLIC_DIR) {
  const resolved = path.resolve(root);
  const manifest = object(JSON.parse(await fsp.readFile(path.join(resolved, 'Internal/artifact-manifest.json'), 'utf8')), 'artifact manifest');
  assert.equal(manifest.schemaVersion, 1);
  const files = records(manifest.files, 'manifest files').map(file => {
    assert(typeof file.path === 'string' && typeof file.producer === 'string' && typeof file.size === 'number' && typeof file.sha256 === 'string' && HASH.test(file.sha256));
    assert(!path.isAbsolute(file.path) && !file.path.includes('..'));
    return { path: file.path, producer: file.producer, size: file.size, sha256: file.sha256 } satisfies FileRecord;
  });
  const paths = new Set(files.map(file => file.path));
  assert.equal(paths.size, files.length, 'Duplicate delivery paths');
  await Promise.all(files.map(async file => {
    const bytes = await fsp.readFile(path.join(resolved, file.path));
    assert.equal(bytes.length, file.size, `Changed size: ${file.path}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `Changed bytes: ${file.path}`);
  }));
  const entries = await fsp.readdir(resolved, { recursive: true, withFileTypes: true });
  for (let i = 0, len = entries.length; i < len; i++) {
    const entry = entries[i];
    assert(!entry.isSymbolicLink(), `Symlink in delivered tree: ${entry.name}`);
    if (entry.isFile()) {
      const relative = path.relative(resolved, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/');
      assert(relative === 'Internal/artifact-manifest.json' || paths.has(relative), `Unregistered delivered file: ${relative}`);
    }
  }
  const required = ['index.html', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', '.RULEMESH_RULESET_SERVER', 'deploy-check.txt'];
  for (let i = 0, len = required.length; i < len; i++) assert(paths.has(required[i]), `Missing delivery: ${required[i]}`);
  const inputs = records(manifest.inputs, 'manifest inputs');
  assert(inputs.some(input => input.role === 'source') && inputs.some(input => input.role === 'dynamic') && inputs.some(input => input.role === 'history'), 'Missing source/dynamic/history identity');
  for (let i = 0, len = inputs.length; i < len; i++) {
    const input = inputs[i];
    assert(typeof input.source === 'string' && typeof input.sha256 === 'string' && HASH.test(input.sha256));
  }
  const index = await fsp.readFile(path.join(resolved, 'index.html'), 'utf8');
  assert(!index.includes('<summary>Config</summary>'), 'Config belongs outside the rules tree');
  const externalPrefixes = ['rules/', 'configs/', 'LegacyClashPremium/'];
  for (const relative of paths) assert(!externalPrefixes.some(prefix => relative.startsWith(prefix)), `Obsolete entry point: ${relative}`);
  const artifactInputs = await Promise.all(clients.flatMap(client => variants.map(async variant => {
    const relative = configPath(client, variant);
    const [references, text] = await Promise.all([
      clientReferences(client.id, variant === 'advertising', SITE_BASE, resolved),
      fsp.readFile(path.join(resolved, relative), 'utf8')
    ]);
    return { client: client.id, variant, references, text };
  })));
  for (let clientIndex = 0, clientCount = clients.length; clientIndex < clientCount; clientIndex++) {
    const client = clients[clientIndex];
    assert(index.includes(`data-client="${client.id}"`) && index.includes(`data-client-panel="${client.id}"`), `Missing switcher: ${client.id}`);
    for (let variantIndex = 0, variantCount = variants.length; variantIndex < variantCount; variantIndex++) {
      const variant = variants[variantIndex];
      const relative = configPath(client, variant);
      assert(paths.has(relative), `Missing configuration: ${relative}`);
      const url = SITE_BASE + relative;
      const label = variant === 'standard' ? 'Standard' : 'Advertising';
      assert(index.includes(`href="${importUrl(client, url, `RuleMesh ${label}`)}"`), `Missing client action: ${relative}`);
      assert(index.includes(`data-copy-url="${url}"`) && index.includes(`href="${relative}"`), `Missing URL or view action: ${relative}`);
      if (client.qr) assert(paths.has(`Config/${client.configDirectory}/${variant}.svg`), `Missing QR: ${relative}`);
      const artifact = artifactInputs.find(item => item.client === client.id && item.variant === variant)!;
      const { references, text } = artifact;
      for (const match of text.matchAll(LOCAL_URL)) assert(paths.has(match[1]), `Missing referenced resource: ${relative} -> ${match[1]}`);
      if (client.id === 'shadowrocket' || client.id === 'surge') {
        const rows = text.split('\n').filter(line => line.startsWith('RULE-SET,') || line.startsWith('DOMAIN-SET,'));
        const expected = references.map(reference => `${client.id === 'surge' && reference.partition === 'domainset' ? 'DOMAIN-SET' : 'RULE-SET'},${SITE_BASE}${reference.path},${client.id === 'surge' ? 'RuleMesh-' : ''}${reference.policy}`);
        assert.deepEqual(rows, expected, `Routing references/order differ: ${relative}`);
      } else if (client.id === 'mihomo') {
        const document = object(parse(text), 'Mihomo config');
        const providers = object(document['rule-providers'], 'rule providers');
        const groupNames = names(records(document['proxy-groups'], 'proxy groups'), 'name');
        const rows = document.rules;
        assert(Array.isArray(rows));
        for (let i = 0, len = references.length; i < len; i++) {
          const reference = references[i];
          assert.equal(rows[i], `RULE-SET,${reference.tag},RuleMesh-${reference.policy}`);
          assert.equal(object(providers[reference.tag], 'provider').url, SITE_BASE + reference.path);
          assert(groupNames.has(`RuleMesh-${reference.policy}`));
        }
      } else {
        const document = object(JSON.parse(text), 'sing-box config');
        const modeInputs: Array<Promise<readonly [string, ResolutionMode]>> = [];
        for (let i = 0, len = references.length; i < len; i++) {
          const reference = references[i];
          if (reference.partition === 'ip') modeInputs.push(singboxResolutionMode(reference, resolved).then(mode => [reference.tag, mode] as const));
        }
        // eslint-disable-next-line no-await-in-loop -- finish each delivered profile's validation before proceeding
        const modes = await Promise.all(modeInputs);
        assertSingboxRouting(document, references, new Map(modes));
      }
    }
  }
  const [mihomo, singbox] = await Promise.all([capabilityGaps('mihomo', resolved), capabilityGaps('singbox', resolved)]);
  await validateCapabilityGaps({ mihomo, singbox });
  const report = object(JSON.parse(await fsp.readFile(path.join(resolved, 'Config/capability-gaps.json'), 'utf8')), 'capability report');
  assert.deepEqual(report.targets, { mihomo, singbox });
  const sources = await validateSourceCatalog();
  return { status: 'pass', files: files.length, configs: clients.length * variants.length, pinnedSources: sources.sources.files.length, revision: sources.sources.upstream.revision };
}
if (require.main === module) void acceptArtifacts().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
