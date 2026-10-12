import path from 'node:path';
import { readFileIntoProcessedArray, fetchRemoteTextByLine } from './fetch-text-by-line';
import { SpanCategory } from '../trace';
import type { Span } from '../trace';
import { SHARED_DESCRIPTION } from '../constants/description';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { SOURCE_DIR } from '../constants/dir';
import { DomainsetOutput } from './rules/domainset';
import { CRASHLYTICS_WHITELIST } from '../constants/reject-data-source';
import { HostnameTrie } from 'hntrie';
import { $$fetch } from './fetch-retry';
import { fastUri } from 'fast-uri';
import { settleBuildWork } from './build-output';

const IPFS_GATEWAYS = 'https://cdn.jsdelivr.net/gh/ipfs/public-gateway-checker@main/gateways.json';
export function parseIpfsGateways(data: unknown): string[] {
  if (!Array.isArray(data) || !data.length) throw new TypeError(`Invalid IPFS gateway list from ${IPFS_GATEWAYS}: expected a non-empty array`);
  const domains: string[] = [];
  for (let i = 0, len = data.length; i < len; i++) {
    const gateway: unknown = data[i];
    if (typeof gateway !== 'string' || !gateway.trim()) throw new TypeError(`Invalid IPFS gateway at ${IPFS_GATEWAYS}:${i + 1}: expected a URL string`);
    const parsed = fastUri.parse(gateway);
    if (!parsed.host || (parsed.scheme !== 'https' && parsed.scheme !== 'http') || parsed.error) throw new TypeError(`Invalid IPFS gateway URL at ${IPFS_GATEWAYS}:${i + 1}`);
    domains.push(parsed.host.trim());
  }
  return domains;
}

export async function generateCdnDownload(span: Span) {
  const cdnDomainSetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/cdn.conf'));
  const downloadDomainSetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/download.conf'));
  const steamDomainSetPromise = readFileIntoProcessedArray(path.join(SOURCE_DIR, 'domainset/game-download.conf'));
  const [
    S3OSSDomains,
    IPFSDomains,
    cdnDomainsList,
    downloadDomainSet,
    steamDomainSet
  ] = await settleBuildWork([
    span.traceChild('download public suffix list for s3', SpanCategory.Network).traceAsyncFn(
      async () => {
        const trie = new HostnameTrie();

        for await (const line of await fetchRemoteTextByLine('https://publicsuffix.org/list/public_suffix_list.dat', true)) {
          trie.add(line);
        }

        /**
         * Extract OSS domain from publicsuffix list
         */
        const S3OSSDomains: string[] = [];

        trie.find('.amazonaws.com').forEach((line: string) => {
          if (
            (line.startsWith('s3-') || line.startsWith('s3.'))
            && !line.includes('cn-')
          ) {
            S3OSSDomains.push('.' + line);
          }
        });
        trie.find('.scw.cloud').forEach((line: string) => {
          if (
            (line.startsWith('s3-') || line.startsWith('s3.'))
          // && !line.includes('cn-')
          ) {
            S3OSSDomains.push('.' + line);
          }
        });
        trie.find('sakurastorage.jp').forEach((line: string) => {
          if (
            (line.startsWith('s3-') || line.startsWith('s3.'))
          ) {
            S3OSSDomains.push('.' + line);
          }
        });

        return S3OSSDomains;
      }
    ),
    span.traceChild('load public ipfs gateway list', SpanCategory.Network).traceAsyncFn(
      async () => {
        const data: unknown = await (await $$fetch(IPFS_GATEWAYS)).json();
        return parseIpfsGateways(data);
      }
    ),
    cdnDomainSetPromise,
    downloadDomainSetPromise,
    steamDomainSetPromise
  ]);

  // Move S3 domains to download domain set, since S3 files may be large
  appendArrayInPlace(downloadDomainSet, S3OSSDomains);
  appendArrayInPlace(downloadDomainSet, steamDomainSet);

  // we have whitelisted the crashlytics domain, and we also want to put it in CDN policy
  appendArrayInPlace(cdnDomainsList, CRASHLYTICS_WHITELIST);

  return settleBuildWork([
    new DomainsetOutput(span, 'cdn')
      .withTitle('Sukka\'s Ruleset - CDN Domains')
      .appendDescription(SHARED_DESCRIPTION)
      .appendDescription(
        '',
        'This file contains object storage and static assets CDN domains.'
      )
      .addFromDomainset(cdnDomainsList)
      .bulkAddDomainSuffix(IPFSDomains)
      .write(),

    new DomainsetOutput(span, 'download')
      .withTitle('Sukka\'s Ruleset - Large Files Hosting Domains')
      .appendDescription(SHARED_DESCRIPTION)
      .appendDescription(
        '',
        'This file contains domains for software updating & large file hosting.'
      )
      .addFromDomainset(downloadDomainSet)
      .write()
  ]);
}
