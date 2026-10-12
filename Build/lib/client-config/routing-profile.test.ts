import { describe, it } from 'mocha';
import { expect } from 'earl';

import { groupChoices, orderedCategories, policyFor, policyGroups } from './routing-profile';

describe('client routing profile', () => {
  it('keeps blocking and specific services ahead of broad catch-all rules', () => {
    const available = new Set(['global', 'advertising', 'private', 'anthropic']);

    expect(orderedCategories(available, false)).toEqual(['private', 'anthropic', 'global']);
    expect(orderedCategories(available, true)).toEqual(['advertising', 'private', 'anthropic', 'global']);
  });

  it('lets service selectors inherit a family selector while remaining overridable', () => {
    const anthropic = policyGroups.find(group => group.id === 'anthropic')!;

    expect(policyFor('anthropic')).toEqual('anthropic');
    expect(groupChoices(anthropic, 'RuleMesh-Nodes', 'DIRECT', 'REJECT', 'RuleMesh-')).toEqual([
      'RuleMesh-ai', 'RuleMesh-Nodes', 'DIRECT'
    ]);
  });
});
