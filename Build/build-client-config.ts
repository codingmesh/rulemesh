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
      '# RuleMesh client configurations', '',
      'Shadowrocket configs are directly importable. Surge, Mihomo and sing-box files are complete structural templates; compose them with your node base using the source repository CLI.', '',
      'Policy hierarchy:', '',
      '1. Choose the default node in the root node selector.',
      '2. AI, social and streaming family selectors inherit that choice.',
      '3. Anthropic, OpenAI, Gemini, Telegram, YouTube and Netflix inherit their family and may be overridden independently.',
      '4. Private and mainland China traffic default to direct. Global fallback defaults to the root node selector.',
      '5. The advertising profile evaluates reject rules before private, service, domestic and global rules; the standard profile contains no advertising rules.', '',
      'Target-specific omissions that cannot be represented natively are listed in capability-gaps.json.'
    ], path.join(PUBLIC_DIR, 'Config/README.md')),
    compareAndWriteFile(span, JSON.stringify({ schemaVersion: 1, reviewedAt: approval.checkedAt, targets }, null, 2).split('\n'), path.join(PUBLIC_DIR, 'Config/capability-gaps.json'))
  ]);
});
