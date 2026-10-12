export type ConfigTarget = 'shadowrocket' | 'surge' | 'mihomo' | 'singbox';
export type Partition = 'domainset' | 'non_ip' | 'ip';
type DefaultPolicy = 'PROXY' | 'DIRECT' | 'REJECT';

export interface PolicyGroup {
  id: string,
  categories: string[],
  defaultPolicy: DefaultPolicy,
  parent?: string
}

export const partitions: Partition[] = ['domainset', 'non_ip', 'ip'];

const serviceOrder = [
  'anthropic', 'openai', 'gemini', 'copilot', 'xai', 'perplexity', 'apple-intelligence', 'ai-other', 'ai',
  'telegram', 'discord', 'whatsapp', 'twitter', 'instagram', 'facebook', 'reddit', 'youtube', 'netflix',
  'disney', 'hbo', 'primevideo', 'twitch', 'tiktok', 'spotify', 'bilibili-intl', 'bilibili', 'apple-cn',
  'icloud', 'apple-music', 'apple-tv', 'google-fcm', 'onedrive', 'npm', 'python', 'docker', 'github',
  'gitlab', 'jetbrains', 'developer', 'steam-cn', 'game-downloads', 'steam', 'epic-games', 'playstation',
  'xbox', 'nintendo'
];
const platformOrder = ['downloads', 'apple', 'google', 'microsoft', 'aws', 'digitalocean', 'cloudflare', 'games', 'download', 'cdn', 'speedtest', 'cloudmounter'];
const domesticOrder = ['china', 'cdn-cn', 'domestic', 'domestic_cdn', 'neteasemusic', 'sogouinput'];
const privateOrder = ['lan', 'private', 'private.resolve'];
const advertisingOrder = ['advertising', 'reject', 'reject_extra', 'reject_phishing', 'reject-drop', 'reject-no-drop', 'reject-url-regex', 'reject_sukka'];
const genericOrder = ['cdn-global', 'global', 'global_plus'];

// The hierarchy is inspired by the researched client configurations: a root
// node selector, a small set of family selectors, and optional service
// overrides. A service inherits its family choice until the user overrides it.
export const policyGroups: PolicyGroup[] = [
  { id: 'ai', categories: [], defaultPolicy: 'PROXY' },
  { id: 'anthropic', categories: ['anthropic'], defaultPolicy: 'PROXY', parent: 'ai' },
  { id: 'openai', categories: ['openai'], defaultPolicy: 'PROXY', parent: 'ai' },
  { id: 'gemini', categories: ['gemini'], defaultPolicy: 'PROXY', parent: 'ai' },
  { id: 'ai-other', categories: ['copilot', 'xai', 'perplexity', 'apple-intelligence', 'ai-other', 'ai'], defaultPolicy: 'PROXY', parent: 'ai' },
  { id: 'social', categories: ['discord', 'whatsapp', 'twitter', 'instagram', 'facebook', 'reddit'], defaultPolicy: 'PROXY' },
  { id: 'telegram', categories: ['telegram', 'telegram_asn', 'teleproto'], defaultPolicy: 'PROXY', parent: 'social' },
  { id: 'streaming', categories: ['disney', 'hbo', 'primevideo', 'twitch', 'tiktok', 'spotify', 'bilibili-intl', 'stream', 'stream_us', 'stream_eu', 'stream_hk', 'stream_tw', 'stream_jp', 'stream_kr'], defaultPolicy: 'PROXY' },
  { id: 'youtube', categories: ['youtube'], defaultPolicy: 'PROXY', parent: 'streaming' },
  { id: 'netflix', categories: ['netflix'], defaultPolicy: 'PROXY', parent: 'streaming' },
  { id: 'developer', categories: ['npm', 'python', 'docker', 'github', 'gitlab', 'jetbrains', 'developer'], defaultPolicy: 'PROXY' },
  { id: 'apple', categories: ['icloud', 'icloud_private_relay', 'apple-music', 'apple-tv', 'apple', 'apple_cdn', 'apple_services'], defaultPolicy: 'DIRECT' },
  { id: 'google', categories: ['google-fcm', 'google'], defaultPolicy: 'PROXY' },
  { id: 'microsoft', categories: ['onedrive', 'microsoft'], defaultPolicy: 'DIRECT' },
  { id: 'games', categories: ['steam', 'epic-games', 'playstation', 'xbox', 'nintendo', 'games'], defaultPolicy: 'PROXY' },
  { id: 'downloads', categories: ['game-download', 'game-downloads', 'downloads', 'download', 'cdn-global', 'cdn', 'aws', 'cloudflare', 'digitalocean', 'speedtest', 'cloudmounter'], defaultPolicy: 'PROXY' },
  { id: 'china', categories: ['china', 'cdn-cn', 'apple-cn', 'apple_cn', 'steam-cn', 'bilibili', 'domestic', 'domestic_cdn', 'neteasemusic', 'sogouinput'], defaultPolicy: 'DIRECT' },
  { id: 'private', categories: ['private', 'private.resolve', 'lan'], defaultPolicy: 'DIRECT' },
  { id: 'advertising', categories: advertisingOrder, defaultPolicy: 'REJECT' },
  { id: 'fallback', categories: ['global', 'global_plus'], defaultPolicy: 'PROXY' }
];

const categoryPolicy = new Map<string, string>();
for (let groupIndex = 0, groupLength = policyGroups.length; groupIndex < groupLength; groupIndex++) {
  const group = policyGroups[groupIndex];
  for (let categoryIndex = 0, categoryLength = group.categories.length; categoryIndex < categoryLength; categoryIndex++) {
    const category = group.categories[categoryIndex];
    const previous = categoryPolicy.get(category);
    if (previous) throw new Error(`Routing category ${category} belongs to both ${previous} and ${group.id}`);
    categoryPolicy.set(category, group.id);
  }
}

export function policyFor(category: string) { return categoryPolicy.get(category); }

export function orderedCategories(available: Set<string>, includeAdvertising: boolean) {
  const selected: string[] = [];
  const append = (ids: string[]) => {
    for (let i = 0, len = ids.length; i < len; i++) {
      const id = ids[i];
      if (available.has(id) && categoryPolicy.has(id) && !selected.includes(id)) selected.push(id);
    }
  };
  if (includeAdvertising) append(advertisingOrder);
  append(privateOrder);
  append(serviceOrder);
  append(platformOrder);
  append(domesticOrder);

  // Keep newly introduced, explicitly mapped categories before broad catch-all
  // sets. Unknown categories are excluded until their routing intent is chosen.
  const generic = new Set(genericOrder);
  const advertising = new Set(advertisingOrder);
  append([...available].filter(id => !generic.has(id) && (includeAdvertising || !advertising.has(id))).sort());
  append(genericOrder);
  return selected;
}

export function activePolicyGroups(includeAdvertising: boolean) {
  return policyGroups.filter(group => includeAdvertising || group.id !== 'advertising');
}

export function groupChoices(group: PolicyGroup, nodePolicy: string, directPolicy: string, rejectPolicy: string, groupPrefix = '') {
  if (group.parent) return [`${groupPrefix}${group.parent}`, nodePolicy, directPolicy];
  if (group.defaultPolicy === 'DIRECT') return [directPolicy, nodePolicy];
  if (group.defaultPolicy === 'REJECT') return [rejectPolicy, directPolicy];
  return [nodePolicy, directPolicy];
}
