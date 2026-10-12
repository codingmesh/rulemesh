# RuleMesh 项目验收记录

日期：2026-10-12。对象：本轮源码及`.cache/project-final-output`交付树。验收针对规则管理项目的交付物，不要求安装系统扩展、启动VPN或完成全部手机/GUI流程。公开交付以对应源码提交的main Actions和站点deploy-check.txt为准；下面的线上地址检查是发布前对既有版本的实际记录，不冒充新版本上线结果。

## 当前项目验收结果

| 项目 | 实际结果与证据 | 判定 |
| --- | --- | --- |
| P01 分类与来源 | 四主端各95个配置分类；标准档109、广告档118个规则集引用；53个固定服务源无遗漏，所有有分类的策略组均有引用。Source维护归属及能力差异校验通过 | 本地通过 |
| P02 顺序与冲突 | 细服务/国内特例优先于宽平台；补齐Sukka的apple_cn、game-download排序。既有优先级测试扩展独立约束，先复现失败再修正；两内核38项原生请求包括Apple CN、游戏下载、直接CN IP和域名解析至CN IP | 通过当前契约及代表行为验证，不宣称穷尽所有互联网域名 |
| P03 格式与配置 | 最终719个登记产物、8份配置的字节/哈希/策略/引用/广告隔离通过；Surge、Mihomo、sing-box两档共6份原生配置检查通过，新增China SRS编译成功。Shadowrocket沿用已实测writer/导入结构；其为完整profile，其他三端需组合真实节点底稿 | 本地通过 |
| P04 自定义与维护 | Source/override单链维护、重应用及来源/worker扩展实验；已有46项独立组/分类请求和规则刷新/重启/底稿重组；真实HTTP节点provider刷新和完整配置API热载入通过 | 通过已列维护与更新机制 |
| P05 站点与入口 | 规则树与Config分开；四客户端切换和8张卡片的URL/scheme对应正确。二维码改为卡片内原生details展开，展开后地址不变且图片加载成功；复制成功反馈、键盘切换和完整配置表单Enter校验实测通过；320/375/1280px无横向溢出，浅/深色配置页axe WCAG2 A/AA均0违规 | 本地通过 |
| P06 工程、文档与许可 | TypeScript、68项测试、ESLint 0 error/25条既有warning通过；兼容writer、目录常量、worker注册及展示删除，来源/许可/研究保留；删除失效实施状态和设备验收门槛 | 通过 |
| P07 公开交付身份 | 发布前，现有站点、8份配置、2份QR、4份Anthropic规则和部署标记共16个URL返回200，标记为ed766d95；新版本必须由既有main发布链核对对应提交标记及新China IP引用 | 既有URL通过；本次上线证据由[对应Actions](https://github.com/codingmesh/rulemesh/actions/workflows/main.yml)和deploy-check提供 |

本轮真实缺口及直接修正：

- sing-box缺CN IP兜底：固定MetaCubeX `83c8208…:geo/geoip/cn.list`，共6,163个IPv4、3,446个IPv6输入，登记为人工固定快照，通过既有FileOutput/writer输出；服务与私有匹配先行，sing-box在resolve后匹配。
- Sukka分类名未进入细分类顺序：在现有serviceOrder补入apple_cn及game-download，不建立第二排序器。
- Clash Premium兼容残留：删除writer及其全部构建/worker/站点/README消费者，artifact acceptance拒绝旧目录重新进入交付。
- 文档将手机/GUI/系统扩展当成项目完成门槛，且任务页叠加已失效中间状态：已删除并改为当前项目任务和实际证据。

当前证据：`.cache/project-final-{types,tests,lint,build,acceptance,native}.txt`、`.cache/project-category-coverage.json`、`.cache/project-online-urls.json`、`.cache/project-priority-before.txt`、`.cache/project-generated-diff.json`及`.cache/project-china.srs`。完整构建复用已记录的固定动态/历史输入；CI发布则执行真实网络构建并核对同份交付树。产物对照确认49份删除全部属于LegacyClashPremium；新增6份为China IP五端输出及语义元数据，其他规则文件内容保持不变。下方记录的是此前客户端补充实测的环境及范围。

随后README/配置页优化：统一配置区16px正文及标题、控件层级；URL直接显示，QR内联折叠，模板组合说明保持可见。README精简为使用/规则/维护入口，详细操作归入既有工程文档，生成仓库README和Config说明同步精简。未增加纯样式单测；类型、相关lint和artifact acceptance通过。固定输入产物对照只有index、两份生成README和源码标记改变，规则与八份配置内容未变。浏览器截图、两主题a11y结果及检查日志位于`.cache/config-*`；这是界面与文档变更，不再重做设备或原生路由验证。

## 此前客户端补充实测

| 项目 | 环境和实际操作 | 结果 |
| --- | --- | --- |
| 独立选择 | Mihomo 1.19.32 / sing-box 1.14.3，隔离回环节点A/B，真实controller API及HTTP流量 | 根组选择A，AI家庭改B，Anthropic单独改A；OpenAI继续走B，均通过 |
| 分类优先级 | 每个策略使用不同回环出口，23个请求分别在两内核执行 | 46项通过；覆盖全部有分类的标准策略组及fallback，包含Gemini/Google、Copilot/Microsoft、YouTube/Google等具体服务与宽分类重叠 |
| 选择持久 | 保留同一客户端工作目录及节点/策略tag，关闭并重启内核 | Anthropic独立选择及家庭选择保留，并通过实际HTTP请求核对 |
| 远程规则更新 | 仅Anthropic规则集改为本机HTTP源，Mihomo通过真实provider更新API，sing-box通过原生update_interval | 更新前自定义域名走fallback，添加后走Anthropic的节点B；组选择保持B |
| 节点底稿更新 | 节点次序反转后重新组合配置，再次启动同一工作目录 | 独立服务选择保留；新自定义域名及原claude.ai仍走节点B。此为节点底稿重组场景，不是GUI机场订阅刷新验收 |
| HTTP节点订阅刷新 | Mihomo 1.19.32原生HTTP proxy-provider；订阅第二版增加node-c、改变顺序，并把同名node-b改到另一实际端口；PUT /providers/proxies/airport触发刷新 | 实际发生两次HTTP订阅请求；服务组出现node-c，Anthropic仍选node-b，claude.ai实际走新版端口；OpenAI仍走家庭选择node-a |
| 完整配置热载入 | 同一Mihomo进程，配置含节点底稿的profile.store-selected:true；维护的Anthropic规则文件加入自定义域名，PUT /configs?force=true重新载入完整配置 | 返回204；服务/家庭选择保留，自定义域名和claude.ai走新版node-b端口，OpenAI走node-a。这是原生内核热载入，不代替GUI远程profile刷新 |
| 原生字段 | sing-box节点底稿指定cache_file.path/cache_id，另有显式false的聚焦复审 | path/cache_id及其他原生字段保留；显式enabled:false受尊重，未指定时默认true |
| Shadowrocket导入 | macOS Shadowrocket 2.2.85，导入独立命名RuleMesh-QA.conf，原用户配置仍保持启用 | 110条规则、21个策略组、108/108规则集被识别；国内默认DIRECT，家庭/服务继承链解析正确，claude.ai解析至客户端已有Home节点 |
| Shadowrocket规则 | 已导入标准配置测试claude.ai、gemini.google.com、qq.com；最终QA副本复验claude.ai和qq.com | 具体域名条件命中，qq.com直连；新副本的订阅/父组/DIRECT语法经客户端自身保存确认 |
| 原生配置结构 | Surge Mac 6.4.4 CLI、Mihomo、sing-box各检查标准/广告两份最终配置 | 6份通过；Shadowrocket由上述真实GUI导入补充验证 |
| 整体集成 | 类型检查、68项测试、lint、同进程固定输入冷/热两次构建及artifact acceptance | 通过；762个文件集合、规范化内容、producer及输入身份相同；lint为0 error、25条既有warning |

分类静态核对使用标准Mihomo的108个实际引用，扫描domainset/non_ip的23,564条exact/suffix原子条件，得到18,630个不同条件，其中908个条件出现跨策略重叠。报告按实际引用先后记录胜出策略及来源类别，没有把重复条件自动判为错误或改变分流顺序。此核对不包含父子后缀、wildcard、进程、HTTP及IP条件的穷尽匹配；上述46项原生请求验证补充代表性实际路由。

## 本轮发现和直接修正

1. 原Mihomo/sing-box服务组只能选父组、根组或直连；为Anthropic选择真实node-a返回400。各端原生renderer现补齐真实节点候选：Mihomo同时支持inline与provider use，sing-box添加真实outbound tag，Surge每组包含实际代理与远程组。原继承候选的首选顺序保持，修复后API返回204，实际请求出口可区分。
2. Shadowrocket用`use=true`引用订阅并保留显式父组/直连候选，根组含PROXY。语法由2.2.85客户端编辑QA副本后自身生成的内容确认；单独regex会改变候选来源，不能据生成文本假定其保持继承。用户可在客户端根组选择自己的订阅/节点，不嵌入节点凭证或订阅URL。
3. sing-box原生成器覆盖cache_file整个对象；现保留调用者原生字段，仅对缺省enabled提供true。没有增加状态持久化框架、兼容导出或另一套配置模型。

上述节点候选和缓存字段修正集中在既有`client-config/configuration.ts`及其已有接口回归。当时两轴复审未发现新增可证阻断；后续分类、CN IP与清理的证据见本页当前项目验收结果，不能用旧评审直接代替新变更检查。

## 证据与实验边界

- `.cache/client-choice-probe.json`与`.cache/client-choice-fixed.txt`：真实controller验证服务节点候选与204结果；修复前400结果保留于会话工具记录。
- `.cache/client-runtime-results.json`与对应日志：46项路由、实际节点切换、重启、远程规则刷新、自定义域名与节点底稿重组结果。
- `.cache/client-subscription-results.json`、`.cache/client-subscription-check.txt`及`.cache/client-subscription-acceptance.cjs`：2026-10-12补测HTTP节点订阅刷新与完整配置热载入。使用当前configuration library和现有交付规则，仅把测试节点、DNS和资源接线设为回环/本地文件；本轮未修改生产代码，未重跑已通过的全量检查。
- `.cache/category-overlap-audit.json`：全引用exact/suffix相同条件的重叠清单与优先级。
- `.cache/client-native-config-check.json`、`.cache/client-final-build.txt`、`.cache/client-config-tests.txt`、`.cache/client-config-lint.txt`：最终交付树和工程检查。
- GUI验收副本源文件为`local/client-acceptance/RuleMesh-QA.conf`，不进入公开产物；App中保留同名未启用验收副本，当前用户配置未切换。

所有测试内核和HTTP/DNS监听仅绑定127.0.0.1，使用无凭证的临时节点和数据库；进程及监听在finally关闭，没有修改系统代理或用户已启用配置。测试规则更新运输对本机HTTP源显式直连，避免规则下载经只返回观察标签的模拟代理；这是隔离测试的接线，不是生产下载策略修改。CLI可用不等于GUI权限或设备连接已经验收。

## 补充兼容性验证边界

手机实机、完整GUI更新、系统扩展/VPN连接、系统TUN及真实外网网络环境未纳入本轮必需验收；不以其未执行判定规则项目失败，也不宣称已经执行。这些环境说明不再作为待办门槛反复尝试。

已验证的更新使用稳定节点名称、回环HTTP provider及Mihomo底稿的store-selected配置。客户端删除/改名节点、覆盖手工GUI编辑等未作保证；源规则自定义通过项目Source/override维护，由重新生成而非GUI编辑保留提供维护合同。
