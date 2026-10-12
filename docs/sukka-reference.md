# SukkaW/Surge 架构参考与 RuleMesh 取舍

> 文档状态：2026-10-11 的研究与历史决策记录。当前实现状态以源码和验收结果为准；完整事实核查见 [Sukka 仓库完整架构核查](sukka-full-audit.md)。

调研日期：2026-10-11（America/Los_Angeles）<br>
参考仓库：[SukkaW/Surge](https://github.com/SukkaW/Surge)<br>
源码快照：`6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62`<br>
方法：静态阅读源码、README 和 CI，未执行上游构建脚本，未进行客户端运行验证。下列链接均固定到该提交，不能当作未来版本的承诺。历史采用决定见 [上游采用清单](upstream-adoption.md)；本页保留源码事实。

## 结论

Sukka 已有成熟的规则管理、收集整理、多客户端输出、构建和部署体系；RuleMesh 以其具体实现为规则工程基础，优先复用或适配，不能把“独立实现这些结构”作为默认任务。源码与产物分离、内容稳定及 README 的标准匹配阶段一并采用；项目额外承担自定义分类覆盖、能力诊断、候选审阅、固定输入与客户端配置扩展。

Sukka 主要交付规则集与引用示例，其规则工程体系可以作为基础；完整 Shadowrocket 等客户端配置由其他成熟模板与官方机制补齐。规则管理项目完整性与是否提供某软件整份个人配置是不同问题。同源多格式的实际表达范围仍按下面的源码证据核查。

## 1. 源码和规则源分层

`Source/domainset` 保存精确域名及以 `.` 开头的后缀域名；`Source/non_ip` 和 `Source/ip` 使用类似 Surge 的逗号规则行。域名集适合优化数据结构，非 IP 与 IP 分离便于在配置中先匹配域名，再决定是否进入地址匹配。

[`Build/build-common.ts`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-common.ts) 扫描源文件，读取标题和描述等元数据。`# $ custom_build_script` 标记会跳过通用转换，交给专用构建任务；域名集交给 `DomainsetOutput`，其余交给 `RulesetOutput`。

[`Build/index.ts`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/index.ts) 显式编排通用规则、国内地址、广告、CDN、流媒体、Telegram、AI 等任务。任务共享之前的构建产物，独立任务并发执行；完成后写入 `.BUILD_FINISHED`，异常退出失败。它还有 worker farm、缓存和构建性能报告，属于规模增长后的优化，不是 RuleMesh v1 的必要复杂度。

**RuleMesh 取舍：**借鉴阶段分层，但目录不是语义校验的替代品。导入时必须检查分类中的实际规则类型和解析依赖，不能仅因文件位于 `non_ip` 就相信其不会触发解析。规则分类和执行阶段分别建模，不把 `ai` 等分类绑定到某个出口。

## 2. 统一数据累积与输出策略

[`FileOutput`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/base.ts) 收集域名 trie、关键词、通配符、进程、URL、CIDR、ASN、GEOIP、端口等数据。它负责读取和汇总，输出格式由 [`BaseWriteStrategy`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/base.ts) 定义。

[`RulesetOutput`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/ruleset.ts) 默认安装 Surge、Mihomo/Clash、旧 Clash Premium、Surfboard 和 sing-box 输出策略；[`DomainsetOutput`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/domainset.ts) 安装 Surge 域名集、Clash 域名集、sing-box 策略。它还有仅对特定客户端输出的类。README 的目标列表不包含 Shadowrocket，代码中也未在该默认列表注册独立的 Shadowrocket 策略。

**RuleMesh 取舍：**保留“统一输入 → 多个 exporter”的接口。统一模型要比这些集合更严格：每条规则保存来源及语义选项，覆盖表达式与匹配顺序独立保存。Shadowrocket 单独作为目标验证，不能仅因其支持不少 Surge 规则就标记全部兼容。

## 3. 去重、排序和地址语义

`FileOutput` 使用 `HostnameSmolTrie` 汇总精确域名与后缀；其他多种类型用 `Set`。[`strategy-write-data.ts`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/rules/strategy-write-data.ts) 导出 trie，执行 `domainToASCII`，排序后写入各策略，并使用关键词过滤重叠域名。IPv4 CIDR 合并分别在普通桶和 `no-resolve` 桶内进行，当前代码没有对 IPv6 两桶调用同样的 merge。

普通 CIDR、ASN、GEOIP 与各自的 `no-resolve` 版本分别存储。写出顺序先处理 `no-resolve`，后处理普通地址匹配。[Surge exporter](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/surge.ts) 和 [Clash classical exporter](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/clash.ts) 将该标记写进相应 CIDR 行。

**RuleMesh 取舍：**可以用 trie 与集合消除同分类内冗余，但必须在覆盖处理之后压缩。不同分类、不同阶段、不同解析语义的记录不能仅凭值相同合并；来源证据需要保留。不能把关键词覆盖的条目从全局删除，因为不同分类可能需要更精确的优先级例外。

## 4. sing-box 输出存在明确的语义范围

[`SingboxSource`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/writing-strategy/singbox.ts) 写出 `version: 2` 的 JSON，包含精确域名、后缀、关键词和 IPv4/IPv6 CIDR。它当前将多个类型集中写在单个 headless rule 对象中。类型接口中列出字段，不代表实际 writer 会填充这些字段。

其通配符、User-Agent、进程名称、进程路径、URL 正则、ASN、GEOIP、源地址、端口、协议和其他规则 writer 当前均为 `noop`。CIDR writer 不使用 `noResolve` 参数，普通 CIDR 和 `no-resolve` CIDR 写入相同 `ip_cidr` 数组。因此当前转换不能称为通用的无损转换；这是该提交实现范围的事实，不代表 sing-box 本身不支持相应功能。

实际例子是 [`Source/non_ip/ai.conf`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Source/non_ip/ai.conf) 中 Google Gemini 跳转的 `URL-REGEX`：注释要求对相关域名启用 MITM，而 sing-box writer 不生成该 URL 条件。另一个例子是 [`Source/ip/ai.conf`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Source/ip/ai.conf) 的 `IP-ASN,399358`：不能期待它自动出现在 sing-box JSON 中。

**RuleMesh 取舍：**每个目标先进行能力检查；不支持的输入默认使该目标构建失败，只有明确选择的扩展产物允许省略，并生成缺失报告。地址规则的解析意图需要由客户端配置实现，不能声称将 `no-resolve` 改名成 JSON 字段即可等价。逻辑条件必须按官方语义构造独立或复合规则，不能把任意类型扁平塞入一个对象。

## 5. 官方动态数据和人工来源组合

[`Build/build-ai-cidr.ts`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-ai-cidr.ts) 从 OpenAI 官方 `chatgpt-voice.json` 读取前缀，验证 `prefixes`、`creationTime` 和每个地址，然后把 IPv4/IPv6 以 `no-resolve` 加入，并合并本地 AI IP 文件。输出描述记录数据地址及官方更新时间。

广告任务也调用 `appendDataSource` 记录所用 hosts、域名列表和过滤源；其 whitelist 方法用于特定广告数据过滤。[参考任务](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/build-reject-domainset.ts)。这些机制不等于已实现任意分类之间的精确域名转移或后缀集合减法。

**RuleMesh 取舍：**优先官方资料补充核心服务缺口；除格式和时间验证外，锁定实际下载的内容哈希，并保留候选数据，防止“同一个源码提交、不同时间下载”生成不同规则。自有覆盖要明确区分删除一条输入记录与排除某个匹配范围。

## 6. 内容稳定与发布过程

[`content-hash.ts`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/content-hash.ts) 对标题、描述和规则正文计算 SHA-256，不包括易变日期；[`create-file.ts`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/Build/lib/create-file.ts) 对比上一文件，内容未变则不重写，因此保留旧的 Last Updated。该内容哈希用于避免无效写入和差异噪声，不是整次发布的 manifest 或跨文件一致性协议。

[`main.yml`](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/.github/workflows/main.yml) 对 master push、PR、手动触发以及每日两次定时运行构建。之前产物来自 `SukkaLab/ruleset.skk.moe`；PR 分支对比构建产物与发布仓库，master 构建直接发布到 GitHub/GitLab 产物仓库和 Cloudflare Pages。GitHub 镜像使用部署 marker 等待 Pages 可见。

代码与生成产物分离值得借鉴，但当前 workflow 没有“每次远程数据变化先创建候选数据 PR，获审阅后才进入稳定版”的流程。每日定时 master 构建仍可直接发布新数据。部署 marker 证明某部署已可见，不能保证客户端同时更新所有规则文件。该 workflow 也不是按不可变版本目录发布整套客户端资源的方案。

**RuleMesh 取舍：**采用源码/产物分仓、上一份产物复用、PR 产物 diff、main 发布同一生成树和固定站点 URL。不增加 Release、不可变版本目录或晋升系统；客户端缓存仍需设备验证。

## 7. 许可证与复用边界

[README](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/README.md) 明确说明除 `List/ip/china_ip.conf` 使用 CC BY-SA 2.0 外，其余文件使用 AGPL-3.0；根 [LICENSE](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/LICENSE) 是 AGPL-3.0。[package.json](https://github.com/SukkaW/Surge/blob/6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62/package.json) 的 `license: ISC` 与上述声明不一致，不能据该字段认定可复制 Build 代码并以 ISC 发布。

本次仅参考架构和记载事实，不复制上游实现。后续如导入或改编规则、复制代码，必须在具体 source 的许可清单中记录对应许可和通知要求，不把 RuleMesh 自写工具的许可自动覆盖第三方规则数据。

## 8. 采用与新增责任清单

| 设计点 | Sukka 证据 | RuleMesh 决策 |
|---|---|---|
| domainset / non_ip / ip 分层与顺序 | Source、README、通用构建 | 采用具体结构及非 IP 在前、IP 在后的标准顺序；不自建提前 IP/重复复查档 |
| 统一收集 + 输出策略 | FileOutput、RulesetOutput | 优先复用产物或适配已有模块；额外保留来源、覆盖与语义诊断 |
| trie、Set、CIDR 分桶 | base、strategy-write-data | 同分类安全压缩，覆盖前不合并 |
| 官方数据 + 人工补充 | build-ai-cidr | 采用，增加固定内容快照 |
| 内容不变不更新时间 | content-hash、create-file | 采用，另设检查时间与发布时间 |
| 源码 / 产物分离 | CI、constants/dir | 采用，采用独立纯产物仓库及固定站点 |
| 候选数据 PR 审阅 | 当前 CI 不是该流程 | RuleMesh 自行实现 |
| 跨分类覆盖和本地节点接入 | 当前 whitelist 不是该契约 | RuleMesh 自行定义和验证 |
| 不支持语义必须阻断 | 部分 writer 使用 noop | RuleMesh 加强，不照搬静默省略 |
| 不可变多文件发布和升级契约 | 当前部署 marker 不提供 | 采用同一生成树持续部署，并说明客户端缓存限制 |

这些事实和采用边界已纳入方案 0.6 与上游采用清单。功能是否完成以实际实现及验证记录为准；旧实验代码和本页源码核查不能证明本版完整配置已经可用。
