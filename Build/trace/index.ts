import { isCI } from 'ci-info';
import { basename, extname } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { threadId } from 'node:worker_threads';
import { mergeExternalDownloadStats, takeExternalDownloadStats } from '../lib/download-stats';
import type { ExternalDownloadStatsSnapshot } from '../lib/download-stats';
import { mergeWireStats, takeWireStats } from '../lib/download-wire-stats';
import type { WireStatsSnapshot } from '../lib/download-wire-stats';
import { SPAN_STATUS_END, SPAN_STATUS_START, SpanCategory } from './types';
import type { RawSpan, TraceResult } from './types';
import { adjustTraceTimestamps, printBuildReport } from './report';
import { endBuildWorkerFarm } from '../lib/build-worker-farm';
import { closeFetchAgent } from '../lib/fetch-retry';
import { assertBuildActive } from '../lib/build-output';

export { SPAN_STATUS_START, SPAN_STATUS_END, SpanCategory, UNCATEGORIZED } from './types';
export type { RawSpan, TraceResult, ReportedSpanCategory, SpanEventLoopUtilization } from './types';
export { printTraceResult, printStats, printBuildReport, analyzeTraces } from './report';
export type { BuildResourceUsage, TraceAnalysis } from './report';

const spanTag = Symbol('span');

export interface Span {
  [spanTag]: true,
  readonly rawSpan: RawSpan,
  readonly stop: (time?: number) => void,
  /** Tag (or re-tag) what this span's self time is spent on */
  readonly setCategory: (category: SpanCategory) => Span,
  readonly traceChild: (name: string, category?: SpanCategory) => Span,
  readonly traceSyncFn: <T>(fn: (span: Span) => T) => T,
  readonly traceAsyncFn: <T>(fn: (span: Span) => T | Promise<T>) => Promise<T>,
  readonly tracePromise: <T>(promise: Promise<T>) => Promise<T>,
  readonly traceChildSync: <T>(name: string, fn: (span: Span) => T, category?: SpanCategory) => T,
  readonly traceChildAsync: <T>(name: string, fn: (span: Span) => T | Promise<T>, category?: SpanCategory) => Promise<T>,
  readonly traceChildPromise: <T>(name: string, promise: Promise<T>, category?: SpanCategory) => Promise<T>,
  /** Always tagged {@link SpanCategory.Worker}: the self time is the IPC + waiting on the worker */
  readonly traceWorkerChild: <T>(name: string, factory: (rawSpan: RawSpan) => Promise<WorkerJobResult<T>>) => Promise<T>,
  readonly traceResult: TraceResult
}

/**
 * Wraps a serializable {@link RawSpan} with all span methods.
 * Use this on a worker thread after receiving a {@link RawSpan} (or {@link TraceResult})
 * transferred from another thread.
 */
export function makeSpan(rawSpan: RawSpan): Span {
  const { traceResult } = rawSpan;

  const stop = (time?: number) => {
    if (rawSpan.status === SPAN_STATUS_END) {
      throw new Error(`span already stopped: ${traceResult.name}`);
    }
    traceResult.end = time ?? performance.now();
    if (rawSpan.eluStart) {
      traceResult.loopIdle = { atStart: rawSpan.eluStart.idle, atEnd: performance.eventLoopUtilization().idle };
    }
    rawSpan.status = SPAN_STATUS_END;
  };

  const traceChild = (name: string, category?: SpanCategory) => createSpan(name, traceResult, category);

  const span: Span = {
    [spanTag]: true,
    rawSpan,
    stop,
    setCategory(category) {
      traceResult.category = category;
      return span;
    },
    traceChild,
    // Spans are stopped in `finally` so a throwing function is still measured
    // (and the tree does not end up with an "(unfinished)" hole where it failed).
    traceSyncFn<T>(fn: (span: Span) => T) {
      traceResult.sync = true;
      try {
        return fn(span);
      } finally {
        span.stop();
      }
    },
    async traceAsyncFn<T>(fn: (span: Span) => T | Promise<T>): Promise<T> {
      try {
        return await fn(span);
      } finally {
        span.stop();
      }
    },
    traceResult,
    async tracePromise<T>(promise: Promise<T>): Promise<T> {
      try {
        return await promise;
      } finally {
        span.stop();
      }
    },
    traceChildSync: <T>(name: string, fn: (span: Span) => T, category?: SpanCategory): T => traceChild(name, category).traceSyncFn(fn),
    traceChildAsync: <T>(name: string, fn: (span: Span) => T | Promise<T>, category?: SpanCategory): Promise<T> => traceChild(name, category).traceAsyncFn(fn),
    traceChildPromise: <T>(name: string, promise: Promise<T>, category?: SpanCategory): Promise<T> => traceChild(name, category).tracePromise(promise),

    async traceWorkerChild<T>(name: string, factory: (rawSpan: RawSpan) => Promise<WorkerJobResult<T>>): Promise<T> {
      const childSpan = traceChild(name, SpanCategory.Worker);
      const { result, traceResult, workerTimeOrigin, externalDownloadStats, wireStats } = await factory(childSpan.rawSpan);
      mergeWorkerTrace(childSpan, traceResult, workerTimeOrigin);
      mergeExternalDownloadStats(externalDownloadStats);
      mergeWireStats(wireStats);
      childSpan.stop();
      return result;
    }
  };

  // eslint-disable-next-line sukka/no-redundant-variable -- self reference
  return span;
}

