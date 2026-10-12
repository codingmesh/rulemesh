import process from 'node:process';
import type { JestWorkerFarm } from 'jest-worker';
import { Worker as JestWorker } from 'jest-worker';

const sharedWorkerOptions = {
  enableWorkerThreads: true,
  forkOptions: {
    // Mocha's runtime require hooks are not inherited by worker threads.
    // The worker owns the TypeScript loader when the calling CLI did not preload it.
    execArgv: process.execArgv.some(argument => argument.includes('@swc-node/register'))
      ? undefined
      : ['--require', require.resolve('@swc-node/register')],
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS
    }
  }
} satisfies ConstructorParameters<typeof JestWorker>[1];

export function createWorker<T extends Record<string, unknown>>(workerPath: string, numWorkers = 1) {
  return <const K extends ReadonlyArray<keyof T & string>>(exposedMethods: K): JestWorkerFarm<Pick<T, K[number]>> => {
    const worker = new JestWorker(workerPath, {
      ...sharedWorkerOptions,
      numWorkers,
      exposedMethods
    }) as JestWorkerFarm<Pick<T, K[number]>>;

    worker.getStdout().pipe(process.stdout);
    worker.getStderr().pipe(process.stderr);

    return worker;
  };
}
