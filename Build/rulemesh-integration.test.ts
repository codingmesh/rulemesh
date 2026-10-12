import { describe, it } from 'mocha';
import { expect } from 'earl';

import { treeHtml } from './build-public';
import { TreeFileType } from './lib/tree-dir';
import { ShadowrocketRuleSet } from './lib/writing-strategy/shadowrocket';

describe('RuleMesh integration with the inherited build', () => {
  it('keeps configuration output out of the root rules directory', () => {
    const html = treeHtml([
      { type: TreeFileType.DIRECTORY, name: 'Config', path: '/Config', children: [] },
      { type: TreeFileType.DIRECTORY, name: 'Shadowrocket', path: '/Shadowrocket', children: [] }
    ]);

    expect(html).not.toInclude('Config');
    expect(html).toInclude('Shadowrocket');
  });

  it('serializes domain sets as explicit Shadowrocket rules', () => {
    const writer = new ShadowrocketRuleSet('domainset');
    writer.writeDomain('api.example.com');
    writer.writeDomainSuffix('example.net');

    const content = writer.content ?? [];
    expect(content).toInclude('DOMAIN,api.example.com');
    expect(content).toInclude('DOMAIN-SUFFIX,example.net');
  });
});
