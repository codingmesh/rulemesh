import { task } from './trace';
import { generateCdnDownload } from './lib/cdn-download';

export const buildCdnDownloadConf = task(require.main === module, __filename)(generateCdnDownload);
