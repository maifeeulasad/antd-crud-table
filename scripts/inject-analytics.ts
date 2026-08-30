/**
 * Inject the analytics tag into every generated page of the built site.
 *
 * The demo carries its tag in a hand-written `index.html`, but TypeDoc and
 * Storybook generate their own HTML - TypeDoc alone emits a page per class,
 * interface, type and function, which is most of the site by page count. There
 * is no source file to add a snippet to, so it is added after the build.
 *
 * Site-only. This runs against the deploy output and never touches `lib/` or
 * anything published to npm.
 *
 * Usage:
 *   node scripts/inject-analytics.ts [siteDir]
 *   GA_MEASUREMENT_ID=G-XXXX node scripts/inject-analytics.ts
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/** Marks a block this script owns, so repeated runs stay idempotent. */
const MARKER = 'antd-crud-table:analytics';

/**
 * Pages deliberately left untagged.
 *
 * Storybook renders `iframe.html` inside `index.html`; tagging both would
 * count every story view twice.
 */
const EXCLUDED = new Set(['storybook/iframe.html']);

interface InjectionSummary {
  injected: string[];
  alreadyTagged: string[];
  excluded: string[];
  noHead: string[];
}

const measurementId = (): string => {
  const id = process.env.GA_MEASUREMENT_ID ?? 'G-3G1RNC5YLT';
  if (!/^G-[A-Z0-9]+$/i.test(id)) {
    throw new Error(`GA_MEASUREMENT_ID is not a valid measurement id: ${id}`);
  }
  return id;
};

const snippet = (id: string): string =>
  [
    `<!-- ${MARKER} -->`,
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
    '<script>',
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('js', new Date());",
    `gtag('config', '${id}');`,
    '</script>',
  ].join('');

/** Every `.html` file under `dir`, as paths relative to it, using `/` separators. */
const findHtmlFiles = async (dir: string, base = dir): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findHtmlFiles(full, base)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      found.push(relative(base, full).split(sep).join('/'));
    }
  }

  return found.sort();
};

/**
 * Whether a page already reports to this property.
 *
 * Checks for the measurement id as well as this script's marker, so the demo's
 * hand-written tag is recognised and not duplicated.
 */
const alreadyTagged = (html: string, id: string): boolean =>
  html.includes(MARKER) || html.includes(id);

export const injectInto = (html: string, id: string): string | null => {
  const closing = html.toLowerCase().lastIndexOf('</head>');
  if (closing === -1) return null;
  return `${html.slice(0, closing)}${snippet(id)}${html.slice(closing)}`;
};

const run = async (siteDir: string): Promise<InjectionSummary> => {
  const id = measurementId();
  const files = await findHtmlFiles(siteDir);
  const summary: InjectionSummary = { injected: [], alreadyTagged: [], excluded: [], noHead: [] };

  for (const file of files) {
    if (EXCLUDED.has(file)) {
      summary.excluded.push(file);
      continue;
    }

    const path = join(siteDir, file);
    const html = await readFile(path, 'utf8');

    if (alreadyTagged(html, id)) {
      summary.alreadyTagged.push(file);
      continue;
    }

    const updated = injectInto(html, id);
    if (updated === null) {
      summary.noHead.push(file);
      continue;
    }

    await writeFile(path, updated, 'utf8');
    summary.injected.push(file);
  }

  return summary;
};

const main = async (): Promise<void> => {
  const siteDir = process.argv[2] ?? 'dist-site';
  const summary = await run(siteDir);

  const total =
    summary.injected.length +
    summary.alreadyTagged.length +
    summary.excluded.length +
    summary.noHead.length;

  console.log(`analytics: scanned ${total} page(s) under ${siteDir}`);
  console.log(`  injected:       ${summary.injected.length}`);
  console.log(`  already tagged: ${summary.alreadyTagged.length}`);
  console.log(`  excluded:       ${summary.excluded.length}${summary.excluded.length ? ` (${summary.excluded.join(', ')})` : ''}`);

  if (summary.noHead.length > 0) {
    console.warn(`  no <head>:      ${summary.noHead.length} (${summary.noHead.join(', ')})`);
  }

  // A build that matched nothing at all is a broken build, not a clean run.
  if (total === 0) {
    throw new Error(`No HTML found under ${siteDir}. Did the site build run?`);
  }
};

// Only run when invoked directly, so the helpers stay importable by tests.
if (process.argv[1]?.endsWith('inject-analytics.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { findHtmlFiles, alreadyTagged, snippet, run, MARKER, EXCLUDED };
