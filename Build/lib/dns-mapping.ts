export function createGetDnsMappingRule(allowWildcard: boolean) {
  const hasWildcard = (domain: string) => {
    if (domain.includes('*') || domain.includes('?')) {
      if (!allowWildcard) throw new TypeError(`Wildcard domain is not supported: ${domain}`);
      return true;
    }
    return false;
  };
  return (domain: string): string[] => {
    const wildcard = hasWildcard(domain);
    if (domain[0] === '$') return [`${wildcard ? 'DOMAIN-WILDCARD' : 'DOMAIN'},${domain.slice(1)}`];
    if (domain[0] === '+') return [`${wildcard ? 'DOMAIN-WILDCARD,*.' : 'DOMAIN-SUFFIX,'}${domain.slice(1)}`];
    return wildcard ? [`DOMAIN-WILDCARD,${domain}`, `DOMAIN-WILDCARD,*.${domain}`] : [`DOMAIN-SUFFIX,${domain}`];
  };
}
