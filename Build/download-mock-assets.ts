import { SpanCategory, task } from './trace';
import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { OUTPUT_MOCK_DIR } from './constants/dir';
import { mkdirp } from './lib/misc';
import { $$fetch } from './lib/fetch-retry';
import { assertBuildActive, copyBuildFile, historicalInput, reserveOutput, settleBuildWork } from './lib/build-output';

const ASSETS_LIST = {
  'www-google-analytics-com_ga.js': 'https://cdn.jsdelivr.net/npm/@adguard/scriptlets@latest/dist/redirect-files/google-analytics-ga.js',
  'www-googletagservices-com_gpt.js': 'https://cdn.jsdelivr.net/npm/@adguard/scriptlets@latest/dist/redirect-files/googletagservices-gpt.js',
  'www-google-analytics-com_analytics.js': 'https://cdn.jsdelivr.net/npm/@adguard/scriptlets@latest/dist/redirect-files/google-analytics.js',
  'www-googlesyndication-com_adsbygoogle.js': 'https://cdn.jsdelivr.net/npm/@adguard/scriptlets@latest/dist/redirect-files/googlesyndication-adsbygoogle.js',
  'amazon-adsystem-com_amazon-apstag.js': 'https://cdn.jsdelivr.net/npm/@adguard/scriptlets@latest/dist/redirect-files/amazon-apstag.js'
} as const;

export const downloadMockAssets = task(require.main === module, __filename)(async (span) => {
  const p = mkdirp(OUTPUT_MOCK_DIR);
  if (p) {
    await p;
  }

  return settleBuildWork(Object.entries(ASSETS_LIST).map(
    ([filename, url]) => span
      // fetch + stream straight to disk; the transfer dominates
      .traceChild(url, SpanCategory.Network)
      .traceAsyncFn(async () => {
        const src = path.join(OUTPUT_MOCK_DIR, filename);
        try {
          const res = await $$fetch(url);
          if (!res.body) throw new Error(`Empty mock body: ${url}`);
          const output = reserveOutput(src, 'downloadMockAssets');
          try {
            await pipeline(res.body, fs.createWriteStream(src, 'utf-8'));
            output.commit();
          } finally { output.release(); }
        } catch (error) {
          assertBuildActive();
          const previous = await historicalInput(src, 'fallback');
          console.warn(`Using previous mock ${filename}:`, error);
          await copyBuildFile(previous!, src, 'downloadMockAssets fallback');
        }
      })
  ));
});
