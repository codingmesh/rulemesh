import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { CACHE_DIR, PUBLIC_DIR, ROOT_DIR } from '../constants/dir';
import { fastStringCompare } from 'foxts/fast-string-compare';

export interface BuildContext { root: string, previous: string, failure: SharedArrayBuffer }
export interface OutputRecord { path: string, producer: string }
export interface InputRecord { source: string, role: 'source' | 'dynamic' | 'history' | 'fallback', sha256: string, lastModified?: string }
export interface BuildRecords { outputs: OutputRecord[], inputs: InputRecord[] }
interface ActiveBuild extends BuildContext { outputs: Map<string, OutputRecord>, inputs: Map<string, InputRecord>, writing: Map<string, string>, previousHashes?: Map<string, string> }
const SHA256 = /^[a-f0-9]{64}$/;
// One build owns IO per thread. Workers receive this small context explicitly;
// tracing remains observation only. The four-byte flag is shared because a
// worker must stop writing even while the main thread is handling another task.
let active: ActiveBuild | undefined;

export function buildContext(): BuildContext | undefined {
  return active && { root: active.root, previous: active.previous, failure: active.failure };
}
export function installBuildContext(context: BuildContext): void {
  if (active) throw new Error('A build already owns this thread');
  active = { ...context, outputs: new Map(), inputs: new Map(), writing: new Map() };
}
export function finishBuildContext(): BuildRecords {
  if (active?.writing.size) throw new Error('Cannot release build context while output is in flight');
  const records = buildRecords();
  active = undefined;
  return records;
}
export function buildRecords(): BuildRecords {
  return { outputs: [...(active?.outputs.values() ?? [])], inputs: [...(active?.inputs.values() ?? [])] };
}
export function failBuild(): void {
  if (active) Atomics.store(new Int32Array(active.failure), 0, 1);
}
export class BuildAbortedError extends Error {
  constructor() {
    super('Build failed; refusing new output');
    this.name = 'BuildAbortedError';
  }
}
export function firstBuildFailure(errors: unknown[]): unknown {
  for (let i = 0, len = errors.length; i < len; i++) {
    const error = errors[i];
    if (error && typeof error === 'object') {
      if ('name' in error && error.name === 'BuildAbortedError') continue;
      if ('type' in error && error.type === 'BuildAbortedError') continue;
    }
    return error;
  }
  return errors[0];
}
/** A task cannot release borrowed resources until all of its started work settles. */
export async function settleBuildWork<T extends readonly unknown[]>(work: T | []): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  const errors: unknown[] = [];
  const results = await Promise.allSettled(Array.from(work, promise => Promise.resolve(promise).catch(error => {
    failBuild();
    errors.push(error);
    throw error;
  })));
  if (errors.length) throw firstBuildFailure(errors);
  return results.map(result => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  }) as { -readonly [K in keyof T]: Awaited<T[K]> };
}
export function assertBuildActive(): void {
  if (active && Atomics.load(new Int32Array(active.failure), 0)) throw new BuildAbortedError();
}
function relativeOutput(file: string): string | undefined {
  if (!active) return;
  const relative = path.relative(active.root, path.resolve(file)).replaceAll('\\', '/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative) || !within(realPath(active.root), realPath(file))) throw new Error(`Output is outside build root: ${file}`);
  return relative;
}
function within(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}
/** Resolve existing ancestors too, so a symlink cannot redirect cleanup or IO. */
function realPath(file: string): string {
  let current = path.resolve(file);
  const missing: string[] = [];
  while (true) {
    const entry = fs.lstatSync(current, { throwIfNoEntry: false });
    if (entry) return path.join(fs.realpathSync(current), ...missing.reverse());
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Cannot resolve directory: ${file}`);
    missing.push(path.basename(current));
    current = parent;
  }
}
function assertDisposableDirectory(directory: string): void {
  const resolved = path.resolve(directory);
  const actual = realPath(resolved);
  const repository = realPath(ROOT_DIR);
  const cache = realPath(CACHE_DIR);
  const publicRoot = path.join(repository, 'public');
  if (actual === cache || within(actual, repository)) throw new Error(`Unsafe build output directory: ${directory}`);
  if (within(repository, actual)) {
    if ((!within(publicRoot, actual) && !within(cache, actual)) || within(actual, cache)) throw new Error(`Unsafe build output directory: ${directory}`);
  } else if (fs.existsSync(resolved) && fs.readdirSync(resolved).length && (!fs.existsSync(path.join(resolved, '.RULEMESH_RULESET_SERVER')) || !fs.existsSync(path.join(resolved, 'Internal/artifact-manifest.json')))) {
    // An arbitrary populated directory is never implicitly adopted as output.
    throw new Error(`Unowned build output directory: ${directory}`);
  }
}
/** Reserve before IO; successful writes alone become delivery records. */
export function reserveOutput(file: string, producer = 'writer') {
  assertBuildActive();
  const owner = active;
  const relative = relativeOutput(file);
  if (owner && relative !== undefined) {
    const previous = owner.outputs.get(relative)?.producer ?? owner.writing.get(relative);
    if (previous) throw new Error(`Duplicate output ${relative}: ${previous} / ${producer}`);
    owner.writing.set(relative, producer);
  }
  return {
    commit() {
      if (!owner || relative === undefined) return;
      if (active !== owner || Atomics.load(new Int32Array(owner.failure), 0)) throw new BuildAbortedError();
      owner.outputs.set(relative, { path: relative, producer });
    },
    release() { if (relative !== undefined) owner?.writing.delete(relative); }
  };
}
export function hasOutput(file: string): boolean {
  const relative = relativeOutput(file);
  return relative !== undefined && !!active?.outputs.has(relative);
}
export function recordOutput(file: string, producer = 'writer'): void {
  assertBuildActive();
  const relative = relativeOutput(file);
  if (relative === undefined || !active) return;
  const previous = active.outputs.get(relative)?.producer ?? active.writing.get(relative);
  if (previous) throw new Error(`Duplicate output ${relative}: ${previous} / ${producer}`);
  active.outputs.set(relative, { path: relative, producer });
}
export function recordInput(input: InputRecord): void {
  active?.inputs.set(`${input.role}:${input.source}:${input.sha256}:${input.lastModified ?? ''}`, input);
}
export function mergeBuildRecords(records: BuildRecords): void {
  if (!active) return;
  for (let i = 0, len = records.outputs.length; i < len; i++) {
    const output = records.outputs[i];
    recordOutput(path.join(active.root, output.path), output.producer);
  }
  for (let i = 0, len = records.inputs.length; i < len; i++) recordInput(records.inputs[i]);
}
export function previousOutput(file: string): string {
  const root = active?.root ?? path.resolve(PUBLIC_DIR);
  const previous = active?.previous ?? process.env.RULEMESH_PREVIOUS_DIR;
  return previous ? path.join(previous, path.relative(root, path.resolve(file))) : file;
}
/** Standalone writes compare full content; builds require a verified manifest. */
export async function verifiedPreviousOutput(file: string): Promise<boolean | null> {
  if (!active) return null;
  const owner = active;
  if (owner.previousHashes === undefined) {
    try {
      const manifest: unknown = JSON.parse(fs.readFileSync(path.join(owner.previous, 'Internal/artifact-manifest.json'), 'utf8'));
      if (!manifest || typeof manifest !== 'object' || !('files' in manifest) || !Array.isArray(manifest.files)) throw new Error('Invalid previous output manifest');
      const hashes = new Map<string, string>();
      for (let i = 0, len = manifest.files.length; i < len; i++) {
        const file: unknown = manifest.files[i];
        if (!file || typeof file !== 'object' || !('path' in file) || !('sha256' in file) || typeof file.path !== 'string' || typeof file.sha256 !== 'string' || !SHA256.test(file.sha256) || hashes.has(file.path)) throw new Error('Invalid previous output record');
        hashes.set(file.path, file.sha256);
      }
      owner.previousHashes = hashes;
    } catch {
      owner.previousHashes = new Map();
    }
  }
  const relative = relativeOutput(file)!;
  const expected = owner.previousHashes.get(relative);
  if (!expected) return false;
  const bytes = await fsp.readFile(previousOutput(file));
  return createHash('sha256').update(bytes).digest('hex') === expected;
}
export interface WorkerValue<T> { value: T, records: BuildRecords }
export function mergeWorkerValue<T>(result: WorkerValue<T>): T {
  mergeBuildRecords(result.records);
  return result.value;
}
export async function withWorkerBuild<T>(context: BuildContext | undefined, callback: () => Promise<T>): Promise<WorkerValue<T>> {
  if (context) installBuildContext(context);
  try {
    assertBuildActive();
    const value = await callback();
    return { value, records: context ? buildRecords() : { outputs: [], inputs: [] } };
  } catch (error) {
    console.error('Worker build failed:', error);
    failBuild();
    throw error;
  } finally {
    if (context) finishBuildContext();
  }
}
export async function historicalInput(file: string, role: 'history' | 'fallback', optional = false): Promise<string | null> {
  const source = previousOutput(file);
  try {
    const content = await fsp.readFile(source);
    recordInput({ source: path.relative(active?.root ?? PUBLIC_DIR, path.resolve(file)).replaceAll('\\', '/'), role, sha256: createHash('sha256').update(content).digest('hex') });
    return source;
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      recordInput({ source: path.relative(active?.root ?? PUBLIC_DIR, path.resolve(file)), role, sha256: createHash('sha256').update('absent:optional').digest('hex') });
      return null;
    }
    throw new Error(`Missing required ${role} input: ${source}`, { cause: error });
  }
}
export async function prepareBuildOutput(root = PUBLIC_DIR): Promise<void> {
  if (active) throw new Error('A build is already active');
  const resolved = path.resolve(root);
  assertDisposableDirectory(resolved);
  const supplied = process.env.RULEMESH_PREVIOUS_DIR;
  const previous = path.resolve(supplied ?? path.join(CACHE_DIR, 'previous-build'));
  if (within(realPath(previous), realPath(resolved)) || within(realPath(resolved), realPath(previous))) throw new Error('Previous output must be separate from the work tree');
  // A failed partial tree never replaces the last complete cache.
  if (!supplied && fs.existsSync(path.join(resolved, 'Internal/artifact-manifest.json'))) {
    assertDisposableDirectory(previous);
    await fsp.rm(previous, { recursive: true, force: true });
    await fsp.cp(resolved, previous, { recursive: true });
  }
  await fsp.rm(resolved, { recursive: true, force: true });
  await fsp.mkdir(resolved, { recursive: true });
  installBuildContext({ root: resolved, previous, failure: new SharedArrayBuffer(4) });
}
export async function copyBuildFile(source: string, destination: string, producer: string): Promise<void> {
  const output = reserveOutput(destination, producer);
  try {
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    assertBuildActive();
    await fsp.copyFile(source, destination);
    output.commit();
  } finally { output.release(); }
}
export async function finalizeBuildOutput(): Promise<void> {
  assertBuildActive();
  if (!active) throw new Error('No active build');
  const root = active.root;
  const records = buildRecords();
  records.outputs.sort((a, b) => fastStringCompare(a.path, b.path));
  records.inputs.sort((a, b) => {
    const left = `${a.role}:${a.source}:${a.sha256}:${a.lastModified ?? ''}`;
    const right = `${b.role}:${b.source}:${b.sha256}:${b.lastModified ?? ''}`;
    return fastStringCompare(left, right);
  });
  const files = await Promise.all(records.outputs.map(async output => {
    const content = await fsp.readFile(path.join(root, output.path));
    return { ...output, size: content.length, sha256: createHash('sha256').update(content).digest('hex') };
  }));
  const entries = await fsp.readdir(root, { recursive: true, withFileTypes: true });
  const registered = new Set(files.map(file => file.path));
  for (let i = 0, len = entries.length; i < len; i++) {
    const entry = entries[i];
    if (entry.isSymbolicLink()) throw new Error(`Symlink in output: ${entry.name}`);
    if (entry.isFile()) {
      const relative = path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/');
      if (!registered.has(relative)) throw new Error(`Unregistered output: ${relative}`);
    }
  }
  const manifest = path.join(root, 'Internal/artifact-manifest.json');
  const output = reserveOutput(manifest, 'artifact-manifest');
  try {
    await fsp.mkdir(path.dirname(manifest), { recursive: true });
    assertBuildActive();
    await fsp.writeFile(manifest, JSON.stringify({ schemaVersion: 1, inputs: records.inputs, files }, null, 2) + '\n');
    output.commit();
  } finally { output.release(); }
}
