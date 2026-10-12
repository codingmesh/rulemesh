import { describe, it } from 'mocha';
import { expect } from 'earl';
import { createServer } from 'node:http';
import { fetchAssets } from './fetch-assets';
import { closeFetchAgent } from './fetch-retry';
import { ignoreAdGuardUnsupportedLine } from './parse-filter/filters';
import { FileOutput } from './rules/base';
import { SurgeRuleSet } from './writing-strategy/surge';
import { ShadowrocketRuleSet } from './writing-strategy/shadowrocket';
import { ClashClassicRuleSet } from './writing-strategy/clash';
import { SingboxSource } from './writing-strategy/singbox';
import { createSpan } from '../trace';

describe('source preprocessing through the download interface', () => {
  it('keeps plain and AdGuard inputs intact and accepts a new source format without changing writers', async () => {
    const bodies: Record<string, string> = {
      '/plain': '# comment\n  plain.example.com \n',
      '/adguard': '! comment\nexample.com##.banner\n||ads.example.com^\n',
      '/records': 'host=api.example.org\nsuffix=example.net\nignored=data\n'
    };
    const server = createServer((request, response) => response.end(bodies[request.url!]));
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
      const base = `http://127.0.0.1:${address.port}`;
      expect(await fetchAssets(base + '/plain', null, true)).toEqual(['plain.example.com']);
      expect(await fetchAssets(base + '/adguard', null, true, false, ignoreAdGuardUnsupportedLine)).toEqual(['||ads.example.com^']);
      const sourceAdapter = (line: string) => {
        if (line.startsWith('host=')) return 'DOMAIN,' + line.slice(5);
        if (line.startsWith('suffix=')) return 'DOMAIN-SUFFIX,' + line.slice(7);
        return null;
      };
      const lines = await fetchAssets(base + '/records', null, true, false, sourceAdapter);
      const result = await new FileOutput(createSpan('new source adapter'), 'fixture')
        .withStrategies([new SurgeRuleSet('non_ip'), new ShadowrocketRuleSet('non_ip'), new ClashClassicRuleSet('non_ip'), new SingboxSource('non_ip')])
        .addFromRuleset(lines)
        .compile();
      for (let i = 0; i < 3; i++) {
        expect(result[i]!).toInclude('DOMAIN,api.example.org');
        expect(result[i]!).toInclude('DOMAIN-SUFFIX,example.net');
      }
      const singbox = JSON.parse(result[3]!.join('\n'));
      expect(singbox.rules[0].domain).toInclude('api.example.org');
      expect(singbox.rules[0].domain_suffix).toInclude('example.net');
      await expect(fetchAssets(base + '/records', null, true, false, () => null)).toBeRejected();
    } finally {
      await closeFetchAgent();
      await new Promise<void>((resolve, reject) => { server.close(error => (error ? reject(error) : resolve())); });
    }
  });
});
