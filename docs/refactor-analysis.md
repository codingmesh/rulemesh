# RuleMesh 全面分析：客户端使用价值与重构依据

日期：2026-10-12。源码基线：`ed766d95eaa8d1141fc5370b847805d7e8c417d2`。状态：分析完成，方案待评审，未实施重构。

本轮先撤销此前五个已跟踪文件的未提交修改和四个新模块，恢复干净工作区。随后只读分析源码、执行临时诊断与隔离内核实验。本文件不把此前口头评审直接当作事实。

## 1. 需求边界

目标是长期维护一套完整合理的分类 ruleset，结合成熟仓库的工程、数据和客户端设计，支持 Surge、Shadowrocket、Mihomo/Clash Verge Rev、sing-box，并允许自定义。节点、国家和 ISP 由使用者在客户端选择。完整配置引用分类 ruleset，不平铺全部规则。

工程直接扩展 Sukka 的 `Source → FileOutput → writer → public`，保留许可与归属；没有 Git upstream、自动合并参考仓库或第二套规则引擎要求。交付使用固定 HTTPS 站点及客户端原生机制，不引入 GitHub Release、多版本晋升或回滚演练产品。

用户价值的判断链路是：接入已有节点 → 请求命中正确服务 → 家族继承或单服务独立选择 → 国内/局域网行为正确 → 更新后节点和自定义保留。站点按钮存在、规则数量多、内核可以解析，都不能替代这条链路。

未经用户确定的 Minimal/Full 新档位、删除客户端支持、变更默认出口，不属于本轮既定需求。Standard/Advertising 继续作为已有档位。公开规则和本地节点凭证是不同内容，但不另建“私人规则产品层”。

## 2. 核查范围与证据等级

- **E1 原生复现**：实际 sing-box 1.14.3，通过回环入站和两个回环 HTTP 代理测到不同路由结果；没有启用系统代理或 VPN。
- **E2 现有函数复现**：直接调用 `FileOutput`、writer、compose、override 接口；输入均为假节点和测试域名。
- **E3 源码/产物核查**：阅读当前源码、文件集合、引用和工作流，足以证明结构事实；尚未运行的完整设备行为不标为已验证。
- **E4 待验证**：客户端选择持久、移动端性能、真实 DNS/UDP/IPv6 和订阅更新，列入后续验收。

`public/` 是被忽略的历史工作目录：本轮读取的 `deploy-check.txt` 为 `384dfbf25be7430c70ab13c2e9e2d7ddcab98e15`，并非源码基线。该目录的规模、旧 marker 和混合条件只能描述本地快照。关于当前 writer 的结论以当前源码重新生成的最小输入及 E1/E2 为准。没有假装重新完成线上、四客户端 GUI 或真实网络验收。

本轮 `pnpm exec tsc --noEmit` 通过，`pnpm test` 为 38 passing。这说明已覆盖行为仍通过；新增复现显示现有测试存在盲区。没有为纯文案增加测试。

## 3. 当前工程与真实增量

| 环节 | 当前实现 | 对使用者/维护者的价值 | 仍需核查的内容 |
| --- | --- | --- | --- |
| 规则输入 | 97 个 `.conf`，53 个 Meta 分类、11 个登记快照、33 个继承/人工源 | 细服务与通用分类可统一维护 | 手工、专项动态来源未形成完整输入目录 |
| 规则处理 | Sukka trie、关键词、白名单、CIDR 分桶及合并 | 同语义优化，保留 domainset/non_ip/ip | 关键词白名单错误、读取失败、未知类型 |
| 多格式 writer | 四主端；Surfboard/Legacy 部分输出 | 同一分类无需人工写四份 | 原生条件语义、平台限制和完整缺口 |
| 分类策略 | `routing-profile.ts` 的家族/服务组和顺序 | 改策略不改域名；跨端分类一致 | 重叠来源裁决和独立选节点能力 |
| 完整配置 | Shadowrocket 全配置；另三端 compose + 假节点模板 | 小火箭原生节点接入；维护者可生成配置 | 真实节点、DNS、捕获入口、重复组合与更新 |
| 维护 | Meta 固定 revision、带证据的 add/remove、候选 PR | 自有修正可持续、输入变化可审查 | 分类拼错、幂等 PR、准确提交校验 |
| 发布 | 同树同步生成仓库、Pages 标记、二进制固定哈希 | 固定 URL、可核对上线源码 | 输出集合依赖历史、完整生成 diff 不足 |
| 辅助功能 | Modules、Mock、测速、域名调查、MTProto 信息 | 部分用户可选；部分为维护诊断 | 不等于默认配置已使用或本项目独立维护 |

