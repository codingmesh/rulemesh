# RuleMesh

RuleMesh 是基于 [SukkaW/Surge](https://github.com/SukkaW/Surge) 持续维护的多客户端规则集工程。项目直接扩展 Sukka 的 `Source → Build → writer → public` 链路，不维护第二套规则引擎。

- 项目主页：<https://codingmesh.github.io/ruleset/>
- 规则目录：<https://codingmesh.github.io/ruleset/#rules>
- 客户端配置：<https://codingmesh.github.io/ruleset/#configs>
- 生成仓库：<https://github.com/codingmesh/ruleset>
- 源码仓库：<https://github.com/codingmesh/rulemesh>

公开站点只有一个入口，通过页面内状态切换概览、Sukka 风格规则目录和客户端配置。规则目录只展示规则文件；配置区域再按客户端切换，避免重新定位或打开另一套页面。

## 客户端交付

| 客户端 | 规则目录 | 配置交付 |
| --- | --- | --- |
| Shadowrocket | `Shadowrocket/` | 标准/广告完整配置 URL 与二维码，可直接导入 |
| Surge | `List/` | 标准/广告结构模板；本地组合后得到完整配置 |
| Clash Verge Rev / Mihomo | `Clash/` | 标准/广告 YAML 模板；本地组合后得到完整配置 |
| sing-box | `sing-box/` | 标准/广告 JSON 模板；本地组合后得到完整配置 |
| Surfboard | `Surfboard/` | 规则文件 |

标准档不启用广告拦截；广告档显式增加对应规则和拒绝策略。

### Shadowrocket

- 标准档：[配置 URL](https://codingmesh.github.io/ruleset/Config/Shadowrocket/standard.conf) · [二维码](https://codingmesh.github.io/ruleset/Config/Shadowrocket/standard.svg)
- 广告档：[配置 URL](https://codingmesh.github.io/ruleset/Config/Shadowrocket/advertising.conf) · [二维码](https://codingmesh.github.io/ruleset/Config/Shadowrocket/advertising.svg)

配置不包含节点或订阅凭证；导入后通过 `node-selection` 和各服务组选择客户端已有节点。

Shadowrocket根组通过订阅模式引用客户端已有节点；可在组的Servers中选择自己的订阅/策略。服务默认继承家庭与根组，国内/局域网组默认DIRECT；各服务可以在客户端单独调整。

### Surge、Mihomo、sing-box

线上模板位于：

- `Config/surge/{standard,advertising}.conf`
- `Config/mihomo/{standard,advertising}.yaml`
- `Config/singbox/{standard,advertising}.json`

模板中的 `REPLACE-ME` 只表示节点注入位置。推荐使用本地组合命令，把自己的节点底稿与当前规则结构合成可运行配置：

```sh
pnpm run config -- compose surge --nodes /absolute/path/base.conf
pnpm run config -- compose mihomo --nodes /absolute/path/base.yaml
pnpm run config -- compose singbox --nodes /absolute/path/base.json
```

站点中的每张配置卡都提供 **Open & Import**、**Copy URL** 和 **View Template**。直接打开公开模板可以检查客户端接管流程，但其中的 `REPLACE-ME` 不是可用节点；实际使用时仍需先组合自己的节点底稿。把组合后的文件托管到自己的 HTTPS 地址后，可在同一客户端面板的 **Import composed config** 区域粘贴 URL，通过 `surge:///install-config`、Clash Verge Rev 的 `clash://install-config` 或 `sing-box://import-remote-profile` 导入。URL 只在浏览器本地编码，不会提交给 RuleMesh。

客户端无法原生表达的规则类型不会被描述为等价支持；当前逐分类差异发布在 `Config/capability-gaps.json`，审阅基线位于 `sources/capability-gaps-approved.json`。新增或消失的能力缺口会阻断构建，必须更新理由和审阅日期。

增加 `--advertising` 生成广告档，使用 `--output` 指定输出位置。节点底稿和合成结果写入被 Git 忽略的 `local/`，不会发布。

每个服务组同时提供实际节点候选，Mihomo的provider节点、Surge的远程组和sing-box的真实outbound均沿用各端原生机制。sing-box保留底稿中的cache_file配置。实际验证过的选择、规则更新与节点重组持久范围见[本机使用验收](docs/client-acceptance.md)；完整profile覆盖及GUI订阅刷新不能由内核重启测试推定。

## 直接引用规则

以 Anthropic 为例：

- Surge：`https://codingmesh.github.io/ruleset/List/domainset/anthropic.conf`
- Shadowrocket：`https://codingmesh.github.io/ruleset/Shadowrocket/domainset/anthropic.conf`
- Mihomo：`https://codingmesh.github.io/ruleset/Clash/domainset/anthropic.txt`
- sing-box：`https://codingmesh.github.io/ruleset/sing-box/domainset/anthropic.json`

其他分类遵循相同目录和文件名约定。

## 规则维护

```text
Source/                 人工维护和继承的规则源
sources/registry.json   自动同步的上游文件与固定 revision
sources/maintained.json 固定快照、转换方式和许可来源
sources/overrides.json  对同步分类执行有证据的 add/remove 修正
sources/capability-gaps-approved.json  已审阅的客户端表达差异基线
Build/                  构建、writer、配置组合和验收程序
Modules/                Surge 模块
Mock/                   拦截响应资源
public/                 本地生成目录，不提交源码仓库
```

MetaCubeX 细分类固定到 `sources/registry.json` 中的提交。每日同步任务发现新提交后生成候选 PR；构建只使用已审阅并提交的 revision。Sukka 固定产物和官方网络事实记录在 `sources/maintained.json`，不会自动同步。`sources/overrides.json` 会在每次同步后重新应用有证据的 `add` 和 `remove`，因此自有修正不会被候选更新覆盖。

自定义规则按语义进入同一条构建链：人工分类直接编辑 `Source/domainset`、`Source/non_ip` 或 `Source/ip` 的对应文件；自动同步的 MetaCubeX 分类使用 `sources/overrides.json`，保留理由、证据和核查日期。新增人工源须在 `sources/maintained.json` 登记维护归属，并在 `Build/lib/client-config/routing-profile.ts` 指定策略或独立工具角色。构建会拒绝未知分类、遗漏来源、矛盾修正和缺失引用。

维护继承的规则时遵循 [工程规范](docs/engineering.md)。客户端路径和导入协议统一在 `Build/lib/client-config/clients.ts`，配置组合由 library 接口供构建、CLI 和原生验证共同使用。每次构建从空目录生成，旧输出仅供已声明的历史输入、后备资源与日期复用使用；`Internal/artifact-manifest.json` 记录实际文件、来源输入和哈希。

自建源登记在 `sources/maintained.json` 的 `manual` 数组，例如 `{"path":"Source/domainset/example.conf","license":"AGPL-3.0","maintenance":"项目自行维护"}`；不需要伪造上游提交。继承源列在 `inherited.paths`，固定快照列在 `files`。三者不能重复声明同一个文件。

```sh
pnpm run sync             # 检查是否存在新的候选输入
pnpm run sync -- --write  # 更新到最新上游，供候选 PR 使用
pnpm run sync:verify      # 验证当前固定输入可重现
```

## 研究与设计依据

项目保留此前对 SukkaW/Surge、MetaCubeX、blackmatrix7、Loyalsoldier、SagerNet、LOWERTOP、LingJingMaster、Johnshall 和 ACL4SSR 等项目的研究、来源审计与采用记录。研究资料及状态说明见 [docs/README.md](docs/README.md)，研究设计与当前实现的逐项映射见 [参考实现采用清单](docs/reference-adoption.md)。参考仓库不会因此成为 Git upstream 或自动同步来源。

## 构建与验收

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test
pnpm lint
pnpm build
PUBLIC_DIR=public pnpm acceptance
```

CI 还会使用固定 SHA-256 的 Mihomo 1.19.32 与 sing-box 1.14.3：

- 解析标准档与广告档完整配置；
- 编译全部 Mihomo domain MRS 与 sing-box SRS，并由 Mihomo 原生加载 classical/IP 文本 provider；
- 通过隔离的本地 DNS、HTTP 代理和混合入站验证 AI、社交、流媒体、开发、直连服务、国内、局域网、兜底、官方服务 IP、私有 IP 与广告拒绝；
- 验证配置引用文件、标准/广告隔离、顺序、自有规则重应用、许可证和发布目录。

项目验收覆盖规则分类与优先级、四主端格式与引用、配置组合、自定义维护、站点 URL／复制／导入协议，以及关键工程回归。macOS 可额外使用 Surge CLI 校验配置。原生验证使用隔离节点，不启用系统代理或替换现用配置；手机实机、GUI 全流程与系统扩展连接属于补充兼容性验证，不作为规则项目交付的前置条件。当前证据和发布状态见 [验收记录](docs/client-acceptance.md)。

## 发布

main 构建通过后，将同一棵 `public/` 完整同步到 `codingmesh/ruleset`，再等待 GitHub Pages 返回当前源码提交标记。`Config/` 与规则文件共用固定 HTTPS 地址，但不显示在 ruleset 目录树中。

## 上游与许可

RuleMesh 从 `SukkaW/Surge@6172daf80ac3f9a1d2dbdb9ad6b559554aa8ac62` 的代码树独立发布，不携带其祖先提交，也不依赖 Git `upstream` remote 或自动合并。后续只在明确需要时重新研究并人工采用设计或实现。[NOTICE](NOTICE) 记录原始版权和 RuleMesh 修改说明。项目整体使用 [GNU AGPL-3.0](LICENSE)；第三方数据与依赖许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和 `licenses/`。
