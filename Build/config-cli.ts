import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';
import { composeClientConfiguration } from './build-client-config';

async function main() {
  const rawArgs = process.argv.slice(2); const [command, target, ...args] = rawArgs.slice(rawArgs[0] === '--' ? 1 : 0); const targets = new Set(['surge', 'mihomo', 'singbox']);
  if (command !== 'compose' || !targets.has(target)) throw new Error('Usage: pnpm config -- compose <surge|mihomo|singbox> --nodes <file> [--advertising] [--site-base <url>] [--output <file>]');
  let nodes = ''; let output = ''; let advertising = false; let siteBase = 'https://codingmesh.github.io/ruleset/';
  for (let i = 0, len = args.length; i < len; i++) {
    const option = args[i];
    if (option === '--advertising') { advertising = true; continue; }
    const value = args[++i]; if (!value) throw new Error(`Missing value for ${option}`);
    switch (option) { case '--nodes': nodes = value; break; case '--output': output = value; break; case '--site-base': siteBase = value; break; default: throw new Error(`Unknown option: ${option}`); }
  }
  if (!nodes) throw new Error('--nodes is required');
  const resolvedTarget = target as 'surge' | 'mihomo' | 'singbox'; let extension = 'conf';
  if (resolvedTarget === 'mihomo') extension = 'yaml'; else if (resolvedTarget === 'singbox') extension = 'json';
  const destination = path.resolve(output || `local/${resolvedTarget}.${extension}`);
  const content = await composeClientConfiguration(resolvedTarget, await fsp.readFile(path.resolve(nodes), 'utf8'), advertising, siteBase);
  await fsp.mkdir(path.dirname(destination), { recursive: true }); await fsp.writeFile(destination, content); console.log(destination);
}
void main();
