# Sukka 仓库完整架构核查

核查日期：2026-10-11（America/Los_Angeles）。参照源码：`SukkaW/Surge`，本地只读副本 `.cache/reference/SukkaW-Surge`，固定提交 **`6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62`**。这是本次实际读取的版本，不把本地 HEAD 自动等同于以后变化的远端 HEAD。RuleMesh 对照：`4f59f34` 的当前实现。

结论：Sukka 的核心是**人工规则源与自动数据任务共用语义容器，按客户端和匹配类型输出，复用上一份产物，PR 检查产物差异，主分支持续部署固定 URL 的规则站点**。只抄网站部署，或者只引入几份规则数据，均不等于采用这个架构。RuleMesh 当前除了发布入口，还缺少已生效的域名集选择、覆盖去重及稳定产物写入；这些要作为结构调整处理。

Sukka 自身交付的是 ruleset snippet、辅助 DNS 配置和可选模块。用户要求的 Shadowrocket 完整配置、节点策略组和二维码，是 RuleMesh 要在此基础上完成的扩展，不能声称 Sukka 已经提供了同样的产品。[上游 README](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/README.md)、[输出策略注册](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/ruleset.ts)。

## 1. 核查范围与边界

`git ls-files` 清点为 179 个受版本管理的文件：`Build/` 97 个、`Source/` 49 个、`Mock/` 12 个、`Modules/` 5 个、`.github/workflows/` 4 个，另有 12 个根目录和编辑器文件。

本次阅读覆盖：

- 根 README、LICENSE、package、TypeScript/ESLint 配置、忽略项；四份完整 workflow。
- `Build/index.ts`、全部 18 份 `build-*.ts` 的任务逻辑，以及上次产物下载和 Mock 下载逻辑。
- 核心 `FileOutput`、三类规则输出容器、全部七个 writer 文件、writer 数据分发、内容哈希、比较写入、工作线程入口与站点生成逻辑。
- 远端源聚合、hosts/domainlist/广告过滤的解析入口、域名标准化、下载缓存/重试/镜像竞速、Telegram 备份解析与 MTProto 持久化。
- 全部维护工具和 `validate-*.ts` 的用途，测试源的实际断言及 benchmark 的测量方法；trace 的入口、数据类型和回归断言。
- `Source` 的三类输入结构、TS 数据模型、元数据/特殊构建指令，五个静态模块的实际内容，以及 Mock 与模块之间的引用关系。

不把数据清单中的每个域名都描述为逐条审核过；也未执行上游脚本、安装依赖、跑网络测试或部署。因此这里的结论是源码机制核查，不是对所有规则有效性、当前站点可用性、上游全部测试通过的证明。个别长辅助模块是按入口、关键分支和调用关系读取，不声称逐行审计所有 179 个文件。

## 2. 产品定位与目录契约

README 明确称它为个人维护的 **Ruleset Snippet**。目标是 Surge、Mihomo、旧 Clash Premium、sing-box、Surfboard、Stash；默认 exporter 没有独立 Shadowrocket writer。[README](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/README.md)、[RulesetOutput](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/ruleset.ts)。

| 输入/产物 | 实际职责 |
| --- | --- |
| `Source/domainset/*.conf` | 精确域名与以 `.` 开头的后缀域名 |
| `Source/non_ip/*.conf` | 不需要地址解析的经典规则，不限于域名 |
| `Source/ip/*.conf` | CIDR、ASN 等地址类规则，含解析选项 |
| `Source/**/*.ts` | 国内 DNS 映射、服务模型、流媒体分区及复杂规则数据 |
| `List/{domainset,non_ip,ip}` | Surge 输出 |
| `Clash/{domainset,non_ip,ip}` | Mihomo 的 domain/classical/ipcidr text 输出 |
| `LegacyClashPremium` / `Surfboard` | 对应客户端裁剪后的经典规则 |
| `sing-box/{domainset,non_ip,ip}` | Headless Rule JSON 源格式 |
| `Modules` / `Internal` / `Mock` | 可选模块、内部 DNS 辅助文件、模块引用的替代资源 |

这些目录由[目录常量](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/constants/dir.ts)和[各输出容器](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/domainset.ts)决定，不是把所有规则平铺到完整配置里。README 要求全部 domainset/non-IP 置于全部 IP 类规则之前；IP 与 FINAL/直连触发 DNS 的时机是顺序设计的依据。[README 规则顺序说明](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/README.md)。

