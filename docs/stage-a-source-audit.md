# 阶段 A：首批分类与上游输入审计

核查日期：2026-10-11（America/Los_Angeles）。方法：下载固定提交下的公开文本，统计实际规则类型，阅读上游构建工作流、原始服务清单、根许可证及官方服务网络要求。未执行上游脚本，未将规则导入客户端，本文不证明运行时分流行为。

## 决策

首批采用 Sukka 的 LAN / 国内 / 通用境外数据和 MetaCubeX 的五个服务域名清单。它们可支持八个分类的离线数据管线，但目前不是完整网络分类数据库：国内 IPv6、Telegram IP、OpenAI Voice IP 和 OpenAI 正则端点等仍需要后续明确来源与能力支持。不能把文本导入成功写成覆盖全部业务流量。

Sukka 国内与境外文件含 v1 不支持的类型，必须提前声明 `domain-view` 并列出未选择条目。MetaCubeX `.list` 自身也是域名视图，OpenAI 的原始 geosite 存在该视图没有携带的正则。此范围选择是项目决策，不是导入器遇到错误时的自动降级。

## 1. 固定快照与下载入口

| 用途 | 仓库 / 分支 | 实际固定提交 |
|---|---|---|
| Sukka 可下载产物 | `SukkaLab/ruleset.skk.moe` / master | `fb2480119a3dd21e5f95f7eabf1ff98988e32289` |
| Sukka 对应源码参考 | `SukkaW/Surge` / master | `6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62` |
| MetaCubeX 域名产物 | `MetaCubeX/meta-rules-dat` / meta | `b4d414227a182c5bc954283e4a83ee176dad671b` |
| MetaCubeX 构建与许可 | `MetaCubeX/meta-rules-dat` / master | `4178770badecb1b349fbcd62c737e0d7a2079729` |
| v2fly 原始服务清单交叉核查 | `v2fly/domain-list-community` / master | `c6adacf29cc4fb05e04651fcf03e00989ef9f797` |

元数据通过 GitHub REST API 核查。最后一项是核查时的源码快照，不能证明它就是 MetaCubeX 当次构建实际拉取的提交；MetaCubeX 工作流未将这些 transitive 输入提交写入产物。本项目锁定实际消费的产物字节，单独记录其已知来源链及这个溯源限制。

Sukka 固定下载前缀：

`https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/fb2480119a3dd21e5f95f7eabf1ff98988e32289/`

MetaCubeX 固定下载前缀：

`https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/b4d414227a182c5bc954283e4a83ee176dad671b/`

阶段 A 使用固定提交地址和本地快照；`ruleset.skk.moe`、分支 `master/meta` 和 latest 不进入可重现构建。备用入口必须最终核对同一个 SHA-256，不能因下载失败改用更新后的文件。

## 2. 八个分类的文件映射

以下条数为原始非注释规则行，未去重、未应用自定义操作。Sukka 每个 List 中的一条作者标记域名也计算在内。