Sukka 是已采用的代码基础，MetaCubeX 是实际分类数据来源；blackmatrix7、Loyalsoldier、ACL4SSR、LOWERTOP、LingJingMaster、Johnshall、SagerNet 主要贡献设计/格式参考。不能把“研究过这些仓库”写成“运行时合并了全部仓库”。自有审阅 override 当前只有 `.claude.app` 一项，条目数量不代表整合工程没有价值，也不证明本项目比所有上游数据更完整。

本地公开快照四主端各有约 117–120 个规则文件，Surfboard/Legacy 各 51 个。Shadowrocket Standard 为 21 组、108 个远程引用、约 0.78 MB；Advertising 为 22 组、117 个引用、约 12.9 MB。此处只是资源规模，未测 iPhone 内存/延迟，不能直接断言广告档不适合移动端或规则拆分必然拖慢运行。

## 4. 客户端运行时分析

### 4.1 分组不等于任意独立选节点

当前小火箭 `anthropic = select,ai,node-selection,DIRECT,PROXY`，OpenAI 和 Gemini 也是同样的共享入口。Surge/Mihomo/sing-box 服务组也只枚举家族、总组及 DIRECT。用户可以切换这些成员，但不能据此承诺每个服务都能独立枚举全部真实节点。

三个服务分别使用三个不同节点，必须验证服务组实际有对应节点成员或独立的节点选择入口。默认继承家族与允许单服务覆盖应同时成立。当前只有总组的节点成员较明确；Shadowrocket 的 `policy-regex-filter` 及 PROXY 实际枚举范围需以指定客户端版本复验。[当前组选择实现](../Build/lib/client-config/routing-profile.ts)

### 4.2 数据与顺序的实际影响

本地快照按当前 reference 顺序做 DOMAIN/SUFFIX/KEYWORD 静态匹配（不是完整原生匹配器）得到：

| 请求 | 当前首个域名策略 | 需要解决的问题 |
| --- | --- | --- |
| `claude.ai`、`claudemcpcontent.com` | anthropic | 保留；验证 Desktop/MCP 实际请求及独立节点选择 |
| `api.openai.com`、`chatgpt.com` | openai | 域名属于单服务；Voice IP 也应归同策略 |
| `gemini.google.com` | gemini | URL 挑战端点与其他 Google 服务不可一律当等价 |
| `api.github.com` | ai-other | Sukka AI 先于 GitHub；普通 GitHub API 会受到 AI 选择影响 |
| `steamcdn-a.akamaihd.net` | games | 与 downloads 有重叠，当前不能声称游戏下载必走 downloads |
| `download.windowsupdate.com` | microsoft | 与其他 Microsoft 集合重叠，当前目标一致 |
| `qq.com` | china | 域名直连不等于未知中国目的 IP 都能直连 |

因此，补齐域名条目只是第一步；真正的组合优化要登记重叠意图、首匹配顺序和代表请求。不能通过跨策略去重、整后缀并集或分类名字推断达到正确分流。

### 4.3 接入与更新

- **Shadowrocket**：完整 `.conf` + 首页已有节点有原生依据；当前历史记录证明导入和部分 Test Rule 操作，尚不足以证明三服务三节点、真实 UDP、配置更新后选择/自定义永久保留。
- **Surge**：目前从底稿复制 Proxy/组，再添加 RuleMesh 组并替换 Rule。远程节点组与本 profile Proxy 是不同来源，必须显式包含；本地设置可通过 native detached profile 保护，不能用公开假节点代替接入。
- **Clash Verge Rev/Mihomo**：普通订阅是 YAML 配置，客户端扩展脚本可以在真实订阅之上生成组/providers/rules；这与导入一个无真实节点的 YAML 模板不同。应保留用户实际订阅的更新入口，验证每次更新重新应用规则。
- **sing-box**：真实 outbounds、DNS、客户端捕获方式和 selector 交付缺一不可。core 支持 JSON 合并不代表 GUI 支持统一订阅转换；Apple 官方客户端有 local/iCloud/remote profile 路径，不能强制所有人自找 HTTPS 托管。

规则内容刷新、整份 profile 结构更新、节点订阅更新和客户端选择持久是四种操作；验收必须分别记录。

## 5. 已确认问题

