# 现成分流规则研究：Surge、Shadowrocket、Mihomo、sing-box

研究日期：2026-10-11（America/Los_Angeles）。活动时间以下统一 UTC，避免混淆自动构建日期。只读研究，不创建 GitHub 仓库，不修改正在使用的客户端配置。

## 结论

现有生态已经有可直接引用的成熟规则，**目前没有足够理由自建、长期维护一套全量规则数据库**。跨客户端优先研究 Sukka；Mihomo 和 sing-box 优先使用 MetaCubeX 的原生输出；Shadowrocket 的完整配置优先看 LOWERTOP 懒人配置或继续沿用 LingJingMaster 后做少量专项调整。blackmatrix7 适合服务级独立策略组，但具体 AI 文件存在明显更新缺口。Johnshall 适合国内外分流与去广告，不是专用 AI 出口管理的最佳基础。推荐先复用公共上游，按实际服务分类组织策略组；只有具体缺口时才维护小型覆盖规则或向上游提交修正。节点目的地由用户自行选择，研究不预设 Claude 必须固定美国出口。

“规则集可直接引用”不等于“完整配置可直接导入”。完整配置还决定节点、策略组、DNS、IPv6、TUN、兜底与更新行为；规则集仅决定匹配范围。没有任何规则集能保证防封、保证出口固定或保证 DNS 不泄漏。

## 活动与规模快照

GitHub REST API 实际读取各仓库 metadata 与对应分支最新 commit；star 数仅代表关注规模，不能代替质量评价。自动产物必须看发布分支，不能用源码默认分支的最后提交日期断言停更。

