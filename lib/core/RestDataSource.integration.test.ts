/**
 * Integration tests against the local dev backend.
 *
 * Everything else in the suite drives `RestDataSource` through an injected
 * fetch. That proves the request it builds, not that a server accepts it -
 * and the configurations that matter most here (an expiring token, a
 * conditional write, an idempotent create) only mean anything against
 * something that actually enforces them.
 *
 * The server under `backend/` is deliberately awkward: bearer auth with
 * short-lived tokens, a required version header, PATCH for updates, an
 * envelope on every payload, and non-standard pagination parameters.
 *
 * Run with `pnpm test:integration`; the server is started and stopped here.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { RestDataSource, RestError } from './RestDataSource';
import type { RestRequestContext } from './RestDataSource';
import type { CrudPage, CrudQuery, CrudSort } from './types';

interface User {
  id: number;
  name: string;
  age: number;
  status: 'active' | 'inactive';
  isAdmin: boolean;
  revision: number;
}

const PORT = 3199;
const ORIGIN = `http://localhost:${PORT}`;
const API_VERSION = '2024-01';

let server: ChildProcess;

/** Anything the server printed, so a startup failure explains itself. */
let serverOutput = '';

/** Poll until the server answers, so the suite does not race its startup. */
const waitForServer = async (attempts = 60): Promise<void> => {
  for (let i = 0; i < attempts; i += 1) {
    if (server.exitCode !== null) {
      throw new Error(
        `Dev backend exited with code ${server.exitCode} before listening.\n${serverOutput}`,
      );
    }
    try {
      const response = await fetch(`${ORIGIN}/auth/token`, { method: 'POST' });
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Dev backend did not start on ${ORIGIN}.\n${serverOutput}`);
};

beforeAll(async () => {
  const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../backend');
  server = spawn('node', ['--experimental-strip-types', 'index.ts'], {
    cwd: backendDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Captured rather than ignored: a server that fails to boot should say why
  // instead of surfacing as an opaque timeout.
  server.stdout?.on('data', (chunk: Buffer) => (serverOutput += chunk.toString()));
  server.stderr?.on('data', (chunk: Buffer) => (serverOutput += chunk.toString()));

  await waitForServer();
}, 45_000);

afterAll(() => {
  server?.kill();
});

beforeEach(async () => {
  await fetch(`${ORIGIN}/__reset`, { method: 'POST' });
});

/** Tracks every token the source asked for, so refreshes are observable. */
class TokenStore {
  readonly issued: string[] = [];
  private token?: string;
  private expiresAt = 0;

  async current(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt - 500) return this.token;

    const { token, expiresInMs } = (await fetch(`${ORIGIN}/auth/token`, { method: 'POST' }).then(
      (r) => r.json(),
    )) as { token: string; expiresInMs: number };

    this.token = token;
    this.expiresAt = Date.now() + expiresInMs;
    this.issued.push(token);
    return token;
  }

  /** Forces the next request to fetch a fresh token. */
  expire(): void {
    this.expiresAt = 0;
  }
}

interface Envelope<D> {
  data: D;
  meta?: { total_count: number };
}

/**
 * A source configured for the awkward API.
 *
 * Every unusual thing this server demands is expressed declaratively here.
 * None of it required subclassing.
 */
class AwkwardApiSource extends RestDataSource<User, 'id'> {
  /** This server signs the sort field rather than taking a direction parameter. */
  protected serializeSort(
    sort: readonly CrudSort<User>[] | undefined,
    params: URLSearchParams,
  ): void {
    const primary = sort?.[0];
    if (!primary) return;
    params.set('order_by', `${primary.direction === 'descend' ? '-' : ''}${String(primary.field)}`);
  }

  /** This server has one search parameter rather than one per column. */
  protected serializeFilters(filters: CrudQuery<User>['filters'], params: URLSearchParams): void {
    const search = Object.values(filters ?? {}).find(
      (value) => value !== undefined && value !== null && value !== '',
    );
    if (search !== undefined) params.set('q', String(search));
  }
}

const makeSource = (tokens: TokenStore, revisions?: Map<number, number>) =>
  new AwkwardApiSource({
    baseUrl: `${ORIGIN}/api`,
    endpoints: { list: '/users', create: '/users', update: '/users', remove: '/users' },
    paramNames: { page: 'page', pageSize: 'per_page', sortBy: 'order_by', sortOrder: 'ignored' },
    methods: { update: 'PATCH' },
    query: { 'api-key': 'demo' },
    headers: { 'X-Api-Version': API_VERSION },

    // Resolved per call: the token expires mid-session, and the conditional
    // and idempotency headers belong to one operation each.
    configureRequest: async (context: RestRequestContext<User, 'id'>) => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${await tokens.current()}`,
      };

      if (context.operation === 'create') {
        headers['Idempotency-Key'] = `key-${context.draft?.name ?? 'anon'}`;
      }
      if (context.operation === 'update' && context.id !== undefined) {
        const revision = revisions?.get(context.id);
        if (revision !== undefined) headers['If-Match'] = `"${revision}"`;
      }

      return { headers };
    },

    serializeRequest: (draft) => ({ data: { attributes: draft } }),
    parseResponse: (payload): CrudPage<User> => {
      const { data, meta } = payload as Envelope<User[]>;
      return { items: data, total: meta?.total_count ?? data.length };
    },
    parseRecord: (payload) => (payload as Envelope<User>).data,
  });

