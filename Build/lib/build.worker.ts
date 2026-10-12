/**
 * The single worker module behind the build's shared thread farm. Every job that
 * runs off the main thread is exported from here; each is implemented in its own
 * module, this file is only the surface jest-worker loads.
 *
 * jest-worker runs one call at a time per thread, so the farm size is chosen for
 * the phase with the most concurrent calls (see build-worker-farm.ts).
 */
import { task } from '../trace';
import type { RawSpan, WorkerJobResult } from '../trace';
import { generateMicrosoftCdn } from './microsoft-cdn';
import { generateCdnDownload } from './cdn-download';
import { getPhishingDomains as phishing } from './get-phishing-domains';
import { getRejectSources as reject } from './get-reject-sources';
import { writeOutput as output } from './rules/output.worker';
import type { OutputWorkerPayload } from './rules/strategy-write-data';
import { withWorkerBuild } from './build-output';
import type { BuildContext, WorkerValue } from './build-output';

async function job<T>(context: BuildContext | undefined, callback: () => Promise<WorkerJobResult<T>>): Promise<WorkerJobResult<WorkerValue<T>>> {
  const { value, records } = await withWorkerBuild(context, callback);
  return { ...value, result: { value: value.result, records } };
}
export function writeOutput(span: RawSpan | undefined, payload: OutputWorkerPayload, context?: BuildContext) {
  return job(context, () => output(span, payload));
}
export function getPhishingDomains(span: RawSpan | undefined, context?: BuildContext) {
  return job(context, () => phishing(span));
}
export function getRejectSources(span: RawSpan | undefined, context?: BuildContext) {
  return job(context, () => reject(span));
}
export function buildMicrosoftCdn(context?: BuildContext) {
  return withWorkerBuild(context, () => task(false, 'build-microsoft-cdn.ts')(generateMicrosoftCdn)());
}
export function buildCdnDownloadConf(context?: BuildContext) {
  return withWorkerBuild(context, () => task(false, 'build-cdn-download-conf.ts')(generateCdnDownload)());
}
