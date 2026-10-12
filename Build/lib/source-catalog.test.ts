import { describe, it } from 'mocha';
import { expect } from 'earl';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { validateSourceCatalog } from './source-catalog';

describe('source maintenance ownership', () => {
  it('rejects both new unowned sources and missing declared sources', async () => {
    const root = await fsp.mkdtemp(path.join(tmpdir(), 'rulemesh-sources-'));
    try {
      await Promise.all([fsp.mkdir(path.join(root, 'sources')), fsp.mkdir(path.join(root, 'Source/domainset'), { recursive: true })]);
      const revision = 'a'.repeat(40);
      await Promise.all([
        fsp.writeFile(path.join(root, 'sources/registry.json'), JSON.stringify({ schemaVersion: 1, upstream: { repository: 'example/repo', branch: 'main', revision }, files: [] })),
        fsp.writeFile(path.join(root, 'sources/overrides.json'), JSON.stringify({ schemaVersion: 2, add: [], remove: [] })),
        fsp.writeFile(path.join(root, 'sources/maintained.json'), JSON.stringify({ schemaVersion: 1, files: [], manual: [{ path: 'Source/domainset/owned.conf', license: 'AGPL-3.0', maintenance: 'maintained by this project' }], inherited: { revision, license: 'AGPL-3.0', maintenance: 'manual inherited', paths: [] } })),
        fsp.writeFile(path.join(root, 'Source/domainset/owned.conf'), 'example.com\n')
      ]);
      await validateSourceCatalog(root);
      const orphan = path.join(root, 'Source/domainset/orphan.conf');
      await fsp.writeFile(orphan, 'orphan.example\n');
      await expect(validateSourceCatalog(root)).toBeRejectedWith(Error, 'Unowned source: Source/domainset/orphan.conf');
      await Promise.all([fsp.rm(orphan), fsp.rm(path.join(root, 'Source/domainset/owned.conf'))]);
      await expect(validateSourceCatalog(root)).toBeRejectedWith(Error, 'Declared source is missing: Source/domainset/owned.conf');
    } finally {
      await fsp.rm(root, { recursive: true, force: true });
    }
  });
});
