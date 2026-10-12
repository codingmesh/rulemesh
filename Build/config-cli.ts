import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';
import { composeClientConfiguration } from './lib/client-config/configuration';
import { clientFor, SITE_BASE } from './lib/client-config/clients';

async function main() {
  const rawArgs = process.argv.slice(2);
  const [command, target, ...args] = rawArgs.slice(rawArgs[0] === '--' ? 1 : 0);
  const client = clientFor(target);
  if (command !== 'compose' || client.id === 'shadowrocket') throw new Error('Usage: pnpm config -- compose <surge|mihomo|singbox> --nodes <file> [--advertising] [--site-base <url>] [--output <file>]');
  let nodes = ''; let output = ''; let advertising = false; let siteBase = SITE_BASE;
  for (let i = 0, len = args.length; i < len; i++) {
    const option = args[i];
    if (option === '--advertising') { advertising = true; continue; }
    const value = args[++i]; if (!value) throw new Error(`Missing value for ${option}`);
    switch (option) { case '--nodes': nodes = value; break; case '--output': output = value; break; case '--site-base': siteBase = value; break; default: throw new Error(`Unknown option: ${option}`); }
  }
  if (!nodes) throw new Error('--nodes is required');
  const destination = path.resolve(output || `local/${client.id}.${client.configExtension}`);
  const content = await composeClientConfiguration(client.id, await fsp.readFile(path.resolve(nodes), 'utf8'), advertising, siteBase);
  await fsp.mkdir(path.dirname(destination), { recursive: true }); await fsp.writeFile(destination, content); console.log(destination);
}
if (require.main === module) void main().catch(error => { console.error(error); process.exitCode = 1; });
