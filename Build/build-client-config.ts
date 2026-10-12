import path from 'node:path';
import qrcode from 'qrcode';
import { PUBLIC_DIR } from './constants/dir';
import { compareAndWriteFile } from './lib/create-file';
import { clients, configPath, importUrl, SITE_BASE, variants, validateSiteBase } from './lib/client-config/clients';
import { composeClientConfiguration, sampleBase, shadowrocketConfiguration } from './lib/client-config/configuration';
import { capabilityGaps, validateCapabilityGaps } from './lib/client-config/capability-gaps';
import { task } from './trace';
import { settleBuildWork } from './lib/build-output';

export const buildClientConfig = task(require.main === module, __filename)(async span => {
  validateSiteBase(SITE_BASE);
  const [mihomo, singbox] = await settleBuildWork([capabilityGaps('mihomo'), capabilityGaps('singbox')]);
  const targets = { mihomo, singbox };
  const approval = await validateCapabilityGaps(targets);
  await settleBuildWork(variants.flatMap(variant => clients.map(async client => {
    const advertising = variant === 'advertising';
    const content = client.id === 'shadowrocket'
      ? await shadowrocketConfiguration(advertising)
      : await composeClientConfiguration(client.id, sampleBase(client.id), advertising);
    const relative = configPath(client, variant);
    await compareAndWriteFile(span, content.trimEnd().split('\n'), path.join(PUBLIC_DIR, relative));
    if (client.qr) {
      const svg = await qrcode.toString(importUrl(client, SITE_BASE + relative), { type: 'svg', errorCorrectionLevel: 'M', margin: 4 });
      await compareAndWriteFile(span, svg.trim().split('\n'), path.join(PUBLIC_DIR, `Config/${client.configDirectory}/${variant}.svg`));
    }
  })));
  await settleBuildWork([
    compareAndWriteFile(span, [
      '# RuleMesh 客户端配置', '',
      '**[打开配置页](https://codingmesh.github.io/ruleset/#configs)**：切换客户端，复制 URL、导入配置或展开二维码。', '',
      '- **Shadowrocket**：直接导入，在 node-selection 中选择已有订阅或节点。',
      '- **Surge、Mihomo、sing-box**：公开文件为节点占位模板，先用[源码仓库的组合命令](https://github.com/codingmesh/rulemesh#使用配置)加入自己的节点。', '',
      '**标准分流**使用服务分组、国内和局域网直连；**广告拦截**在此基础上增加拒绝规则。默认节点、家庭组和具体服务出口均可在客户端调整。', '',
      '客户端不能表达的规则差异见 [capability-gaps.json](capability-gaps.json)。'
    ], path.join(PUBLIC_DIR, 'Config/README.md')),
    compareAndWriteFile(span, JSON.stringify({ schemaVersion: 1, reviewedAt: approval.checkedAt, targets }, null, 2).split('\n'), path.join(PUBLIC_DIR, 'Config/capability-gaps.json'))
  ]);
});
