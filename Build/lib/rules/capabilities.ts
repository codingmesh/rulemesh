import path from 'node:path';
import fsp from 'node:fs/promises';
import { PUBLIC_DIR } from '../../constants/dir';
import { MIHOMO_UNSUPPORTED_RULE_TYPES } from '../writing-strategy/clash';
import { SINGBOX_UNSUPPORTED_RULE_TYPES } from '../writing-strategy/singbox';
import type { StrategyWriteData } from './strategy-write-data';
import { writeFile } from '../misc';
import { buildContext } from '../build-output';

export interface RuleOrigin { file: string, line: number, text: string }
export type ResolutionMode = 'existing-only' | 'resolve' | 'mixed-existing-only';
export interface CapabilityGap { category: string, partition: string, type: string, count: number, examples: string[], origins: RuleOrigin[] }
const PROCESS_GLOB = /[*?]/;
const RESOLUTION_MODES = new Set(['existing-only', 'resolve', 'mixed-existing-only']);

/** Diagnose original semantic buckets, before any writer omits conditions. */
export function ruleMetadata(id: string, partition: string, data: StrategyWriteData) {
  const conditions = new Map<string, string[]>([
    ['USER-AGENT', data.userAgents], ['URL-REGEX', data.urlRegexes],
    ['IP-ASN', [...data.ipasn, ...data.ipasnNoResolve]],
    ['GEOIP', [...data.geoip, ...data.geoipNoResolve]],
    ['PROCESS-NAME-WILDCARD', data.processNames.filter(value => PROCESS_GLOB.test(value))]
  ]);
  for (let i = 0, len = data.otherRules.length; i < len; i++) {
    const line = data.otherRules[i];
    const type = line.slice(0, line.indexOf(','));
    const values = conditions.get(type) ?? [];
    values.push(line);
    conditions.set(type, values);
  }
  const existing = data.ipcidrNoResolve.length + data.ipcidr6NoResolve.length + data.ipasnNoResolve.length + data.geoipNoResolve.length;
  const resolve = data.ipcidr.length + data.ipcidr6.length + data.ipasn.length + data.geoip.length;
  let resolutionMode: ResolutionMode = 'resolve';
  if (existing) resolutionMode = resolve ? 'mixed-existing-only' : 'existing-only';
  const targets: { mihomo: CapabilityGap[], singbox: CapabilityGap[] } = { mihomo: [], singbox: [] };
  const targetNames = ['mihomo', 'singbox'] as const;
  for (let targetIndex = 0, targetCount = targetNames.length; targetIndex < targetCount; targetIndex++) {
    const target = targetNames[targetIndex];
    const unsupported = target === 'mihomo' ? MIHOMO_UNSUPPORTED_RULE_TYPES : SINGBOX_UNSUPPORTED_RULE_TYPES;
    for (const [type, values] of conditions) {
      if (values.length && unsupported.has(type)) {
        const originType = type === 'PROCESS-NAME-WILDCARD' ? 'PROCESS-NAME' : type;
        targets[target].push({ category: id, partition, type, count: values.length, examples: values.slice(0, 3), origins: data.origins?.[originType] ?? [] });
      }
    }
  }
  if (partition === 'ip' && resolutionMode === 'mixed-existing-only') {
    targets.singbox.push({ category: id, partition, type: 'MIXED-RESOLUTION', count: 1, examples: ['Mixed no-resolve and resolve-allowed inputs are conservatively evaluated before DNS resolution.'], origins: [...(data.origins?.['IP-CIDR'] ?? []), ...(data.origins?.['IP-ASN'] ?? [])].slice(0, 3) });
  }
  // Domain views intentionally project HTTP-only conditions. They remain
  // visible here; the corresponding non-IP resources carry the profile gap.
  const projected = partition === 'domainset';
  return { schemaVersion: 1, category: id, partition, resolutionMode, targets: projected ? { mihomo: [], singbox: [] } as typeof targets : targets, projections: projected ? targets : { mihomo: [], singbox: [] } as typeof targets };
}
export async function readRuleMetadata(id: string, partition: string, root = PUBLIC_DIR) {
  const file = path.join(root, 'Internal/rules', partition, `${id}.json`);
  const value: unknown = JSON.parse(await fsp.readFile(file, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid rule metadata: ${file}`);
  const metadata = value as Partial<ReturnType<typeof ruleMetadata>>;
  if (metadata.schemaVersion !== 1 || metadata.category !== id || metadata.partition !== partition || !metadata.targets || !RESOLUTION_MODES.has(metadata.resolutionMode ?? '')) throw new Error(`Invalid rule metadata: ${file}`);
  const targets = ['mihomo', 'singbox'] as const;
  for (let i = 0, len = targets.length; i < len; i++) {
    const gaps = metadata.targets[targets[i]];
    if (!Array.isArray(gaps)) throw new Error(`Invalid capability metadata: ${file}`);
    for (let j = 0, count = gaps.length; j < count; j++) {
      const value: unknown = gaps[j];
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid capability gap in ${file}`);
      const gap = value as Partial<CapabilityGap>;
      if (gap.category !== id || gap.partition !== partition || typeof gap.type !== 'string' || typeof gap.count !== 'number' || !Number.isSafeInteger(gap.count) || gap.count < 1 || !Array.isArray(gap.examples) || !Array.isArray(gap.origins)) throw new Error(`Invalid capability gap in ${file}`);
    }
  }
  return metadata as ReturnType<typeof ruleMetadata>;
}
export async function writeRuleMetadata(id: string, partition: string, data: StrategyWriteData): Promise<void> {
  await writeFile(path.join(buildContext()?.root ?? PUBLIC_DIR, 'Internal/rules', partition, `${id}.json`), JSON.stringify(ruleMetadata(id, partition, data), null, 2) + '\n');
}
