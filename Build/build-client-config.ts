import path from 'node:path';
import fsp from 'node:fs/promises';
import process from 'node:process';
import qrcode from 'qrcode';

import { PUBLIC_DIR } from './constants/dir';
import { compareAndWriteFile } from './lib/create-file';
import { task } from './trace';

const SITE_BASE = process.env.RULEMESH_SITE_BASE ?? 'https://codingmesh.github.io/rulemesh-site/';

function validateSiteBase(base: string) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !base.endsWith('/')) {
    throw new Error('RULEMESH_SITE_BASE must be a plain HTTPS directory URL ending in /');
  }
}

const serviceOrder = [
  'anthropic', 'openai', 'gemini', 'copilot', 'xai', 'perplexity',
  'apple-intelligence', 'ai-other', 'telegram', 'discord', 'whatsapp',
  'twitter', 'instagram', 'facebook', 'reddit', 'youtube', 'netflix',
  'disney', 'hbo', 'primevideo', 'twitch', 'tiktok', 'spotify',
  'bilibili-intl', 'bilibili', 'apple-cn', 'icloud', 'apple-music',
  'apple-tv', 'google-fcm', 'onedrive', 'npm', 'python', 'docker',
  'github', 'gitlab', 'jetbrains', 'developer', 'steam-cn',
  'game-downloads', 'steam', 'epic-games', 'playstation', 'xbox',
  'nintendo'
];

const platformOrder = [
  'downloads', 'apple', 'google', 'microsoft', 'aws', 'digitalocean',
  'cloudflare', 'games'
];

const genericOrder = ['cdn-cn', 'cdn-global', 'china', 'global'];

const groups: Array<{ id: string, categories: string[], defaultPolicy: 'PROXY' | 'DIRECT' | 'REJECT' }> = [
  { id: 'anthropic', categories: ['anthropic'], defaultPolicy: 'PROXY' },
  { id: 'openai', categories: ['openai'], defaultPolicy: 'PROXY' },
  { id: 'gemini', categories: ['gemini'], defaultPolicy: 'PROXY' },
  { id: 'ai-other', categories: ['xai', 'perplexity', 'apple-intelligence', 'ai-other', 'ai'], defaultPolicy: 'PROXY' },
  { id: 'telegram', categories: ['telegram', 'telegram_asn', 'teleproto'], defaultPolicy: 'PROXY' },
  { id: 'social', categories: ['discord', 'whatsapp', 'twitter', 'instagram', 'facebook', 'reddit'], defaultPolicy: 'PROXY' },
  { id: 'youtube', categories: ['youtube'], defaultPolicy: 'PROXY' },
  { id: 'netflix', categories: ['netflix'], defaultPolicy: 'PROXY' },
  { id: 'streaming', categories: ['disney', 'hbo', 'primevideo', 'twitch', 'tiktok', 'spotify', 'bilibili-intl', 'stream', 'stream_us', 'stream_eu', 'stream_hk', 'stream_tw', 'stream_jp', 'stream_kr'], defaultPolicy: 'PROXY' },
  { id: 'developer', categories: ['copilot', 'npm', 'python', 'docker', 'github', 'gitlab', 'jetbrains', 'developer'], defaultPolicy: 'PROXY' },
  { id: 'apple', categories: ['icloud', 'icloud_private_relay', 'apple-music', 'apple-tv', 'apple', 'apple_cdn', 'apple_services'], defaultPolicy: 'DIRECT' },
  { id: 'google', categories: ['google-fcm', 'google'], defaultPolicy: 'PROXY' },
  { id: 'microsoft', categories: ['onedrive', 'microsoft'], defaultPolicy: 'DIRECT' },
  { id: 'games', categories: ['steam', 'epic-games', 'playstation', 'xbox', 'nintendo', 'games'], defaultPolicy: 'PROXY' },
  { id: 'downloads', categories: ['game-download', 'game-downloads', 'downloads', 'download', 'cdn-global', 'cdn', 'aws', 'cloudflare', 'digitalocean'], defaultPolicy: 'PROXY' },
  { id: 'china', categories: ['china', 'cdn-cn', 'apple-cn', 'apple_cn', 'steam-cn', 'bilibili', 'domestic', 'domestic_cdn', 'neteasemusic', 'sogouinput'], defaultPolicy: 'DIRECT' },
  { id: 'private', categories: ['private', 'private.resolve', 'lan'], defaultPolicy: 'DIRECT' },
  { id: 'advertising', categories: ['advertising', 'reject', 'reject_extra', 'reject_phishing', 'reject-drop', 'reject-no-drop', 'reject-url-regex'], defaultPolicy: 'REJECT' },
  { id: 'fallback', categories: ['global'], defaultPolicy: 'PROXY' }
];

const categoryPolicy = new Map<string, string>();
for (let groupIndex = 0, len = groups.length; groupIndex < len; groupIndex++) {
  const group = groups[groupIndex];
  for (let categoryIndex = 0, len = group.categories.length; categoryIndex < len; categoryIndex++) {
    categoryPolicy.set(group.categories[categoryIndex], group.id);
  }
}

async function outputIds(type: 'domainset' | 'non_ip' | 'ip') {
  const directory = path.join(PUBLIC_DIR, 'Shadowrocket', type);
  const entries = await fsp.readdir(directory);
  const ids = new Set<string>();
  for (let i = 0, len = entries.length; i < len; i++) {
    const name = entries[i];
    if (name.endsWith('.conf')) ids.add(name.slice(0, -5));
  }
  return ids;
}

