import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import fs from 'node:fs';
import path from 'node:path';
import picocolors from 'picocolors';
import { SpanCategory } from '../trace';
import type { Span } from '../trace';
import { readFileByLine } from './fetch-text-by-line';
import { writeFile } from './misc';
import { extractContentHashFromFile } from './content-hash';
import { copyBuildFile, previousOutput, recordOutput, reserveOutput, verifiedPreviousOutput } from './build-output';

const MODULE_DATE = /^(#!desc=Last Updated: )\S+/;
function comparableLine(line: string): string {
  if (line.startsWith('# Last Updated: ')) return '# Last Updated:';
  if (line.startsWith('! Last modified: ')) return '! Last modified:';
  return line.replace(MODULE_DATE, '$1<timestamp>');
}
async function fileEqual(lines: string[], input: AsyncIterable<string>): Promise<boolean> {
  let index = 0;
  for await (const line of input) {
    if (index >= lines.length || comparableLine(line) !== comparableLine(lines[index])) return false;
    index++;
  }
  return index === lines.length;
}

/**
 * The comparison half shared by {@link compareAndWriteFile} and
 * {@link compareAndWriteFileInWorker} -- there is exactly one implementation of
 * "is the previous output already up to date", regardless of how the new content
 * ends up being written.
 */
async function isPreviousOutputEqual(span: Span, linesA: string[], filePath: string, contentHash: string | null) {
  const destination = filePath;
  filePath = previousOutput(filePath);
  // Comparison must not mutate content owned by the writer or another output.
  const comparisonLines = linesA.at(-1) === '' ? linesA.slice(0, -1) : linesA;

  const isEqual = await span.traceChildAsync(`compare ${filePath}`, async () => {
    if (!fs.existsSync(filePath)) {
      console.log(`${filePath} does not exists, writing...`);
      return false;
    }

    const verified = await verifiedPreviousOutput(destination);
    if (verified === false) return false;
    if (contentHash && verified === true) {
      const previousHash = await extractContentHashFromFile(filePath);
      if (previousHash) {
        return previousHash === contentHash;
      }
      // previous output predates the content hash marker, fall through to full comparison
    }

    return fileEqual(comparisonLines, readFileByLine(filePath));
  }, SpanCategory.FsRead);

  if (isEqual) {
    console.log(picocolors.gray(picocolors.dim(`same content, bail out writing: ${filePath}`)));
  }

  return isEqual;
}

/**
 * To keep metadata comment `last updated` not change if real content is the same,
 * we only write when the actual content differs, and the new `last updated` will
 * be written along with new content.
 *
 * A hash marker is used only after validating the previous file's actual bytes
 * against its manifest. Missing or invalid cache metadata forces regeneration.
 * Standalone writes compare content, ignoring only explicit timestamp fields.
 */
export async function compareAndWriteFile(span: Span, linesA: string[], filePath: string, contentHash: string | null = null) {
  if (await isPreviousOutputEqual(span, linesA, filePath, contentHash)) {
    const previous = previousOutput(filePath);
    if (previous === filePath) recordOutput(filePath);
    else await copyBuildFile(previous, filePath, 'writer');
    return;
  }

  return writeFileLines(span, linesA, filePath);
}

/**
 * Same comparison as {@link compareAndWriteFile}, but the write itself is
 * synchronous. For worker threads only: blocking a dedicated worker is free,
 * whereas an async write hands the completion back through libuv to an event
 * loop we would rather not depend on being idle.
 */
export async function compareAndWriteFileInWorker(span: Span, linesA: string[], filePath: string, contentHash: string | null = null) {
  if (await isPreviousOutputEqual(span, linesA, filePath, contentHash)) {
    const previous = previousOutput(filePath);
    if (previous === filePath) recordOutput(filePath);
    else await copyBuildFile(previous, filePath, 'writer');
    return;
  }

  writeFileLinesSync(span, linesA, filePath);
}

export function writeFileLines(span: Span, linesA: string[], filePath: string): Promise<void> {
  return span.traceChildAsync<void>(
    `writing ${filePath}`,
    () => writeFile(filePath, fastStringArrayJoin(linesA, '\n') + '\n'),
    SpanCategory.FsWrite
  );
}

export function writeFileLinesSync(span: Span, linesA: string[], filePath: string): void {
  const output = reserveOutput(filePath);
  try {
    span.traceChildSync(`writing ${filePath}`, () => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, fastStringArrayJoin(linesA, '\n') + '\n');
      output.commit();
    }, SpanCategory.FsWrite);
  } finally { output.release(); }
}