describe('RestDataSource against the dev backend', () => {
  it('authenticates, versions and pages a list request', async () => {
    const tokens = new TokenStore();
    const page = await makeSource(tokens).list({ page: 2, pageSize: 5 });

    expect(page.total).toBe(23);
    expect(page.items).toHaveLength(5);
    expect(page.items[0].id).toBe(6);
  });

  it('unwraps the list envelope into items and total', async () => {
    const page = await makeSource(new TokenStore()).list({ page: 1, pageSize: 10 });

    expect(page.items[0]).toMatchObject({ name: 'Person 1' });
    expect(page.total).toBe(23);
  });

  it('sends filters and sort in the server’s own vocabulary', async () => {
    const page = await makeSource(new TokenStore()).list({
      page: 1,
      pageSize: 10,
      filters: { name: 'Person 2' },
      sort: [{ field: 'id', direction: 'descend' }],
    });

    // Person 2, 20, 21, 22, 23 all contain "Person 2"
    expect(page.total).toBe(5);
    expect(page.items[0].id).toBeGreaterThan(page.items[1].id);
  });

  it('creates through the envelope and unwraps the created record', async () => {
    const created = await makeSource(new TokenStore()).create({ name: 'Ada', age: 36 });

    expect(created).toMatchObject({ name: 'Ada', age: 36, revision: 1 });
    expect(created.id).toBeGreaterThan(23);
  });

  // parseRecord is what makes this pass: without it the envelope itself would
  // come back and `created.id` would be undefined.
  it('returns the record rather than the envelope', async () => {
    const created = await makeSource(new TokenStore()).create({ name: 'Grace' });

    expect(created).not.toHaveProperty('data');
    expect(typeof created.id).toBe('number');
  });

  it('updates with PATCH, which is the only verb this server accepts', async () => {
    const source = makeSource(new TokenStore());
    const updated = await source.update(1, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
    expect(updated.revision).toBe(2);
  });

  it('deletes and tolerates a 204 with no body', async () => {
    const source = makeSource(new TokenStore());
    await expect(source.remove(1)).resolves.toBeUndefined();

    const page = await source.list({ page: 1, pageSize: 100 });
    expect(page.items.find((u) => u.id === 1)).toBeUndefined();
  });

  it('refreshes an expired token mid-session without failing a request', async () => {
    const tokens = new TokenStore();
    const source = makeSource(tokens);

    await source.list({ page: 1, pageSize: 5 });
    expect(tokens.issued).toHaveLength(1);

    // The server expires tokens after 5s; forcing it keeps the test quick.
    tokens.expire();
    const page = await source.list({ page: 1, pageSize: 5 });

    expect(tokens.issued).toHaveLength(2);
    expect(page.total).toBe(23);
  });

  it('sends a conditional update and surfaces a stale revision as 412', async () => {
    const revisions = new Map<number, number>();
    const tokens = new TokenStore();

    revisions.set(1, 1);
    const first = await makeSource(tokens, revisions).update(1, { name: 'First' });
    expect(first.revision).toBe(2);

    // Still claiming revision 1, which the server has moved past.
    const error = await makeSource(tokens, revisions)
      .update(1, { name: 'Second' })
      .then(
        () => { throw new Error('expected a precondition failure'); },
        (caught: unknown) => caught as RestError,
      );

    expect(error).toBeInstanceOf(RestError);
    expect(error.status).toBe(412);
    expect(error.body).toContain('revision_mismatch');
  });

  it('treats a repeated create with the same idempotency key as one record', async () => {
    const source = makeSource(new TokenStore());

    const first = await source.create({ name: 'Once' });
    const second = await source.create({ name: 'Once' });

    expect(second.id).toBe(first.id);

    const page = await source.list({ page: 1, pageSize: 100 });
    expect(page.items.filter((u) => u.name === 'Once')).toHaveLength(1);
  });

  it('carries static query parameters alongside generated ones', async () => {
    // The server ignores api-key, but a malformed URL would fail the version
    // and auth middleware before reaching the handler.
    const page = await makeSource(new TokenStore()).list({ page: 1, pageSize: 3 });
    expect(page.items).toHaveLength(3);
  });

  it('reports a validation failure with its status and body intact', async () => {
    const error = await makeSource(new TokenStore())
      .create({ age: 5 })
      .then(
        () => { throw new Error('expected a validation failure'); },
        (caught: unknown) => caught as RestError,
      );

    expect(error.status).toBe(422);
    expect(JSON.parse(error.body).error.field).toBe('name');
  });

  it('reports a missing version header rather than hanging', async () => {
    const source = new RestDataSource<User, 'id'>({
      baseUrl: `${ORIGIN}/api`,
      endpoints: { list: '/users', create: '/users', update: '/users', remove: '/users' },
      // No X-Api-Version, no Authorization.
    });

    const error = await source.list({ page: 1, pageSize: 5 }).then(
      () => { throw new Error('expected a rejection'); },
      (caught: unknown) => caught as RestError,
    );

    expect(error.status).toBe(400);
  });

  it('honours an AbortSignal', async () => {
    const controller = new AbortController();
    const tokens = new TokenStore();
    const source = new RestDataSource<User, 'id'>({
      baseUrl: `${ORIGIN}/api`,
      endpoints: { list: '/users', create: '/users', update: '/users', remove: '/users' },
      headers: { 'X-Api-Version': API_VERSION },
      init: { signal: controller.signal },
      configureRequest: async () => ({
        headers: { Authorization: `Bearer ${await tokens.current()}` },
      }),
      parseResponse: (payload) => {
        const { data, meta } = payload as Envelope<User[]>;
        return { items: data, total: meta?.total_count ?? data.length };
      },
    });

    controller.abort();
    await expect(source.list({ page: 1, pageSize: 5 })).rejects.toThrow();
  });
});
