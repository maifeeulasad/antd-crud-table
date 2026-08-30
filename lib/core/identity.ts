import type { IdGenerator } from './types';

/**
 * Fresh RFC-4122 v4 identifier.
 *
 * `crypto.randomUUID` needs a secure context and is absent in some test
 * environments, so this falls back to `getRandomValues` and, failing that,
 * to `Math.random`. The fallback is for uniqueness within a client-side
 * dataset, not for anything security-bearing.
 */
const randomUuid = (): string => {
  const webCrypto: Crypto | undefined =
    typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;

  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Version 4, variant 10xx, per RFC 4122 section 4.4.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const DIGITS_ONLY = /^\d+$/;

/**
 * Default identity policy for in-memory sources.
 *
 * Chooses from the *runtime type of the existing keys* rather than coercing
 * them to numbers. Coercion was the old bug: `Number('a3f9-...')` is `NaN`,
 * `|| 0` collapsed it to `0`, and every created row came back as `1` -
 * duplicate keys, and `update`/`remove` then resolving to the wrong record.
 *
 * - numeric keys      -> highest + 1
 * - digit-like strings -> highest + 1, kept as a string
 * - any other string  -> a fresh UUID
 * - empty dataset     -> `1`, matching the previous behaviour for the common case
 *
 * Mixed or non-primitive key types cannot be continued safely, so those throw
 * rather than silently colliding. Pass an explicit generator for those.
 */
export const defaultIdGenerator = <T, K extends keyof T>(key: K): IdGenerator<T, K> => {
  return (existing: readonly T[]): T[K] => {
    const keys = existing.map((item) => item[key]).filter((value) => value !== undefined && value !== null);

    if (keys.length === 0) return 1 as T[K];

    if (keys.every((value) => typeof value === 'number')) {
      const highest = Math.max(...(keys as number[]).filter(Number.isFinite));
      return ((Number.isFinite(highest) ? highest : 0) + 1) as T[K];
    }

    if (keys.every((value) => typeof value === 'string')) {
      const strings = keys as string[];
      if (strings.every((value) => DIGITS_ONLY.test(value))) {
        const highest = Math.max(...strings.map(Number));
        return String(highest + 1) as T[K];
      }
      return randomUuid() as T[K];
    }

    throw new Error(
      `Cannot derive the next id for "${String(key)}": existing keys are neither all numbers nor all strings. ` +
        'Supply an explicit `generateId` to the data source.',
    );
  };
};

export { randomUuid };
