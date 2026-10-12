# RuleMesh 代码与架构质量评估

日期：2026-10-12。对象：`ed766d95`上的当前未提交工作树，包含本轮重构、六项问题修复及后续质量整改。依据：[软件工程质量评估研究](software-quality-research.md)。本记录绑定具体工程、维护及扩展场景，不作ISO认证或所有未来软件质量属性均已验证的声明。

## 判断范围与结论

**已满足本项目已约定的核心代码、架构及代表性维护/扩展场景验收。** 初评指出的循环依赖和隐式客户端分派已直接修正；通过真实来源适配、隔离writer扩展、数据维护、编译遗漏反例及原端回归证明收益。标准/规格两轴复审未发现剩余可行动问题；未执行的专项评价保留明确边界。

此前“通过测试即全面达标”的依据不充分。本记录补足职责、依赖、变更局部性及真实扩展证据，不以测试数量或设计模式名称作为质量分数。

## 维度与证据

| 维度 | 当前判断 | 实际证据与边界 |
| --- | --- | --- |
| 核心功能及可靠性 | 通过已测场景 | 原始规则语义、主线程/worker、并发writer失败收尾、危险目录、越界/重复IO、污染缓存、缺失来源、实际sing-box顺序和IPFS错误输入有反例保护；完整固定输入冷/热与原生回环通过。不是所有第三方网络故障或所有规则组合均已验证 |
| 职责与依赖 | 通过已定约束 | 配置生成与task/CLI分开；trace不携带业务输出登记；客户端交付事实集中。114个非测试Build/Source TS模块的静态运行时import循环为0，lib→执行入口为0；下载模块不再依赖AdGuard解析 |
| 可理解、可分析 | 通过接口/诊断核查 | 来源、行号、cause、产物/输入身份可定位；模块职责与日常命令有文档；两轴复审核对了真实调用链。没有以未执行的独立维护者阅读耗时或满意度试验作证明 |
| 可修改、可维护 | 通过代表场景 | 隔离实验仅增加域名输入，四端及临时writer自动出现新域名并保留原exact/suffix；规则算法和renderer无需修改。已有override/来源归属错误回归继续有效；长期缺陷趋势未测 |
| 可扩展 | 通过代表场景 | 新来源预处理经真实loopback下载进入四端writer；临时新domain-view writer仅涉及实现、已有复活注册与已有fan-out三处，main/worker一致且旧四端保留。新增ConfigTarget遗漏composer编译失败。没有宣称新客户端所有能力或安装路径均已验证 |
| 简洁性与模式 | 通过当前取舍评审 | 复用既有过滤函数及splitTextIntoLines seam；删除AdGuard特定下载参数与默认sing-box兜底；私有composer将render/sample绑定。没有第二引擎、兼容wrapper或通用service container。统一writer宽接口保留现有能力合同，不按模式数量打分 |
| 回归保护 | 通过已定义重点 | 68项测试、交付验收定向反例、762个产物同进程冷/热及30项实际交付路由检查；8份配置与整改前字节相同。未对全部模块做系统变异测试，不以测试数或覆盖率宣布全面质量 |
| 性能、总体安全与长期运行 | 未完成专项评价 | 有构建和worker运行记录及路径安全反例；没有统一资源预算、长期性能趋势或全面安全扫描。本文不据此宣称达标，也不自动扩张为发布/回滚系统 |

## 结构修正及扩展取舍

### 下载与过滤解析的循环依赖

初评确认下载与AdGuard解析形成一个二模块强连通分量。现已删除`fetch-assets.ts`对`filters.ts`的import，将特定布尔参数替换为调用者提供的预处理函数。AdGuard调用传原`ignoreAdGuardUnsupportedLine`，普通hosts/domain调用不传过滤器。预处理仍在processLine之前执行。

没有创建第二解析器、转发兼容层或新的下载框架。真实loopback测试验证plain、AdGuard及新增record来源适配，过滤为空时仍拒绝必需源。当前下载模块仅处理传入的通用函数，对来源语法没有知识。

核对使用TypeScript AST读取静态import/export，排除type-only import和测试文件；初评证据为`.cache/quality-architecture-evidence.json`，修复后为`.cache/quality-architecture-final.json`。该核对不包含动态import、require、运行时条件依赖或第三方依赖；worker、import安全与故障收尾由实际行为实验补充，不将静态图结果扩大为所有运行时行为证明。

