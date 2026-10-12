import { describe, it } from 'mocha';
import { expect } from 'earl';
import { readRuleSource } from './read-rule-source';

describe('rule source reading', () => {
  it('preserves source locations through metadata and comments', async () => {
    expect(await readRuleSource('example.conf', [
      '# $ meta_title Example',
      '# $ meta_description Description',
      '# comment',
      '',
      'DOMAIN,api.example.com',
      '# $ sgmodule_mitm_hostnames example-module'
    ])).toEqual({
      title: 'Example',
      descriptions: ['Description'],
      lines: ['DOMAIN,api.example.com'],
      lineNumbers: [5],
      mitmModule: 'example-module'
    });
    expect(await readRuleSource('custom.conf', ['# $ custom_build_script'])).toEqual(null);
  });

  it('rejects a read failure after valid input, preserving its cause', async () => {
    const failure = new Error('stream failed');
    function *interruptedSource() {
      yield 'DOMAIN,partial.example';
      throw failure;
    }
    try {
      await readRuleSource('broken.conf', interruptedSource());
      throw new Error('Expected the read to fail');
    } catch (error) {
      expect(Error.isError(error)).toEqual(true);
      expect((error as Error).message).toEqual('Failed to read rule source broken.conf after line 1');
      expect((error as Error).cause).toEqual(failure);
    }
  });
});
