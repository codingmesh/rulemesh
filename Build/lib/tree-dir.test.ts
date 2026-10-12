import { describe, it } from 'mocha';
import { expect } from 'earl';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { treeDir, TreeFileType } from './tree-dir';

describe('rules directory traversal', () => {
  it('waits for deep directory contents before returning', async () => {
    const root = await fsp.mkdtemp(path.join(tmpdir(), 'rulemesh-tree-'));
    try {
      await fsp.mkdir(path.join(root, 'client/partition/nested'), { recursive: true });
      await fsp.writeFile(path.join(root, 'client/partition/nested/rules.conf'), 'DOMAIN,example.com\n');
      const tree = await treeDir(root);
      const client = tree[0];
      expect(client.type).toEqual(TreeFileType.DIRECTORY);
      if (client.type !== TreeFileType.DIRECTORY) throw new Error('Missing client directory');
      const partition = client.children.at(0)!;
      if (partition.type !== TreeFileType.DIRECTORY) throw new Error('Missing partition directory');
      const nested = partition.children.at(0)!;
      if (nested.type !== TreeFileType.DIRECTORY) throw new Error('Missing nested directory');
      expect(nested.children).toEqual([{ type: TreeFileType.FILE, name: 'rules.conf', path: '/client/partition/nested/rules.conf' }]);
    } finally {
      await fsp.rm(root, { recursive: true, force: true });
    }
  });
});
