import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'earl';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createSpan } from '../trace';
import { BuildAbortedError, buildContext, buildRecords, copyBuildFile, failBuild, finalizeBuildOutput, finishBuildContext, firstBuildFailure, historicalInput, installBuildContext, mergeWorkerValue, prepareBuildOutput, reserveOutput } from './build-output';
import { writeFile } from './misc';
import { compareAndWriteFile, writeFileLinesSync } from './create-file';
import { ROOT_DIR } from '../constants/dir';
import { calculateContentHash } from './content-hash';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { FileOutput } from './rules/base';
import { SurgeRuleSet } from './writing-strategy/surge';
import { SingboxSource } from './writing-strategy/singbox';
import { getBuildWorkerFarm, endBuildWorkerFarm } from './build-worker-farm';
import { serializeStrategy } from './rules/strategy-write-data';
import type { StrategyWriteData } from './rules/strategy-write-data';

const LINES = ['DOMAIN,exact.example', 'DOMAIN-KEYWORD,blocked', 'DOMAIN-KEYWORD,keep', 'PROCESS-NAME,curl', 'URL-REGEX,^https://example.com/'];
const DATA: StrategyWriteData = {
  domains: ['exact.example'], domainKeywords: ['blocked', 'keep'], whitelistKeywords: ['blocked'],
  processNames: ['curl'], urlRegexes: ['^https://example.com/'],
  origins: { 'URL-REGEX': [{ file: 'Source/fixture.conf', line: 5, text: LINES[4] }] },
  wildcards: [], userAgents: [], processPaths: [], ipcidr: [], ipcidrNoResolve: [], ipcidr6: [], ipcidr6NoResolve: [], ipasn: [], ipasnNoResolve: [], geoip: [], geoipNoResolve: [], sourceIpOrCidr: [], sourcePort: [], destPort: [], protocol: [], otherRules: []
};
const DATE = new Date('2026-10-12T00:00:00Z');