| 分类 | 精确路径 | 实际类型 / 数量 | 消费范围 |
|---|---|---|---|
| private 域名 | [`List/non_ip/lan.conf`](https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/fb2480119a3dd21e5f95f7eabf1ff98988e32289/List/non_ip/lan.conf) | DOMAIN 12、SUFFIX 38 | 完整域名输入；不含正则、关键词 |
| private IP | [`List/ip/lan.conf`](https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/fb2480119a3dd21e5f95f7eabf1ff98988e32289/List/ip/lan.conf) | DOMAIN 1、IPv4 CIDR 8、IPv6 CIDR 3 | 完整规则输入；目录名不能代替类型检查 |
| china 域名 | [`List/non_ip/domestic.conf`](https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/fb2480119a3dd21e5f95f7eabf1ff98988e32289/List/non_ip/domestic.conf) | DOMAIN 27、SUFFIX 841、WILDCARD 1、USER-AGENT 3 | 显式域名视图；不选择 wildcard / UA |
| china 地理 IPv4（候选） | [`List/ip/china_ip.conf`](https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/fb2480119a3dd21e5f95f7eabf1ff98988e32289/List/ip/china_ip.conf) | DOMAIN 1、IPv4 CIDR 3904 | CC BY-SA 2.0 独立数据；不混入统一 AGPL 产物 |
| china 补充 IP（候选） | [`List/ip/domestic.conf`](https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/fb2480119a3dd21e5f95f7eabf1ff98988e32289/List/ip/domestic.conf) | DOMAIN 1、IPv4 CIDR 2 | 两条 IP 都有 no-resolve；用途与 geographic 分开 |
| global | [`List/non_ip/global.conf`](https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/fb2480119a3dd21e5f95f7eabf1ff98988e32289/List/non_ip/global.conf) | DOMAIN 8、SUFFIX 1257、KEYWORD 9、USER-AGENT 1 | 显式域名视图，保留关键词；不选择 UA |
| anthropic | [`geo/geosite/anthropic.list`](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/b4d414227a182c5bc954283e4a83ee176dad671b/geo/geosite/anthropic.list) | 精确域名 1、后缀 8，共 9 | MetaCubeX 域名视图 + 官方 claude.app 补充 |
| openai | [`geo/geosite/openai.list`](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/b4d414227a182c5bc954283e4a83ee176dad671b/geo/geosite/openai.list) | 精确域名 9、后缀 13，共 22 | 域名视图；原始 regexp / Voice IP 尚未覆盖 |
| github | [`geo/geosite/github.list`](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/b4d414227a182c5bc954283e4a83ee176dad671b/geo/geosite/github.list) | 精确域名 32、后缀 33，共 65 | 含 Copilot、npm 和遥测的上游合集 |
| telegram | [`geo/geosite/telegram.list`](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/b4d414227a182c5bc954283e4a83ee176dad671b/geo/geosite/telegram.list) | 后缀 21 | 域名视图；不是 Telegram IP 完整集 |
| youtube | [`geo/geosite/youtube.list`](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/b4d414227a182c5bc954283e4a83ee176dad671b/geo/geosite/youtube.list) | 精确域名 1、后缀 177，共 178 | 含媒体 CDN、地区域名、广告端点 |

`china` 名称表示上游已知国内可用域名，不代表所有中国注册域名，也不能仅凭这个集保证全部国内流量直连。`global` 是上游整理的通用境外服务集，不是所有非中国 IP 的集合。

## 3. 类型与评估要求不能自动改写

Sukka `domestic` 未选择的四行是：`DOMAIN-WILDCARD,qhimgs?.com` 和三条 USER-AGENT（优酷、手机淘宝、TeslaMap）。`global` 未选择的行是 `USER-AGENT,Roam*`。coverage 报告应同时保存类型、原始行号和文本，未来上游新增不支持类型时需要重新审阅，不能只凭固定排除数量通过。

Sukka List 的作者标记是一个真实 DOMAIN 规则：`7h15.ru1353t.1s.m4d3.by.5ukk4w.skk.moe`。原样保留会在多个分类产生相同域名重叠。如决定去掉，应以可追踪的公共 `remove-entry` 记录，指定 source ID 和理由，不能把它偷偷当成注释。

`lan.conf` 的 11 条 CIDR 都没有 no-resolve，按本项目设计应导入为 `resolve-allowed`。若需在早期局域网保护使用 existing-only，必须是有证据的项目评估计划/覆盖，保留原始来源要求并报告差异；不能因文件叫 LAN 就把字段改写。补充国内 IP 的两条 no-resolve 应保留为 existing-only；中国地理 IPv4 的普通 CIDR 保留 resolve-allowed。

