/**
 * Copy index.html to 404.html for static hosts that have no SPA rewrite rule.
 *
 * GitHub Pages serves 404.html for any path it does not have a file for, with a
 * 404 status. Because that file is the full app, the SPA still boots and the
 * router resolves the requested path — so a deep link like /datasets works after
 * a hard refresh. Without it, refreshing on any route except "/" shows the host's
 * own "404 Not Found" page.
 *
 * Vercel does not need this: frontend/vercel.json already rewrites unknown paths
 * to index.html. This exists for the GitHub Pages deployment.
 */

import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const index = join(dist, 'index.html');
const fallback = join(dist, '404.html');

if (!existsSync(index)) {
  console.error(`No ${index}. Run the build first.`);
  process.exit(1);
}

copyFileSync(index, fallback);
console.log('Wrote dist/404.html so deep links resolve on a static host.');
