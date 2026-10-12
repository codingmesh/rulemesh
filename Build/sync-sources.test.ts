import { describe, it } from 'mocha';
import { expect } from 'earl';

import { applyOverrides, validateOverrides } from './lib/source-catalog';

const evidence = { reason: 'verified correction', evidence: 'https://example.com/evidence', checkedAt: '2026-10-12' };

describe('source overrides', () => {
  it('rejects a misspelled category before applying any source changes', () => {
    expect(() => validateOverrides({ schemaVersion: 2, add: [{ category: 'anthropci', value: '.claude.app', ...evidence }], remove: [] }, new Set(['anthropic']))).toThrow(Error, 'Unknown override category: anthropci');
  });
  it('applies reviewed additions and removals without changing other categories', () => {
    const entries = new Set(['keep.example', 'remove.example']);
    applyOverrides('example', entries, {
      schemaVersion: 2,
      add: [{ category: 'example', value: 'add.example', ...evidence }, { category: 'other', value: 'ignore.example', ...evidence }],
      remove: [{ category: 'example', value: 'remove.example', ...evidence }]
    });

    expect([...entries].sort()).toEqual(['add.example', 'keep.example']);
  });

  it('rejects contradictory overrides', () => {
    const override = { category: 'example', value: 'same.example', ...evidence };
    expect(() => applyOverrides('example', new Set(), { schemaVersion: 2, add: [override], remove: [override] })).toThrow(Error, 'Source override both adds and removes example:same.example');
  });
});
