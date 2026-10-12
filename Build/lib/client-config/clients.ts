import process from 'node:process';
import type { ConfigTarget } from './routing-profile';
import { nullthrow } from 'foxts/guard';

export const SITE_BASE = process.env.RULEMESH_SITE_BASE ?? 'https://codingmesh.github.io/ruleset/';
export const variants = ['standard', 'advertising'] as const;
export type Variant = typeof variants[number];
export interface ClientDefinition {
  id: ConfigTarget,
  label: string,
  rulesDirectory: string,
  rulesExtension: string,
  configDirectory: string,
  configExtension: string,
  role: 'profile' | 'template',
  importPrefix: string,
  encodedUrl: boolean,
  importFragment?: boolean,
  qr: boolean
}
export const clients: ClientDefinition[] = [
  { id: 'shadowrocket', label: 'Shadowrocket', rulesDirectory: 'Shadowrocket', rulesExtension: 'conf', configDirectory: 'Shadowrocket', configExtension: 'conf', role: 'profile', importPrefix: 'shadowrocket://config/add/', encodedUrl: false, qr: true },
  { id: 'surge', label: 'Surge', rulesDirectory: 'List', rulesExtension: 'conf', configDirectory: 'surge', configExtension: 'conf', role: 'template', importPrefix: 'surge:///install-config?url=', encodedUrl: true, qr: false },
  { id: 'mihomo', label: 'Mihomo / Clash Verge Rev', rulesDirectory: 'Clash', rulesExtension: 'txt', configDirectory: 'mihomo', configExtension: 'yaml', role: 'template', importPrefix: 'clash://install-config?url=', encodedUrl: true, qr: false },
  { id: 'singbox', label: 'sing-box', rulesDirectory: 'sing-box', rulesExtension: 'json', configDirectory: 'singbox', configExtension: 'json', role: 'template', importPrefix: 'sing-box://import-remote-profile?url=', encodedUrl: true, importFragment: true, qr: false }
];
export function clientFor(id: string): ClientDefinition {
  return nullthrow(clients.find(item => item.id === id), `Unknown client: ${id}`);
}
export function validateSiteBase(base: string): void {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !base.endsWith('/')) {
    throw new Error('RuleMesh site base must be a plain HTTPS directory URL ending in /');
  }
}
export function configPath(client: ClientDefinition, variant: Variant): string {
  return `Config/${client.configDirectory}/${variant}.${client.configExtension}`;
}
export function importUrl(client: ClientDefinition, url: string, title = 'RuleMesh'): string {
  return client.importPrefix + (client.encodedUrl ? encodeURIComponent(url) : url) + (client.importFragment ? `#${encodeURIComponent(title)}` : '');
}
