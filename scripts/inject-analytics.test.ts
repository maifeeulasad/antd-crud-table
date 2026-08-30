import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { injectInto, alreadyTagged, findHtmlFiles, run, MARKER } from './inject-analytics';

const ID = 'G-TESTID123';
const page = (head = '<title>t</title>') => `<!DOCTYPE html><html><head>${head}</head><body>x</body></html>`;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'analytics-'));
  process.env.GA_MEASUREMENT_ID = ID;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.GA_MEASUREMENT_ID;
});

describe('injectInto', () => {
  it('places the snippet immediately before </head>', () => {
    const out = injectInto(page(), ID);
    expect(out).toContain(MARKER);
    expect(out?.indexOf(MARKER)).toBeLessThan(out?.indexOf('</head>') ?? -1);
  });

  it('handles minified markup with no whitespace', () => {
    expect(injectInto('<html><head><title>x</title></head><body></body></html>', ID)).toContain(ID);
  });

  it('matches a closing tag regardless of case', () => {
    expect(injectInto('<HTML><HEAD></HEAD><BODY></BODY></HTML>', ID)).toContain(ID);
  });

  it('reports pages with no head rather than corrupting them', () => {
    expect(injectInto('<html><body>fragment</body></html>', ID)).toBeNull();
  });

  it('leaves body content untouched', () => {
    expect(injectInto(page(), ID)).toContain('<body>x</body>');
  });
});

describe('alreadyTagged', () => {
  it('recognises this script’s own marker', () => {
    expect(alreadyTagged(`<head><!-- ${MARKER} --></head>`, ID)).toBe(true);
  });

  // The demo's tag is hand-written in index.html and carries no marker.
  it('recognises a hand-written tag by its measurement id', () => {
    expect(alreadyTagged(`<head><script src="...?id=${ID}"></script></head>`, ID)).toBe(true);
  });

  it('does not match an untagged page', () => {
    expect(alreadyTagged(page(), ID)).toBe(false);
  });
});

describe('findHtmlFiles', () => {
  it('walks nested directories and returns forward-slash paths', async () => {
    await mkdir(join(dir, 'api', 'classes'), { recursive: true });
    await writeFile(join(dir, 'index.html'), page());
    await writeFile(join(dir, 'api', 'classes', 'A.html'), page());
    await writeFile(join(dir, 'api', 'styles.css'), 'body{}');

    expect(await findHtmlFiles(dir)).toEqual(['api/classes/A.html', 'index.html']);
  });
});

describe('run', () => {
  const build = async () => {
    await mkdir(join(dir, 'api'), { recursive: true });
    await mkdir(join(dir, 'storybook'), { recursive: true });
    await writeFile(join(dir, 'index.html'), page(`<script src="?id=${ID}"></script>`));
    await writeFile(join(dir, 'api', 'a.html'), page());
    await writeFile(join(dir, 'api', 'b.html'), page());
    await writeFile(join(dir, 'storybook', 'index.html'), page());
    await writeFile(join(dir, 'storybook', 'iframe.html'), page());
  };

  it('injects into generated pages, skipping tagged and excluded ones', async () => {
    await build();
    const summary = await run(dir);

    expect(summary.injected.sort()).toEqual(['api/a.html', 'api/b.html', 'storybook/index.html']);
    expect(summary.alreadyTagged).toEqual(['index.html']);
    expect(summary.excluded).toEqual(['storybook/iframe.html']);
  });

  // Storybook renders iframe.html inside index.html; tagging both would count
  // every story view twice.
  it('leaves the storybook iframe untagged', async () => {
    await build();
    await run(dir);

    expect(await readFile(join(dir, 'storybook', 'iframe.html'), 'utf8')).not.toContain(ID);
  });

  it('does not duplicate the demo’s hand-written tag', async () => {
    await build();
    await run(dir);

    const html = await readFile(join(dir, 'index.html'), 'utf8');
    expect(html.split(ID).length - 1).toBe(1);
  });

  it('is idempotent across repeated runs', async () => {
    await build();
    await run(dir);
    const second = await run(dir);

    expect(second.injected).toEqual([]);
    const html = await readFile(join(dir, 'api', 'a.html'), 'utf8');
    expect(html.split(MARKER).length - 1).toBe(1);
  });

  it('rejects a malformed measurement id rather than emitting a broken tag', async () => {
    await build();
    process.env.GA_MEASUREMENT_ID = 'not-an-id';

    await expect(run(dir)).rejects.toThrow(/not a valid measurement id/);
  });

  it('reports pages with no head instead of skipping them silently', async () => {
    await writeFile(join(dir, 'fragment.html'), '<div>no head</div>');
    const summary = await run(dir);

    expect(summary.noHead).toEqual(['fragment.html']);
  });
});
