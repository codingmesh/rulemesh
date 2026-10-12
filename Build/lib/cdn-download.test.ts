import { describe, it } from 'mocha';
import { expect } from 'earl';
import { parseIpfsGateways } from './cdn-download';

describe('required IPFS gateway source', () => {
  it('preserves valid gateway hosts and rejects malformed or partial input', () => {
    expect(parseIpfsGateways(['https://ipfs.example.com/ipfs/:hash', 'http://gateway.example.com'])).toEqual(['ipfs.example.com', 'gateway.example.com']);
    const invalid: unknown[] = [{ invalid: 'not an array' }, [], ['https://valid.example', null], ['not a URL'], ['']];
    for (let i = 0, len = invalid.length; i < len; i++) {
      expect(() => parseIpfsGateways(invalid[i])).toThrow(TypeError);
    }
  });
});
