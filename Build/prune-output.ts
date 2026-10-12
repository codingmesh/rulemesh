import path from 'node:path';
import fsp from 'node:fs/promises';
import { PUBLIC_DIR } from './constants/dir';
import { task } from './trace';

const removedIds = ['my_direct', 'my_git', 'my_plus', 'my_proxy', 'my_reject', 'my_tw', 'my_us'];
const outputs = [
  ['List', 'conf'], ['Shadowrocket', 'conf'], ['Clash', 'txt'],
  ['LegacyClashPremium', 'txt'], ['Surfboard', 'conf'], ['sing-box', 'json']
];
export const pruneOutput = task(require.main === module, __filename)(async () => {
  const removals: Array<Promise<void>> = [
    fsp.rm(path.join(PUBLIC_DIR, 'rules'), { force: true, recursive: true }),
    fsp.rm(path.join(PUBLIC_DIR, 'configs'), { force: true, recursive: true })
  ];
  const templateTargets = [['surge', 'conf'], ['mihomo', 'yaml'], ['singbox', 'json']];
  const templateVariants = ['standard', 'advertising'];
  for (let targetIndex = 0, targetLength = templateTargets.length; targetIndex < targetLength; targetIndex++) {
    const target = templateTargets[targetIndex];
    for (let variantIndex = 0, variantLength = templateVariants.length; variantIndex < variantLength; variantIndex++) {
      removals.push(fsp.rm(path.join(PUBLIC_DIR, 'Config', target[0], `${templateVariants[variantIndex]}.${target[1]}.template`), { force: true }));
    }
  }
  for (let outputIndex = 0, outputLength = outputs.length; outputIndex < outputLength; outputIndex++) {
    const [directory, extension] = outputs[outputIndex];
    for (let idIndex = 0, idLength = removedIds.length; idIndex < idLength; idIndex++) {
      removals.push(fsp.rm(path.join(PUBLIC_DIR, directory, 'non_ip', `${removedIds[idIndex]}.${extension}`), { force: true }));
    }
  }
  const deprecated = [
    ['domainset', 'reject_sukka'],
    ['non_ip', 'global_plus'],
    ['non_ip', 'apple_cdn'],
    ['non_ip', 'china.extra'],
    ['non_ip', 'global.extra']
  ];
  for (let outputIndex = 0, outputLength = outputs.length; outputIndex < outputLength; outputIndex++) {
    const [directory, extension] = outputs[outputIndex];
    for (let itemIndex = 0, itemLength = deprecated.length; itemIndex < itemLength; itemIndex++) {
      const [partition, id] = deprecated[itemIndex];
      removals.push(fsp.rm(path.join(PUBLIC_DIR, directory, partition, `${id}.${extension}`), { force: true }));
    }
  }
  await Promise.all(removals);
});
