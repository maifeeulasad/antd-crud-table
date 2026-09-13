import express from 'express';
import bodyParser from 'body-parser';

/**
 * A deliberately awkward CRUD API.
 *
 * The demo could be served by a tidy REST collection, but a tidy collection
 * only exercises the defaults. This one is shaped like the APIs that actually
 * cause trouble: bearer auth, a required version header, PATCH for updates,
 * conditional writes, idempotent creates, non-standard pagination parameters
 * and an envelope around every payload.
 *
 *   GET    /api/users?page=&per_page=&order_by=&q=   list, enveloped
 *   POST   /api/users                                create, Idempotency-Key
 *   PATCH  /api/users/:id                            update, optional If-Match
 *   DELETE /api/users/:id                            delete, 204 no content
 *
 * Every route requires `Authorization: Bearer <token>` and `X-Api-Version`.
 * Tokens expire after a few seconds so a client has to refresh mid-session;
 * `POST /auth/token` issues a new one.
 */

interface User {
  id: number;
  name: string;
  age: number;
  createdAt: string;
  status: 'active' | 'inactive';
  isAdmin: boolean;
  /** Bumped on every write, so conditional updates have something to match. */
  revision: number;
}

const API_VERSION = '2024-01';
const TOKEN_TTL_MS = 5_000;

const app = express();
app.use(bodyParser.json());

app.use((_req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Expose-Headers', 'ETag');
  next();
});
app.options(/.*/, (_req, res) => res.sendStatus(204));

const seed = (): User[] =>
  Array.from({ length: 23 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    age: 20 + (i % 40),
    createdAt: new Date(Date.UTC(2023, i % 12, 1)).toISOString(),
    status: i % 3 === 0 ? 'inactive' : 'active',
    isAdmin: i % 5 === 0,
    revision: 1,
  }));

let users: User[] = seed();
let nextId = users.length + 1;

/** Issued tokens and when they expire. */
const tokens = new Map<string, number>();

const issueToken = (): string => {
  const token = `tok_${Math.random().toString(36).slice(2, 10)}`;
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
};

/** Creates keyed by Idempotency-Key, so a retry returns the original record. */
const idempotentCreates = new Map<string, User>();

app.post('/auth/token', (_req, res) => {
  res.json({ token: issueToken(), expiresInMs: TOKEN_TTL_MS });
});

/** Resets to the seeded dataset, so integration tests start from a known state. */
app.post('/__reset', (_req, res) => {
  users = seed();
  nextId = users.length + 1;
  idempotentCreates.clear();
  res.sendStatus(204);
});

app.use('/api', (req, res, next) => {
  if (req.get('X-Api-Version') !== API_VERSION) {
    return res.status(400).json({ error: { code: 'bad_version', message: 'X-Api-Version is required' } });
  }

  const auth = req.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: { code: 'unauthenticated', message: 'Bearer token required' } });
  }

  const expiry = tokens.get(token);
  if (expiry === undefined) {
    return res.status(401).json({ error: { code: 'unknown_token', message: 'Token not recognised' } });
  }
  if (expiry < Date.now()) {
    tokens.delete(token);
    return res.status(401).json({ error: { code: 'token_expired', message: 'Token expired' } });
  }

  next();
});

app.get('/api/users', (req, res) => {
  const page = Number(req.query.page ?? 1);
  const perPage = Number(req.query.per_page ?? 10);
  const search = String(req.query.q ?? '').toLowerCase();
  const orderBy = String(req.query.order_by ?? '');

  const matched = search
    ? users.filter((u) => u.name.toLowerCase().includes(search))
    : [...users];

  if (orderBy) {
    const descending = orderBy.startsWith('-');
    const field = (descending ? orderBy.slice(1) : orderBy) as keyof User;
    matched.sort((a, b) => {
      const left = a[field];
      const right = b[field];
      const comparison = left === right ? 0 : left > right ? 1 : -1;
      return descending ? -comparison : comparison;
    });
  }

  const start = (page - 1) * perPage;
  res.json({
    data: matched.slice(start, start + perPage),
    meta: { total_count: matched.length, page, per_page: perPage },
  });
});

app.post('/api/users', (req, res) => {
  const key = req.get('Idempotency-Key');
  if (!key) {
    return res
      .status(400)
      .json({ error: { code: 'missing_idempotency_key', message: 'Idempotency-Key is required' } });
  }

  const existing = idempotentCreates.get(key);
  if (existing) return res.status(200).json({ data: existing });

  const attributes = (req.body?.data?.attributes ?? {}) as Partial<User>;
  if (!attributes.name) {
    return res
      .status(422)
      .json({ error: { code: 'validation_failed', message: 'name is required', field: 'name' } });
  }

  const user: User = {
    id: nextId++,
    name: attributes.name,
    age: attributes.age ?? 0,
    createdAt: new Date().toISOString(),
    status: attributes.status ?? 'active',
    isAdmin: attributes.isAdmin ?? false,
    revision: 1,
  };
  users.push(user);
  idempotentCreates.set(key, user);
  res.status(201).json({ data: user });
});

app.patch('/api/users/:id', (req, res) => {
  const index = users.findIndex((u) => u.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: { code: 'not_found', message: 'User not found' } });
  }

  const current = users[index];
  const ifMatch = req.get('If-Match');
  if (ifMatch && ifMatch !== `"${current.revision}"`) {
    return res
      .status(412)
      .json({ error: { code: 'revision_mismatch', message: `Expected ${ifMatch}, have "${current.revision}"` } });
  }

  const attributes = (req.body?.data?.attributes ?? {}) as Partial<User>;
  const updated: User = { ...current, ...attributes, id: current.id, revision: current.revision + 1 };
  users[index] = updated;

  res.set('ETag', `"${updated.revision}"`);
  res.json({ data: updated });
});

app.delete('/api/users/:id', (req, res) => {
  const index = users.findIndex((u) => u.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: { code: 'not_found', message: 'User not found' } });
  }
  users.splice(index, 1);
  res.sendStatus(204);
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`Awkward CRUD API on http://localhost:${PORT}`);
  console.log(`  version header: X-Api-Version: ${API_VERSION}`);
  console.log(`  tokens expire after ${TOKEN_TTL_MS}ms; POST /auth/token to refresh`);
});
