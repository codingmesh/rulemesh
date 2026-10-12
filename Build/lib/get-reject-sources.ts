import { workerJob } from '../trace';
import type { RawSpan, Span, WorkerJobResult } from '../trace';

import {
  HOSTS, HOSTS_EXTRA,
  DOMAIN_LISTS, DOMAIN_LISTS_EXTRA,
  ADGUARD_FILTERS, ADGUARD_FILTERS_EXTRA, ADGUARD_FILTERS_WHITELIST
} from '../constants/reject-data-source';
import { createHostsProcessor } from './parse-filter/hosts';
import { createDomainListProcessor } from './parse-filter/domainlists';
import { createFilterProcessor } from './parse-filter/filters';
import type { ProcessFilterRulesResult } from './parse-filter/filters';
import { foundDebugDomain } from './parse-filter/shared';
import { settleBuildWork } from './build-output';

/**
 * Everything build-reject-domainset pulls from remote hosts / domain lists /
 * AdGuard filters, already parsed. Plain arrays only
 */
export interface RejectSources {
  hosts: string[][],
  hostsExtra: string[][],
  domainLists: string[][],
  domainListsExtra: string[][],
  adguardFilters: ProcessFilterRulesResult[],
  adguardFiltersExtra: ProcessFilterRulesResult[],
  adguardFiltersWhitelist: ProcessFilterRulesResult[],
  /** DEBUG_DOMAIN_TO_FIND was seen while parsing -- lives in this thread's module state, so it has to be reported back */
  foundDebugDomain: boolean
}

export function getRejectSources(rawSpan?: RawSpan): Promise<WorkerJobResult<RejectSources>> {
  return workerJob(rawSpan, async (span) => {
    // Processors only declare work. Invoking all groups below starts downloads
    // concurrently, with rejection handlers already owned by this task.
    const hosts = HOSTS.map(entry => createHostsProcessor(...entry));
    const hostsExtra = HOSTS_EXTRA.map(entry => createHostsProcessor(...entry));
    const domainLists = DOMAIN_LISTS.map(entry => createDomainListProcessor(...entry));
    const domainListsExtra = DOMAIN_LISTS_EXTRA.map(entry => createDomainListProcessor(...entry));
    const adguardFilters = ADGUARD_FILTERS.map(entry => createFilterProcessor(...entry));
    const adguardFiltersExtra = ADGUARD_FILTERS_EXTRA.map(entry => createFilterProcessor(...entry));
    const adguardFiltersWhitelist = ADGUARD_FILTERS_WHITELIST.map(entry => createFilterProcessor(...entry));

    const run = <T>(tasks: Array<(span: Span) => Promise<T>>) => settleBuildWork(tasks.map(task => task(span)));

    const [
      hostsResults, hostsExtraResults,
      domainListsResults, domainListsExtraResults,
      adguardFiltersResults, adguardFiltersExtraResults, adguardFiltersWhitelistResults
    ] = await settleBuildWork([
      run(hosts), run(hostsExtra),
      run(domainLists), run(domainListsExtra),
      run(adguardFilters), run(adguardFiltersExtra), run(adguardFiltersWhitelist)
    ]);

    return {
      hosts: hostsResults,
      hostsExtra: hostsExtraResults,
      domainLists: domainListsResults,
      domainListsExtra: domainListsExtraResults,
      adguardFilters: adguardFiltersResults,
      adguardFiltersExtra: adguardFiltersExtraResults,
      adguardFiltersWhitelist: adguardFiltersWhitelistResults,
      foundDebugDomain: foundDebugDomain.value
    };
  });
}
