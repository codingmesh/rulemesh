# 工程重构验收记录

日期：2026-10-12。源码基线：`ed766d95`。对应工程方案1.3、工程规范1.2、E01–E12与Q01–Q11。

本记录保留工程重构及已确认正确性修复的执行证据；各阶段文件计数和字节对照只对应当时的产物。最新分类、CN IP、兼容输出清理与分发验收见[项目验收记录](client-acceptance.md)，不从本页历史数字推断当前树。手机实机或系统扩展不作为项目完成门槛。

2026-10-12补充质量整改：初评指出的下载/解析循环及隐式客户端分派已修正，来源适配、隔离writer main/worker扩展、数据维护和新增目标编译遗漏反例均通过；最新为68项测试，114模块静态import无循环或lib→入口反向依赖。当前工程及代表性维护/扩展场景验收详见[代码与架构质量评估](software-quality-assessment.md)，不以本记录宣称所有质量属性或所有未来客户端已验证。

随后已完成[本机客户端使用验收](client-acceptance.md)，包括独立节点选择、46项实际分流、规则刷新/节点重组/重启持久和Shadowrocket导入。新增节点候选及保留原生缓存字段是经过实际使用反例确认的产品修正；此前“8份配置字节相同”仅属于前一轮结构重构对照，不能套用到本轮有意增加候选的变更。

## 评审纠正与修复后复验

此前“验收通过”的结论被撤回：正常构建和健康缓存的对照没有覆盖危险目录、越界写入、并发失败收尾、缓存污染及交付规则顺序。下面记录修复后实际执行的证据，不以旧结论替代复验。

| 评审问题 | 修复与反例结果 |
| --- | --- |
| 输出目录误删 | 删除前核对仓库、允许输出位置、真实路径、缓存分离及已有目录归属。Source、Build、仓库祖先及指向源码的符号链接在任何破坏性IO前拒绝；测试拦截IO，无真实删除 |
| 越界/重复写入 | async、sync、copy及stream统一写前预占，写后提交，finally释放。越界写、符号链接和并发同路径被拒绝，原字节不变；有在途写入时不能释放context |
| 并发失败遗漏收尾 | 现有并发收尾函数由入口移到共享IO模块，task/writer/worker各层等待全部已启动工作；fallback赢家确定后也等待输掉的请求。真实writer失败→另一writer等待的反例证明任务不会提前返回、不会产生late.conf，随后新构建有效 |
| 污染缓存复用 | 内嵌内容标记只能在旧manifest与实际字节校验通过后使用；污染、缺少/无效清单重新生成。没有旧文件兼容分支。冷/热的业务producer都为writer |
| sing-box顺序漏检 | 验收实际交付的顺序、动作、策略、DNS解析阶段、资源与出站引用。反转规则、换目标、提前resolve和错误download_detour均被阻断；原生回环读取交付配置，仅注入隔离节点/DNS/本地资源路径 |
| 复审发现IPFS源错误被吞 | 严格校验必需网关JSON数组与每个URL。错误对象、空数组及坏条目抛出带来源位置的错误；真实任务复验输出尝试数为0，原静默return[]已删除 |

修复后类型检查通过，67项测试通过，lint为0 error、25条既有warning。完整固定输入构建在同一进程运行冷/热两次，762个文件的集合、规范化内容、producer及全部输入身份相等；两次分别通过加强后的artifact acceptance。标准与规格两轴复审确认原五项及新增IPFS问题已修复，未发现剩余可报告问题。最终交付树另执行三端配置检查、全量MRS/SRS编译与两内核原生回环复验；执行结果收录在下方证据。

本次日志：`.cache/review-fix-tests.txt`、`.cache/review-fix-lint.txt`、`.cache/review-final-build.txt`、`.cache/review-final-native.txt`。固定输入验证器仍是临时工具，没有加入生产构建或长期快照平台。

最终原生复验全部通过：Surge/Mihomo/sing-box共6份配置检查；68份domain MRS、117份SRS（domainset 68、non_ip 29、ip 20）编译；Mihomo/sing-box对实际交付的standard/advertising配置运行30项隔离路由检查。未修改系统代理或当前客户端配置。

## 实施结果与收益

| 项目 | 实际结果 |
| --- | --- |
| 继承架构 | 保留Source→FileOutput→writer fan-out、trie/CIDR整理、共享worker、trace和稳定写入；没有第二规则引擎、vendor副本或扩展层 |
| 职责 | 配置library供build/CLI调用；原生回环读取实际交付配置；客户端静态事实一处维护；站点视图、能力核查、来源校验与入口分开；库不反向依赖执行入口 |
| 语义 | 关键词豁免真正作用于输出；sing-box独立条件保持OR；未知/空条件阻断；原始读错误和位置保留；原生能力缺口与格式投影分别报告 |
| 生命周期 | import不启动下载/持久化/线程；每次任务清理独立、全部等待；共享资源由入口关闭；取消错误不掩盖真实失败；失败worker后可在同一池开始新构建 |
| 输出 | 空目录生成，实际IO登记与哈希核查；不再整树复制旧public或维护删除黑名单；只有被请求的旧文件能用于日期复用；测速历史和Mock后备具有显式输入合同 |
| 来源 | 104个规则/声明文件维护归属闭合；固定源、人工快照、继承人工源、带证据修正分开；动态输入、HTTP Last-Modified、MTProto结果与代码树身份有记录 |
| CI | 删除background/wait无效键和浮动Sukka产物依赖；同一检查链、冻结lockfile、准确候选SHA、候选分支/PR复用、完整生成patch、PR不发布 |
| 文档 | 删除过时sources/owned及兼容迁移描述，研究保留；AGPL/NOTICE与Sukka采用提交保留；不再把模板schema通过描述为客户端已联网 |

