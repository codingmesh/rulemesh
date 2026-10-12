import { describe, it } from 'mocha';
import { expect } from 'earl';
import { assertSingboxRouting } from './acceptance';
import type { RuleReference } from './lib/client-config/configuration';
import type { ResolutionMode } from './lib/rules/capabilities';
import { SITE_BASE } from './lib/client-config/clients';

describe('delivered sing-box routing contract', () => {
  it('rejects reordered, misrouted and prematurely resolved delivery rules', () => {
    const references: RuleReference[] = [
      { id: 'advertising', partition: 'domainset', policy: 'advertising', path: 'sing-box/domainset/advertising.json', tag: 'ads' },
      { id: 'anthropic', partition: 'non_ip', policy: 'anthropic', path: 'sing-box/non_ip/anthropic.json', tag: 'ai' },
      { id: 'lan', partition: 'ip', policy: 'private', path: 'sing-box/ip/lan.json', tag: 'lan' },
      { id: 'domestic', partition: 'ip', policy: 'china', path: 'sing-box/ip/domestic.json', tag: 'china' }
    ];
    const modes = new Map<string, ResolutionMode>([['lan', 'existing-only'], ['china', 'resolve']]);
    const fixture = {
      outbounds: ['anthropic', 'private', 'china', 'fallback', 'Nodes'].map(name => ({ tag: `RuleMesh-${name}` })),
      route: {
        final: 'RuleMesh-fallback',
        rule_set: references.map(reference => ({ type: 'remote', tag: reference.tag, format: 'source', url: SITE_BASE + reference.path, update_interval: '1d', download_detour: 'RuleMesh-Nodes' })),
        rules: [
          { rule_set: ['ads'], action: 'reject' },
          { rule_set: ['ai'], action: 'route', outbound: 'RuleMesh-anthropic' },
          { rule_set: ['lan'], action: 'route', outbound: 'RuleMesh-private' },
          { action: 'resolve' },
          { rule_set: ['china'], action: 'route', outbound: 'RuleMesh-china' }
        ]
      }
    };
    assertSingboxRouting(fixture, references, modes);
    const mutations = [
      (copy: typeof fixture) => copy.route.rules.reverse(),
      (copy: typeof fixture) => { copy.route.rules[1].outbound = 'RuleMesh-fallback'; },
      (copy: typeof fixture) => { const existing = copy.route.rules[2]; copy.route.rules[2] = copy.route.rules[3]; copy.route.rules[3] = existing; },
      (copy: typeof fixture) => { copy.route.rules[0] = { action: 'resolve' }; },
      (copy: typeof fixture) => { copy.route.rule_set[0].download_detour = 'invalid'; },
      (copy: typeof fixture) => { copy.outbounds.pop(); }
    ];
    for (let i = 0, len = mutations.length; i < len; i++) {
      const copy = structuredClone(fixture);
      mutations[i](copy);
      expect(() => assertSingboxRouting(copy, references, modes)).toThrow();
    }
  });
});