function orderedCategories(available: Set<string>, includeAdvertising: boolean) {
  const preferred = ['lan', 'private', ...serviceOrder, ...platformOrder, ...genericOrder];
  const excluded = (id: string) => id.startsWith('my_') || id === 'direct' || (!includeAdvertising && categoryPolicy.get(id) === 'advertising');
  const selected: string[] = [];
  for (let i = 0, len = preferred.length; i < len; i++) {
    const id = preferred[i];
    if (available.has(id) && !excluded(id)) selected.push(id);
  }
  const remaining = [...available].sort();
  for (let i = 0, len = remaining.length; i < len; i++) {
    const id = remaining[i];
    if (!selected.includes(id) && !excluded(id)) selected.push(id);
  }
  return selected;
}

function policyFor(category: string) {
  return categoryPolicy.get(category) ?? 'node-selection';
}

async function shadowrocketConfig(includeAdvertising: boolean) {
  const byType = {
    domainset: await outputIds('domainset'),
    non_ip: await outputIds('non_ip'),
    ip: await outputIds('ip')
  };
  const all = new Set([...byType.domainset, ...byType.non_ip, ...byType.ip]);
  const ordered = orderedCategories(all, includeAdvertising);
  const name = includeAdvertising ? 'advertising' : 'standard';
  const configUrl = `${SITE_BASE}Config/Shadowrocket/${name}.conf`;
  const policyGroups: string[] = [];
  for (let i = 0, len = groups.length; i < len; i++) {
    const group = groups[i];
    if (!includeAdvertising && group.id === 'advertising') continue;
    let choices = 'node-selection,PROXY,DIRECT';
    if (group.defaultPolicy === 'DIRECT') choices = 'DIRECT,node-selection,PROXY';
    if (group.defaultPolicy === 'REJECT') choices = 'REJECT,node-selection,PROXY,DIRECT';
    policyGroups.push(`${group.id} = select,${choices}`);
  }
  const rules: string[] = [];
  const types = ['domainset', 'non_ip', 'ip'] as const;
  for (let typeIndex = 0, len = types.length; typeIndex < len; typeIndex++) {
    const type = types[typeIndex];
    for (let idIndex = 0, len = ordered.length; idIndex < len; idIndex++) {
      const id = ordered[idIndex];
      if (byType[type].has(id)) {
        rules.push(`RULE-SET,${SITE_BASE}Shadowrocket/${type}/${id}.conf,${policyFor(id)}`);
      }
    }
  }
  if (all.has('china') || all.has('domestic')) rules.push('GEOIP,CN,china');
  rules.push('FINAL,fallback');
  const declaredPolicies = new Set(['DIRECT', 'PROXY', 'REJECT', 'node-selection']);
  for (let i = 0, len = groups.length; i < len; i++) {
    const group = groups[i];
    if (includeAdvertising || group.id !== 'advertising') declaredPolicies.add(group.id);
  }
  for (let i = 0, len = rules.length; i < len; i++) {
    const policy = rules[i].slice(rules[i].lastIndexOf(',') + 1);
    if (!declaredPolicies.has(policy)) throw new Error(`Undeclared Shadowrocket policy: ${policy}`);
  }
  const lines = [
    '# RuleMesh complete Shadowrocket configuration',
    '# Rules are built by the inherited SukkaW/Surge pipeline; nodes remain in the client.',
    '',
    '[General]',
    `update-url = ${configUrl}`,
    'dns-server = https://cloudflare-dns.com/dns-query#proxy',
    'dns-direct-system = true',
    'dns-fallback-system = false',
    'private-ip-answer = true',
    'ipv6 = false',
    'prefer-ipv6 = false',
    'udp-policy-not-supported-behaviour = REJECT',
    '',
    '[Proxy]',
    '# Nodes remain in Home subscriptions; no credentials are embedded.',
    '',
    '[Proxy Group]',
    'node-selection = select,policy-regex-filter=.*',
    ...policyGroups,
    '',
    '[Rule]',
    ...rules,
    '',
    '[Host]',
    'localhost = 127.0.0.1',
    '*.local = server:system',
    '*.in-addr.arpa = server:system',
    '*.ip6.arpa = server:system'
  ];
  return { name, configUrl, lines };
}

export const buildClientConfig = task(require.main === module, __filename)(async (span) => {
  validateSiteBase(SITE_BASE);
  const results = await Promise.all([shadowrocketConfig(false), shadowrocketConfig(true)]);
  const writes: Array<Promise<void>> = [];
  for (let i = 0, len = results.length; i < len; i++) {
    const result = results[i];
    writes.push((async () => {
      const directory = path.join(PUBLIC_DIR, 'Config', 'Shadowrocket');
      await compareAndWriteFile(span, result.lines, path.join(directory, `${result.name}.conf`));
      const importUrl = `shadowrocket://config/add/${result.configUrl}`;
      const svg = await qrcode.toString(importUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 });
      await compareAndWriteFile(span, svg.trim().split('\n'), path.join(directory, `${result.name}.svg`));
    })());
  }
  await Promise.all(writes);
  await compareAndWriteFile(span, [
    '# RuleMesh client configurations',
    '',
    'These generated configurations are intentionally excluded from the root ruleset directory.',
    '',
    '- Shadowrocket standard: `Shadowrocket/standard.conf`',
    '- Shadowrocket with advertising rejection: `Shadowrocket/advertising.conf`'
  ], path.join(PUBLIC_DIR, 'Config', 'README.md'));
});