### 新客户端的扩展位置与遗漏风险

当前交付事实集中在`Build/lib/client-config/clients.ts`，但实际格式行为仍有必要的不同实现。新增客户端需要考虑：

1. writer及`strategy-write-data.ts`的worker复活注册；
2. `domainset.ts`、`ruleset.ts`的实际fan-out；
3. ConfigTarget与客户端交付定义；
4. 配置生成、sampleBase、能力诊断与批准；
5. 交付验收、native工具和必要CI验证。

这些位置代表不同职责，不能只按文件数量判为散弹式修改，也不应该全部塞入一个mega registry。`configuration.ts`已删除两套if及默认sing-box分支；一个私有、类型穷尽的composer表将每个支持端的renderer与sample成对绑定，build/CLI仍调用原来的公开函数。未知目标明确失败。

在内存中向ConfigTarget增加`quality_probe`，不修改生产文件：类型检查报告2741，要求composer提供该目标，证明遗漏不会默认套用sing-box。隔离复制树中的临时JSON domain-view writer仅改实现、已有worker复活表和domainset fan-out三个位置，main/worker所有文件逐字节一致；仅改变域名输入后，原四端及实验格式都保留旧规则并输出新增规则。

这是对来源适配、writer seam和注册遗漏的实证，不是第五客户端完整产品验收。临时writer具有明确domain-view合同，不声称表达进程/IP/HTTP规则，未合入生产；旧原生能力差异仍按现有合同核查。

## 设计原则核对

| 原则 | 当前证据 | 可得出的结论 |
| --- | --- | --- |
| 单一职责与高内聚 | routing-profile负责策略，writer负责格式，task负责取输入/编排，视图消费交付事实；下载接收来源函数 | 当前职责约束成立，来源语法变化不要求修改下载实现 |
| 信息隐藏与低耦合 | 配置生成从执行入口抽离，来源核查及共享IO封装；lib不静态导入task | 有改善；全局构建context、显式begin/finish及reserve/commit/release仍要求调用者理解生命周期合同，不能只看文件拆分 |
| 开闭原则 | 新writer沿既有策略接口接入main/worker，不改解析；新来源通过函数注入 | 代表性扩展成立，组合根登记保留各自职责，新增目标缺实现编译失败 |
| 里氏替换与行为契约 | 同一语义数据由main/worker使用，native能力差异明确报告 | 已验证代表性替换语义；不能要求所有客户端表达同一能力，也不能由类型检查推出全部条件可替换 |
| 接口隔离 | BaseWriteStrategy要求17种write方法，不同格式有noop或显式unsupported | 宽接口是继承实现的取舍，需要能力与调用合同一致；不足以仅因noop判硬违规，也不是当前新增接口层的理由 |
| 依赖方向 | 高层路由不依赖HTML，配置库不依赖CLI/task，下载不依赖解析器 | 已定方向成立；采用实际函数seam，不套用完整Clean Architecture或给每层加interface |
| DRY与简洁性 | 客户端URL/path/scheme共享、旧任务算法迁到真实library并删除副本 | 有明确收益；不能因各端原生renderer不同而强行统一，也不能用模式数量衡量质量 |

## 本轮验收证据与边界

修复与行为证据：`.cache/quality-fix-tests.txt`（68项）、`.cache/quality-fix-lint.txt`（0 error、25条既有warning）、`.cache/quality-target-extension.json`（缺目标编译阻断）、`.cache/quality-writer-extension.json`及对应日志（新writer/worker/数据维护）、`.cache/quality-config-preservation.json`（8份配置字节不变）。

总体集成：`.cache/quality-final-build.txt`记录同进程两次冷/热构建、762个产物的规范化内容/producer/全部输入身份一致，两份树均通过严格artifact acceptance；`.cache/quality-final-native.txt`记录实际交付树的两内核30项回环路由。固定输入验证器只调整旧fixture的过滤参数身份映射，生产调用仍使用函数；真实预处理路径由loopback测试验证，没有把离线重放称为新的一次外部网络抓取。

生产仅调整下载/预处理调用与配置composer；一个新增接口回归和现有composition测试保护真实风险。临时writer实验位于忽略的`.cache/quality-writer-probe`，不引入质量评分平台、发布系统或生产实验目标。长期性能趋势、全面安全度量、所有未来格式及完整客户端产品验收不在本轮已测范围，不伪造通过。
