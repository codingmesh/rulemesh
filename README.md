# RuleMesh

RuleMesh 是基于 [SukkaW/Surge](https://github.com/SukkaW/Surge) 持续开发的多客户端规则工程。项目直接继承 Sukka 的 `Source → Build → public` 构建链路、规则整理、多格式 writer、稳定写入、产物目录和静态规则站点，并在这些模块中继续增加细分类、Shadowrocket 和完整配置组合能力。

上游原始使用说明保存在 [docs/sukka-upstream-readme.md](docs/sukka-upstream-readme.md)，便于核对继承行为和后续同步。

规则站点：<https://codingmesh.github.io/rulemesh-site/>

## 目录

- `Source/`：所有人工维护和引入的规则源；RuleMesh 新分类直接进入这里。
- `Build/`：继承并改进的构建任务、规则模型和客户端 writer。
- `Modules/`、`Mock/`：继承的 Surge 模块和拦截响应资源。
- `public/`：本地生成结果，不提交到源码仓库。

规则站点保持 Sukka 的目录树展示方式。完整配置属于组合产物，生成在独立的 `Config/` 路径并从规则首页隐藏，避免把使用入口、验证元数据和规则文件混成一个页面。

## 支持目标

继承输出：

- Surge `List/`
- Mihomo / Clash `Clash/`
- sing-box `sing-box/`
- Surfboard `Surfboard/`
- Legacy Clash Premium `LegacyClashPremium/`

RuleMesh 增加：

- Shadowrocket `Shadowrocket/`
- Anthropic、OpenAI、Gemini、开发、社交、媒体、游戏平台等细分类
- 直接接入现有构建任务的完整配置组合

## Shadowrocket 配置

- 标准档：[配置 URL](https://codingmesh.github.io/rulemesh-site/Config/Shadowrocket/standard.conf) · [二维码](https://codingmesh.github.io/rulemesh-site/Config/Shadowrocket/standard.svg)
- 广告拦截档：[配置 URL](https://codingmesh.github.io/rulemesh-site/Config/Shadowrocket/advertising.conf) · [二维码](https://codingmesh.github.io/rulemesh-site/Config/Shadowrocket/advertising.svg)

配置本身和规则文件使用同一个固定 HTTPS 站点，但 `Config/` 不出现在规则目录首页。节点与订阅仍保留在 Shadowrocket 客户端，由 `node-selection` 和各服务组选择。

## 开发

需要 `.node-version` 指定的 Node.js 和 `packageManager` 指定的 pnpm。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
```

构建复用已发布产物以保持未变化文件的时间和内容稳定。生成完成后，`public/index.html` 是规则目录，`.BUILD_FINISHED` 是完整构建标记。

## 上游同步

仓库保留 `upstream` 指向 `https://github.com/SukkaW/Surge.git`。上游更新先合并到工作分支，再处理 RuleMesh 对同一模块的修改并运行完整构建验证。

```sh
git fetch upstream master
git merge upstream/master
```

## 许可

项目整体使用 [GNU AGPL-3.0](LICENSE)。RuleMesh 直接基于 SukkaW/Surge 修改，必须保留 [NOTICE](NOTICE) 中的上游版权和修改说明。引入的第三方规则数据保留各自许可与来源，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和 `licenses/`。