目录表示的是解析行为分层，不能只按 predicate 名字判断。例如 `Source/non_ip/apple_services.conf` 中仍有 `IP-CIDR,17.0.0.0/8,no-resolve`；这不主动触发 DNS 的 IP 条目被放入 non-IP 层。RuleMesh 在模型中明确记录解析要求是必要的，转换时不能仅看目录丢掉原意。[Apple services 源](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Source/non_ip/apple_services.conf)。

## 3. 从源到部署的完整链路

```text
Source 人工输入 + TS 专门数据 + 远端官方/社区数据
  → 下载、格式解析、源级过滤、明确白名单
  → FileOutput（域名 trie / 各规则类型 Set / 其它规则）
  → 覆盖去重、keyword 过滤、CIDR 合并、确定性顺序
  → 按匹配类型安装客户端 writer
  → 与上一份产物比较，必要时更新文件及日期
  → 退役文件清理/兼容提示 + Modules/Mock + 浏览目录站点
  → .BUILD_FINISHED + 一份 Actions artifact
  → PR：与已发布产物仓库 Git diff
  → master：同一 artifact 部署 GitHub 产物仓库 / GitLab / Cloudflare
  → 客户端持续读取固定 HTTPS 文件 URL
```

[主构建](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/index.ts)、[FileOutput](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/base.ts)、[写入数据分发](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/strategy-write-data.ts)、[完整工作流](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/.github/workflows/main.yml)。

这条链路没有要求用户选 GitHub Release、版本目录、不可变发布 tag、候选发布索引或回滚服务。Actions artifact 是 CI 中暂存并传递同一份构建输出的载体，不是面向客户端的多版本产品。

## 4. 通用输入与扩展方式

`build-common.ts` 扫描所有非 JS/TS 源文件，读取四种指令：`custom_build_script` 跳过通用构建，`meta_title` 和 `meta_description` 补充元信息，`sgmodule_mitm_hostnames` 声明附属 MITM 模块。再按首层目录选择 DomainsetOutput 或 RulesetOutput。[通用任务](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-common.ts)。

这是一个明确的扩展接口：普通规则修改源文件；需要远端数据、不同输入格式或额外辅助产物时，增加专项任务，仍调用统一输出容器。扩展不应绕开共享模型直接拼接未知语义的客户端文本。

`Source/non_ip/direct.ts` 的 `DNSMapping` 同时记录 domains、dns、hosts、realip、ruleset；`$` 为精确域名，`+` 是子域匹配意图，无前缀包含主域及子域。各目标 DNS 配置如何解释前缀仍需看专门转换，不可拿一个泛用后缀替换完成所有语义。[模型](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Source/non_ip/direct.ts)、[转换任务](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-domestic-direct-lan-ruleset-dns-mapping-module.ts)。

## 5. 全部构建任务的职责

以下链接均固定到本次提交；这是任务行为清单，不代表 RuleMesh 必须复制所有产品功能。

