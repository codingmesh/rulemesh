# RuleMesh

基于 [SukkaW/Surge](https://github.com/SukkaW/Surge) 的多客户端规则项目，提供按服务分类的规则组，以及标准分流和广告拦截两种配置。

**[客户端配置与导入](https://codingmesh.github.io/ruleset/#configs)** · [规则目录](https://codingmesh.github.io/ruleset/#rules) · [研究与维护文档](docs/README.md)

## 使用配置

| 客户端 | 标准分流 | 广告拦截 | 使用方式 |
| --- | --- | --- | --- |
| Shadowrocket | [配置 URL](https://codingmesh.github.io/ruleset/Config/Shadowrocket/standard.conf) | [配置 URL](https://codingmesh.github.io/ruleset/Config/Shadowrocket/advertising.conf) | 直接导入，使用客户端已有节点 |
| Surge | [模板 URL](https://codingmesh.github.io/ruleset/Config/surge/standard.conf) | [模板 URL](https://codingmesh.github.io/ruleset/Config/surge/advertising.conf) | 加入自己的节点底稿 |
| Clash Verge Rev / Mihomo | [模板 URL](https://codingmesh.github.io/ruleset/Config/mihomo/standard.yaml) | [模板 URL](https://codingmesh.github.io/ruleset/Config/mihomo/advertising.yaml) | 加入自己的节点底稿 |
| sing-box | [模板 URL](https://codingmesh.github.io/ruleset/Config/singbox/standard.json) | [模板 URL](https://codingmesh.github.io/ruleset/Config/singbox/advertising.json) | 加入自己的节点底稿 |

标准分流默认让国内、局域网流量直连，其余按服务分组；广告档在此基础上增加拦截。节点和服务组的出口可在客户端调整。

### Shadowrocket

在[配置页](https://codingmesh.github.io/ruleset/#configs)选择标准或广告档，点击“导入客户端”，也可以复制 URL 手动导入。二维码在卡片内展开。

导入后，在 `node-selection` 的 Servers 中选择已有订阅或节点；AI、社交、流媒体及具体服务组可分别调整。

<details>
<summary>Shadowrocket 导入二维码</summary>

<p>标准分流</p>
<img src="https://codingmesh.github.io/ruleset/Config/Shadowrocket/standard.svg" alt="Shadowrocket 标准分流导入二维码" width="208" height="208">

<p>广告拦截</p>
<img src="https://codingmesh.github.io/ruleset/Config/Shadowrocket/advertising.svg" alt="Shadowrocket 广告拦截导入二维码" width="208" height="208">

</details>

### Surge、Mihomo、sing-box

公开模板中的 `REPLACE-ME` 是节点占位项。使用源码仓库的组合命令生成包含自己节点的完整配置：

```sh
pnpm install --frozen-lockfile
pnpm run config -- compose surge --nodes /absolute/path/base.conf
pnpm run config -- compose mihomo --nodes /absolute/path/base.yaml
pnpm run config -- compose singbox --nodes /absolute/path/base.json
```

选择对应客户端的命令；添加 `--advertising` 生成广告档，`--output` 指定输出路径。结果默认写入 `local/`，不会发布节点凭证。

生成后可本地导入。若使用自己的 HTTPS 地址托管，将 URL 粘贴到配置页对应客户端的“完整配置 URL”中，即可打开客户端导入。

## 使用规则组

已有自己的配置时，可从[规则目录](https://codingmesh.github.io/ruleset/#rules)复制所需分类的 URL，使用客户端原生规则集引用。

| 客户端 | 规则位置 |
| --- | --- |
| Surge | `List/{domainset,non_ip,ip}/` |
| Shadowrocket | `Shadowrocket/{domainset,non_ip,ip}/` |
| Mihomo / Clash Verge Rev | `Clash/{domainset,non_ip,ip}/` |
| sing-box | `sing-box/{domainset,non_ip,ip}/` |
| Surfboard | `Surfboard/{domainset,non_ip,ip}/` |

原生格式间存在表达差异，见[客户端能力说明](https://codingmesh.github.io/ruleset/Config/capability-gaps.json)。

## 自定义与维护

人工规则维护在 `Source/`；自动同步分类的自有修正维护在 `sources/overrides.json`。两者通过同一条构建链生成各端规则。

- [维护操作与工程规范](docs/engineering.md#维护操作)：修改、新增规则、来源登记及构建命令。
- [研究与采用记录](docs/README.md)：Sukka、MetaCubeX及其他参考项目的设计依据。
- [项目验收](docs/client-acceptance.md)：格式、分流、维护和分发的实际证据。

`main` 验证通过后更新[生成仓库](https://github.com/codingmesh/ruleset)，由固定站点提供最新规则和配置。

## 许可与致谢

基于 SukkaW/Surge 的构建与规则整理实现开发，采用提交及修改说明见 [NOTICE](NOTICE)。项目使用 [AGPL-3.0](LICENSE)；MetaCubeX 等第三方数据的来源与许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
