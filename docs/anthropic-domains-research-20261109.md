# Anthropic / Claude routing domains

Checked 2026-11-09. Research only; no rule sources changed. Baseline: `anthropic.com`, `clau.de`, `claude.ai`, `claude.app`, `claude.com`, `claude.dev`, `claudemcpclient.com`, `claudemcpcontent.com`, `claudeusercontent.com`, exact `servd-anthropic-website.b-cdn.net`.

## Community comparison and recommended additions

The current [MetaCubeX generated Anthropic list](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/anthropic.list) adds these suffixes beyond the baseline:

```text
ant.dev
anthropic.team
antspace.dev
chatbotclaude.com
claude.new
claude.site
claudeacademy.com
claudepages.dev
claudestudio.com
```

Recommendation: include these nine as community-attributed Claude coverage. This is evidence of community classification, not proof that every domain is required for normal chat, Code or Cowork operation, or independent legal ownership verification. The list also includes two exact telemetry hosts: `http-intake.logs.us5.datadoghq.com` and `o1158394.ingest.us.sentry.io`.

The [v2fly source Anthropic list](https://raw.githubusercontent.com/v2fly/domain-list-community/master/data/anthropic) contains the same suffixes and exact hosts, explicitly labels the latter telemetry, and links `antspace.dev` to reverse engineering. Matching generated/source lists should not be counted as independent ownership evidence.

[Sukka's current AI source](https://raw.githubusercontent.com/SukkaW/Surge/master/Source/non_ip/ai.conf) lists `anthropic.com`, `claude.ai`, `claude.com`, and `clau.de`; all are already present. Its comment describes the short URL's geoblocking significance as uncertain.

[blackmatrix7 Claude](https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Claude/Claude.list) still declares update 2025-06-06 and includes only `anthropic.com`, `claude.ai`, exact `cdn.usefathom.com`. [Anthropic](https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Anthropic/Anthropic.list) declares 2024-01-08 and includes the two suffixes plus the existing exact Bunny CDN host. These older lists are not a completeness ceiling.

[Open PR #1671](https://github.com/blackmatrix7/ios_rule_script/pull/1671) reports missing content coverage, including a November 2 comment about `claudeusercontent.com`. It proposes broad shared Statsig domains and `sentrian.io` without strong first-party evidence; do not adopt those automatically. [Open PR #1726](https://github.com/blackmatrix7/ios_rule_script/pull/1726) also proposes expanding Claude coverage but is not the deployed master list.

## Official operational evidence

[Desktop network requirements](https://code.claude.com/docs/en/desktop#network-access-requirements) identify `anthropic.com`, `claude.ai`, `claude.com`, `claude.app`, `*.claudeusercontent.com`, and `*.claudemcpcontent.com`. All are covered by the baseline suffixes. Examples include `assets-proxy.anthropic.com`, `a-cdn.anthropic.com`, `s-cdn.anthropic.com`, `downloads.claude.ai`, `sso.claude.com`, and dynamic live-preview hosts. A missing explicit hostname under an already matched suffix is not a coverage gap. The document requires the Chrome bridge to share egress with Claude when organizational IP allowlisting applies.

[CLI network requirements](https://code.claude.com/docs/en/network-config#network-access-requirements) confirm core API, OAuth, MCP proxy, installer and artifact endpoints under those suffixes. They also list optional exact `http-intake.logs.us5.datadoghq.com` and `browser-intake-us5-datadoghq.com` for Datadog telemetry/error reports. Include these only if telemetry routing is part of the intended complete service coverage; neither warrants a Datadog-wide suffix. `o1158394.ingest.us.sentry.io` has community evidence above, but was not in the current official network table reviewed.

The same CLI document lists shared dependencies for plugin installation, package metadata and release notes (`storage.googleapis.com`, `registry.npmjs.org`, `github.com`, `raw.githubusercontent.com`), and artifact font/library hosts. These are dependencies, not Anthropic-owned suffixes. Do not copy their parent domains into the Claude category just to cover specific workflows.

## Shared authentication, CDN, and telemetry boundaries

Keep `servd-anthropic-website.b-cdn.net` exact. If adopting blackmatrix7's Fathom entry, keep `cdn.usefathom.com` exact and classify it as shared analytics rather than core authentication. Do not broaden to `b-cdn.net`, `usefathom.com`, `datadoghq.com`, or `sentry.io`.

No current official Claude-specific Auth0 host was established in this review. Generic [Auth0 firewall guidance](https://support.auth0.com/center/s/article/Configure-a-Firewall-Allowlist-for-Auth0-Authentication) names `cdn.auth0.com` and each application's actual custom domain/identity providers; it does not establish that a particular Claude flow needs all Auth0 tenants. Do not add `auth0.com`, `google.com`, `cloudflare.com`, or cloud-storage provider suffixes from generic login/asset advice.

## MCP and arbitrary external services

[Claude file/network guidance](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude) distinguishes package-manager egress, configured domains, full internet access, and MCP connectivity. MCP connections can communicate regardless of that sandbox egress setting. Third-party connectors, downloaded packages, browsed sites, identity providers and user-configured MCP endpoints cannot be exhaustively represented by one Anthropic domain list. Treat those destinations through their own service rules or explicit exact-host additions; do not route arbitrary external hosts solely because Claude initiated the operation.

## Implementation recommendation

Add the nine community suffixes with provenance. Preserve the existing owned/core suffixes and exact CDN rule. If the intended policy includes optional diagnostics, add the two current official exact Datadog hosts and the community exact Sentry host, clearly marked optional/shared; otherwise record their deliberate exclusion. Keep broad third-party suffixes and unsubstantiated `sentrian.io` out. This extends category coverage without claiming to solve every connector or package-manager network requirement.

## X search limitation

The coordinating task attempted both web search and Chrome's live X search for `Claude (分流 OR 域名 OR ruleset)`. Web results were unrelated trend summaries; X displayed a connectivity failure. No original X post was verifiable, so none is used as evidence here. This is a source-access gap, not a conclusion that no relevant posts exist.


## Local preparation and validation

The local RuleMesh source and evidence-backed `sources/overrides.json` have been updated: 10 → 22 entries (nine community suffixes plus three exact optional telemetry hosts). Existing entries remain. `validateSourceCatalog` passed; existing `Build/sync-sources.test.ts` passed (3 tests). The existing `Build/build-common.ts` writer completed and generated the Shadowrocket artifact; every added override is represented with correct DOMAIN/DOMAIN-SUFFIX semantics and broad shared-provider suffixes are absent. This is a common-rule generation check, not a full-site release acceptance.

Read-only confirmation: active `CurrentRuleFileName` is `Shadowrocket.conf-945990013.db`; both blackmatrix7 and codingmesh Anthropic RULE-SET entries target the fixed ISP policy. Neither reference nor the policy was modified. No commit/push/site publication or client cache refresh was performed; the online subscription does not yet contain these local additions.