| ID | 级别/证据 | 事实及影响 | 当前代码 |
| --- | --- | --- | --- |
| A01 | 阻断/E1+E2 | sing-box 将独立域名和进程条件装进一个 headless object，形成合取；命中的域名会因进程不匹配落到兜底 | `writing-strategy/singbox.ts:97–148,176–225` |
| A02 | 高/E2 | keyword 白名单算出过滤结果，却仍输出原关键词集合；`blocked` 被白名单豁免后仍输出 | `rules/strategy-write-data.ts:81–92` |
| A03 | 高/E2 | 模拟读流在一条规则后抛错，`processFile` 只记录错误并返回部分规则 | `build-common.ts:65–97` |
| A04 | 高/E2+E3 | `FUTURE-TYPE` 入 `otherRules`；Surge 保留、sing-box 丢弃，当前缺口扫描只识别硬编码类型，不能覆盖未知项 | `rules/base.ts:236–300`; `build-client-config.ts:192–211` |
| A05 | 高/E2 | override 分类拼成 `anthropci` 时接受但未应用；缺少全目录分类校验 | `sync-sources.ts:17–29,80–92` |
| A06 | 高/E2+E3 | 97 个 `.conf` 中 64 个在两份登记表，33 个由上游整体归属但缺逐文件维护模式；动态源也未完整登记 | `sources/`; `acceptance.ts:87–107` |
| A07 | 高/E2 | Mihomo 合成第二次出现 21 个重复组；底稿 Rule/rules 静默替换，保留名碰撞和已有规则处理无统一契约 | `build-client-config.ts:130–178` |
| A08 | 高/E2+官方依据 | Surge 底稿仅有 Existing/policy-path 时被接受，RuleMesh-Nodes 却只有 include-all-proxies，无法包含那个外部组的节点 | `build-client-config.ts:132–135` |
| A09 | 高/E2 | sing-box 接受底稿 CN rule_set，但生成 rules 从不引用；保留定义不等于保留国内 IP 兜底 | `build-client-config.ts:168–178` |
| A10 | 高/E3 | 三端公开模板写入 replace.invalid:1，并用直接 Open & Import 发布；不能证明实际联网价值 | `build-client-config.ts:186–189`; `build-public.ts:756` |
| A11 | 高/E3 | 旧 public 整树作为本次工作目录，prune 只有手写删除清单；输出集合可能保留已无生产者的文件 | `main.yml:41–63`; `prune-output.ts` |
| A12 | 高/E3 | 固定来源与 build 时在线拉取混用，原始动态字节/hash没有形成每次构建记录 | `build-ai-cidr.ts:71–89`; `build-telegram.ts:11–68` 等 |
| A13 | 中/E3 | 缺口只审阅 category/type 增删，未覆盖每次调用/内容差异；缺原始 List 文件时跳过 | `build-client-config.ts:192–237` |
| A14 | 中/E3 | 生成 PR summary 只有 diff --stat；同 revision 未合并时 sync 可再次创建同名分支/PR，缺恢复逻辑 | `main.yml:108–116`; `sync.yml:35–44` |
| A15 | 中/E3 | Modules/DNS 衍生引用仍指向 ruleset.skk.moe；实际可选内容与本项目独立发布边界不明确 | `Modules/sukka_enhance_adblock.sgmodule`; `build-domestic-…:252,304` |
| A16 | 中/E3 | 客户端路径/扩展名/scheme/状态散在生成、CLI、网页、验收；配置任务承担渲染/QR/缺口扫描/审批 | `build-client-config.ts`; `build-public.ts`; `config-cli.ts`; `acceptance.ts` |
| A17 | 中/E3 | 验收将 Open 文案次数作为通过条件，却没检查独立选节点、重复组、混合语义和入口是否真实可用 | `acceptance.ts:21–34`; `native-routing.ts:61–70` |
| A18 | 中/E3 | 当前 index 每次写当前时间；同源码同动态输入仍可产生无意义站点 diff。Surfboard/Legacy 新 domainset 未覆盖，且没有等价验收 | `build-public.ts:754`; `rules/domainset.ts:10–16` |

### 原生复现实例 A01

当前 writer 接收 `DOMAIN,domain.example` 和 `PROCESS-NAME,curl`，生成一个同时含 `domain` 和 `process_name` 的对象。实验配置以 `candidate` rule_set 路由到回环 hit 代理，其他请求到回环 fallback 代理。由 Node 发起到 `domain.example` 的 HTTP 请求：

```json
{"core":"sing-box 1.14.3","actualWriterRoute":"fallback","independentConditionsRoute":"hit","requestProcess":"node (not curl)","systemProxyChanged":false}
```

