import { describe, it } from 'mocha';
import { expect } from 'earl';

import { treeHtml } from './build-public';
import { TreeFileType } from './lib/tree-dir';
import { ShadowrocketRuleSet } from './lib/writing-strategy/shadowrocket';
import { domainWildcardToRegex, SingboxSource } from './lib/writing-strategy/singbox';
import { assertNodeOnlySingboxRoute } from './lib/client-config/configuration';

describe('RuleMesh integration with the inherited build', () => {
  it('keeps configuration output out of the root rules directory', () => {
    const html = treeHtml([
      { type: TreeFileType.DIRECTORY, name: 'Config', path: '/Config', children: [] },
      {
        type: TreeFileType.DIRECTORY,
        name: 'Shadowrocket',
        path: '/Shadowrocket',
        children: [
          { type: TreeFileType.FILE, name: 'anthropic.conf', path: '/Shadowrocket/anthropic.conf' }
        ]
      }
    ]);

    expect(html).not.toInclude('Config');
    expect(html).toInclude('Shadowrocket');
    expect(html).toInclude('href="Shadowrocket/anthropic.conf"');
    expect(html).not.toInclude('href="/Shadowrocket');
  });

  it('serializes domain sets as explicit Shadowrocket rules', () => {
    const writer = new ShadowrocketRuleSet('domainset');
    writer.writeDomain('api.example.com');
    writer.writeDomainSuffix('example.net');

    const content = writer.content ?? [];
    expect(content).toInclude('DOMAIN,api.example.com');
    expect(content).toInclude('DOMAIN-SUFFIX,example.net');
  });

  it('preserves domain wildcard semantics in sing-box regex rules', () => {
    expect(domainWildcardToRegex('qhimgs?.example.*')).toEqual(String.raw`^qhimgs.\.example\..*$`);
  });

  it('rejects sing-box node bases that can shadow RuleMesh routing', () => {
    expect(() => assertNodeOnlySingboxRoute({ rules: [{ action: 'route', outbound: 'other' }] })).toThrow(Error, 'sing-box node base must not contain route.rules; RuleMesh owns complete routing order');
  });

  it('does not turn process-name globs into ineffective exact sing-box names', () => {
    const writer = new SingboxSource('non_ip'); writer.writeProcessNames(new Set(['curl', 'qbittorrent*']));
    const document = JSON.parse((writer.content ?? []).join('\n')) as { rules: Array<{ process_name?: string[] }> };
    expect(document.rules.find(rule => rule.process_name)?.process_name).toEqual(['curl']);
  });
});