export function createSpan(name: string, parentTraceResult?: TraceResult, category?: SpanCategory): Span {
  const traceResult: TraceResult = {
    name,
    start: performance.now(),
    end: 0,
    thread: threadId,
    children: []
  };
  if (category !== undefined) {
    traceResult.category = category;
  }

  const rawSpan: RawSpan = {
    traceResult,
    status: SPAN_STATUS_START,
    eluStart: performance.eventLoopUtilization()
  };

  parentTraceResult?.children.push(traceResult);

  return makeSpan(rawSpan);
}

export const dummySpan = createSpan('dummy');

export function task(importMetaMain: boolean, importMetaPath: string) {
  return (fn: (span: Span, onCleanup: (cb: () => Promise<void> | void) => void) => Promise<unknown>, customName?: string) => {
    const taskName = customName ?? basename(importMetaPath, extname(importMetaPath));
    async function run(parentSpan?: Span | null): Promise<TraceResult> {
      assertBuildActive();
      const runSpan = parentSpan ? parentSpan.traceChild(taskName) : createSpan(taskName);
      const cleanups: Array<() => Promise<void> | void> = [];
      let failed = false;
      let failure: unknown;
      try {
        await fn(runSpan, callback => cleanups.push(callback));
      } catch (error) {
        failed = true;
        failure = error;
      } finally {
        runSpan.stop();
        // Resource teardown follows reverse acquisition order. Every callback is
        // awaited, even if an earlier callback or the task itself failed.
        for (let i = cleanups.length - 1; i >= 0; i--) {
          try {
            // eslint-disable-next-line no-await-in-loop -- resources must close in reverse acquisition order
            await cleanups[i]();
          } catch (error) {
            if (failed) console.error(`Cleanup failed for ${taskName}:`, error);
            else { failed = true; failure = error; }
          }
        }
        runSpan.traceResult.timeOrigin = performance.timeOrigin;
      }
      if (failed) throw failure;
      return runSpan.traceResult;
    }

    if (importMetaMain) {
      const eluAtStart = performance.eventLoopUtilization();
      const cpuAtStart = process.cpuUsage();
      void run().then(trace => {
        printBuildReport([trace], {
          elu: performance.eventLoopUtilization(eluAtStart),
          cpu: process.cpuUsage(cpuAtStart)
        });
      }).catch(error => {
        console.error(error);
        process.exitCode = 1;
      }).finally(async () => {
        // Only an independently executed task owns these shared resources.
        const results = await Promise.allSettled([
          endBuildWorkerFarm(), closeFetchAgent()
        ]);
        for (let i = 0, len = results.length; i < len; i++) {
          const result = results[i];
          if (result.status === 'rejected') {
            console.error(result.reason);
            process.exitCode = 1;
          }
        }
      });
    }
    return run;
  };
}

export async function whyIsNodeRunning() {
  if (isCI && process.env.RUNNER_DEBUG === '1') {
    const mod = await import('why-is-node-running');
    return mod.default();
  }
}

// const isSpan = (obj: any): obj is Span => {
//   return typeof obj === 'object' && obj && spanTag in obj;
// };
// export const universalify = <A extends any[], R>(taskname: string, fn: (this: void, ...args: A) => R) => {
//   return (...args: A) => {
//     const lastArg = args[args.length - 1];
//     if (isSpan(lastArg)) {
//       return lastArg.traceChild(taskname).traceSyncFn(() => fn(...args));
//     }
//     return fn(...args);
//   };
// };

function mergeWorkerTrace(
  parentSpan: Span,
  workerTraceResult: TraceResult,
  workerTimeOrigin: number
): void {
  const offset = workerTimeOrigin - performance.timeOrigin;
  for (let i = 0, len = workerTraceResult.children.length; i < len; i++) {
    const child = workerTraceResult.children[i];
    parentSpan.traceResult.children.push(adjustTraceTimestamps(child, offset));
  }
}

/** The envelope that a worker function returns so the main thread can recover both the result and the trace. */
export interface WorkerJobResult<T> {
  result: T,
  traceResult: TraceResult,
  workerTimeOrigin: number,
  externalDownloadStats: ExternalDownloadStatsSnapshot,
  wireStats: WireStatsSnapshot
}

/**
 * Worker-side wrapper.  Call this instead of manually constructing spans.
 *
 * - When `rawSpan` is provided (normal worker invocation from the main thread),
 *   it is wrapped with {@link makeSpan} so all child spans are attached to the
 *   caller's trace tree and can be recovered after the job finishes.
 * - When `rawSpan` is `undefined` (standalone / CLI invocation), a fresh
 *   child span of {@link dummySpan} is used instead.
 *
 * The impl function receives a full {@link Span} and returns its result
 * normally; the wrapper packages everything into a {@link WorkerJobResult}.
 */
export async function workerJob<T>(
  rawSpan: RawSpan | undefined,
  impl: (span: Span) => Promise<T>
): Promise<WorkerJobResult<T>> {
  const span = rawSpan == null ? dummySpan.traceChild('worker-standalone') : makeSpan(rawSpan);
  const result = await impl(span);
  return {
    result,
    traceResult: span.traceResult,
    workerTimeOrigin: performance.timeOrigin,
    externalDownloadStats: takeExternalDownloadStats(),
    wireStats: takeWireStats()
  };
}
