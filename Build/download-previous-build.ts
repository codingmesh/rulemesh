import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';
import { SpanCategory, task } from './trace';
import { extract as tarExtract } from 'tar-fs';
import type { Headers as TarEntryHeaders } from 'tar-fs';
import zlib from 'node:zlib';
import undici from 'undici';
import picocolors from 'picocolors';
import { CACHE_DIR } from './constants/dir';
import { buildContext } from './lib/build-output';
import { requestWithLog } from './lib/fetch-retry';
import { isDirectoryEmptySync } from './lib/misc';
import { isCI } from 'ci-info';

const GITHUB_CODELOAD_URL = 'https://codeload.github.com/codingmesh/ruleset/tar.gz/main';

export const downloadPreviousBuild = task(require.main === module, __filename)(async (span) => {
  const directory = buildContext()?.previous ?? process.env.RULEMESH_PREVIOUS_DIR ?? path.join(CACHE_DIR, 'previous-build');
  if (fs.existsSync(directory) && !isDirectoryEmptySync(directory)) {
    console.log(picocolors.blue('Previous input directory exists, skip downloading'));
    return;
  }

  if (process.env.RULEMESH_SKIP_PREVIOUS_DOWNLOAD === '1') {
    console.log(picocolors.blue('Clean RuleMesh build requested, skip downloading previous output'));
    return;
  }

  // we uses actions/checkout to download the previous build now, so we should throw if the directory is empty
  if (isCI) {
    throw new Error('CI environment detected, but public directory is empty');
  }

  const tarGzUrl = await span.traceChildAsync('get tar.gz url', async () => {
    const resp = await requestWithLog(GITHUB_CODELOAD_URL, { method: 'HEAD' });
    if (resp.statusCode !== 200) {
      throw new Error(`Download previous RuleMesh build failed: ${resp.statusCode}`);
    }
    return GITHUB_CODELOAD_URL;
  }, SpanCategory.Network);

  // streaming download -> gunzip -> untar to disk, network dominates so that is the tag
  return span.traceChildAsync('download & extract previous build', async () => {
    const respBody = undici.pipeline(
      tarGzUrl,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'curl/8.12.1',
          // https://github.com/unjs/giget/issues/97
          // https://gitlab.com/gitlab-org/gitlab/-/commit/50c11f278d18fe1f3fb12eb595067216bb58ade2
          'sec-fetch-mode': 'same-origin'
        }
      },
      ({ statusCode, body }) => {
        if (statusCode !== 200) {
          console.warn('Download previous build failed! Status:', statusCode);
          if (statusCode === 404) {
            throw new Error('Download previous build failed! 404');
          }
        }

        return body;
      }
      // by default, undici.pipeline returns a duplex stream (for POST/PUT)
      // Since we are using GET, we need to end the write immediately
    ).end();

    const pathPrefix = 'ruleset-main/';

    return pipeline(
      respBody,
      zlib.createGunzip(),
      tarExtract(
        directory,
        {
          ignore(_: string, header?: TarEntryHeaders) {
            if (header) {
              if (header.type !== 'file' && header.type !== 'directory') {
                return true;
              }
              if (header.type === 'file' && path.extname(header.name) === '.ts') {
                return true;
              }
            }

            return false;
          },
          map(header) {
            header.name = header.name.replace(pathPrefix, '');
            return header;
          }
        }
      )
    );
  }, SpanCategory.Network);
});
