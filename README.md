# RuleMesh

RuleMesh 是基于 [SukkaW/Surge](https://github.com/SukkaW/Surge) 持续维护的多客户端规则集工程。项目直接扩展 Sukka 的 `Source → Build → writer → public` 链路，不维护第二套规则引擎。

- 项目主页：<https://codingmesh.github.io/ruleset/>
- 规则目录：<https://codingmesh.github.io/ruleset/#rules>
- 客户端配置：<https://codingmesh.github.io/ruleset/#configs>
- 生成仓库：<https://github.com/codingmesh/ruleset>
- 源码仓库：<https://github.com/codingmesh/rulemesh>

公开站点只有一个入口，通过页面内状态切换概览、Sukka 风格规则目录和客户端配置。规则目录只展示规则文件；配置区域再按客户端切换，避免重新定位或打开另一套页面。

## 客户端交付

| 客户端 | 规则目录 | 完整配置交付 |
| --- | --- | --- |
| Shadowrocket | `Shadowrocket/` | 标准/广告完整配置 URL 与二维码，可直接导入 |
| Surge | `List/` | 标准/广告完整结构模板；使用本地节点底稿组合 |
| Mihomo / Clash | `Clash/` | 标准/广告完整 YAML 模板；使用本地节点底稿组合 |
| sing-box | `sing-box/` | 标准/广告完整 JSON 模板；使用本地节点底稿组合 |
| Surfboard | `Surfboard/` | 规则文件 |
| Legacy Clash Premium | `LegacyClashPremium/` | 兼容格式规则文件 |

标准档不启用广告拦截；广告档显式增加对应规则和拒绝策略。

### Shadowrocket

- 标准档：[配置 URL](https://codingmesh.github.io/ruleset/Config/Shadowrocket/standard.conf) · [二维码](https://codingmesh.github.io/ruleset/Config/Shadowrocket/standard.svg)
- 广告档：[配置 URL](https://codingmesh.github.io/ruleset/Config/Shadowrocket/advertising.conf) · [二维码](https://codingmesh.github.io/ruleset/Config/Shadowrocket/advertising.svg)

配置不包含节点或订阅凭证；导入后通过 `node-selection` 和各服务组选择客户端已有节点。

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

增加 `--advertising` 生成广告档，使用 `--output` 指定输出位置。节点底稿和合成结果写入被 Git 忽略的 `local/`，不会发布。

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
Build/                  构建、writer、配置组合和验收程序
Modules/                Surge 模块
Mock/                   拦截响应资源
public/                 本地生成目录，不提交源码仓库
```

MetaCubeX 细分类固定到 `sources/registry.json` 中的提交。每日同步任务发现新提交后生成候选 PR；构建只使用已审阅并提交的 revision。Sukka 固定产物和官方网络事实记录在 `sources/maintained.json`，不会自动同步。`sources/overrides.json` 会在每次同步后重新应用有证据的 `add` 和 `remove`，因此自有修正不会被候选更新覆盖。

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
- 通过隔离的本地 DNS、HTTP 代理和混合入站验证细服务、国内、局域网、兜底、服务 IP 与私有 IP 路由；
- 验证配置引用文件、标准/广告隔离、顺序、自有规则重应用、许可证和发布目录。

macOS 本地同时使用 Surge CLI 和 Shadowrocket GUI 验证。验收不会启用系统代理或替换当前正在使用的配置。

## 发布

main 构建通过后，将同一棵 `public/` 完整同步到 `codingmesh/ruleset`，再等待 GitHub Pages 返回当前源码提交标记。`Config/` 与规则文件共用固定 HTTPS 地址，但不显示在 ruleset 目录树中。

## 上游与许可

`upstream` 指向 SukkaW/Surge，上游更新直接合并到当前代码。[NOTICE](NOTICE) 记录上游版权和 RuleMesh 修改说明。项目整体使用 [GNU AGPL-3.0](LICENSE)；第三方数据与依赖许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和 `licenses/`。
