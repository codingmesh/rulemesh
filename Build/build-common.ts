// @ts-check

import * as path from 'node:path';
import { readRuleSource } from './lib/read-rule-source';
import type { Span } from './trace';
import { SpanCategory, task } from './trace';
import { SHARED_DESCRIPTION } from './constants/description';
import { fdir as Fdir } from 'fdir';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { SOURCE_DIR } from './constants/dir';
import { DomainsetOutput } from './lib/rules/domainset';
import { RulesetOutput } from './lib/rules/ruleset';
import { settleBuildWork } from './lib/build-output';

export const buildCommon = task(require.main === module, __filename)(async (span) => {
  const promises: Array<Promise<unknown>> = [];
  const paths = await new Fdir()
    .withRelativePaths()
    .filter((filepath, isDirectory) => isDirectory || path.extname(filepath) === '.conf')
    .crawl(SOURCE_DIR)
    .withPromise();

  for (let i = 0, len = paths.length; i < len; i++) {
    const relativePath = paths[i];
    const fullPath = SOURCE_DIR + path.sep + relativePath;

    promises.push(transform(span, fullPath, relativePath));
  }

  return settleBuildWork(promises);
});

async function transform(parentSpan: Span, sourcePath: string, relativePath: string) {
  const extname = path.extname(sourcePath);
  const id = path.basename(sourcePath, extname);

  return parentSpan
    .traceChild(`transform ruleset: ${id}`)
    .traceAsyncFn(async (span) => {
      const type = relativePath.slice(0, relativePath.indexOf(path.sep));

      if (type !== 'ip' && type !== 'non_ip' && type !== 'domainset') {
        throw new TypeError(`Invalid type: ${type}`);
      }

      const source = await span.traceChildAsync(`read ${sourcePath}`, () => readRuleSource(sourcePath), SpanCategory.FsRead);
      if (!source) return;
      const { title, descriptions, lines, lineNumbers, mitmModule } = source;

      let finalDescriptions: string[];
      if (descriptions.length) {
        finalDescriptions = SHARED_DESCRIPTION.slice();
        finalDescriptions.push('');
        appendArrayInPlace(finalDescriptions, descriptions);
      } else {
        finalDescriptions = SHARED_DESCRIPTION;
      }

      if (type === 'domainset') {
        return new DomainsetOutput(span, id)
          .withTitle(title)
          .withDescription(finalDescriptions)
          .addFromDomainset(lines)
          .write();
      }

      return new RulesetOutput(span, id, type)
        .withTitle(title)
        .withDescription(finalDescriptions)
        .withMitmSgmodulePath(mitmModule)
        .addFromRuleset(lines, { file: `Source/${relativePath.replaceAll(path.sep, '/')}`, lineNumbers })
        .write();
    });
}
