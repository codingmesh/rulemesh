import process from 'node:process';
import os from 'node:os';
import fs from 'node:fs';

import { downloadPreviousBuild } from './download-previous-build';
import { buildCommon } from './build-common';
import { buildRejectIPList } from './build-reject-ip-list';
import { buildAppleCdn } from './build-apple-cdn';
import { buildAICIDR } from './build-ai-cidr';
import { buildRejectDomainSet } from './build-reject-domainset';
import { buildSpeedtestDomainSet } from './build-speedtest-domainset';
import { buildDomesticRuleset } from './build-domestic-direct-lan-ruleset-dns-mapping-module';
import { buildGlobalRuleset } from './build-global-server-dns-mapping';
import { buildStreamService } from './build-stream-service';

import { buildRedirectModule } from './build-sgmodule-redirect';
import { buildAlwaysRealIPModule } from './build-sgmodule-always-realip';

import { buildTelegram } from './build-telegram';
import { downloadMockAssets } from './download-mock-assets';

import { buildPublic } from './build-public';
import { buildCloudMounterRules } from './build-cloudmounter-rules';
import { buildClientConfig } from './build-client-config';

import { printBuildReport, whyIsNodeRunning } from './trace';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { ROOT_DIR } from './constants/dir';
import { isCI } from 'ci-info';
import { printExternalDownloadStats } from './lib/download-stats';
import { printWireStats } from './lib/download-wire-stats';
import { endBuildWorkerFarm, getBuildWorkerFarm, warmBuildWorkerFarm } from './lib/build-worker-farm';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { closeFetchAgent } from './lib/fetch-retry';
import { assertBuildActive, buildContext, failBuild, finalizeBuildOutput, finishBuildContext, mergeWorkerValue, prepareBuildOutput, recordInput, settleBuildWork } from './lib/build-output';
import { validateSourceCatalog } from './lib/source-catalog';

const buildFinishedLock = path.join(ROOT_DIR, '.BUILD_FINISHED');

let building = false;
export async function buildRulesetServer(): Promise<void> {
  if (building) throw new Error('A build is already running');
  building = true;
  try {
    await runBuild();
  } finally {
    building = false;
  }
}
async function runBuild(): Promise<void> {
  console.log('Version:', process.version);

  console.log(`OS: ${os.type()} ${os.release()} ${os.arch()}`);
  console.log(`Node.js: ${process.versions.node}`);
  console.log(`V8: ${process.versions.v8}`);

  const cpus = os.cpus()
    .reduce<Record<string, number>>((o, cpu) => {
      o[cpu.model] = (o[cpu.model] || 0) + 1;
      return o;
    }, {});

  console.log(`CPU: ${
    Object.keys(cpus)
      .map((key) => `${key} x ${cpus[key]}`)
      .join('\n')
  }`);
  if ('availableParallelism' in os) {
    console.log(`Available parallelism: ${os.availableParallelism()}`);
  }

  console.log(`Memory: ${os.totalmem() / (1024 * 1024)} MiB`);

  if (fs.existsSync(buildFinishedLock)) {
    fs.unlinkSync(buildFinishedLock);
  }

  // Build-wide resource baselines: how busy the main thread's event loop was
  // (CPU vs. waiting on I/O) and how much CPU the whole process (incl. worker
  // threads) burned relative to wall-clock.
  const eluAtStart = performance.eventLoopUtilization();
  const cpuAtStart = process.cpuUsage();

  // The one thread farm every off-main-thread job goes through: the reject
  // sources / phishing parse, the two trie-heavy CDN tasks, and any FileOutput
  // that crosses the offload threshold. Booted here rather than on first use so
  // the ~250ms-per-thread spin-up overlaps the first downloads instead of landing
  // on the critical path. Everything else is I/O-bound and stays on this thread.
  let cleanupFailed = false;
  let cleanupFailure: unknown;
  let failed = false;
  try {
    const catalog = await validateSourceCatalog();
    await prepareBuildOutput();
    for (let i = 0, len = catalog.inputs.length; i < len; i++) recordInput(catalog.inputs[i]);
    warmBuildWorkerFarm();
    const farm = getBuildWorkerFarm();
    // only enable why-is-node-running in GitHub Actions debug mode
    if (isCI && process.env.RUNNER_DEBUG === '1') {
      await import('why-is-node-running');
    }

    const downloadPreviousBuildPromise = downloadPreviousBuild();

    const [traces, telegramTraces] = await settleBuildWork([
      settleBuildWork([
        downloadPreviousBuildPromise,
        downloadPreviousBuildPromise.then(() => buildCommon()),
        downloadPreviousBuildPromise.then(() => buildRejectIPList()),
        downloadPreviousBuildPromise.then(() => buildAppleCdn()),
        downloadPreviousBuildPromise.then(() => buildAICIDR()),
        downloadPreviousBuildPromise.then(() => { assertBuildActive(); return farm.buildCdnDownloadConf(buildContext()); }).then(mergeWorkerValue),
        downloadPreviousBuildPromise.then(() => buildRejectDomainSet()),
        downloadPreviousBuildPromise.then(() => buildSpeedtestDomainSet()),
        downloadPreviousBuildPromise.then(() => buildDomesticRuleset()),
        downloadPreviousBuildPromise.then(() => buildGlobalRuleset()),
        downloadPreviousBuildPromise.then(() => buildRedirectModule()),
        downloadPreviousBuildPromise.then(() => buildAlwaysRealIPModule()),
        downloadPreviousBuildPromise.then(() => buildStreamService()),
        downloadPreviousBuildPromise.then(() => { assertBuildActive(); return farm.buildMicrosoftCdn(buildContext()); }).then(mergeWorkerValue),
        downloadPreviousBuildPromise.then(() => buildCloudMounterRules()),
        downloadPreviousBuildPromise.then(() => downloadMockAssets())
      ]),
      downloadPreviousBuildPromise.then(() => buildTelegram())
    ]);

    appendArrayInPlace(traces, telegramTraces);
    traces.push(await buildClientConfig(), await buildPublic());

    printExternalDownloadStats();
    printWireStats();
    printBuildReport(traces, {
      elu: performance.eventLoopUtilization(eluAtStart),
      cpu: process.cpuUsage(cpuAtStart)
    });

    await whyIsNodeRunning();
  } catch (error) {
    failed = true;
    failBuild();
    throw error;
  } finally {
    const results = await Promise.allSettled([endBuildWorkerFarm(), closeFetchAgent()]);
    for (let i = 0, len = results.length; i < len; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        console.error('Build resource cleanup failed:', result.reason);
        if (!cleanupFailed) { cleanupFailed = true; cleanupFailure = result.reason; }
      }
    }
    if (cleanupFailed) failBuild();
    if (failed || cleanupFailed) finishBuildContext();
  }
  if (cleanupFailed) throw cleanupFailure;
  try {
    await finalizeBuildOutput();
  } finally {
    finishBuildContext();
  }
  // Success includes resource teardown; a failed build cannot leave this marker.
  fs.writeFileSync(buildFinishedLock, 'BUILD_FINISHED\n');
}

if (require.main === module) {
  void buildRulesetServer().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