| 任务 | 输入、处理与输出 |
| --- | --- |
| [common](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-common.ts) | 扫描手工源，处理元数据及专项任务跳过指令，统一多客户端输出 |
| [ai-cidr](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-ai-cidr.ts) | 验证 OpenAI Voice JSON 的时间和前缀，合并本地 AI IP；官方 voice CIDR 标为 no-resolve |
| [apple-cdn](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-apple-cdn.ts) | dnsmasq Apple 域名源 → 域名集，排除 apps.apple.com/push.apple.com |
| [cdn-download](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-cdn-download-conf.ts) | 本地 CDN/下载/游戏数据 + PSL 对象存储 + IPFS gateways；对象存储分配下载类，Crashlytics 允许项分配 CDN |
| [chn-cidr](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-chn-cidr.ts) | 两个中国 IPv4/IPv6 源，纯 IP 输出，单独许可说明 |
| [cloudmounter](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-cloudmounter-rules.ts) | 服务域名结合进程名或来源网段生成 AND；不是无条件把整个服务放到另一路由 |
| [domestic/direct/LAN/DNS](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-domestic-direct-lan-ruleset-dns-mapping-module.ts) | 人工 `.conf` + DOMESTICS/DIRECTS/LAN/HOSTS 数据，生成路由集、Surge Host 模块引用集、Mihomo nameserver-policy 与 hosts、AdGuard DNS mapping、LAN Cache 辅助集 |
| [global](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-global-server-dns-mapping.ts) | 合并本地 global.conf 和 TS GLOBAL 域名；文件名虽提 DNS，本任务实际返回 global non-IP ruleset |
| [microsoft-cdn](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-microsoft-cdn.ts) | dnsmasq 国内加速数据经 trie 筛选 Microsoft 探测后缀、黑名单，再合并手工规则 |
| [reject-domainset](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-reject-domainset.ts) | 多来源广告/钓鱼/恶意域名，白名单和 keyword 过滤，基础/额外/钓鱼集合去重，wildcard non-IP 与反 NXDOMAIN/botnet IP，AdGuard Home 衍生产物 |
| [reject-ip-list](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-reject-ip-list.ts) | 输出内部 ASN 文本；botnet/bogus-NXDOMAIN 已由 reject-domainset 处理 |
| [always-realip](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-sgmodule-always-realip.ts) | realip 数据 + 网络探测/STUN/LAN Cache 例外，Surge always-real-ip 和 Mihomo fake-ip-filter；不是代理路由集 |
| [redirect](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-sgmodule-redirect.ts) | 人工重定向表 → 完整/精简 Surge 模块及 uBO/AdGuard URI transform；处理两种系统不同的覆盖顺序 |
| [speedtest](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-speedtest-domainset.ts) | Speedtest/LibreSpeed API + 手工域名 + 已发布旧测速域名，维持已有服务覆盖 |
| [stream-service](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-stream-service.ts) | 统一 StreamService 服务模型 → 总集及 US/EU/HK/TW/JP/KR 分区，域名与 no-resolve IP 分开 |
| [telegram](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-telegram.ts) | 官方 CIDR + 签名备份端点，生产/测试备份的使用范围明确；另并发生成 help.getConfig 的 MTProto DC JSON |
| [deprecate-files](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-deprecate-files.ts) | 删除明确退役的文件/目录；对已合并的旧路径保留说明文件，不靠长期版本分叉维持兼容 |
| [public](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-public.ts) | 静态 Modules/Mock + 浏览文件树站点 + 404/headers/产物仓库 README/.nojekyll |

广告名单维护并非无脑拼接所有热门仓库：源表记录基础与 extra、镜像、includeSubdomain、允许空源，附带为何停用/排除某些源的理由；预设白名单包含实际误拦截案例。[来源与白名单表](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/constants/reject-data-source.ts)。RuleMesh 需要多上游覆盖，但不能为数量牺牲冲突判断。

## 6. 数据质量、去重与转换

FileOutput 存放语义数据而不负责目标格式。域名由 hostname trie 存储；其它类型使用独立 Set；resolve/no-resolve CIDR、ASN、GEOIP 分开保存；复合/其它规则作为单独项处理。[FileOutput](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/base.ts)。

统一写入阶段把 Unicode 域名转换为 ASCII，按长度和字典顺序稳定排序，用 keyword 及 whitelist keyword 过滤域名，并对 IPv4 CIDR 桶执行合并；IPv6 当前保留数组，不应声称同样执行了网段合并。no-resolve 和允许解析的 IPv4 不混在一批合并。[分发实现](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/strategy-write-data.ts)。广告额外集、钓鱼集再排除基础集已覆盖的域名，这是**有产品边界的跨集去重**，不能任意删除不同路由策略下的重叠项。[广告任务](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-reject-domainset.ts)。

hosts/domainlist/AdGuard filter 使用不同 parser。广告解析主动筛掉 cosmetic、路径和浏览器上下文限定的规则，再区分精确域名/后缀、白黑名单、IP、wildcard、keyword。不能将浏览器过滤规则全部转成域名规则而继续声称语义完整。[过滤解析器](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/parse-filter/filters.ts)、[hosts](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/parse-filter/hosts.ts)、[domainlists](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/parse-filter/domainlists.ts)。

重要边界：上游 keyword 过滤实现计算了 `whitelistedKeywords`，但在非空时向 writer 传入的是原 `domainKeywords` Set。这里只记录源码现象，未执行上游测试证明所有场景；RuleMesh 应复用机制思想并针对真实白名单回归验证，不能认为成熟项目每行代码都可免验照抄。[实际调用](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/strategy-write-data.ts)。

## 7. 客户端 exporter 的实际能力边界

