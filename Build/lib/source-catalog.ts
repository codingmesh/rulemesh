import path from 'node:path';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ROOT_DIR } from '../constants/dir';
import type { InputRecord } from './build-output';

export interface SourceFile { category: string, path: string, license: string }
export interface SourcesDocument { schemaVersion: number, upstream: { repository: string, branch: string, revision: string }, files: SourceFile[] }
export interface SourceOverride { category: string, value: string, reason: string, evidence: string, checkedAt: string }
export interface OverridesDocument { schemaVersion: number, add: SourceOverride[], remove: SourceOverride[] }
const REVISION = /^[a-f0-9]{40}$/;
const PINNED = /^(?:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/;
const DOMAIN = /^\.?[\w*-]+(?:\.[\w*-]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_FILE = /\.(?:conf|ts|js)$/;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label} object`);
  return value as Record<string, unknown>;
}
function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label}`);
  return value;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label} array`);
  return value;
}
function readOverride(value: unknown): SourceOverride {
  const item = object(value, 'override');
  const result = { category: string(item.category, 'override category'), value: string(item.value, 'override value'), reason: string(item.reason, 'override reason'), evidence: string(item.evidence, 'override evidence'), checkedAt: string(item.checkedAt, 'override checkedAt') };
  if (!DOMAIN.test(result.value) || !result.evidence.startsWith('https://') || !DATE.test(result.checkedAt) || new Date(result.checkedAt).toISOString().slice(0, 10) !== result.checkedAt) throw new Error(`Invalid override: ${result.category}:${result.value}`);
  return result;
}
export function validateOverrides(overrides: OverridesDocument, categories: Set<string>): void {
  if (overrides.schemaVersion !== 2) throw new Error('Unsupported sources/overrides.json schema');
  const additions = new Set<string>();
  const removals = new Set<string>();
  const groups = [[overrides.add, additions], [overrides.remove, removals]] as const;
  for (let groupIndex = 0, groupCount = groups.length; groupIndex < groupCount; groupIndex++) {
    const [items, seen] = groups[groupIndex];
    for (let i = 0, len = items.length; i < len; i++) {
      const item = readOverride(items[i]);
      if (!categories.has(item.category)) throw new Error(`Unknown override category: ${item.category}`);
      const key = `${item.category}:${item.value}`;
      if (seen.has(key)) throw new Error(`Duplicate source override: ${key}`);
      seen.add(key);
    }
  }
  for (const key of additions) if (removals.has(key)) throw new Error(`Source override both adds and removes ${key}`);
}
export function applyOverrides(category: string, entries: Set<string>, overrides: OverridesDocument): void {
  const additions = new Set<string>();
  for (let i = 0, len = overrides.add.length; i < len; i++) {
    const item = readOverride(overrides.add[i]);
    if (item.category === category) { entries.add(item.value); additions.add(item.value); }
  }
  for (let i = 0, len = overrides.remove.length; i < len; i++) {
    const item = readOverride(overrides.remove[i]);
    if (item.category === category) {
      if (additions.has(item.value)) throw new Error(`Source override both adds and removes ${category}:${item.value}`);
      entries.delete(item.value);
    }
  }
}
export async function validateSourceCatalog(root = ROOT_DIR) {
  const sourceText = await fsp.readFile(path.join(root, 'sources/registry.json'), 'utf8');
  const registry = object(JSON.parse(sourceText), 'source registry');
  const upstream = object(registry.upstream, 'source upstream');
  const revision = string(upstream.revision, 'source revision');
  if (registry.schemaVersion !== 1 || !REVISION.test(revision)) throw new Error('Source revision must be immutable');
  const files = array(registry.files, 'source files').map(value => {
    const file = object(value, 'source file');
    return { category: string(file.category, 'source category'), path: string(file.path, 'source path'), license: string(file.license, 'source license') };
  });
  const sources: SourcesDocument = { schemaVersion: 1, upstream: { repository: string(upstream.repository, 'source repository'), branch: string(upstream.branch, 'source branch'), revision }, files };
  const rawOverrides = object(JSON.parse(await fsp.readFile(path.join(root, 'sources/overrides.json'), 'utf8')), 'overrides');
  const overrides: OverridesDocument = { schemaVersion: Number(rawOverrides.schemaVersion), add: array(rawOverrides.add, 'override additions').map(readOverride), remove: array(rawOverrides.remove, 'override removals').map(readOverride) };
  const categories = new Set(files.map(file => file.category));
  if (categories.size !== files.length) throw new Error('Duplicate synchronized source category');
  validateOverrides(overrides, categories);
  const owners = new Map<string, string>();
  const requiredHeaders = new Map<string, string>();
  const own = (file: string, owner: string, header?: string) => {
    if (!file.startsWith('Source/') || file.includes('..') || path.isAbsolute(file)) throw new Error(`Invalid owned source path: ${file}`);
    if (owners.has(file)) throw new Error(`Duplicate source ownership: ${file}`);
    owners.set(file, owner);
    if (header) requiredHeaders.set(file, header);
  };
  for (let i = 0, len = files.length; i < len; i++) own(`Source/domainset/${files[i].category}.conf`, 'pinned synchronization', `@${revision}`);
  const maintained = object(JSON.parse(await fsp.readFile(path.join(root, 'sources/maintained.json'), 'utf8')), 'maintained sources');
  if (maintained.schemaVersion !== 1) throw new Error('Invalid maintained sources schema');
  const snapshots = array(maintained.files, 'maintained files');
  for (let i = 0, len = snapshots.length; i < len; i++) {
    const item = object(snapshots[i], 'maintained source');
    const pin = string(item.revision, 'maintained revision');
    if (!PINNED.test(pin)) throw new Error('Invalid maintained source revision');
    string(item.sourcePath, 'maintained sourcePath');
    string(item.license, 'maintained license');
    string(item.transformation, 'maintained transformation');
    own(string(item.path, 'maintained path'), 'manual pinned snapshot', pin);
  }
  const inherited = object(maintained.inherited, 'inherited source ownership');
  const manual = array(maintained.manual ?? [], 'manual sources');
  for (let i = 0, len = manual.length; i < len; i++) {
    const item = object(manual[i], 'manual source');
    string(item.license, 'manual source license');
    string(item.maintenance, 'manual source maintenance');
    own(string(item.path, 'manual source path'), 'self-maintained source');
  }
  if (!REVISION.test(string(inherited.revision, 'inherited revision'))) throw new Error('Invalid inherited source revision');
  string(inherited.license, 'inherited license');
  string(inherited.maintenance, 'inherited maintenance');
  const paths = array(inherited.paths, 'inherited paths');
  for (let i = 0, len = paths.length; i < len; i++) own(string(paths[i], 'inherited path'), 'manual inherited source');
  const entries = await fsp.readdir(path.join(root, 'Source'), { recursive: true });
  const actual = new Set(entries.flatMap(file => (SOURCE_FILE.test(file) ? [`Source/${file.replaceAll('\\', '/')}`] : [])));
  for (const file of actual) if (!owners.has(file)) throw new Error(`Unowned source: ${file}`);
  const inputs = await Promise.all(Array.from(owners, async ([file, owner]) => {
    if (!actual.has(file)) throw new Error(`Declared source is missing: ${file}`);
    const bytes = await fsp.readFile(path.join(root, file));
    const expected = requiredHeaders.get(file);
    if (!bytes.length || (expected && !bytes.toString('utf8').includes(expected))) throw new Error(`Invalid pinned source header: ${file}`);
    return { source: `${file} (${owner})`, role: 'source', sha256: createHash('sha256').update(bytes).digest('hex') } satisfies InputRecord;
  }));
  return { sources, overrides, inputs };
}
