import { SpanCategory } from '../../trace';
import type { Span } from '../../trace';
import { fetchAssets } from '../fetch-assets';
import { fastNormalizeDomainWithoutWww } from '../normalize-domain';
import { onBlackFound } from './shared';

const rSpace = /\s+/;

function hostsLineCb(line: string, set: string[], meta: string) {
  const _domain = line.split(rSpace, 3)[1];
  if (!_domain) {
    return;
  }
  const domain = fastNormalizeDomainWithoutWww(_domain.trim());
  if (!domain) {
    return;
  }

  onBlackFound(domain, meta);

  set.push(domain);
}

function hostsLineCbIncludeAllSubdomain(line: string, set: string[], meta: string) {
  const _domain = line.split(rSpace, 3)[1];
  if (!_domain) {
    return;
  }
  const domain = fastNormalizeDomainWithoutWww(_domain.trim());
  if (!domain) {
    return;
  }

  onBlackFound(domain, meta);

  set.push('.' + domain);
}

export function createHostsProcessor(hostsUrl: string, mirrors: string[] | null, includeAllSubdomain = false, allowEmptyRemote = false) {
  const cb = includeAllSubdomain ? hostsLineCbIncludeAllSubdomain : hostsLineCb;

  return (span: Span) => span.traceChildAsync(`process hosts: ${hostsUrl}`, async (span) => {
    const filterRules = await span.traceChildAsync('download', () => fetchAssets(hostsUrl, mirrors, true, allowEmptyRemote), SpanCategory.Network);

    const domainSets: string[] = [];

    span.traceChild('parse hosts', SpanCategory.Compute).traceSyncFn(() => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        cb(filterRules[i], domainSets, hostsUrl);
      }
    });

    return domainSets;
  });
}