Meta `.list` 的普通主机名是精确域名，`+.` 前缀表示根域及子域后缀。不得把普通主机名一律变成后缀。它适用于 Mihomo 的 domain 视图，不含独立经典规则行或 IP 解析选项。四客户端产生的 IP 数据与路由配置应分别声明支持状态。

## 4. MetaCubeX 数据来源链与覆盖缺口

实际[构建工作流](https://github.com/MetaCubeX/meta-rules-dat/blob/4178770badecb1b349fbcd62c737e0d7a2079729/.github/workflows/run.yml)从 v2fly domain-list-community 构建完整 `geo`；另有 blackmatrix 等对 cn、onedrive、steam、tracker、httpdns 等分类的替换。上述五个服务不在这些替换步骤内，能与本次核查的 v2fly 文件交叉对应。`geo-lite` 是另一条管线，GitHub/OpenAI/Telegram/YouTube 大量直接取自 blackmatrix；不能与 `geo` 混淆，也不能依据主仓库 GPL-3.0 抹去数据原有许可。

重要范围差异：

- [v2fly OpenAI](https://github.com/v2fly/domain-list-community/blob/c6adacf29cc4fb05e04651fcf03e00989ef9f797/data/openai)有一条匹配 Azure Web PubSub 动态主机的 regexp；Meta `.list` 的 22 行中没有它。现阶段明确选择纯域名视图，记载不覆盖该动态端点；不将正则泛化成 `azure.com` 后缀。
- [v2fly GitHub](https://github.com/v2fly/domain-list-community/blob/c6adacf29cc4fb05e04651fcf03e00989ef9f797/data/github)包含 `github-copilot` 和 `npmjs` 子集。这解释了 65 行产物的范围，GitHub 分类说明必须包含这两类服务，待独立 npm/Copilot 分类加入后再决定拆分。
- [v2fly Telegram](https://github.com/v2fly/domain-list-community/blob/c6adacf29cc4fb05e04651fcf03e00989ef9f797/data/telegram)还包含 TON / Fragment / Graph 等生态域名；不是只包含聊天客户端。
- [v2fly YouTube](https://github.com/v2fly/domain-list-community/blob/c6adacf29cc4fb05e04651fcf03e00989ef9f797/data/youtube)把部分域名附上 `@ads` / `@cn` 属性，Meta domain 文件只保存匹配数据。RuleMesh 当前将整个服务分类用作路由分类，不作为广告阻断分类；若以后从它生成阻断规则，须消费并保留原始属性，而不能猜测。

这些范围选择应留在注册表和生成报告中。追踪字段、省略的正则和 include 来源不能根据展开后的纯域名文本恢复；需要这些能力时重新锁定原始 geosite 输入及依赖。

## 5. Anthropic 官方补充

[Claude Desktop 官方网络要求](https://code.claude.com/docs/en/desktop#network-access-requirements)明确要求 `claude.app` 根域及其子域；当前锁定的 [Meta Anthropic](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/b4d414227a182c5bc954283e4a83ee176dad671b/geo/geosite/anthropic.list)缺少该后缀。建议增加一条 `domain-suffix: claude.app`，reason 记录 Desktop 网络要求，checked-at 使用本次核查日期。这是官方事实支持的自有补充，覆盖实例可用 `livepreview.claude.app` 检查。

官方说明也涉及用户内容和 MCP 内容的动态子域，已有 Meta 后缀可覆盖这些范围。共享字体、JavaScript CDN 属于官方说明的可选外部资源，不宜把整个 Google Fonts、jsDelivr、Cloudflare 等平台后缀放入 Anthropic 专属组。官方文档会变化，自有补充应定期复核，不能保证未来完全覆盖。

## 6. 许可、通知与发布边界

本节记载上游声明和项目发布约束；未做完整法律审查。许可文本和来源链要随快照保存，发布前再次检查实际输入组合。

- Sukka 根[LICENSE](https://github.com/SukkaLab/ruleset.skk.moe/blob/fb2480119a3dd21e5f95f7eabf1ff98988e32289/LICENSE)是 GNU AGPL 第 3 版，各选中普通 List 头亦标明 AGPL 3.0；源仓库[README](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/README.md)对中国 IPv4 文件单独声明 CC BY-SA 2.0。不能以 package.json 的 ISC 字段替代这些规则许可。
- MetaCubeX 根[LICENSE](https://github.com/MetaCubeX/meta-rules-dat/blob/4178770badecb1b349fbcd62c737e0d7a2079729/LICENSE)是 GNU GPL 第 3 版；产物 meta 分支没有同样的根文件，仍须记录源码仓库声明及具体来源。五个 `geo` 服务集的基础 v2fly [LICENSE](https://github.com/v2fly/domain-list-community/blob/c6adacf29cc4fb05e04651fcf03e00989ef9f797/LICENSE)为 MIT，版权所有者 V2Ray。保留 MIT 通知并记录 MetaCubeX 转换链，不能自动将该产物改标为只有 MIT。
- 不选 blackmatrix `geo-lite`。其 GPL-2.0 数据不能因为经过 Meta 转换就按 GPL-3.0 或 AGPL-3.0 随意合并。没有逐来源许可证据前不导入或发布。
- `china_ip.conf` 的头部声明来源为 chnroutes2 CDN 和 CC BY-SA 2.0。但上游 chnroutes2 核查提交 `77a36db3e2c9681c1efcba66fec146a4dc62c3ec` 的[根 LICENSE](https://github.com/misakaio/chnroutes2/blob/77a36db3e2c9681c1efcba66fec146a4dc62c3ec/LICENSE)实际是 CC BY-SA 4.0，版权所有者 Misaka Network, Inc.；同提交的 [README](https://github.com/misakaio/chnroutes2/blob/77a36db3e2c9681c1efcba66fec146a4dc62c3ec/README.md)仍链接 2.0。这个版本归属矛盾尚未解决，不能只依赖 Sukka 头部作为完整许可结论。保留证据并暂缓发布该候选；确认适用许可后仍须保留作者/来源、许可及修改说明，独立于 AGPL/GPL 数据发布，不能把它放入一个宣称纯 AGPL 的统一文件。
- 本项目自写工具许可与规则数据许可分开决定。需要复制 AGPL/GPL 数据时，保存固定原始输入、变换说明和可重现工具；向用户提供相应源码/通知。AGPL 与 GPL 第 3 版的组合不能简单省略其中一种许可，是否构成组合与聚合应按实际产物检查。[GNU GPLv3 文本第 13 节](https://www.gnu.org/licenses/gpl-3.0.html#section13)是相关原文依据。

## 7. 阶段 A 应保留的阻断与待办

1. 注册表显式记录 domestic/global 的 domain-view 及 OpenAI 已知 regexp 缺口，不能宣传为全量无损导入。
2. private IP 的原始解析要求必须保留。早期地址保护策略需要客户端能力验证，尚无证据就只发布数据/离线模型。
3. 国内 IPv4 上游 CC BY-SA 2.0 / 4.0 声明矛盾及独立许可产物未落实前，不发布；中国 IPv6 尚无本次审计的确定输入。
4. Telegram / OpenAI Voice 的 IP 源后续单独核查，含 ASN 的输入不得自动降级成 IP 列表。
5. 上游词条不等于官方确认：OpenAI 中 `crixet.com`、Telegram 的 TON 等生态条目来自上游，先保留来源范围并供维护者审阅；没有证据就不扩大到共享平台整站。
6. 下载成功、规则类型合法和哈希锁定只能作为静态验证；客户端格式和实际 DNS/路由行为由兼容性任务验证，未验证目标保持 experimental。

本次没有添加配置、修改正在使用的 Shadowrocket 或创建 GitHub 仓库。后续实现以仓库中的 source registry、lock 和 coverage 报告为实际状态；本文是来源审计依据。
