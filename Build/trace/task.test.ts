import { describe, it } from 'mocha';
import { expect } from 'earl';
import { task } from './index';

describe('task resource ownership', () => {
  it('awaits all cleanups in reverse acquisition order without reusing them', async () => {
    const events: string[] = [];
    let invocation = 0;
    const run = task(false, __filename)(async (_span, onCleanup) => {
      await Promise.resolve();
      invocation++;
      events.push(`run ${invocation}`);
      if (invocation === 1) {
        onCleanup(async () => { await Promise.resolve(); events.push('first resource'); });
        onCleanup(async () => { await Promise.resolve(); events.push('second resource'); });
      }
    });
    await run();
    await run();
    expect(events).toEqual(['run 1', 'second resource', 'first resource', 'run 2']);
  });

  it('preserves the original task failure while completing remaining cleanup', async () => {
    const failure = new Error('task failed');
    const events: string[] = [];
    const run = task(false, __filename)(async (_span, onCleanup) => {
      await Promise.resolve();
      onCleanup(() => { events.push('remaining cleanup'); });
      onCleanup(() => { throw new Error('cleanup failed'); });
      throw failure;
    });
    expect(await run().catch(error => error)).toEqual(failure);
    expect(events).toEqual(['remaining cleanup']);
  });

  it('rejects an otherwise successful task when cleanup fails', async () => {
    const run = task(false, __filename)(async (_span, onCleanup) => {
      await Promise.resolve();
      onCleanup(() => { throw new Error('cleanup failed'); });
    });
    await expect(run()).toBeRejectedWith(Error, 'cleanup failed');
  });
});
