import { task } from './trace';
import { generateMicrosoftCdn } from './lib/microsoft-cdn';

export const buildMicrosoftCdn = task(require.main === module, __filename)(generateMicrosoftCdn);
