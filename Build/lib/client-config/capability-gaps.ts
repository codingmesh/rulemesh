import path from 'node:path';
import fsp from 'node:fs/promises';
import { PUBLIC_DIR, ROOT_DIR } from '../../constants/dir';
import { clientReferences } from './configuration';
import type { CapabilityGap } from '../rules/capabilities';
import { readRuleMetadata } from '../rules/capabilities';

export async function capabilityGaps(target: 'mihomo' | 'singbox', root = PUBLIC_DIR): Promise<CapabilityGap[]> {
  const references = await clientReferences(target, true, undefined, root);
  const records = await Promise.all(references.map(async reference => {
    const metadata = await readRuleMetadata(reference.id, reference.partition, root);
    return metadata.targets[target];
  }));
  return records.flat();
}
interface Approval { schemaVersion: number, checkedAt: string, rationale: Record<string, string>, gaps: { mihomo: string[], singbox: string[] } }
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export async function validateCapabilityGaps(gaps: { mihomo: CapabilityGap[], singbox: CapabilityGap[] }) {
  const approval = JSON.parse(await fsp.readFile(path.join(ROOT_DIR, 'sources/capability-gaps-approved.json'), 'utf8')) as Partial<Approval>;
  if (approval.schemaVersion !== 1 || typeof approval.checkedAt !== 'string' || !DATE.test(approval.checkedAt) || !approval.rationale || !approval.gaps) throw new Error('Invalid capability gap approval');
  const targets = ['mihomo', 'singbox'] as const;
  for (let targetIndex = 0, targetCount = targets.length; targetIndex < targetCount; targetIndex++) {
    const target = targets[targetIndex];
    if (!Array.isArray(approval.gaps[target])) throw new Error(`Missing ${target} capability approval`);
    const actual = gaps[target].map(gap => `${gap.partition}/${gap.category}:${gap.type}`).sort();
    const expected = [...approval.gaps[target]].sort();
    const added = actual.filter(key => !expected.includes(key));
    const removed = expected.filter(key => !actual.includes(key));
    if (added.length || removed.length) throw new Error(`Unreviewed ${target} capability gap change; added=[${added.join(', ')}], removed=[${removed.join(', ')}]`);
    for (let i = 0, len = gaps[target].length; i < len; i++) if (!approval.rationale[gaps[target][i].type]) throw new Error(`Capability gap ${gaps[target][i].type} has no approval rationale`);
  }
  return approval;
}