| Writer | 可确认的限制 |
| --- | --- |
| Surge Domainset / Clash Domainset | 只写 domain 和 suffix，其余 write 方法为 noop |
| Mihomo classical | 支持域名/wildcard/进程/CIDR/ASN/GEOIP/来源及端口等；UA、URL-regex、other 为 noop；protocol 只写 TCP/UDP 的 NETWORK |
| Legacy Clash Premium | 继承 classical，但 wildcard、ASN 为 noop |
| Surfboard | 继承 Surge，wildcard、UA、URL-regex、ASN、other 为 noop；来源端口转换成 IN-PORT |
| sing-box | 当前代码实际写 domain、suffix、keyword、IPv4/6 CIDR；wildcard、process、URL-regex、ASN、GEOIP、来源网段/端口、目标端口、protocol、other 均 noop。接口声明了更多 JSON 字段，不等于已经输出 |
| AdGuard Home | 对 no-resolve IP 主动跳过；某些不支持的调用直接抛错，其它使用 noop |

[Surge](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/surge.ts)、[Clash](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/clash.ts)、[Legacy](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/legacy-clash-premium.ts)、[Surfboard](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/surfboard.ts)、[sing-box](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/singbox.ts)、[AdGuard Home](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/adguardhome.ts)。

因此，“遵循 Sukka”不能解释为照搬静默丢弃。RuleMesh 的明确 capability gap、默认配置拒绝未表达的重要规则、目标专门转换及原生差异记录，仍是必要扩展。IP 解析行为属于使用配置和客户端路由语义；JSON 里没有 no-resolve 选项，不等于该意图消失后仍能宣称等价。

## 8. 稳定写入与上一份产物

CI checkout `SukkaLab/ruleset.skk.moe` 作构建目录，去掉其 `.git` 后 `PUBLIC_DIR` 指向此目录。本地若目录为空才下载旧产物；GitHub 下载入口不可用可换 GitLab，CI 目录为空则失败。[旧产物下载](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/download-previous-build.ts)、[workflow](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/.github/workflows/main.yml)。

内容哈希覆盖 title、description、rules，排除 Last Updated；读取前 8 KiB 优先判断哈希，无标记回退比较。规则没变就保持旧文件和日期。JSON 无日期，CI 可直接覆写，而字节稳定时 Git diff 仍无规则变化。[content-hash](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/content-hash.ts)、[create-file](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/create-file.ts)、[BaseWriteStrategy](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/base.ts)。

这不是全站所有字节都不变：站点 index 的 Last Build 会变化，一些模块也有动态日期。借鉴应落实到真实规则和必要元信息的稳定性，不杜撰“上游全站完全无噪声”保证。

上一份产物还有数据用途：speedtest 合并旧域名，Mock 下载返回非成功状态或无 body 时可使用已有资源。既然复用旧树，就必须同时维护明确退役路径；否则移除源文件后旧产物会残留。上游专门维护 deprecate/removed 列表，没有用彻底清空上一份输出代替此机制。

## 9. 站点与模块的实际功能

`build-public.ts` 复制 Modules/Mock，扫描真实产物树生成文件浏览页，按 domainset/non-IP/IP 和客户端目录排序，默认收起 Internal/Mock。生成产物仓库 README、404、`.nojekyll`，Cloudflare `_headers` 设置短缓存及文本 Content-Type。它没有生成完整代理节点配置、通用订阅转换接口或用户账号体系。[站点生成](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-public.ts)。