对照只将两个独立条件写成两个 rules 对象，其他配置相同。此结论与官方 headless 匹配规则一致：域名/IP 家族内部可为或，但与 process/network 等其他字段合取。[官方 headless rules](https://sing-box.sagernet.org/configuration/rule-set/headless-rule/)

这里的错误属于可表达语义的转换缺陷，不能用“批准能力缺口”豁免。对不可表达语义，才允许明确、按来源审阅的差异。

## 6. 修正此前不严谨的判断

1. A03 证明的是读取/预处理错误被吞；`processLine` 只是行预处理，规则解析在后续 `addFromRuleset`。不能据此说“任意坏规则行都会在这个 catch 被吞”。
2. `noop` 不是一概错误：domain-only 投影可以有明确不选取字段；有问题的是需要交付的语义无诊断消失、投影缺少合同、未知类型绕过检查。
3. 33 个未逐文件登记源仍有 Sukka 整体版权/提交依据，不能写成“33 个无来源或违法源”。需要补的是维护归属与实际数据链。
4. Sukka 明确采用旧产物保持日期/测速覆盖/Mock 后备；借鉴合理。错误在于旧目录决定当前文件集合。重构应把这些用途作为显式输入保留，不能一刀切删除。
5. 无 DNS/inbounds/Clash API 字段的节点底稿结果，不一概证明官方 GUI 不可运行；GUI 可注入部分参数。需要按实际客户端定义责任，而不是把 headless 和 GUI 当同一个目标。
6. 旧 iCloud Downloads 中 `Shadowrocket.conf` 是 Hackl0us 旧文件，未证明它就是用户当前 active config。之前把它当当前配置比较、不经验证宣称全面提升，依据不足。
7. 21 个组/108 个资源并不自动等于过度设计；实际必要性由独立选节点、分类边界、资源刷新和性能测量判断。没有本轮依据要求新增 Minimal 或删除广告档。
8. 当前 GitHub 官方文档对 GITHUB_TOKEN 创建 PR 有需要批准的触发状态；不能仅凭过去规则断言永远不触发。必须检查候选提交是否确实运行质量门禁。[官方触发说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)

## 7. 仍需实施前/验收时核实

- Shadowrocket/macOS 与 iOS 的所有节点枚举、服务三节点独立选择、重载/更新后的选择与本地规则保留。
- Surge 指定版本 detached include、远程组包含、本地 profile 保护；iOS 与 Mac 能力并不全相同。
- Clash Verge Rev 指定版本脚本安装/更新入口、provider-only 订阅、GUI 切换持久与订阅刷新重应用。
- sing-box 指定 GUI 与 core 入口区别、启动下载 DNS、TUN/Fake-IP、UDP、IPv6、selector 持久、CN 数据许可与接入。
- Shadowrocket 关于 PROCESS/UA/URL/复合规则的版本/平台范围；Surfboard/Legacy 能力矩阵与保留理由。
- 两份手动辅助 workflow 的 `background`/`wait` 写法在当前 GitHub Actions 的实际可执行性，以及是否仍服务于本项目维护需求。
- 干净输出与旧树输出差异、新鲜动态字节可重放、所有可选模块内部/外部引用与许可。
- 广告档首加载/刷新耗时、内存、误拦截、允许名单作用范围。不能用条数代替这些指标。

## 8. 设计依据

已有研究继续保留：[主流仓库研究](research.md)、[完整覆盖研究](research-complete-coverage.md)、[Sukka 完整核查](sukka-full-audit.md)。现行采用清单包含过时 `sources/owned` 等描述，不能代替现状代码。

本轮新增的原生接入依据：

- [Surge policy including](https://manual.nssurge.com/policy-groups/policy-including.html)：区分 Proxy 与外部组成员。
- [Surge profile format](https://manual.nssurge.com/profile/format.html)：detached/linked profile 可以分别维护节点、本地设置、远程规则；混合 include 和远程 include 有版本边界。
- [Clash Verge Rev script 官方源码文档](https://github.com/clash-verge-rev/clash-verge-rev.github.io/blob/main/docs/guide/script.md)：脚本 main 接收真实 config；不支持网络/文件 IO。
- [Clash Verge Rev URL scheme](https://clash-verge-rev.github.io/guide/url_schemes.html)：install-config 导入的是配置，不是任意扩展脚本。
- [sing-box configuration](https://sing-box.sagernet.org/configuration/) 和 [官方客户端 profile](https://sing-box.sagernet.org/clients/general/)：原生 merge 与 local/iCloud/remote 是不同层的能力。

全面核查结论：保留 Sukka 基础和多客户端整合价值；先保证匹配语义、真实节点接入、更新持久和来源/产物闭合，再解决重复结构。单纯把两个大文件拆成更多文件不能解决这些问题。
