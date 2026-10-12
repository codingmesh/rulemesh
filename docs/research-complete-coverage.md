# 多仓库完整配置与分类覆盖研究

核查日期：2026-10-11。本文补充 research.md，限定为公开仓库、作者原始文件、服务官方说明及客户端官方文档。候选表表示可核查输入，不表示已接入、已获得全部转许可确认或通过真实客户端验证。

## 交付边界

用户要求是完整配置订阅：导入 Shadowrocket config URL 或对应二维码，使用已有节点，在客户端调整各服务策略；公共来源与自定义规则长期维护，另外提供 Surge、Mihomo、sing-box 的适合各客户端的交付。8 分类实验版不能代表这一目标完成。

优化至少同时覆盖分类、优先级、DNS/地址匹配、节点选择、整体更新、自定义持久性和验证。多个仓库分别提供数据、分类或配置经验，不要求把每个仓库的数据全部合并，也不把一个仓库的结构参考当成唯一数据来源。默认配置应适合移动端；巨量拦截、地区流媒体和额外服务可提供扩展档。

## 仓库角色与取舍

| 上游 | 应取用的部分 | 完整配置能力 | 需要保留的限制与许可 |
|---|---|---|---|
| [SukkaW/Surge](https://github.com/SukkaW/Surge) 与 [SukkaLab 产物](https://github.com/SukkaLab/ruleset.skk.moe) | LAN/国内/境外、CDN/下载与服务 IP 分层、统一生成思路 | 规则与片段为主，不能直接作为完整 Shadowrocket 配置 | AGPL-3.0；China IP 文件另声明 CC BY-SA 2.0，与部分原始来源需逐项核对；UA/process/wildcard/regex 不得静默删除 |
| [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) | 细服务、属性子集、MRS/SRS；适合多数跨客户端域名分类的主源 | README 给规则与 DNS 示例，未提供个人节点绑定完整通用配置 | GPL-3.0；full geo 与 geo-lite 来源不同；部分分类已整合 blackmatrix，不能称作完全独立交叉证据 |
| [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script/tree/master/rule/Shadowrocket) | 服务粒度及 Shadowrocket 原生文件对照、开发/游戏/社交/专项修正 | 以规则集为主 | 根 LICENSE 为 GPL-2.0 文本；具体来源与版本条款需确认，不推定可与 GPL-3.0/AGPL 同一文件混合改许可；有的 `.list` 必须配 `_Domain.list` |
| [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules) | private/direct/proxy/reject、China CIDR 的基础划分及白/黑名单兜底对照 | provider 与 rules 示例 | GPL-3.0；YAML payload 必须按 domain/ipcidr/classical 区分；不叠加第二份巨量通用库冒充优化 |
| [LingJingMaster/Shadowrocket-Rules](https://github.com/LingJingMaster/Shadowrocket-Rules) | 可分享完整 config、空 Proxy 节、PROXY/组层次、update-url | 可直接导入后单独添加首页节点/订阅 | MIT 适用于其原创文件，引用第三方规则不因此改许可；默认地区出口和 MITM/重写不照搬 |
| [LOWERTOP/Shadowrocket](https://github.com/LOWERTOP/Shadowrocket) | 懒人配置、配置导入/包含/更新语义、节点选择方法 | lazy.conf/lazy_group.conf 为 Shadowrocket 整份配置 | 非官方社区维护手册；本次仓库树未见 LICENSE，作为行为参考，勿直接重发布整份内容 |
| [Johnshall/Shadowrocket-ADBlock-Rules-Forever](https://github.com/Johnshall/Shadowrocket-ADBlock-Rules-Forever/tree/release) | 国内外/回国/拦截模式的完整交付、同步懒人配置经验 | release 有 sr_cnip、sr_adb、仅去广告等整份配置 | LICENSE 明示 CC BY-SA 4.0；模板分类较粗，单纯每日重建不表示所有条目逐日复核 |
| [ACL4SSR/ACL4SSR](https://github.com/ACL4SSR/ACL4SSR/blob/master/Clash/config/ACL4SSR_Online_Full.ini) | 主策略→服务组→节点的层次，FCM/游戏/媒体/下载拆分 | `.ini` 是订阅转换器配置，不是可直接导入的 Clash YAML | [README](https://github.com/ACL4SSR/ACL4SSR#license) 明示 CC BY-SA 4.0，即使根目录无 LICENSE 文件；不绑定其地区或测速默认 |
| [SagerNet/sing-geosite](https://github.com/SagerNet/sing-geosite/tree/rule-set) | sing-box 原生 SRS 备选、原始 geosite 属性对照 | 数据产物，非完整配置 | [LICENSE](https://github.com/SagerNet/sing-geosite/blob/main/LICENSE) 明示 GPL-3.0-or-later；rule-set 活跃度与 main 分开判断 |

以上角色由各仓库 README、具体配置、发布分支与 LICENSE 核对。许可元数据只描述作者声明；复制改造前还需消费文件的实际来源记录。可分别引用或分别发布不兼容许可的原始集合，不能一律标 MIT。

## 可复现的文件树证据

本次 GitHub Trees API 核对到以下快照，与已有输入可共用同一 pin：

| 仓库/分支 | commit | 树核查 |
|---|---|---|
| SukkaLab/ruleset.skk.moe master | fb2480119a3dd21e5f95f7eabf1ff98988e32289 | 未截断；List/non_ip、List/ip、List/domainset 分别检查 |
| MetaCubeX/meta-rules-dat meta | b4d414227a182c5bc954283e4a83ee176dad671b | 根递归树 **被截断**，不能以根结果认定 geo 分类不存在 |
| blackmatrix7/ios_rule_script master | 83f37120c155f67c8eef43221dabe15cc3c95fec | 本次 Shadowrocket 分类目录可见 |
| Loyalsoldier/clash-rules release | 95e5d6a50402b221b277e0752626cdbd9b84a528 | private/direct/proxy/reject/lancidr/cncidr 等文件可见 |
| LingJingMaster/Shadowrocket-Rules main | c61257022f647a825be423a84253386b9d3adc03 | Shadowrocket.conf、MIT LICENSE |
| LOWERTOP/Shadowrocket main | 10d845ffca79413fc50827b4852dfa6bb1d1d24a | README.md、lazy.conf、lazy_group.conf，无根 LICENSE |
| Johnshall release | e0c71d555d42a2a48dbf245c3c3d0070e892afb9 | 完整配置族与 LICENSE |
| ACL4SSR master | 802e3abf065f8609e7d9073ba506158dbe2ba6e7 | Clash/config、Clash/Ruleset、Clash/Providers |
| SagerNet/sing-geosite rule-set | df6851d87aeaeb9d6a9464288b317e7ff2288d78 | 原生 geosite-*.srs |

Meta 的 geo 树 SHA 为 `e0d11412c3f4007bdcc1d8a6210d5a2b7186bb6d`；geosite 树 SHA 为 `76abf5933e0efda02ffe16b09cedab8da1a161ce`；geoip 树 SHA 为 `bf1394e3f260117a31689d6fcb271ad4657f2be7`。使用 [geo 子树递归 API](https://api.github.com/repos/MetaCubeX/meta-rules-dat/git/trees/e0d11412c3f4007bdcc1d8a6210d5a2b7186bb6d?recursive=1) 得到未截断结果。

## 完整常用分类的候选映射

下表的 Meta 文件均在上述同一固定提交的 [geo/geosite 目录](https://github.com/MetaCubeX/meta-rules-dat/tree/b4d414227a182c5bc954283e4a83ee176dad671b/geo/geosite) 存在。文件名必须精确使用，不能猜 `gemini.list`、`copilot.list` 或 `applemusic.list`。

固定原文 URL 为 `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/b4d414227a182c5bc954283e4a83ee176dad671b/geo/geosite/` 加下表文件名。`.list` 为域名视图；需要原始正则等能力时另核对 `geo/geosite/classical/`、上游原始 geosite 或原生 SRS，不把视图称为全部语义。

| 分类族 | 精确候选文件 | 配置拆分与交集处理 |
|---|---|---|
| AI 专项 | anthropic.list、openai.list、google-gemini.list、github-copilot.list、xai.list、perplexity.list | 独立服务放平台大组之前；Gemini 属 Google，Copilot 属 GitHub，不能被宽平台提前吞掉 |
| AI 其他 | category-ai-chat-!cn.list、category-ai-!cn.list、category-ai-cn.list、apple-intelligence.list | 细组优先，其他 AI 为后置合集；国内 AI 与国际 AI 分组但用户可改策略；AI 合集可能含共享遥测 |
| Apple | apple-cn.list、icloud.list、apple-music.list、apple-tvplus.list、apple.list | 国内资源、云同步、媒体和国际服务按用途分离；Apple Intelligence 在 Apple 总组前 |
| Google | google-gemini.list、googlefcm.list、google-cn.list、google.list | Gemini/YouTube/FCM 先于 Google；FCM 单独供选择；Google 总组不能代表所有都需同一出口 |
| Microsoft | onedrive.list、bing.list、microsoft.list | 云盘、搜索/AI 与普通平台分离；微软域名合集不等于只包含 Copilot |
| 开发与代码 | github-copilot.list、github.list、gitlab.list、jetbrains.list、category-dev.list | Copilot 先于 GitHub；GitHub 上游含 npm 等生态，应记录合集范围；开发合集最后覆盖其余工具 |
| 包与容器 | npmjs.list、python.list、docker.list | 独立于代码托管；部分 CDN 精确域名属于云服务，服务组先于通用云/CDN |
| 云与存储 | aws.list、cloudflare.list、digitalocean.list、onedrive.list、icloud.list | 大型共享云后缀不能直接归入某个 AI/媒体服务；存储细组优先，云服务不承诺特定地域 |
| 通信社交 | telegram.list、discord.list、whatsapp.list、twitter.list、facebook.list、instagram.list、reddit.list | Telegram 域名不覆盖 IP 直连协议；Facebook/Instagram 重叠由细组优先或父组继承决定 |
| 视频与直播 | youtube.list、netflix.list、disney.list、hbo.list、primevideo.list、twitch.list、tiktok.list | 主服务独立、其他媒体后置；服务 IP 和客户端 UA 不能用域名输出替代 |
| 音乐 | spotify.list、apple-music.list | Apple Music 与 Apple 总组交集；需要更多音乐时有具体服务集再扩展 |
| 国内媒体 | bilibili.list、biliintl.list、category-media-cn.list | 国际 Bilibili 与国内区分；按服务先于国内宽合集；不是自动解锁保证 |
| 游戏 | steam@cn.list、steam.list、epicgames.list、playstation.list、xbox.list、nintendo.list、category-games.list | 国内下载与账号/对战区别；Steam CN 放 Steam 前，Xbox 放 Microsoft 前；游戏合集最后 |
| 通用 CDN | category-cdn-cn.list、category-cdn-!cn.list | 共享 CDN 应后置；可以同策略但不能扭曲服务归属 |
| 国内/境外基础 | private.list、cn.list、geolocation-!cn.list | 与 Sukka 基础库二选一为主，不能随意并集两个大库后消除所有细分类 |
| 可选拦截 | category-ads-all.list；Sukka 分层拦截与 blackmatrix 专项做对照 | 默认轻量配置与扩展广告配置分开；不将整个共享遥测后缀无区别阻断 |
| 可选扩展 | category-scholar-!cn.list、category-public-tracker.list、category-speedtest.list | 学术/BT/测速用途明确，不强制默认开所有分类 |

对应 Meta [geoip](https://github.com/MetaCubeX/meta-rules-dat/tree/b4d414227a182c5bc954283e4a83ee176dad671b/geo/geoip) 有 `telegram.list`、`netflix.list`、`private.list`、`cn.list` 及 classical 变体。IP 类来源和许可追溯、`existing-only`/`resolve-allowed` 及端口限制单独审核，不从域名分类默认推断。

本次原文抽查：`google-gemini.list` 46 行、`github-copilot.list` 6 行、`category-dev.list` 666 行、`category-ai-chat-!cn.list` 189 行、`category-cdn-!cn.list` 195 行、`category-ads-all.list` 902 行；`cn.list` 有 111,595 行。这里统计输入行数，不等于唯一服务或命中完整性。`geo/geosite/classical/openai.list` 的 23 条包括 `DOMAIN-REGEX,^chatgpt-async-webps-prod-\S+-\d+\.webpubsub\.azure\.com$`，plain `openai.list` 不含该正则。因此现有 OpenAI 域名视图可以明确保留缺口，也可以增加支持该类型的转换，不能声称两份语义完全相同。[OpenAI classical 原文](https://github.com/MetaCubeX/meta-rules-dat/blob/b4d414227a182c5bc954283e4a83ee176dad671b/geo/geosite/classical/openai.list)。

Sukka 精确候选来自 [固定 List 树](https://github.com/SukkaLab/ruleset.skk.moe/tree/fb2480119a3dd21e5f95f7eabf1ff98988e32289/List)：

- 基础：`non_ip/lan.conf`、`ip/lan.conf`、`non_ip/domestic.conf`、`non_ip/global.conf`；现有主要源可以保留，并与 Loyalsoldier/Meta 的同类集合比较缺口。
- 国内资源：`non_ip/domestic_cdn.conf`、`non_ip/apple_cn.conf`、`non_ip/microsoft_cdn.conf`，以及 `domainset/apple_cdn.conf`。**`non_ip/apple_cdn.conf` 已废弃，仅注释且零条规则**，不能用它填充 Apple CDN 分类。
- 下载与 CDN：`domainset/download.conf`、`domainset/game-download.conf`、`domainset/cdn.conf`；辅助 `non_ip/download.conf`、`non_ip/cdn.conf` 与 `ip/download.conf`、`ip/cdn.conf`。域名集合先核实 exact/suffix 表达；辅助 non_ip 含 wildcard/URL-REGEX，当前 4 原子模型不能完整处理。
- 细服务：`non_ip/apple_services.conf`、`non_ip/apple_intelligence.conf`、`non_ip/microsoft.conf`、`non_ip/gitlab.conf`、`non_ip/telegram.conf` 与 `ip/telegram.conf`。
- 媒体：`non_ip/stream.conf`、`ip/stream.conf`，及 `stream_us/hk/tw/jp/kr/eu/biliintl.conf` 各 non_ip/ip 分层；地区是服务覆盖范围，不能直接绑定用户出口国家。
- AI：`non_ip/ai.conf` 与 `ip/ai.conf` 作缺口对照。AI 域名有 URL-REGEX，IP 有 ASN；其合集不可替代独立 Anthropic/OpenAI，也不能静默转成仅 CIDR 的等价产物。

blackmatrix 对照采用 [固定 Shadowrocket 目录](https://github.com/blackmatrix7/ios_rule_script/tree/83f37120c155f67c8eef43221dabe15cc3c95fec/rule/Shadowrocket)：`Developer/Developer.list`、`Docker/Docker.list`、`Npmjs/Npmjs.list`、`GitLab/GitLab.list`、`Atlassian/Atlassian.list`、`Discord/Discord.list`、`Game/Game.list`、`Steam/Steam.list`、`Gemini/Gemini.list`、`GoogleFCM/GoogleFCM.list` 等。抽查 Apple.list 与 AdvertisingLite.list 的头部统计包含域名条数，文件正文却为剩余类型；必须检查同目录 `_Domain.list`。不能声称只读 `.list` 就得到全部规则，也不能根据文件更新时间推断全仓库服务覆盖已及时更新。

## 官方服务 IP 补充与范围

Telegram 官方提供 [CIDR 原文](https://core.telegram.org/resources/cidr.txt)。本次读取 227 bytes，9 个 IPv4、5 个 IPv6，SHA-256 `3ecd072cedf72eceee6961b18a51e37f905d5ce4a656a5d24cf5fea63e6ec651`。可以作为 Telegram 服务 IP 的权威候选，锁定快照、重新核查条款后纳入；原文件未给 `no-resolve`，该行为由明确路由设计决定。不是整 ASN 的许可。

ChatGPT Voice 精确地址是 [openai.com/chatgpt-voice.json](https://openai.com/chatgpt-voice.json)，**不是 chatgpt.com/voice.json**。[官方网络说明](https://help.openai.com/en/articles/9247338-network-recommendations-for-chatgpt-errors-on-web-and-apps) 给出 UDP 3478、TCP 443 回退要求。本次 JSON 895 bytes，`creationTime` 为 `2026-03-26T20:12:45.451356+00:00`，`prefixes[].ipv4Prefix` 共 23 个 /32，SHA-256 `8f03f3c594165eeff009915c7e2beb4bdfb9d429fb1955c205e3b33ec781899a`。它仅说明 Voice 服务端，不等于全部 OpenAI API 网段；仅导入 CIDR 是更宽的路由选择，不能宣称保留了 UDP 3478 条件。

Anthropic API IP 需核对 [官方 API 地址](https://platform.claude.com/docs/en/api/ip-addresses) 的入站/出站区别；Claude Code/Desktop 域名按 [官方网络要求](https://code.claude.com/docs/en/network-config) 与 [Desktop](https://code.claude.com/docs/en/desktop) 补充。共享 Cloudflare/Sentry/Intercom/Datadog 整后缀不应为某个 AI 自动接管。

## 完整 config 与各客户端节点接入

Shadowrocket 交付应是整份 `.conf`，包含 General、Proxy Group、Rule、所需 Host 与 update-url，并通过 URL 或对应二维码导入。[Ling 原始配置](https://github.com/LingJingMaster/Shadowrocket-Rules/blob/c61257022f647a825be423a84253386b9d3adc03/Shadowrocket.conf) 明示导入后在首页添加自己的节点/订阅，Proxy 节可以空，主组包含 `PROXY`。可采用以下自主手动选择层次，固定组名，用户在客户端改选：

```ini
[Proxy Group]
节点选择 = select,PROXY,DIRECT
Anthropic = select,节点选择,PROXY,DIRECT
OpenAI = select,节点选择,PROXY,DIRECT
```

这是由原配置语义推导的模板方案，不是已验证的最终文件。`PROXY` 提供默认代理选择，不能把它描述成每组独立枚举全部节点；要每个服务独立选择任意现有节点，应核查客户端组正则、订阅包含或 UI 可选成员，并实测刷新。不要为了发布完整配置把个人 token 写到公共仓库，也不要把仅 DIRECT 当作完整代理 config。

[LOWERTOP 作者手册](https://github.com/LOWERTOP/Shadowrocket/blob/10d845ffca79413fc50827b4852dfa6bb1d1d24a/README.md) 记载 `shadowrocket://config/add/{url}` 安装配置。二维码应封装已确认可用的完整配置导入链接，并以实际 URL scheme 与版本核验；普通 `.list` 二维码不满足整份 config 交付。

| 客户端 | 用户节点和规则配置的结合 | 不能宣称的能力 |
|---|---|---|
| Shadowrocket | 首页节点/订阅保留，完整 config 通过 PROXY 与服务 select 组使用；必要时客户端包含节点 | 普通 PROXY 不是所有服务自动独立选节点；刷新后所有修改永久保留未经实测 |
| Surge | [include-all-proxies/include-other-group/policy-path](https://manual.nssurge.com/policy-groups/policy-including.html)；私人 profile 包含节点或本地绑定 | include-all-proxies 仅含当前 profile 的 Proxy，不是任意已有远程配置中的节点；不能直接照搬 Shadowrocket PROXY |
| Mihomo | [proxy-providers](https://wiki.metacubex.one/config/proxy-providers/) 与 select 的 use/包含参数；客户端覆写或私人合并维护订阅地址 | 公开 provider 模板凭空访问用户别的配置中的节点；完整公开 YAML 自带真实代理 |
| sing-box | [selector](https://sing-box.sagernet.org/configuration/outbound/selector/) 列出真实 outbound tags，通过 Clash API/支持的客户端 UI 切换；私人合并层提供节点 | 有数据 `.srs` 就等于完整客户端配置，或 sing-box core 统一原生支持机场订阅 provider |

完整跨客户端支持意味着分别给出实际可用的导入/合并方式和验证结果，不能承诺四种客户端一样的一键节点接入流程。SS/VMess/VLESS/Trojan 等节点传输协议与规则/配置格式是不同维度。

## 更新与私人规则持久性

[LOWERTOP 更新配置说明](https://github.com/LOWERTOP/Shadowrocket#更新配置) 明示远程 config 更新覆盖本地编辑，编译配置仅更新所引用资源。其 [自动更新说明](https://github.com/LOWERTOP/Shadowrocket#自动更新) 推荐删除 update-url 或使用扩展/包含配置保护自定义。这与“同一完整 config URL 自动更新且任意本地编辑永不丢失”并不相同。

应分别交付：公共完整配置持续地址；项目自有规则进入下一公开版本；私人规则保存在私人输入与客户端包含/覆写层，不自动上传。整份公开模板可引用同一不可变发布规则集；稳定 config 地址更新到下一已验证批次。私人扩展层的优先级、fallback 与包含更新行为须验证，不能把本地输入存在当作客户端更新持久性已完成。组名固定有利于选择持久，但仍需实测当前 Shadowrocket 版本的 UI 选择、配置更新和节点订阅更新三种不同操作。

## 实施验收与未解决事项

建议先完成覆盖所有常用族的轻量完整 Shadowrocket config，再完成各目标真实接入和持续更新验收；不以补齐一个数据管线或增加条数为终点。

1. 给上述各分类建立主要来源、范围与组合顺序；每类至少选代表请求核对细组优先。默认合集保留合理规模，大广告库独立扩展档。
2. 补足必要输入格式，而非对 wildcard/regex/process/UA 自动删行；不可支持的视图清楚标注。正文空文件、分体 `_Domain.list` 必须作为真实错误或明确来源组成处理。
3. 出整份配置 URL/二维码；在已有节点环境导入，选择 Anthropic 与其他组，检查实际可选项、命中、DNS、IP 与 UDP。
4. 添加公共与私人自定义规则，模拟上游变更和整份配置升级，验证持久性及选择保留；失败维持上一已验证批次。
5. 已有来源类别还缺 China 地理 IP 完整许可核验；官方网络数据快照没有仓库 commit，需额外 fetched-at、sha 与条款记录；IP 条件与共享网段风险不可藏在格式转换里。
6. Mihomo/sing-box 的 core 检查和隔离路由验证不替代完整客户端订阅、TUN/Fake-IP、节点协议与升级验证。每目标独立标验证状态。

本轮只研究和记录，没有修改配置、导入新数据、切换客户端、发布新版本或将候选表标为已完成。