静态模块包含 Google 重定向、Surge 探测地址、NetEase 更新阻止、广告替代资源及 MITM 主机名模块。Mock 是被这些模块引用的替代 JS/JSON/text，不能误当成单元测试 fixture。MITM、URL rewrite、Map Local 有特定权限和运行开销；对 RuleMesh 是可选产品功能，不应为“完整参考”强行默认开启。[模块目录](https://github.com/SukkaW/Surge/tree/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Modules)、[Mock 下载](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/download-mock-assets.ts)。

## 10. CI、部署和持续维护

四份 workflow 的实际职责如下：

| Workflow | 实际行为 |
| --- | --- |
| [main](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/.github/workflows/main.yml) | master push、PR、每天两次定时、手工；构建、缓存、artifact、PR 产物 diff、master 部署 |
| [check-source-domain](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/.github/workflows/check-source-domain.yml) | 手工触发六分片域名可用性调查，缓存按 shard 分开；汇总失效域名与原因，不自动删除规则 |
| [benchmark-download](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/.github/workflows/benchmark-download.yml) | 手工比较 fetch/request 下载，参数含并发、round、warmup、压缩、URL；有独立超时和 job summary |
| [toggle-dist-repo-visibility](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/.github/workflows/toggle-dist-repo-visibility.yml) | 定期/手工切换产物仓库 private/public，恢复 legacy Pages，再 archive。cron 实际是每月 12 日，注释写 1 日不能当事实 |

主流程：旧输出非空，所有任务完成，根目录 `.BUILD_FINISHED` 存在才可上传一个短期 artifact；PR 在部署仓库比较生成树；master 下游 job 使用同一个 artifact。Cloudflare、GitLab、GitHub 是三个部署目的地，不是三种客户端使用入口。GitHub 产物增加镜像 CNAME 和 deploy-check 标记，再等待 Pages 标记正确后 archive 仓库。[main.yml](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/.github/workflows/main.yml)。

上游实际有 force push、部署标记等待、archive/unarchive、可见性定期切换，也有一定运营复杂度。“Sukka 发布就是完全没有部署检查”同样不实。但它们服务于上游特定多镜像环境，**不是 RuleMesh 必须复制的规则管理领域模型**。RuleMesh 可先一个产物仓库和一个固定静态站点，记录这个部署范围差异；不要重建 Release/版本晋升/回滚演练系统。

当前上游四份 workflow 没有运行 `pnpm test`、`pnpm lint` 或 `tsc` 的步骤。存在测试脚本与测试文件，不等于主发布路径已经执行所有质量门禁；RuleMesh 不应为了“照上游”删除自己的有效检查。

## 11. 工程、性能与测试

Node 版本文件指定 26，package 使用 pnpm 12.8.1；TS 通过 SWC register 运行，Mocha/Earl 负责测试，TypeScript strict/noEmit、Sukka ESLint 用于开发。根 LICENSE 与 README 是 AGPL-3.0，而 package 的 license 字段写 ISC，采用代码时不能只读该字段得出宽松许可结论。[package](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/package.json)、[tsconfig](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/tsconfig.json)、[LICENSE](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/LICENSE)。

下载层采用 Undici DNS/重试/redirect/SQLite HTTP cache，镜像延迟竞速根据实际编码字节速度判断；本地等待解析队列不误触发镜像。统计区分网络字节、解压后字节、缓存命中、304、下载时间，测量并不只看请求总耗时。[fetch-retry](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/fetch-retry.ts)、[fetch-assets](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/fetch-assets.ts)、[benchmark](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/benchmark-download-client.ts)。

共享三线程 farm 承担广告解析、钓鱼处理、Microsoft/CDN 和大型输出；小文件留在主线程，输出域名阈值 20,000。trace 分类测量 CPU/网络/FS/worker/等待，校正线程时间原点并避免并发 span 时间重复相加。适用的是上游大数据构建规模，不证明 RuleMesh 当前小规模构建需要立即照搬线程池。[farm](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/build-worker-farm.ts)、[输出阈值](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/base.ts)、[trace 回归断言](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/trace/report.test.ts)。

重要测试包含 CRLF/分块读取等价性、过滤先后次序、MTProto IPv6 等价/端点确定性/功能变体、持久化 key 生命周期、trace 并发归因。`parse-filter.test.ts` 当前那个 case 只 console.log，无正确性断言，不能把测试文件存在当质量证据。[行读取测试](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/fetch-text-by-line.test.ts)、[MTProto 测试](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/mtproto-dc-config.test.ts)、[filter 测试](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/parse-filter/parse-filter.test.ts)。

维护工具还包含人工源修剪/去重/迁移、GFWList 与 Tranco 对照补缺、国内列表补缺、TLD 分布与广告统计、哈希碰撞调查。它们主要打印维护线索或显式运行后修改源，并非主构建默认自动修改人工规则。[维护脚本目录](https://github.com/SukkaW/Surge/tree/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build)。

## 12. RuleMesh 当前实现的可核查差异

以下是读当前代码后得到的差异，不是仅依据项目名称或旧方案推断。

| 环节 | 当前 RuleMesh | 需要纠正的结构 |
| --- | --- | --- |
| 去重 | `src/model/normalize.ts` 的 deduplicate 只按 category/kind/value/resolution 精确去重并合并来源 | 补上同策略、同语义范围内的域名覆盖和 CIDR 合并；不同策略/解析阶段不得误合并 |
| domainset 使用 | `datasets.ts` 可生成 Surge domainset，但 `profiles.ts` 的 renderClassic 仍使用普通 RULE-SET non-IP 路径 | domainset/non-IP/IP 应在默认配置里真正使用；混合分类按语义拆分，不能有数据却不用 |
| 构建交付边界 | `site.ts` 先 build，随后再 loadDataset | 单次加载、单份生成结果交给站点与部署，消除第二份输入视图 |
| 最终产物清单 | site 跳过 dist configs/probes，再增加 live config/QR，却直接复制原 dist manifest | 清单必须描述最终站点实际文件与字节；核查默认和可选配置的全部引用 |
| 站点目录 | 只有 Shadowrocket/config/QR/status 三个链接 | 生成四客户端规则目录和实际产物目录，解释分类与导入；新增完整配置入口属于产品扩展 |
| 发布与审查 | source repo Pages push-only，没有 PR 产物 diff，也没有独立纯产物 repo | Source → build once → PR diff / main → generated repo +固定站点 |
| 自定义与来源 | owned/override、来源快照及许可检查已经存在 | 继续作为用户自定义与可重复审查接口；不要为删掉过度发布层同时删掉实际规则维护能力 |
| 能力差异 | 已有 capability gap 及显式拒绝 | 保留并核实，替代上游部分 writer 的静默 noop |

本地证据文件：`src/model/normalize.ts`、`src/exporters/datasets.ts`、`src/exporters/profiles.ts`、`src/site.ts`、`src/dataset.ts`、`src/model/overrides.ts`、`.github/workflows/site.yml`。这些结论对应 `4f59f34`，实施后应重新检查，不应将表中现状永久当作最终设计。

旧 `docs/sukka-reference.md` 中“v1 单仓 Pages/Release”是此前 RuleMesh 选择，不是 Sukka 实际发布结构；应明确退役此结论，避免旧描述继续驱动实现。当前 AGENTS 中“两种路由计划”“私人构建”“只引用不可变发布版本”等也与用户后续取消版本/私人产品层、采用固定站点入口的决定冲突，后续文档修订应统一，而非再新增旁路解释。

## 13. 应采用、删除与扩展的边界

**采用核心结构：**统一输入与规则语义容器；匹配类型和客户端 exporter 分离；实际生效的 domainset/non-IP/IP；语义边界内去重与白名单；稳定比较写入；源码/产物分仓；同一生成树 PR diff 和 main 发布；站点固定地址和真实文件目录；有理由的退役路径维护；保留有意义的质量检查。

**删除偏离：**面向使用者的 Release/tag 多版本入口、候选/稳定晋升服务、版本索引、专用回滚演练产品、重复构建/重复加载，及为了这些流程遗留的强绑定文档和实现。普通 Git 历史、CI artifact、输入审查快照不因名字出现“版本/哈希”而自动成为要删除的产品层。

**完成用户扩展：**多上游覆盖与冲突取舍；用户自定义 add/remove/route exception；Shadowrocket 完整 config、策略组、URL/QR 导入；Surge/Mihomo/sing-box 合适的完整配置或模板；客户端能力矩阵与显式差异。节点由使用者选择，不在规则项目里强行绑定某国家或 ISP。分类规则仍独立托管，完整 config 引用 ruleset，而不是展开成平铺原子条目。

**不默认复制：**Cloudflare/GitLab 三目的地、force push、产物仓库可见性切换/archive、复杂性能线程池、Telegram 专用客户端数据、全部 MITM/重定向模块。按产品是否需要决定；明确记录差异，不能把少部署两个镜像称为没有遵循核心，也不能把只做 Pages 称为已经遵循全部核心。

许可边界：借鉴架构不等于复制 AGPL 源码后还能继续以 MIT 覆盖全部实现；规则数据许可和自写构建代码许可分别处理。这里仅说明已读到的 LICENSE/README/package 不一致和实现来源问题，不作未经授权的许可证改换决定。

本次只新增这份调研文档，没有修改代码、workflow、规则、站点或远端仓库。下一步应以这里的事实修订既有方案与任务，再整体实施需要替换的模块，避免继续在错误接口外层堆叠补丁。
