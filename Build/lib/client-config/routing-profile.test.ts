import { describe, it } from 'mocha';
import { expect } from 'earl';

import { groupChoices, orderedCategories, policyFor, policyGroups, unmappedCategories } from './routing-profile';

describe('client routing profile', () => {
  it('keeps blocking and specific services ahead of broad catch-all rules', () => {
    const available = new Set(['global', 'advertising', 'private', 'anthropic']);

    expect(orderedCategories(available, false)).toEqual(['private', 'anthropic', 'global']);
    expect(orderedCategories(available, true)).toEqual(['advertising', 'private', 'anthropic', 'global']);

    // These overlaps cross service, platform and domestic boundaries. Checking
    // independent priority pairs avoids mirroring the renderer's own order.
    const priorityPairs = [
      ['anthropic', 'ai-other'], ['openai', 'ai-other'], ['gemini', 'google'],
      ['copilot', 'github'], ['copilot', 'microsoft'], ['apple-intelligence', 'apple'],
      ['youtube', 'google'], ['netflix', 'stream'], ['apple-cn', 'apple'], ['apple_cn', 'apple'],
      ['steam-cn', 'steam'], ['game-download', 'steam'], ['game-downloads', 'games'], ['github', 'cloudflare'],
      ['direct', 'downloads'], ['private', 'global'], ['china', 'global']
    ];
    const order = orderedCategories(new Set(priorityPairs.flat()), false);
    for (let i = 0, len = priorityPairs.length; i < len; i++) {
      const [specific, broad] = priorityPairs[i];
      expect(order.indexOf(specific) < order.indexOf(broad)).toEqual(true);
    }
  });

  it('lets service selectors inherit a family selector while remaining overridable', () => {
    const anthropic = policyGroups.find(group => group.id === 'anthropic')!;

    expect(policyFor('anthropic')).toEqual('anthropic');
    expect(groupChoices(anthropic, 'RuleMesh-Nodes', 'DIRECT', 'REJECT', 'RuleMesh-')).toEqual([
      'RuleMesh-ai', 'RuleMesh-Nodes', 'DIRECT'
    ]);
  });

  it('requires every published category to have an explicit policy or standalone role', () => {
    expect(unmappedCategories(new Set(['anthropic', 'clash_fake_ip_filter', 'forgotten']))).toEqual(['forgotten']);
  });
});