## 验证证据

运行环境：Node 26.11.0、pnpm 12.8.1、Darwin arm64。修复后`pnpm exec tsc --noEmit`通过；`pnpm test`67项通过；`pnpm lint`零error。Config和Sync已移除旧整文件lint例外，少量顺序IO例外均在发生处注明理由；历史warning另行保留，不靠关闭规则取得通过。

- **基线**：代表性域名/suffix/keyword/IP输出由修改前的ed766d95实际生成，保存在semantics.test.ts，逐行一致。白名单和混合条件先复现旧错误再修复。配置使用从该提交解出的旧实现对同一输入生成；六份Surge/Mihomo/sing-box配置迁移前后逐字节一致。配置输入身份（目录/文件名及List/ip字节）为`56a4d42cbd44431c6e27a309cf4a8b9d6b253d2997f8ed373abf664037388d61`。旧public仅作为明确输入，未被假称是该提交的规则输出。
- **回归**：读取中断、未知/空规则、原始行号、错拼override、矛盾修正、孤立/缺失源、重复组合和名称冲突、清理失败、重复输出、缺历史输入、未登记文件、失败后写出、worker恢复有真实接口保护。
- **main/worker**：同一语义fixture实际走主线程与Jest worker，规则字节及原始条件诊断一致。worker使用自己的TS loader；关闭未启动池不创建线程，关闭后再次执行新池有效。
- **完整构建**：真实网络构建成功，最终交付树包含762个登记文件和8份配置；53个固定Meta分类当前revision为`83c8208bdfae92b1caaa29745f51f233b6f1847e`。artifact acceptance校验实际字节/哈希、引用、策略与来源；不是网页文案计数。
- **固定输入冷/热对照**：临时验证器记录真实HTTP/asset/签名备份/MTProto输入，在既有依赖seam重放；不加入生产代码或长期快照平台。人工与固定文件不变，测速及Mock历史字节固定，仅改变旧输出缓存。762个文件集合相同，仅归一化`# Last Updated:`、`#!desc=Last Updated:`中的时间和`! Last modified:`后，内容差异为0。JSON/config没有日期豁免。两份树各自通过artifact acceptance。同进程连续完整构建发现目录遍历未等待深层任务，修正为递归等待后全部文件内容差异为0，并有深层目录接口回归。
- **原生**：Surge CLI两个profile返回OK；Mihomo 1.19.32和sing-box 1.14.3两个profile校验通过；全部Mihomo domain MRS与sing-box SRS编译通过；两内核的标准/广告隔离回环DNS/HTTP测试通过。sing-box四组合（仅域名、仅端口、两者、都不）实测为hit/hit/hit/fallback；进程不匹配不再阻挡域名命中。没有改系统代理或用户active配置。
- **站点**：浏览器实测客户端切换、键盘箭头切换、每端两档的URL/原生scheme、复制API参数及复制失败反馈、HTTPS导入输入校验、Config不混入rules树。配置页及rules页axe WCAG2 A/AA均为0违规。浏览器环境拒绝clipboard-read，未把它记成OS剪贴板读取通过；实际writeText调用成功并校验了传入URL，拒绝/后备失败路径显示Copy failed。
- **workflow**：actionlint 1.7.12对全部四个workflow通过；固定source verify返回changed=false。GITHUB_TOKEN创建PR可能需要批准，但workflow_dispatch可触发，候选通过dispatch绑定提交而不是假定已检查。[GitHub触发说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)。本轮尚未推送，所以没有虚报新增远程CI或线上部署成功。

## 工具身份

| 工具/测试依赖 | 固定身份 |
| --- | --- |
| Mihomo 1.19.32，Darwin arm64 binary | SHA256 `94a386ec0149080deadd86b1f667363bde3c70f7489dba3258e52c56fc9a6d66` |
| sing-box 1.14.3，Darwin arm64 binary | SHA256 `28b7200074d6380006acc4f035a404c8af3dceb65dd92d7386ed92c9224e08a2` |
| actionlint 1.7.12，Darwin arm64 archive | SHA256 `aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f` |
| MaxMind Country/ASN测试数据库 | MaxMind-DB提交`6a690a705bc6962c0025a32e94a8f0dc8f86418c`；SHA256分别为`b37601903448683d241af52893c8cbf0fed461e0cdebe0bfaca01891fdeb6db9`与`75901b98ed6e58d3bd41af9985044b747a7ec0be1369f930c24f5e044427181a` |

GeoIP fixture只用于隔离原生测试，未加入public或替换实际客户端数据库。Linux二进制沿用workflow里的独立固定下载哈希。

## 允许的差异及限制

允许修复差异为关键词豁免、sing-box独立条件、错误阻断/定位、重复名称/组合阻断、Surge远程组节点包含、原始诊断/输入清单、旧文件移除、完整目录遍历、日期无意义diff消除和站点真实角色表达。`global.conf`增加专项任务归属标记，避免通用扫描与专项任务覆盖同一路径；规则正文未因此改变。

动态源的实际内容变化由输入哈希区分，不能笼统称作重构差异。旧数据只作历史、后备或缓存。Shadowrocket是完整profile，其他三端仍是需要组合节点底稿的结构模板。后续项目验收已补齐CN IP、独立节点候选和代表性更新验证；当前结论以项目验收记录为准，不沿用早期的待定清单。
