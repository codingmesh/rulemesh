# RuleMesh 文档与研究索引

本目录保留 RuleMesh 在 2026-10-11 完成的上游研究、来源核查与采用决策。研究文档是项目设计和审查的依据，不等同于当前实现状态；代码是否已经落实某项结论，应继续以源码、来源登记、生成产物和验收结果为准。

| 文档 | 内容 | 状态 |
| --- | --- | --- |
| [research.md](research.md) | 主流规则仓库、客户端格式与维护状态研究 | 研究快照 |
| [research-complete-coverage.md](research-complete-coverage.md) | 多仓库完整配置、分类覆盖和仓库角色比较 | 研究快照 |
| [stage-a-source-audit.md](stage-a-source-audit.md) | 首批分类、固定来源和规则能力审计 | 研究快照 |
| [sukka-full-audit.md](sukka-full-audit.md) | SukkaW/Surge 源码、构建、发布和维护体系完整核查 | 研究快照 |
| [sukka-reference.md](sukka-reference.md) | Sukka 架构事实与 RuleMesh 历史取舍 | 参考记录 |
| [reference-adoption.md](reference-adoption.md) | 研究结论到当前代码、产物和验收的采用映射 | 当前采用记录 |
| [refactor-analysis.md](refactor-analysis.md) | 2026-10-12 全项目与客户端使用分析，含最小复现及此前判断纠正 | 基线 ed766d95 的核查结果 |
| [engineering.md](engineering.md) | 工程体系、目录/依赖、接口、类型/错误、共享资源收尾、行为基线、历史输入/缓存、测试与CI规范 | 1.2；已落实，本地工程验收通过 |
| [refactor-design.md](refactor-design.md) | 工程重构范围、架构取舍及收益准入条件 | 1.3；项目交付与补充设备测试边界明确 |
| [refactor-tasks.md](refactor-tasks.md) | E01–E12工程任务与P01–P07项目验收 | 当前清单；不混入失效的中间状态 |
| [engineering-acceptance.md](engineering-acceptance.md) | 基线、固定输入冷/热/重复构建、worker、原生、站点、CI、工具身份及实际限制 | 本轮工程验收证据 |
| [software-quality-research.md](software-quality-research.md) | ISO/CISQ、Google、SEI与设计原则的一手依据；情境化评估方法 | 2026-10-12研究；不作认证声明 |
| [software-quality-assessment.md](software-quality-assessment.md) | 当前源码的原则、依赖、维护与真实扩展实验 | 已定工程及代表性维护/扩展场景通过；专项未测边界保留 |
| [client-acceptance.md](client-acceptance.md) | 分类、优先级、配置、维护、站点与公开交付身份；补充客户端实测 | 项目验收记录与实际发布状态 |

以 `engineering.md` 为统一工程规范，`refactor-tasks.md` 为当前任务清单，`client-acceptance.md`记录项目交付验收。`reference-adoption.md`维护当前采用关系；旧研究保留日期、固定提交和当时限制，不作为当前状态声明。手机实机和客户端内部完整流程不作为规则项目交付门槛。

后续研究应更新或新增有日期的文档，并在本索引中说明替代关系。即使实现方向改变，也保留旧研究及其固定提交、证据链接和当时的限制，避免重复调研或丢失决策依据。
