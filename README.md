# RuleMesh

RuleMesh 是基于 [SukkaW/Surge](https://github.com/SukkaW/Surge) 继续维护的多客户端规则集项目。项目直接使用 Sukka 的规则处理、格式 writer、稳定写入和静态目录生成，不维护第二套规则引擎。

- 规则目录：<https://codingmesh.github.io/ruleset/>
- 生成仓库：<https://github.com/codingmesh/ruleset>
- 上游源码：<https://github.com/SukkaW/Surge>

公开站点只有一个 ruleset 目录页。它用于浏览和引用规则文件，不承担项目文档或配置向导职责；使用说明集中保留在本 README。

## 当前提供什么

| 客户端 | 生成目录 | 交付内容 |
| --- | --- | --- |
| Surge | `List/` | DOMAIN-SET、RULE-SET |
| Shadowrocket | `Shadowrocket/` | RULE-SET；另有可直接导入的完整配置 |
| Mihomo / Clash | `Clash/` | domain、classical、IP 规则文件 |
| sing-box | `sing-box/` | headless rule-set JSON |
| Surfboard | `Surfboard/` | 规则文件 |
| Legacy Clash Premium | `LegacyClashPremium/` | 兼容格式规则文件 |

目前只有 **Shadowrocket** 提供可直接导入的完整配置。Surge、Mihomo 和 sing-box 当前提供规则产物，需要从各自已有配置引用；项目不会把规则文件描述成完整客户端配置。

## Shadowrocket

标准配置不启用广告拦截；广告档显式增加拦截规则组。节点和订阅仍保留在客户端，导入后通过 `node-selection` 和各服务组选择。

- 标准档：[配置 URL](https://codingmesh.github.io/ruleset/Config/Shadowrocket/standard.conf) · [二维码](https://codingmesh.github.io/ruleset/Config/Shadowrocket/standard.svg)
- 广告档：[配置 URL](https://codingmesh.github.io/ruleset/Config/Shadowrocket/advertising.conf) · [二维码](https://codingmesh.github.io/ruleset/Config/Shadowrocket/advertising.svg)

`Config/` 与规则文件发布在同一 HTTPS 地址下，但不会显示在 ruleset 目录树中。

## 在已有配置中引用规则

以 Anthropic 域名规则为例：

- Surge：`https://codingmesh.github.io/ruleset/List/domainset/anthropic.conf`
- Shadowrocket：`https://codingmesh.github.io/ruleset/Shadowrocket/domainset/anthropic.conf`
- Mihomo：`https://codingmesh.github.io/ruleset/Clash/domainset/anthropic.txt`
- sing-box：`https://codingmesh.github.io/ruleset/sing-box/domainset/anthropic.json`

其他分类遵循相同目录和文件名约定，可从规则目录直接查看。

## 仓库结构

```text
Source/   人工维护的规则源
Build/    构建任务、规则模型、客户端 writer 和站点生成
Modules/  Surge 模块
Mock/     拦截响应资源
public/   本地生成目录，不提交源码仓库
```

新增分类直接进入 `Source/domainset`、`Source/non_ip` 或 `Source/ip`。新增客户端格式应扩展 `Build/lib/writing-strategy` 并接入现有 `FileOutput`，不要建立平行生成器。

## 本地构建

需要 `.node-version` 指定的 Node.js 和 `packageManager` 指定的 pnpm。

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test
pnpm lint
pnpm build
```

`pnpm build` 生成 `public/`。CI 将同一棵产物完整同步到 `codingmesh/ruleset`，随后等待 GitHub Pages 返回当前源码提交标记。

## 上游同步

`upstream` 指向 SukkaW/Surge。上游更新直接合并进当前代码，再处理 RuleMesh 对相同模块的改动并运行完整验证。

```sh
git fetch upstream master
git merge upstream/master
```

## 许可

项目整体使用 [GNU AGPL-3.0](LICENSE)。[NOTICE](NOTICE) 记录 SukkaW/Surge 上游版权和 RuleMesh 修改说明；第三方规则数据及依赖许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和 `licenses/`。
