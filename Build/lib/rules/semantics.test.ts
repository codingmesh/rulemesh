import { describe, it } from 'mocha';
import { expect } from 'earl';
import { createSpan } from '../../trace';
import { FileOutput } from './base';
import { SurgeRuleSet } from '../writing-strategy/surge';
import { SingboxSource } from '../writing-strategy/singbox';

// Generated with ed766d95 before changing the implementation, using these bytes.
const BASELINE_INPUT = [
  'DOMAIN,api.example.com',
  'DOMAIN-SUFFIX,example.net',
  'DOMAIN-KEYWORD,search',
  'IP-CIDR,198.51.100.0/24,no-resolve'
];
const BASELINE_SURGE = [
  'DOMAIN,ruleset.marker.rulemesh.invalid',
  'DOMAIN-SUFFIX,example.net',
  'DOMAIN,api.example.com',
  'DOMAIN-KEYWORD,search',
  'IP-CIDR,198.51.100.0/24,no-resolve'
];
const BASELINE_SINGBOX = [
  '{',
  '  "version": 2,',
  '  "rules": [',
  '    {',
  '      "domain": ["ruleset.marker.rulemesh.invalid", "api.example.com"],',
  '      "domain_suffix": ["ruleset.marker.rulemesh.invalid", "example.net"],',
  '      "domain_keyword": ["search"],',
  '      "ip_cidr": ["198.51.100.0/24"]',
  '    }',
  '  ]',
  '}'
];

describe('ruleset semantics', () => {
  it('preserves the baseline destination-only output in both native formats', async () => {
    const output = new FileOutput(createSpan('baseline'), 'baseline')
      .withStrategies([new SurgeRuleSet('non_ip'), new SingboxSource('non_ip')])
      .addFromRuleset(BASELINE_INPUT);
    expect(await output.compile()).toEqual([BASELINE_SURGE, BASELINE_SINGBOX]);
  });

  it('applies keyword exemptions to the emitted rules rather than only their count', async () => {
    const output = new FileOutput(createSpan('keyword exemptions'), 'keywords')
      .withStrategies([new SurgeRuleSet('non_ip')])
      .addDomainKeyword('blocked')
      .addDomainKeyword('keep')
      .whitelistKeyword('blocked');
    expect(await output.compile()).toEqual([[
      'DOMAIN,ruleset.marker.rulemesh.invalid',
      'DOMAIN-KEYWORD,keep'
    ]]);
  });

  it('emits independent sing-box conditions as alternative rules', () => {
    const writer = new SingboxSource('non_ip');
    writer.writeDomain('domain.example');
    writer.writeProcessNames(new Set(['curl']));
    writer.writeSourcePorts(new Set(['1234', '2000-3000']));
    writer.writeDestinationPorts(new Set(['443']));
    writer.writeProtocols(new Set(['TCP']));
    expect(JSON.parse((writer.content ?? []).join('\n'))).toEqual({
      version: 2,
      rules: [
        { domain: ['ruleset.marker.rulemesh.invalid', 'domain.example'], domain_suffix: ['ruleset.marker.rulemesh.invalid'] },
        { source_port: [1234], source_port_range: ['2000:3000'] },
        { port: [443], port_range: [] },
        { process_name: ['curl'] },
        { network: ['tcp'] }
      ]
    });
  });

  it('rejects unknown and empty rules with original source locations', async () => {
    await expect(new FileOutput(createSpan('unknown'), 'unknown')
      .withStrategies([new SurgeRuleSet('non_ip')])
      .addFromRuleset(['FUTURE-TYPE,example.com'], { file: 'source.conf', lineNumbers: [17] })
      .compile()).toBeRejectedWith(TypeError, 'Unknown rule type FUTURE-TYPE at source.conf:17');
    await expect(new FileOutput(createSpan('empty'), 'empty')
      .withStrategies([new SurgeRuleSet('non_ip')])
      .addFromRuleset(['## generated ruleset heading', 'DOMAIN,   '])
      .compile()).toBeRejectedWith(TypeError, 'Missing DOMAIN value at empty:2');
  });
});
