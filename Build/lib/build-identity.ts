import path from 'node:path';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT_DIR } from '../constants/dir';

const execute = promisify(execFile);
export async function buildIdentity() {
  const directories = ['Build', 'Source', 'sources', 'Modules', 'Mock'];
  const paths = (await Promise.all(directories.map(async directory => {
    const entries = await fsp.readdir(path.join(ROOT_DIR, directory), { recursive: true, withFileTypes: true });
    return entries.flatMap(entry => (entry.isFile() ? [path.relative(ROOT_DIR, path.join(entry.parentPath, entry.name))] : []));
  }))).flat();
  paths.push('package.json', 'pnpm-lock.yaml', '.node-version', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md');
  paths.sort();
  const contents = await Promise.all(paths.map(file => fsp.readFile(path.join(ROOT_DIR, file))));
  const hash = createHash('sha256');
  for (let i = 0, len = paths.length; i < len; i++) hash.update(paths[i]).update('\0').update(contents[i]).update('\0');
  const [{ stdout: commit }, { stdout: status }] = await Promise.all([
    execute('git', ['rev-parse', 'HEAD'], { cwd: ROOT_DIR }),
    execute('git', ['status', '--porcelain'], { cwd: ROOT_DIR })
  ]);
  return { commit: commit.trim(), dirty: !!status.trim(), sha256: hash.digest('hex') };
}
