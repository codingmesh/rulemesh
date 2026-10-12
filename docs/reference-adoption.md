# 参考实现采用清单

本清单把 2026-10-11 的研究结论映射到当前实现。除 SukkaW/Surge 是项目直接继承的代码基座、MetaCubeX 是明确登记的数据来源外，其他仓库均为设计和行为参考：不设置 Git upstream，不自动同步，也不形成运行时依赖。实现证据见 [Sukka 完整核查](sukka-full-audit.md)，分类与多仓库证据见 [覆盖研究](research-complete-coverage.md)。

## 1. 采用方式和边界

分为复用数据、借鉴结构、参考行为和必要扩展。每项记录研究时查看的文件或固定提交、采用范围、已知差异和验收证据。人工补充和自定义经同一工程输出；不无条件并集热门仓库。

项目整体沿用 Sukka 基座的 AGPL-3.0。数据保留原许可。无需改造的目标原生产物可直接固定并交付；必须登记格式、语义和可用目标，不为统一模型主动丢弃原生选项。需要自有修改时沿用输入收集、整理和 writer 的 seam，并显式诊断无法表达的条件。

## 2. Sukka 工程采用映射

以下源码固定于 [6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62](https://github.com/SukkaW/Surge/tree/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62)，产物数据初始核查基线为 SukkaLab/ruleset.skk.moe 的 fb2480119a3dd21e5f95f7eabf1ff98988e32289。后续数据变化走候选审查。

| 上游具体实现 | 采用职责 | 保留的差异/验收 |
| --- | --- | --- |
| [Source / build-common](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-common.ts) | 手工输入、元数据、通用扫描及专项任务共享流程 | 项目 sources/owned/overrides 接入同一流程；新增来源不另造路由阶段 |
| [FileOutput](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/base.ts) | 收集语义数据，不决定目标格式 | 原始来源/解析意图/覆盖保留；不是要求照抄类层次 |
| [strategy-write-data](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/strategy-write-data.ts) | trie、集合、类型分桶、稳定整理 | 覆盖之后输出前优化；跨分类不能去重。IPv4 合并、IPv6 规范化集合；优先核对成熟依赖 |
| [domainset / ruleset](https://github.com/SukkaW/Surge/tree/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules) | 一个业务分类可按匹配类型分体输出 | 域名集与非域名条件相邻引用同策略；不能一条 keyword 使整个分类失去域名格式优化 |
| [writing-strategy](https://github.com/SukkaW/Surge/tree/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy) | 同源多客户端 writer | Shadowrocket 单独适配；不采用静默 noop。必需语义阻断和批准缺口分别登记 |
| [build-ai-cidr / build-telegram](https://github.com/SukkaW/Surge/tree/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build) | 官方动态数据与本地补充 | 首批 Telegram CIDR/OpenAI Voice；锁字节/条款/时间，保留解析意图，端口缺口明确 |
| [国内 DNS 配套](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-domestic-direct-lan-ruleset-dns-mapping-module.ts) | 路由、DNS、hosts、real-IP 职责分别组织 | 不照搬个人 DNS 地址；按目标验证启动解析、直连/代理 DNS 及 GUI 切换影响 |
| [content-hash / create-file](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/create-file.ts) | 复用旧产物，实际内容不变不改日期 | 兼容旧路径与明确退役；不建立公开 prepared/版本目录 |
| [build-deprecate-files](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-deprecate-files.ts) | 明确列出退役文件，删除或保留迁移说明 | 分体迁移与既有模板升级分别验收；过渡期后按清单退役，不要求永久保存旧内容；退役说明不等于原规则仍生效 |
| [build-public](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-public.ts) | 真实静态目录与产物仓库说明 | 增加完整配置、档位、QR、节点接入与验证状态；Mock/MITM 不默认加入 |
| [main.yml](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/.github/workflows/main.yml) | 同份构建、PR 产物 diff、主分支部署、线上标记核验 | 一个产物仓库/站点；不复制 force push/archive/可见性切换；输入候选需审阅，线上未可见不报成功 |

## 3. 数据与对照职责

| 分类/需求 | 主来源与对照 | 当前采用决定 |
| --- | --- | --- |
| LAN、国内、境外、CDN、下载 | Sukka 的 domainset/non_ip/ip 成套文件；Meta/Loyalsoldier 对照 | 精确/后缀/wildcard/IP 成套核对；不把废弃空文件算覆盖，不合并两份巨量宽列表冒充优化 |
| AI、开发、通信、媒体、游戏、云平台 | MetaCubeX 精确 geosite/geoip 文件；Sukka 补充；blackmatrix7 粒度及原生格式对照 | 细服务先于平台与通用合集；源视图不等于全语义；完整映射在覆盖研究，新增分类须补代表请求 |
| 国内平台资源与游戏下载 | Sukka 国内 CDN、Apple CN、Microsoft CDN、game-download 等；Meta 属性子集 | 国内资源与账号/主服务分开，跨分类重叠有裁决，不按出口国家划分类 |
| 官方服务缺口 | Anthropic 官方网络要求、Telegram CIDR、OpenAI Voice 地址 | 有证据地补缺，官方动态数据与 GitHub 数据同样可追溯；不把共享云后缀/ASN 全归单服务 |
| 可选广告/追踪/恶意域名 | Sukka 分层、Meta category-ads-all、blackmatrix 专项对照 | 标准档不启用，广告档显式选择；白名单/误拦截原因及源视图可核查 |
| 中国 IP 兜底 | 目标客户端 GEOIP 或使用者底稿 CN 原生规则集 | 本项目暂不再分发 China IP；sing-box 明确依赖，缺失不能宣称完整国内兜底 |

当前产物每份采用一个主要上游许可加本项目补充；Sukka/Meta 分开组织，blackmatrix7 仅对照。未声明许可的模板仅参考行为。条目来源和数据传递关系记录到实际输入，不用仓库根许可证替代文件范围核查。

实际消费的数据分成三类：`sources/registry.json` 固定并同步 MetaCubeX 分类，`sources/maintained.json` 记录不自动同步的 Sukka 固定快照和官方网络事实，`sources/overrides.json` 保存带理由、证据和核查日期的 add/remove 修正。参考设计的仓库不进入这三份数据清单。

## 4. 参考项目的设计采用

| 参考项目 | 采用的设计 | 当前实现证据 |
| --- | --- | --- |
| blackmatrix7 | 服务级分类和服务独立策略覆盖 | `routing-profile.ts` 将 Anthropic、OpenAI、Gemini、Telegram、YouTube、Netflix 等服务映射为独立策略，同时保留家族默认值 |
| LOWERTOP、LingJingMaster | Shadowrocket 单 URL 导入、总节点选择、分组选择和移动端可调整配置 | `build-client-config.ts` 生成标准/广告完整配置、更新 URL、二维码和 `node-selection`；不复制未授权模板文本 |
| Johnshall | 标准分流与广告拦截作为两个明确使用档位 | 四个客户端均生成 standard/advertising；标准档不引用拒绝规则，广告档把拒绝层放在最前 |
| Loyalsoldier | private、reject、服务、国内、通用、final 的基础分层思路 | `orderedCategories` 明确维护阻断、局域网、服务、平台、国内和通用顺序；不导入其 Clash 专用 YAML 数据 |
| ACL4SSR | 总策略组、家族组和服务覆盖组成的层级选择 | AI、social、streaming 是家族 selector；服务 selector 默认继承家族，也允许节点或直连覆盖 |
| MetaCubeX | 细服务分类和 Mihomo 原生 provider 能力 | 53 个固定 revision 分类进入 `Source/`；Mihomo 使用 domain/classical provider 并由原生程序验证 |
| SagerNet / sing-box | 远程 rule-set、selector、route action 和 DNS 解析阶段 | sing-box 使用 source rule-set、selector、显式 resolve 过渡和 reject/route action；由固定版本编译和路由验证 |

这些项目是研究依据，不是 RuleMesh 的上游列表。以后调整设计时，应回到固定研究证据重新比较；只有真正消费数据或代码的项目才进入来源登记和第三方许可清单。

## 5. 完整客户端配置的依据

| 目标 | 采用来源/原生机制 | 接入和验收边界 |
| --- | --- | --- |
| Shadowrocket | [LingJingMaster 完整结构](https://github.com/LingJingMaster/Shadowrocket-Rules/blob/c61257022f647a825be423a84253386b9d3adc03/Shadowrocket.conf)、LOWERTOP 导入/组选择行为参考 | config URL/已验证 QR，首页节点与稳定组；标准/广告一致，资源刷新与配置刷新分别实测 |
| Surge | Sukka DOMAIN-SET/RULE-SET 示例与 [原生 policy including](https://manual.nssurge.com/policy-groups/policy-including.html) | 完整模板配本地节点 compose；托管/include 作为待验证改善路径；DNS、资源刷新和升级后选择保留单独验收 |
| Mihomo | Sukka/Loyalsoldier providers、[原生 rule-providers](https://wiki.metacubex.one/config/rule-providers/)、ACL4SSR 主组/服务组组织参考 | 完整 YAML 接入 proxies/providers；interval 明确；GUI 覆写声明版本，INI 不冒充 YAML |
| sing-box | [原生 rule_set](https://sing-box.sagernet.org/configuration/rule-set/)、[route](https://sing-box.sagernet.org/configuration/route/)、[selector](https://sing-box.sagernet.org/configuration/outbound/selector/) | 完整 JSON 含真实 outbounds/DNS/CN 依赖；HTTP client、缓存与 update_interval 按固定版本验证；不假定机场 provider |

General/DNS/IPv6/TUN 参数按方案默认取向及目标来源核查，用户已指定底稿设置不能被默认参数覆盖。节点出口由用户选择；完整公开模板不嵌入凭证，不开无需求的 MITM/脚本/重写。使用 native 下载/缓存/选择机制，不增加通用转换平台。

## 6. 如何证明采用成立

逐项记录“具体上游职责 → 项目接口与取舍 → 差异 → 行为证据”。当前八类默认匹配和批准缺口不是框架的不可扩展上限；新增类型需列目标表达及来源范围。采用数据、工程结构和客户端行为分别验收，不能用一个目录名称或测试数量证明全部完成。

来源事实留在研究文档；当前采用关系由本清单负责；实际成立与否由源码、生成产物和验收结果共同证明，不能用仓库名称、目录名称或测试数量代替。
