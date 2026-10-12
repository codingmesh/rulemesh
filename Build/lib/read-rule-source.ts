import { readFileByLine } from './fetch-text-by-line';
import { processLine } from './process-line';

const SKIP = '# $ custom_build_script';
const TITLE = '# $ meta_title ';
const DESCRIPTION = '# $ meta_description ';
const MITM = '# $ sgmodule_mitm_hostnames ';

/** Metadata is removed without losing original source locations. */
export async function readRuleSource(file: string, input: AsyncIterable<string> | Iterable<string> = readFileByLine(file)) {
  const lines: string[] = [];
  const lineNumbers: number[] = [];
  const descriptions: string[] = [];
  let title = '';
  let mitmModule: string | null = null;
  let lineNumber = 0;
  try {
    for await (const line of input) {
      lineNumber++;
      if (line.startsWith(SKIP)) return null;
      if (line.startsWith(TITLE)) {
        title = line.slice(TITLE.length).trim();
      } else if (line.startsWith(DESCRIPTION)) {
        descriptions.push(line.slice(DESCRIPTION.length).trim());
      } else if (line.startsWith(MITM)) {
        mitmModule = line.slice(MITM.length).trim();
      } else {
        const processed = processLine(line);
        if (processed && processed.charCodeAt(0) !== 35) {
          lines.push(processed);
          lineNumbers.push(lineNumber);
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to read rule source ${file} after line ${lineNumber}`, { cause: error });
  }
  return { title, descriptions, lines, lineNumbers, mitmModule };
}