| 项目 | stars | 实际检查分支 | 最新提交 UTC | commit（缩写） | 许可 |
|---|---:|---|---|---|---|
| [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) | 28,205 | master | 2026-10-09 22:09:47 | 83f37120c155 | GPL-2.0 |
| [LingJingMaster/Shadowrocket-Rules](https://github.com/LingJingMaster/Shadowrocket-Rules) | 1,164 | main | 2026-10-10 10:39:00 | c61257022f64 | MIT |
| [SukkaW/Surge](https://github.com/SukkaW/Surge) | 4,544 | master | 2026-10-10 10:01:55 | 6172daf80ac3 | AGPL-3.0，China IP 文件另有 CC BY-SA 2.0 |
| [Johnshall/Shadowrocket-ADBlock-Rules-Forever](https://github.com/Johnshall/Shadowrocket-ADBlock-Rules-Forever) | 31,042 | release | 2026-10-10 23:04:44 | e0c71d555d42 | LICENSE 实际为 CC BY-SA 4.0 |
| [LOWERTOP/Shadowrocket](https://github.com/LOWERTOP/Shadowrocket) | 4,670 | main | 2026-10-10 04:11:53 | 10d845ffca79 | API 未声明许可证；不据此假定可随意复制发布 |
| [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) | 5,299 | meta / sing | 2026-10-11 01:11:11 / 01:10:29 | b4d414227a18 / 66997bb8226f | GPL-3.0 |
| [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules) | 28,751 | release | 2026-10-10 22:40:23 | 95e5d6a50402 | GPL-3.0 |
| [SagerNet/sing-geosite](https://github.com/SagerNet/sing-geosite) | 987 | main + rule-set | rule-set 2026-10-10 05:07:39 | df6851d87aea | API 标记 Other，需读 LICENSE |

截至读取时以上均未归档。历史项目 [h2y/Shadowrocket-ADBlock-Rules](https://github.com/h2y/Shadowrocket-ADBlock-Rules) 已归档，最后提交 2021-04-12，不列为当前首选。最初给出的 h2y/Shadowrocket-ADBlock 地址不存在，正确名称带 `-Rules`。

复核入口：`https://api.github.com/repos/{owner}/{repo}`；`https://api.github.com/repos/{owner}/{repo}/commits?sha={branch}&per_page=1`。数字和 commit 是本次快照，后续会变化。

## 产品边界与适配

| 项目 | 提供完整可导入配置 | Surge | Shadowrocket | Clash / Mihomo | sing-box |
|---|---|---|---|---|---|
| Sukka | 以规则和片段为主 | 原生 List 输出 | 非作者明确支持目标；部分 List 可兼容，需排除 Surge 特有参数并编译 | Mihomo 与 LegacyClashPremium 分开输出 | 原生规则集输出 |
| blackmatrix7 | 服务分类规则为主 | 专用目录 | 专用 Shadowrocket 目录 | 专用 Clash 目录 | 不假定 Clash/Surge 文件可直接作为 sing-box 原生输入 |
| MetaCubeX | 数据与示例片段 | 不是 Surge 配置模板 | 不是 Shadowrocket 配置模板 | meta 分支 MRS / 域名与 IP 数据 | sing 分支规则集 |
| Loyalsoldier clash-rules | rule-providers / rules 示例 | 不能直接拿 YAML 规则集作为 Surge RULE-SET | 同左 | YAML domain/ipcidr/classical providers；面向 Premium/Mihomo | 不直接兼容 |
| SagerNet sing-geosite | 数据仓库 | 否 | 否 | 不作为 Mihomo 原生模板 | 原生 rule-set 分支 |
| LingJingMaster | Shadowrocket.conf | 未验证整份兼容 | 是 | 不能整份导入 | 不能整份导入 |
| LOWERTOP | lazy.conf / lazy_group.conf | 未验证整份兼容 | 是 | 不能整份导入 | 不能整份导入 |
| Johnshall | 多种 .conf | 未验证整份兼容 | 是 | 不能整份导入 | 不能整份导入 |

各格式支持依据：[Sukka README](https://github.com/SukkaW/Surge#规则组列表)、[blackmatrix7 rule 目录](https://github.com/blackmatrix7/ios_rule_script/tree/master/rule)、[MetaCubeX README](https://github.com/MetaCubeX/meta-rules-dat#rule-set)、[Loyalsoldier 使用说明](https://github.com/Loyalsoldier/clash-rules#使用方式)、[SagerNet rule-set 分支](https://github.com/SagerNet/sing-geosite/tree/rule-set)。客户端名称与内核版本必须区分；`.txt`、`.conf` 后缀不能证明文件格式兼容。

## 各项目具体评价

### Sukka：跨客户端规则体系的首选候选

有统一来源、分离 domainset / non_ip / ip、原生 Surge/Mihomo/sing-box 输出及官方镜像，适合希望各平台策略一致的人。README 要求域名类排在 IP 类前，DNS 政策仍由客户端配置负责。大型广告域名集作者更推荐在 Surge Mac 使用，移动端不应为了条数全部加载。许可证要求也应保留。

当前 [AI List](https://ruleset.skk.moe/List/non_ip/ai.conf) 为 53 条，头部更新时间 2026-10-03；包含 Claude/Anthropic、Gemini 等，但还包含 `api.github.com`，统一分到 AI 出口会影响普通 GitHub API。含 Gemini URL-REGEX，需要核对是否依赖解密和目标客户端支持，不能把 Surge 示例中的 `extended-matching`、`pre-matching` 直接照抄给 Shadowrocket。它不是专属 Anthropic 列表。

### blackmatrix7：细分服务丰富，但仓库活跃不等于每份规则新鲜

专用客户端目录减少格式转换工作；可独立引用 Google、Apple、Telegram、OpenAI 等。当前 [Anthropic.list](https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Shadowrocket/Anthropic/Anthropic.list) 只有 3 条，头部仍是 2024-01-08；[Claude.list](https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Shadowrocket/Claude/Claude.list) 也是 3 条，2025-06-06。两者包含 anthropic.com 和 claude.ai，其他一条分别为网站 CDN 和 Fathom。不能因仓库每日更新就认为这两份已覆盖最新 Claude Desktop、MCP 与资源域名。

上游 README 声明数据整合自互联网，需关注各列表来源与再发布约束。[仓库说明](https://github.com/blackmatrix7/ios_rule_script)。

### MetaCubeX：Mihomo / sing-box 的优秀现成原生数据

提供 geo 数据、Mihomo MRS 产物以及 sing-box 规则集；源码主分支最后提交是六月，但两种产物分支均在十月十一日更新，维护正常。适合按服务 geosite 单独路由，避免自己编译和维护二进制格式。lite 列表仅部分常用分类，不能假定涵盖所有 AI。示例 DNS 对 cn/private/apple 分别指定解析器，属于示例而非完整配置保证。[README](https://github.com/MetaCubeX/meta-rules-dat)。优先选原生输出，不把数据库文件当作 Shadowrocket 文本规则集。

### Loyalsoldier：成熟的基础分流库

每日北京时间 06:30 构建，release 产物在本次研究前更新。适合 private/direct/proxy/reject/cncidr 这类底层分流；示例分别提供黑名单和白名单兜底。providers 更新间隔与自动构建周期是两回事，镜像也可能有缓存延迟。服务级 AI 单独出口需另配细分列表，不能把通用 proxy 集当作 Anthropic 组。[README](https://github.com/Loyalsoldier/clash-rules)。

### SagerNet sing-geosite：sing-box 原生数据备选

由 sing-box 生态组织提供；main 缺 README，不能从默认分支旧提交断言停止维护。应查看 rule-set 产物及实际客户端规则集字段，尤其新版 sing-box 与旧 geosite 数据库机制区别。[仓库](https://github.com/SagerNet/sing-geosite)、[产物分支](https://github.com/SagerNet/sing-geosite/tree/rule-set)。跨四客户端统一来源优先 Sukka；Mihomo/sing-box 双平台优先 MetaCubeX，SagerNet 作为原生备选。

### LingJingMaster：现在就能导入的小火箭配置

配置提供地区自动测试组，AI 默认美国组，并引用 blackmatrix7 与自身专项列表。当前主配置 DNS 为 Cloudflare DoH `#proxy`，备用 Google DoH `#proxy`；同时 `dns-direct-system=true`，并对 Apple CDN、局域网等指定系统 DNS。不能称作全部 DNS 都走代理。`url-test` 美国组按延迟自动换节点，不能保证 Anthropic 固定出口。主配置没有独立 Anthropic 组。

当前 AI.list 比 blackmatrix Anthropic/Claude 覆盖多，但用 claude/anthropic 关键词扩大范围，还把多个服务合并。[实际配置](https://raw.githubusercontent.com/LingJingMaster/Shadowrocket-Rules/main/Shadowrocket.conf)、[实际 AI 列表](https://raw.githubusercontent.com/LingJingMaster/Shadowrocket-Rules/main/AI.list)。导入适用于接受其默认 DNS、地区组和兜底的人；当前本地自定义配置不能无备份覆盖。

### LOWERTOP：Shadowrocket 原生参考与完整模板

仓库声明手册依据官方群组关键词维护，但同时明确这是非官方项目。lazy_group 配置注释丰富，直接导入地址 [lazy_group.conf](https://lowertop.github.io/Shadowrocket/lazy_group.conf)。当前文件头标注 2026-09-16，配置使用国内 DoH 加普通 DNS，fallback 为 system，IPv6=true；AI 组主要引用 iab0x00 AI.txt，部分单独 AI 规则默认注释。适合作为兼容性和配置语义参考，不能称作默认防泄漏或原生独立 Anthropic 策略。未声明许可情况下不直接复制整套再发布。[说明](https://github.com/LOWERTOP/Shadowrocket)。

### Johnshall：适合通用分流、去广告

release 快照实际十月十日构建，与 README 每日北京时间 08:00 更新的机制相符。提供黑名单、白名单、国内外、回国、仅去广告，以及同步 LOWERTOP 的懒人配置。top500 探测旧机制失效已公开说明，不能将每日重建理解为所有域名逐日验证。抽查黑名单配置 DNS 是 AliDNS/Tencent DoH，IPv6=false；没有专用 Anthropic 策略。LICENSE 为 CC BY-SA 4.0；上游引用多种数据，再发布仍需看各来源。[README](https://github.com/Johnshall/Shadowrocket-ADBlock-Rules-Forever)、[LICENSE](https://github.com/Johnshall/Shadowrocket-ADBlock-Rules-Forever/blob/release/LICENSE)。

## AI 缺口如何判断

完整性必须和服务官方网络说明及真实请求日志比较，不能简单认为列表越长越好。Anthropic 官方现有说明涉及 Claude Desktop/MCP 域名，如 claude.app、claudemcpcontent.com；不能仅检查 claude.ai。共享 Sentry、Datadog、Intercom、Statsig 的整个后缀或宽关键词会影响其他应用，应优先限定官方明确列出的精确端点。

参考：[Claude Desktop 网络要求](https://code.claude.com/docs/en/desktop)、[Claude Code 网络配置](https://code.claude.com/docs/en/network-config)、[Anthropic API IP 地址](https://platform.claude.com/docs/en/api/ip-addresses)。IP 地址还需区分 API 入站地址与 Anthropic 出站地址；帖子的宽网段/ASN 不能未经用途核实就全部纳入客户端代理范围。

## 推荐决策

1. **已有配置稳定，想完善分类**：保留现有模板，按常用服务分别组织 AI、流媒体、开发、社交、Apple、国内直连与兜底组；策略目的地可调整。发现明确缺项时先向成熟上游提 issue/PR，必要时用小型本地覆盖。
2. **四类客户端都使用，想长期统一规则源**：采用 Sukka 为基础，每个客户端用其对应原生格式；Shadowrocket 对使用的具体 List 做编译与日志验证，不直接导入 Surge 全配置。
3. **主要 Mihomo 与 sing-box**：采用 MetaCubeX 原生 MRS/SRS；需要通用基础分流可选 Loyalsoldier，避免叠加多个重叠的全量直连/代理集。
4. **Shadowrocket 想直接导入完整配置**：LOWERTOP lazy_group 或 LingJingMaster 都是现成入口，先按 DNS/IPv6/自动换出口偏好选；Johnshall 适合通用黑白名单和广告场景。
5. **只有需要定制跨格式生成、上游缺少必要分类且无法补上、或多次发生未经审查的回归时**，才考虑自己的 GitHub 项目。项目应只维护多客户端配置与小型覆盖层，保留成熟上游而非重造所有规则。这属于可选后续工作，本次没有实施。

本研究核验公开文件、API 活动、格式声明与 DNS 设置，没有把各配置导入四种真实客户端并执行连通性验证。最终迁移需在目标客户端检查编译、规则命中、DNS、固定出口和回滚；静态阅读不能证明全部端到端可用。

## 全部常用分类与现成接入地址

分类需求应包括：局域网/private，广告/追踪，国内/境外通用分流，Apple/Microsoft/Google，代码托管，Telegram/社交，流媒体地区，游戏/下载/CDN，AI 服务和 GEOIP。Sukka 提供网络层拆分、CDN 与按地区流媒体；blackmatrix 与 MetaCubeX 擅长按服务精细分类；Loyalsoldier 擅长基础 direct/proxy/reject/private；Shadowrocket 模板将分类映射为现成策略组。按实际用途挑选，不默认加载每个类别，也不以总规则数作为完整性指标。

| 需求 | 可直接引用的现成地址 | 接入要求 |
|---|---|---|
| Surge AI | [Sukka AI List](https://ruleset.skk.moe/List/non_ip/ai.conf) | RULE-SET 映射到自有策略组；AI 合集 |
| Mihomo 分类 | [MetaCubeX meta 分支](https://github.com/MetaCubeX/meta-rules-dat/tree/meta/geo/geosite) | 选择 .mrs，behavior=domain / format=mrs |
| Mihomo Anthropic | [anthropic.mrs](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/anthropic.mrs) | 配 provider、策略、顺序 |
| sing-box Anthropic | [anthropic.srs](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/anthropic.srs) | remote rule_set，format=binary，路由映射 outbound |
| sing-box Sukka AI | [ai.json](https://ruleset.skk.moe/sing-box/non_ip/ai.json) | source 格式，version 2，确认目标 sing-box 支持 |
| Shadowrocket 完整模板 | [LOWERTOP lazy_group.conf](https://lowertop.github.io/Shadowrocket/lazy_group.conf) | 导入配置后选择节点，审查 DNS 与 AI 组 |
| Shadowrocket 完整模板 | [Ling Shadowrocket.conf](https://raw.githubusercontent.com/LingJingMaster/Shadowrocket-Rules/main/Shadowrocket.conf) | 同上，需独立 Anthropic 出口时再调整 |
| Shadowrocket 通用完整规则 | [Johnshall sr_cnip.conf](https://johnshall.github.io/Shadowrocket-ADBlock-Rules-Forever/sr_cnip.conf) | 国内外模式；不存在单独 AI 策略 |
| Clash/Mihomo 基础 | [Loyalsoldier release](https://github.com/Loyalsoldier/clash-rules/tree/release) | 文件内容为 YAML payload；domain/ipcidr/classical 不可混填 |
| sing-box 分类备选 | [SagerNet rule-set](https://github.com/SagerNet/sing-geosite/tree/rule-set) | 选择服务 .srs 文件，按新式规则集使用 |

本次实际抽查 MetaCubeX Anthropic 文本/JSON 为 9 条，包含 claudemcpcontent.com，但没有 claude.app；这已经比 blackmatrix 的旧文件更完整，但仍应对照官方 Desktop 要求补足。Sukka sing-box AI JSON 不含 Surge AI 的 URL-REGEX，证明同源不同格式未必完全等价，迁移必须核对语义。

补充流行候选：[ACL4SSR/ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) 在本次快照有 6,788 stars，最近 pushed 为 2026-10-07，实际 LICENSE 为 CC BY-SA 4.0。它适合 Clash/订阅转换生态中的模板与策略生成；不能把订阅转换网站生成的个人配置等同于规则数据库来源，也不能假定直接覆盖 sing-box 或 Shadowrocket 所需格式。对于本次跨客户端研究，Sukka、MetaCubeX、blackmatrix 已有更明确的原生格式分工，无需为了 ACL4SSR 再自建全量规则库。

Sukka 源码与构建产物另分仓库；主代理规则输出在 [SukkaLab/ruleset.skk.moe](https://github.com/SukkaLab/ruleset.skk.moe)。构建产物快照 fb2480119a3dd21e5f95f7eabf1ff98988e32289，2026-10-11 11:25:59 UTC。更新时间应取具体消费文件与产物分支，勿只取源码 HEAD。

## 下载可用性与验证边界补充

本次实际下载了 blackmatrix 的 Surge OpenAI、Shadowrocket GitHub、Clash OpenAI 文件，以及 SagerNet `geosite-anthropic.srs`（SRS 文件头有效），均返回 HTTP 200。Sukka domestic 的 Surge/Mihomo/sing-box 三种产物也均可下载。部分 `ruleset.skk.moe` global 与 AI IP 地址在当前网络返回 403，但相同产物的 GitHub Raw 地址返回 200：

- https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/master/List/non_ip/global.conf
- https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/master/sing-box/non_ip/global.json
- https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/master/List/ip/ai.conf

这表明应保留下载备用入口；不据一次 403 推断项目停更或所有用户不可用。SagerNet rule-set 实际提交为 df6851d87aeaeb9d6a9464288b317e7ff2288d78，2026-10-10 05:07:39 UTC，已独立验证产物分支仍在更新。

客户端格式核对依据：[Surge RULE-SET 官方文档](https://manual.nssurge.com/rules/ruleset.html)、[Mihomo rule-provider 官方文档](https://wiki.metacubex.one/config/rule-providers/)、[sing-box rule-set 官方文档](https://sing-box.sagernet.org/configuration/rule-set/)。Mihomo MRS 不适用于 legacy Clash Premium；sing-box 的 `.srs` 与版本化 JSON 不适用于其他客户端；完整配置的 DNS/TUN/策略结构不能仅靠改扩展名转换。
