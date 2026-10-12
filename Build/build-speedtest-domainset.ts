import path from 'node:path';

import tldts from 'tldts-experimental';
import { SpanCategory, task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { readFileIntoProcessedArray } from './lib/fetch-text-by-line';

import { DomainsetOutput } from './lib/rules/domainset';
import { OUTPUT_SURGE_DIR, SOURCE_DIR } from './constants/dir';
import { $$fetch } from './lib/fetch-retry';

import { fastUri } from 'fast-uri';
import { historicalInput, settleBuildWork } from './lib/build-output';

interface SpeedTestServer {
  url: string,
  lat: string,
  lon: string,
  distance: number,
  name: string,
  country: string,
  cc: string,
  sponsor: string,
  id: string,
  preferred: number,
  https_functional: number,
  host: string
}

function getSpeedtestHostsGroups() {
  return $$fetch('https://speedtest-net-servers.cdn.skk.moe/servers.json')
    .then(res => res.json() as Promise<SpeedTestServer[]>)
    .then((data) => data.reduce<string[]>((prev, cur) => {
      if (cur.host) {
        const hn = tldts.getHostname(cur.host, { detectIp: false, validateHostname: true });
        if (hn) {
          prev.push(hn.trim()); // speedtest API typo: leading whitespace in hostname
        }
      }
      if (cur.url) {
        const hn = fastUri.parse(cur.url).host;
        if (hn) {
          prev.push(hn.trim());
        }
      }
      return prev;
    }, []));
}

interface LibreSpeedServerInfo {
  name: string,
  dlURL: string,
  ulURL: string,
  pingURL: string,
  getIpURL: string,
  server: string,
  sponsorName: string
}

function getLibrespeedBackends() {
  return $$fetch('https://speedtest-net-servers.cdn.skk.moe/librespeed-servers.json')
    .then(res => res.json() as Promise<LibreSpeedServerInfo[]>)
    .then((data) => data.reduce<string[]>((prev, cur) => {
      if (cur.server) {
        const hn = fastUri.parse(cur.server).host;
        if (hn) {
          prev.push(hn.trim());
        }
      }
      return prev;
    }, []));
}

export const buildSpeedtestDomainSet = task(require.main === module, __filename)(
  async (span) => {
    const [speedtestHosts, librespeedBackends, localRules, previousRules] = await settleBuildWork([
      span.traceChildPromise('get speedtest.net servers', getSpeedtestHostsGroups(), SpanCategory.Network),
      span.traceChildPromise('get librespeed backends', getLibrespeedBackends(), SpanCategory.Network),
      readFileIntoProcessedArray(path.resolve(SOURCE_DIR, 'domainset/speedtest.conf')),
      historicalInput(path.resolve(OUTPUT_SURGE_DIR, 'domainset/speedtest.conf'), 'history').then(file => readFileIntoProcessedArray(file!))
    ]);
    return new DomainsetOutput(span, 'speedtest')
      .withTitle('Sukka\'s Ruleset - Speedtest Domains')
      .appendDescription(
        SHARED_DESCRIPTION,
        '',
        'This file contains common speedtest endpoints.'
      )
      .addFromDomainset(localRules)
      .addFromDomainset(previousRules)
      .bulkAddDomain(speedtestHosts)
      .bulkAddDomain(librespeedBackends)
      .write();
  }
);
