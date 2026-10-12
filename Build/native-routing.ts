import { createServer as createHttpServer, request } from 'node:http';
import { createServer as createTcpServer, createConnection } from 'node:net';
import { createSocket } from 'node:dgram';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { parse, stringify } from 'yaml';
import { composeClientConfiguration } from './build-client-config';

async function main() {
  const output = resolve(process.env.PUBLIC_DIR ?? 'public');
  const temp = await mkdtemp(join(tmpdir(), 'rulemesh-routing-'));
  const dns = createSocket('udp4');
  const answers = new Map<string, string>();
  dns.on('message', (packet, remote) => {
    let offset = 12; const labels: string[] = [];
    while (packet[offset]) { const size = packet[offset]; labels.push(packet.subarray(offset + 1, offset + 1 + size).toString()); offset += size + 1; }
    const host = labels.join('.'); const end = offset + 5; const type = packet.readUInt16BE(offset + 1); const ip = answers.get(host);
    const header = Buffer.from(packet.subarray(0, 12)); header.writeUInt16BE(ip ? 0x8180 : 0x8183, 2); header.writeUInt16BE(ip && type === 1 ? 1 : 0, 6); header.writeUInt16BE(0, 8); header.writeUInt16BE(0, 10);
    const record = ip && type === 1 ? Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 1, 0, 4, ...ip.split('.').map(Number)]) : Buffer.alloc(0);
    dns.send(Buffer.concat([header, packet.subarray(12, end), record]), remote.port, remote.address);
  });
  await new Promise<void>(accept => dns.bind(0, '127.0.0.1', accept));
  const dnsPort = dns.address().port; const proxyServers: ReturnType<typeof createHttpServer>[] = []; const proxyPorts: Record<string, number> = {};
  for (const category of ['private', 'service', 'direct', 'generic', 'geo']) {
    const proxy = createHttpServer((_req, response) => response.end(category));
    proxy.on('connect', (_req, socket) => { socket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); socket.once('data', () => socket.end(`HTTP/1.1 200 OK\r\nContent-Length: ${category.length}\r\nConnection: close\r\n\r\n${category}`)); });
    await new Promise<void>(accept => proxy.listen(0, '127.0.0.1', accept)); proxyPorts[category] = (proxy.address() as { port: number }).port; proxyServers.push(proxy);
  }
  async function freePort() { const server = createTcpServer(); await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept)); const port = (server.address() as { port: number }).port; await new Promise<void>(accept => server.close(() => accept())); return port; }
  async function ready(port: number) { for (let i = 0; i < 100; i++) { if (await new Promise<boolean>(accept => { const socket = createConnection({ host: '127.0.0.1', port }); socket.once('connect', () => { socket.destroy(); accept(true); }); socket.once('error', () => accept(false)); })) return; await delay(50); } throw new Error('Native listener did not start'); }
  async function fetchVia(port: number, host: string) { return new Promise<string>((accept, reject) => { const req = request({ host: '127.0.0.1', port, path: `http://${host}/`, headers: { Host: host }, timeout: 5000 }, response => { let body = ''; response.on('data', chunk => body += chunk); response.on('end', () => accept(body)); }); req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout'))); req.end(); }); }
  const directGroups = new Set(['apple', 'microsoft', 'direct']);
  const groupRoute = (name: string) => name === 'private' ? 'private' : name === 'china' ? 'geo' : name === 'fallback' ? 'generic' : directGroups.has(name) ? 'direct' : name === 'advertising' ? 'REJECT' : 'service';
  const tools = { mihomo: process.env.RULEMESH_MIHOMO, singbox: process.env.RULEMESH_SING_BOX };
  if (!tools.mihomo || !tools.singbox) throw new Error('RULEMESH_MIHOMO and RULEMESH_SING_BOX are required');
  const standardScenarios = [
    { host: 'claude.ai', ip: '198.51.100.2', expected: 'service' },
    { host: 'discord.com', ip: '198.51.100.5', expected: 'service' },
    { host: 'netflix.com', ip: '198.51.100.6', expected: 'service' },
    { host: 'github.com', ip: '198.51.100.7', expected: 'service' },
    { host: 'store.steampowered.com', ip: '198.51.100.11', expected: 'service' },
    { host: '1fichier.com', ip: '198.51.100.12', expected: 'service' },
    { host: 'icloud.com', ip: '198.51.100.8', expected: 'direct' },
    { host: 'download.windowsupdate.com', ip: '198.51.100.9', expected: 'direct' },
    { host: 'qq.com', ip: '198.51.100.3', expected: 'geo' },
    { host: 'printer.local', ip: '10.0.0.2', expected: 'private' },
    { host: 'unknown.invalid', ip: '198.51.100.4', expected: 'generic' },
    { host: '102.37.57.54', ip: '102.37.57.54', expected: 'service' },
    { host: '149.154.160.1', ip: '149.154.160.1', expected: 'service' },
    { host: '10.1.2.3', ip: '10.1.2.3', expected: 'private' }
  ];
  const variants = [{ name: 'standard', advertising: false, scenarios: standardScenarios }, { name: 'advertising', advertising: true, scenarios: [{ host: 'doubleclick.net', ip: '198.51.100.10', expected: 'rejected' }] }];
  const results: Array<{ target: string, variant: string, checks: unknown[] }> = [];
  for (const target of ['mihomo', 'singbox'] as const) {
    for (let variantIndex = 0, variantLength = variants.length; variantIndex < variantLength; variantIndex++) {
      const variant = variants[variantIndex]; const port = await freePort(); let configured: any;
      if (target === 'mihomo') {
        const base = stringify({ 'mixed-port': port, 'bind-address': '127.0.0.1', 'allow-lan': false, proxies: Object.entries(proxyPorts).map(([name, proxyPort]) => ({ name, type: 'http', server: '127.0.0.1', port: proxyPort })), dns: { enable: true, ipv6: false, 'enhanced-mode': 'redir-host', 'default-nameserver': [`127.0.0.1:${dnsPort}`], nameserver: [`udp://127.0.0.1:${dnsPort}`] } });
        configured = parse(await composeClientConfiguration('mihomo', base, variant.advertising));
        for (const group of configured['proxy-groups']) group.proxies = [group.name === 'RuleMesh-Nodes' ? 'service' : groupRoute(group.name.replace('RuleMesh-', ''))];
        for (const provider of Object.values(configured['rule-providers']) as any[]) { const relative = new URL(provider.url).pathname.replace('/ruleset/', ''); provider.type = 'file'; provider.path = join(output, relative); delete provider.url; delete provider.interval; }
      } else {
        const base = JSON.stringify({ log: { level: 'warn' }, inbounds: [{ type: 'mixed', tag: 'test', listen: '127.0.0.1', listen_port: port }], outbounds: Object.entries(proxyPorts).map(([tag, proxyPort]) => ({ type: 'http', tag, server: '127.0.0.1', server_port: proxyPort })), dns: { servers: [{ type: 'udp', tag: 'local-dns', server: '127.0.0.1', server_port: dnsPort }], final: 'local-dns', strategy: 'ipv4_only' }, route: {} });
        configured = JSON.parse(await composeClientConfiguration('singbox', base, variant.advertising));
        for (const outbound of configured.outbounds) if (outbound.type === 'selector') outbound.outbounds = [outbound.tag === 'RuleMesh-Nodes' ? 'service' : groupRoute(outbound.tag.replace('RuleMesh-', ''))];
        for (const set of configured.route.rule_set) { const relative = new URL(set.url).pathname.replace('/ruleset/', ''); set.type = 'local'; set.path = join(output, relative); delete set.url; delete set.update_interval; delete set.download_detour; }
      }
      const configPath = join(temp, `${target}-${variant.name}.${target === 'mihomo' ? 'yaml' : 'json'}`); await writeFile(configPath, target === 'mihomo' ? stringify(configured) : JSON.stringify(configured));
      const binary = tools[target]!; const child = spawn(binary, target === 'mihomo' ? ['-d', temp, '-f', configPath] : ['run', '-D', temp, '-c', configPath], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, SAFE_PATHS: output } }); let logs = '';
      child.stdout.on('data', chunk => logs = (logs + chunk).slice(-100000)); child.stderr.on('data', chunk => logs = (logs + chunk).slice(-100000));
      try {
        try { await ready(port); } catch (error) { throw new Error(`${target}/${variant.name}: ${String(error)}\n${logs}`); } await delay(1000); const checks: unknown[] = [];
        for (let i = 0, len = variant.scenarios.length; i < len; i++) {
          const scenario = variant.scenarios[i]; answers.set(scenario.host, scenario.ip);
          if (scenario.expected === 'rejected') { let observed = ''; try { observed = await fetchVia(port, scenario.host); } catch { observed = 'rejected'; } assert.equal(Object.hasOwn(proxyPorts, observed), false, JSON.stringify({ target, variant: variant.name, scenario, observed, logs })); checks.push({ host: scenario.host, observed: 'rejected' }); continue; }
          const observed = await fetchVia(port, scenario.host); assert.equal(observed, scenario.expected, JSON.stringify({ target, variant: variant.name, scenario, observed, logs })); checks.push({ host: scenario.host, observed });
        }
        results.push({ target, variant: variant.name, checks });
      } finally { if (child.exitCode === null) { child.kill('SIGTERM'); await new Promise<void>(accept => child.once('exit', () => accept())); } }
    }
  }
  dns.close(); for (const proxy of proxyServers) { proxy.closeAllConnections(); proxy.close(); }
  await mkdir(join(temp, 'evidence'), { recursive: true }); await writeFile(join(temp, 'evidence/result.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify({ status: 'pass', results }, null, 2));
}
void main();
