import { describe, it } from 'mocha';
import { expect } from 'earl';
import { composeClientConfiguration, sampleBase, shadowrocketConfiguration } from './configuration';
import { clientFor, configPath, importUrl } from './clients';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { parse } from 'yaml';

describe('client configuration composition', () => {
  it('uses one client definition for paths and import schemes and rejects unknown clients', () => {
    const client = clientFor('mihomo');
    expect(configPath(client, 'standard')).toEqual('Config/mihomo/standard.yaml');
    expect(importUrl(client, 'https://example.com/profile.yaml')).toEqual('clash://install-config?url=https%3A%2F%2Fexample.com%2Fprofile.yaml');
    expect(() => clientFor('unknown')).toThrow(Error, 'Unknown client: unknown');
    expect(() => sampleBase('unknown' as 'surge')).toThrow(Error, 'Unknown client: unknown');
  });

  it('rejects recomposition and policy collisions while preserving a remote-only Surge node group', async () => {
    const root = await fsp.mkdtemp(path.join(tmpdir(), 'rulemesh-config-'));
    try {
      await Promise.all(['List', 'Clash', 'sing-box', 'Shadowrocket'].flatMap(directory => ['domainset', 'non_ip', 'ip'].map(partition => fsp.mkdir(path.join(root, directory, partition), { recursive: true }))));
      const shadowrocket = await shadowrocketConfiguration(false, undefined, root);
      expect(shadowrocket).toInclude('node-selection = select,PROXY,use=true,policy-regex-filter=.*');
      expect(shadowrocket).toInclude('anthropic = select,ai,node-selection,DIRECT,PROXY,use=true,policy-regex-filter=.*');
      expect(shadowrocket).toInclude('china = select,DIRECT,node-selection,PROXY,use=true,policy-regex-filter=.*');
      const targets = ['surge', 'mihomo', 'singbox'] as const;
      for (let i = 0, len = targets.length; i < len; i++) {
        const target = targets[i];
        // eslint-disable-next-line no-await-in-loop -- exercise each native renderer's published node-base contract
        const rendered = await composeClientConfiguration(target, sampleBase(target), false, undefined, root);
        if (target === 'surge') expect(rendered).toInclude('[Rule]');
        else if (target === 'mihomo') expect(parse(rendered).rules).toInclude('MATCH,RuleMesh-fallback');
        else expect(JSON.parse(rendered).route.final).toEqual('RuleMesh-fallback');
      }
      await expect(composeClientConfiguration('unknown' as 'surge', '', false, undefined, root)).toBeRejectedWith(Error, 'Unknown client: unknown');
      const surge = await composeClientConfiguration('surge', '[Proxy Group]\nExisting = select,policy-path=https://example.com/nodes\n', false, undefined, root);
      expect(surge).toInclude('RuleMesh-Nodes = select,include-all-proxies=true,include-other-group=Existing');
      expect(surge).toInclude('RuleMesh-anthropic = select,RuleMesh-ai,RuleMesh-Nodes,DIRECT,include-all-proxies=true,include-other-group=Existing');
      await expect(composeClientConfiguration('surge', surge, false, undefined, root)).toBeRejectedWith(Error, 'Reserved RuleMesh policy name: RuleMesh-Nodes');
      const input = 'proxies:\n  - { name: node, type: http, server: 127.0.0.1, port: 8080 }\n';
      const composed = await composeClientConfiguration('mihomo', input, false, undefined, root);
      expect(parse(composed)['proxy-groups'].find((group: { name: string }) => group.name === 'RuleMesh-anthropic').proxies).toEqual(['RuleMesh-ai', 'RuleMesh-Nodes', 'DIRECT', 'node']);
      const providerBase = 'proxy-providers:\n  subscription: { type: file, path: ./nodes.yaml }\n';
      const providerConfig = parse(await composeClientConfiguration('mihomo', providerBase, false, undefined, root));
      expect(providerConfig['proxy-groups'].find((group: { name: string }) => group.name === 'RuleMesh-anthropic').use).toEqual(['subscription']);
      const singboxBase = JSON.stringify({ outbounds: [{ tag: 'node-a', type: 'http' }, { tag: 'node-b', type: 'http' }], experimental: { cache_file: { enabled: true, path: 'custom-cache.db', cache_id: 'custom' } } });
      const singboxConfig = JSON.parse(await composeClientConfiguration('singbox', singboxBase, false, undefined, root));
      expect(singboxConfig.outbounds.find((outbound: { tag: string }) => outbound.tag === 'RuleMesh-anthropic').outbounds).toEqual(['RuleMesh-ai', 'RuleMesh-Nodes', 'RuleMesh-Direct', 'node-a', 'node-b']);
      expect(singboxConfig.experimental.cache_file).toEqual({ enabled: true, path: 'custom-cache.db', cache_id: 'custom' });
      expect(await composeClientConfiguration('mihomo', input, false, undefined, root)).toEqual(composed);
      await expect(composeClientConfiguration('mihomo', composed, false, undefined, root)).toBeRejectedWith(Error, 'Reserved RuleMesh proxy or group name: RuleMesh-Nodes');
      const duplicate = JSON.stringify({ outbounds: [{ tag: 'node', type: 'http' }, { tag: 'node', type: 'http' }] });
      await expect(composeClientConfiguration('singbox', duplicate, false, undefined, root)).toBeRejectedWith(Error, 'Duplicate outbound tag: node');
    } finally {
      await fsp.rm(root, { recursive: true, force: true });
    }
  });
});
