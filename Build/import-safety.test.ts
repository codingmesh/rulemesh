import { describe, it } from 'mocha';
import { expect } from 'earl';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT_DIR } from './constants/dir';

const execute = promisify(execFile);

describe('build import safety', () => {
  it('loads the complete build without starting file input, persistence or workers', async function () {
    this.timeout(15000);
    // A separate process avoids altering dependency state in the test runner.
    const script = String.raw`
      const fs = require('node:fs');
      const undici = require('undici');
      const workers = require('jest-worker');
      const forbid = name => () => { throw new Error('Unexpected import side effect: ' + name); };
      fs.createReadStream = forbid('file input');
      fs.mkdirSync = forbid('persistence');
      undici.Agent = forbid('network dispatcher');
      workers.Worker = forbid('worker threads');
      require('./Build/index');
      require('./Build/acceptance');
      require('./Build/native-routing');
      require('./Build/config-cli');
      require('./Build/lib/parse-filter/hosts').createHostsProcessor('https://example.invalid/hosts', null);
      require('./Build/lib/parse-filter/domainlists').createDomainListProcessor('https://example.invalid/domains', null);
      require('./Build/lib/parse-filter/filters').createFilterProcessor('https://example.invalid/filters');
      require('./Build/lib/build-worker-farm').endBuildWorkerFarm()
        .then(() => require('./Build/lib/fetch-retry').closeFetchAgent())
        .then(() => process.stdout.write('import-safe\n'));
    `;
    const { stdout } = await execute(process.execPath, ['-r', '@swc-node/register', '-e', script], {
      cwd: ROOT_DIR,
      env: { ...process.env, SWC_NODE_IGNORE_DYNAMIC: 'true', SWC_NODE_CACHE: '0' },
      timeout: 15000
    });
    expect(stdout).toEqual('import-safe\n');
  });

  it('exits with failure after a standalone task fails', async () => {
    const script = `
      require('./Build/trace').task(true, 'failure-fixture.ts')(async () => {
        throw new Error('standalone-task-failed');
      });
    `;
    try {
      await execute(process.execPath, ['-r', '@swc-node/register', '-e', script], {
        cwd: ROOT_DIR,
        env: { ...process.env, SWC_NODE_IGNORE_DYNAMIC: 'true', SWC_NODE_CACHE: '0' },
        timeout: 15000
      });
      throw new Error('Expected a failing exit code');
    } catch (error) {
      const result = error as { code: number, stderr: string };
      expect(result.code).toEqual(1);
      expect(result.stderr).toInclude('standalone-task-failed');
    }
  });
});
