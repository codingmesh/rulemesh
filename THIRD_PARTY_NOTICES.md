# Third-party notices

RuleMesh is a modified downstream version of [SukkaW/Surge](https://github.com/SukkaW/Surge), initially adopted from commit `6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62`. The upstream project and this combined work are distributed under GNU AGPL-3.0. Copyright and modification notices are recorded in `NOTICE`.

## SukkaW/Surge rules and build implementation

Author: Sukka and SukkaW/Surge contributors.

RuleMesh retains and modifies the upstream build implementation, source rules, multi-client writers, modules, mock responses, generated-directory site, and publication workflow. The full AGPL-3.0 text is the repository `LICENSE`; a preserved reference copy is in `licenses/Sukka-AGPL-3.0.txt`.

## MetaCubeX service-domain data

The additional service categories are synchronized from MetaCubeX/meta-rules-dat and pinned by `sources/registry.json`, which is the authoritative current revision. MetaCubeX declares GNU GPL version 3; the selected data also traces to v2fly/domain-list-community, which is MIT licensed. Reference license texts are preserved in `licenses/MetaCubeX-GPL-3.0.txt` and `licenses/v2fly-MIT.txt`.

The imported categories were normalized into `Source/domainset`, `Source/non_ip`, and `Source/ip` and are processed by the inherited SukkaW/Surge pipeline. File headers link back to this notice.

## Official network facts

Selected Telegram and OpenAI destination addresses originate from their official published network documentation. RuleMesh records them as routing facts and does not claim ownership of the providers' documentation or replace their terms.

## Dependencies

The inherited build uses `hntrie`, `fast-cidr-tools`, and the other packages pinned by `pnpm-lock.yaml`. Their package metadata and license files remain authoritative. Reference MIT texts for `hntrie` and `fast-cidr-tools` are preserved in `licenses/`.