describe('build output ownership', () => {
  let directory: string;
  let root: string;
  let previous: string;
  beforeEach(async () => {
    directory = await fsp.mkdtemp(path.join(tmpdir(), 'rulemesh-output-'));
    root = path.join(directory, 'output');
    previous = path.join(directory, 'previous');
    await Promise.all([fsp.mkdir(root), fsp.mkdir(previous)]);
    installBuildContext({ root, previous, failure: new SharedArrayBuffer(4) });
  });
  afterEach(async () => {
    finishBuildContext();
    await endBuildWorkerFarm();
    await fsp.rm(directory, { recursive: true, force: true });
  });

  it('reuses only requested old files and preserves their metadata without reviving deleted output', async () => {
    await Promise.all([
      fsp.writeFile(path.join(previous, 'retained.conf'), '# Last Updated: old\nDOMAIN,example.com\n'),
      fsp.writeFile(path.join(previous, 'deleted.conf'), 'obsolete\n')
    ]);
    await fsp.mkdir(path.join(previous, 'Internal'));
    await fsp.writeFile(path.join(previous, 'Internal/artifact-manifest.json'), JSON.stringify({ files: [{ path: 'retained.conf', sha256: createHash('sha256').update('# Last Updated: old\nDOMAIN,example.com\n').digest('hex') }] }));
    const lines = ['# Last Updated: new', 'DOMAIN,example.com'];
    await compareAndWriteFile(createSpan('warm'), lines, path.join(root, 'retained.conf'));
    expect(lines).toEqual(['# Last Updated: new', 'DOMAIN,example.com']);
    expect(await fsp.readFile(path.join(root, 'retained.conf'), 'utf8')).toEqual('# Last Updated: old\nDOMAIN,example.com\n');
    await finalizeBuildOutput();
    await expect(fsp.stat(path.join(root, 'deleted.conf'))).toBeRejected();
    const manifest = JSON.parse(await fsp.readFile(path.join(root, 'Internal/artifact-manifest.json'), 'utf8'));
    expect(manifest.files.map((file: { path: string }) => file.path)).toEqual(['retained.conf']);
  });

  it('rejects duplicate output and late writes after failure', async () => {
    const file = path.join(root, 'owned.conf');
    await writeFile(file, 'first\n');
    await expect(compareAndWriteFile(createSpan('second producer'), ['second'], file)).toBeRejectedWith(Error, 'Duplicate output owned.conf: writer / writer');
    expect(await fsp.readFile(file, 'utf8')).toEqual('first\n');
    failBuild();
    await expect(writeFile(path.join(root, 'late.conf'), 'late')).toBeRejectedWith(Error, 'Build failed; refusing new output');
    await expect(fsp.stat(path.join(root, 'late.conf'))).toBeRejected();
  });
  it('rejects destructive source, ancestor and symlink directories before any IO', async () => {
    finishBuildContext();
    const original = { rm: fsp.rm, cp: fsp.cp, mkdir: fsp.mkdir };
    const link = path.join(directory, 'source-link');
    await fsp.symlink(path.join(ROOT_DIR, 'Source'), link);
    let touched = false;
    const forbidden = () => { touched = true; return Promise.reject(new Error('Destructive IO must not start')); };
    Object.assign(fsp, { rm: forbidden, cp: forbidden, mkdir: forbidden });
    try {
      const unsafePaths = [path.join(ROOT_DIR, 'Source'), path.join(ROOT_DIR, 'Build'), path.dirname(ROOT_DIR), link];
      for (let i = 0, len = unsafePaths.length; i < len; i++) {
        const unsafe = unsafePaths[i];
        // eslint-disable-next-line no-await-in-loop -- validate each destructive boundary independently
        await expect(prepareBuildOutput(unsafe)).toBeRejectedWith(Error, `Unsafe build output directory: ${unsafe}`);
      }
      expect(touched).toEqual(false);
    } finally { Object.assign(fsp, original); }
    await expect(prepareBuildOutput(directory)).toBeRejectedWith(Error, `Unowned build output directory: ${directory}`);
    expect(await fsp.readdir(directory)).toEqual(['output', 'previous', 'source-link']);
    await prepareBuildOutput(path.join(directory, 'fresh'));
    expect(buildContext()?.root).toEqual(path.join(directory, 'fresh'));
  });

  it('checks async, sync, copy and symlink destinations before overwriting any bytes', async () => {
    const outside = path.join(directory, 'outside.conf');
    await fsp.writeFile(outside, 'original');
    const error = `Output is outside build root: ${outside}`;
    await expect(writeFile(outside, 'changed')).toBeRejectedWith(Error, error);
    await expect(copyBuildFile(outside, outside, 'copy')).toBeRejectedWith(Error, error);
    expect(() => writeFileLinesSync(createSpan('sync'), ['changed'], outside)).toThrow(Error, error);
    const link = path.join(root, 'link.conf');
    await fsp.symlink(outside, link);
    await expect(writeFile(link, 'changed')).toBeRejectedWith(Error, `Output is outside build root: ${link}`);
    expect(await fsp.readFile(outside, 'utf8')).toEqual('original');
    const file = path.join(root, 'same.conf');
    const reservation = reserveOutput(file, 'first');
    await expect(writeFile(file, 'second')).toBeRejectedWith(Error, 'Duplicate output same.conf: first / writer');
    expect(() => finishBuildContext()).toThrow(Error, 'Cannot release build context while output is in flight');
    reservation.release();
    await writeFile(file, 'first');
    expect(await fsp.readFile(file, 'utf8')).toEqual('first');
  });

  it('drains writer siblings on failure before teardown and allows a clean next build', async () => {
    const original = new Error('producer failed');
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let started = false;
    let settled = false;
    let siblingFinished = false;
    const failed = new SurgeRuleSet('non_ip', root);
    const slow = new SurgeRuleSet('non_ip', root);
    failed.output = () => { started = true; return Promise.reject(original); };
    slow.output = async () => {
      try { await gate; await writeFile(path.join(root, 'late.conf'), 'late'); } finally { siblingFinished = true; }
    };
    const running = new FileOutput(createSpan('failure drain'), 'fixture')
      .withStrategies([failed, slow])
      .withTitle('Fixture')
      .withDescription([])
      .addDomain('example.com')
      .write()
      .then(() => { settled = true; })
      .catch(error => { settled = true; return error; });
    // Wait until the real writer failure has occurred, without a timing race.
    // eslint-disable-next-line no-await-in-loop -- wait for the writer's explicit start signal
    while (!started) await new Promise<void>(resolve => { setImmediate(resolve); });
    await new Promise<void>(resolve => { setImmediate(resolve); });
    expect(settled).toEqual(false);
    release();
    expect(await running).toEqual(original);
    expect(siblingFinished).toEqual(true);
    await expect(fsp.stat(path.join(root, 'late.conf'))).toBeRejected();
    finishBuildContext();
    installBuildContext({ root, previous, failure: new SharedArrayBuffer(4) });
    await writeFile(path.join(root, 'next.conf'), 'next');
    await finalizeBuildOutput();
    expect(await fsp.readFile(path.join(root, 'next.conf'), 'utf8')).toEqual('next');
  });

  it('regenerates corrupted cache bytes even when the embedded marker still matches', async () => {
    const hash = calculateContentHash('Fixture', [], ['DOMAIN,correct.example']);
    const correct = [`# ${hash}`, 'DOMAIN,correct.example'];
    const bytes = Buffer.from(correct.join('\n') + '\n');
    await fsp.mkdir(path.join(previous, 'Internal'));
    await fsp.writeFile(path.join(previous, 'Internal/artifact-manifest.json'), JSON.stringify({ files: [{ path: 'cached.conf', sha256: createHash('sha256').update(bytes).digest('hex') }] }));
    await fsp.writeFile(path.join(previous, 'cached.conf'), `# ${hash}\nDOMAIN,wrong.example\n`);
    const output = path.join(root, 'cached.conf');
    await compareAndWriteFile(createSpan('corrupt cache'), correct, output, hash);
    expect(await fsp.readFile(output, 'utf8')).toEqual(bytes.toString());
    await finalizeBuildOutput();
    // Missing metadata forces regeneration even when the body looks reusable.
    finishBuildContext();
    await fsp.rm(path.join(previous, 'Internal'), { recursive: true });
    const uncachedRoot = path.join(directory, 'uncached');
    await fsp.mkdir(uncachedRoot);
    installBuildContext({ root: uncachedRoot, previous, failure: new SharedArrayBuffer(4) });
    await fsp.writeFile(path.join(previous, 'cached.conf'), bytes);
    await compareAndWriteFile(createSpan('missing cache manifest'), correct, path.join(uncachedRoot, 'cached.conf'), hash);
    expect(await fsp.readFile(path.join(uncachedRoot, 'cached.conf'), 'utf8')).toEqual(bytes.toString());
    expect(buildRecords().outputs[0].producer).toEqual('writer');
  });
  it('keeps the real failure ahead of synthetic cancellation errors', () => {
    const original = new Error('source failed');
    expect(firstBuildFailure([new BuildAbortedError(), original, new BuildAbortedError()])).toEqual(original);
  });

  it('blocks missing required history and unregistered delivery files', async () => {
    await expect(historicalInput(path.join(root, 'history.conf'), 'history')).toBeRejectedWith(Error, `Missing required history input: ${path.join(previous, 'history.conf')}`);
    await fsp.writeFile(path.join(root, 'pollution.conf'), 'old output');
    await expect(finalizeBuildOutput()).toBeRejectedWith(Error, 'Unregistered output: pollution.conf');
  });

  it('does not hide source or attribution changes behind unchanged rules', async () => {
    await fsp.writeFile(path.join(previous, 'source.conf'), '# Source: old revision\nDOMAIN,example.com\n');
    await compareAndWriteFile(createSpan('source metadata'), ['# Source: new revision', 'DOMAIN,example.com'], path.join(root, 'source.conf'));
    expect(await fsp.readFile(path.join(root, 'source.conf'), 'utf8')).toEqual('# Source: new revision\nDOMAIN,example.com\n');
  });

  it('produces identical content and original-condition diagnostics on main and worker', async function () {
    this.timeout(10000);
    const strategies = [new SurgeRuleSet('non_ip', path.join(root, 'List')), new SingboxSource('non_ip', path.join(root, 'sing-box'))];
    await new FileOutput(createSpan('main'), 'fixture')
      .withStrategies(strategies)
      .withTitle('Fixture')
      .withDescription(['Fixed source'])
      .withDate(DATE)
      .whitelistKeyword('blocked')
      .addFromRuleset(LINES, { file: 'Source/fixture.conf' })
      .write();
    const main = await snapshot();
    finishBuildContext();
    root = path.join(directory, 'worker');
    await fsp.mkdir(root);
    installBuildContext({ root, previous, failure: new SharedArrayBuffer(4) });
    const workerStrategies = [new SurgeRuleSet('non_ip', path.join(root, 'List')), new SingboxSource('non_ip', path.join(root, 'sing-box'))];
    const result = await getBuildWorkerFarm().writeOutput(undefined, { id: 'fixture', title: 'Fixture', description: ['Fixed source'], dateMs: DATE.getTime(), strategies: workerStrategies.map(serializeStrategy), data: DATA }, buildContext());
    mergeWorkerValue(result.result);
    expect(await snapshot()).toEqual(main);
  });

  it('stops a queued worker after failure and permits a fresh build on the same pool', async function () {
    this.timeout(10000);
    const farm = getBuildWorkerFarm();
    const strategies = [new SurgeRuleSet('non_ip', path.join(root, 'List')), new SingboxSource('non_ip', path.join(root, 'sing-box'))];
    const payload = { id: 'fixture', title: 'Fixture', description: ['Fixed source'], dateMs: DATE.getTime(), strategies: strategies.map(serializeStrategy), data: DATA };
    failBuild();
    await expect(farm.writeOutput(undefined, payload, buildContext())).toBeRejected();
    expect(await fsp.readdir(root)).toEqual([]);
    finishBuildContext();
    installBuildContext({ root, previous, failure: new SharedArrayBuffer(4) });
    const result = await farm.writeOutput(undefined, payload, buildContext());
    mergeWorkerValue(result.result);
    expect(await fsp.readFile(path.join(root, 'List/non_ip/fixture.conf'), 'utf8')).toInclude('DOMAIN,exact.example');
    await finalizeBuildOutput();
  });

  async function snapshot() {
    const outputs = buildRecords().outputs;
    outputs.sort((a, b) => (a.path < b.path ? -1 : 1));
    return Promise.all(outputs.map(async output => ({ path: output.path, content: await fsp.readFile(path.join(root, output.path), 'utf8') })));
  }
});
