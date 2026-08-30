import { describe, it, expect } from 'vitest';

import { defaultIdGenerator, randomUuid } from './identity';

interface NumKey { id: number; name: string }
interface StrKey { uuid: string; name: string }

describe('defaultIdGenerator', () => {
  it('continues a numeric sequence from the highest key', () => {
    const next = defaultIdGenerator<NumKey, 'id'>('id');
    expect(next([{ id: 1, name: 'a' }, { id: 7, name: 'b' }, { id: 3, name: 'c' }])).toBe(8);
  });

  it('starts at 1 for an empty dataset', () => {
    expect(defaultIdGenerator<NumKey, 'id'>('id')([])).toBe(1);
  });

  // The regression this policy exists for: coercing a UUID to a number gave
  // NaN, `|| 0` collapsed it to 0, and every created row came back as 1.
  it('produces unique ids for non-numeric string keys instead of colliding on 1', () => {
    const next = defaultIdGenerator<StrKey, 'uuid'>('uuid');
    const seed: StrKey[] = [{ uuid: 'a3f9-1111', name: 'a' }];

    const first = next(seed);
    const second = next([...seed, { uuid: first, name: 'b' }]);

    expect(first).not.toBe(1);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('keeps digit-like string keys as incremented strings, not numbers', () => {
    const next = defaultIdGenerator<StrKey, 'uuid'>('uuid');
    const result = next([{ uuid: '9', name: 'a' }, { uuid: '10', name: 'b' }]);
    expect(result).toBe('11');
    expect(typeof result).toBe('string');
  });

  it('ignores null and undefined keys when deriving the next value', () => {
    const next = defaultIdGenerator<NumKey, 'id'>('id');
    const records = [{ id: 4, name: 'a' }, { id: undefined as unknown as number, name: 'b' }];
    expect(next(records)).toBe(5);
  });

  it('refuses to guess when key types are mixed', () => {
    const next = defaultIdGenerator<NumKey, 'id'>('id');
    const mixed = [{ id: 1, name: 'a' }, { id: 'x' as unknown as number, name: 'b' }];
    expect(() => next(mixed)).toThrow(/neither all numbers nor all strings/);
  });
});

describe('randomUuid', () => {
  it('emits a well-formed v4 uuid', () => {
    expect(randomUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('does not repeat across many draws', () => {
    const seen = new Set(Array.from({ length: 500 }, () => randomUuid()));
    expect(seen.size).toBe(500);
  });
});
