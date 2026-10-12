import { clients, configPath, importUrl, SITE_BASE, variants } from './client-config/clients';
import type { ClientDefinition, Variant } from './client-config/clients';

function artifact(client: ClientDefinition, variant: Variant): string {
  const relative = configPath(client, variant);
  const url = SITE_BASE + relative;
  const visibleUrl = url.replaceAll('/', '/<wbr>');
  const label = variant === 'standard' ? 'Standard' : 'Advertising';
  const title = variant === 'standard' ? '标准分流' : '广告拦截';
  const description = variant === 'standard' ? '国内与局域网直连，其余流量按服务分组。' : '在标准分流基础上，增加广告与恶意域名拦截。';
  const heading = `config-${client.id}-${variant}`;
  const qr = client.qr ? `<details class="config-qr"><summary>二维码</summary><div class="qr-content"><img src="Config/${client.configDirectory}/${variant}.svg" width="208" height="208" loading="lazy" alt="${client.label} ${title}导入二维码"><p>在 ${client.label} 中扫描，导入这份配置。</p></div></details>` : '';
  return `<article class="artifact" aria-labelledby="${heading}"><div class="artifact-heading"><h4 id="${heading}">${title}</h4>${variant === 'standard' ? '<span class="config-badge">日常使用</span>' : ''}</div><p class="variant-description">${description}</p><div class="config-url"><code>${visibleUrl}</code><button type="button" data-copy-url="${url}" aria-label="复制${title} URL">复制 URL</button></div><div class="actions"><a class="config-button" href="${importUrl(client, url, `RuleMesh ${label}`)}">${client.role === 'profile' ? '导入客户端' : '导入模板'} <span aria-hidden="true">↗</span></a><a class="config-source" href="${relative}">查看${client.role === 'profile' ? '配置' : '模板'}</a></div>${qr}</article>`;
}
function panel(client: ClientDefinition): string {
  const composed = client.role === 'template' ? `<section class="compose-help" aria-labelledby="compose-${client.id}"><h4 id="compose-${client.id}">加入自己的节点</h4><p>在源码仓库中，用节点底稿生成完整配置：</p><pre><code>pnpm run config -- compose ${client.id} --nodes /absolute/path/base.${client.configExtension}</code></pre><p>添加 <code>--advertising</code> 使用广告拦截规则。生成后可本地导入，或托管到自己的 HTTPS 地址：</p><form class="import-composed" data-import-client="${client.id}" novalidate><label for="import-url-${client.id}">完整配置 URL</label><div class="import-row"><input id="import-url-${client.id}" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://example.com/rulemesh.${client.configExtension}" aria-describedby="import-error-${client.id}"><button class="config-button" type="submit" data-import-open>导入客户端 <span aria-hidden="true">↗</span></button></div><p id="import-error-${client.id}" class="import-error" aria-live="polite"></p></form></section>` : '';
  return `<div id="client-panel-${client.id}" role="tabpanel" aria-labelledby="client-tab-${client.id}" data-client-panel="${client.id}"${client.id === clients[0].id ? '' : ' hidden'}><div class="client-heading"><h3>${client.label}</h3><span class="config-kind">${client.role === 'profile' ? '完整配置' : '配置模板'}</span></div><p class="client-note">${client.role === 'profile' ? '直接导入后，在 node-selection 和服务分组中选择已有节点。' : '模板不包含可用节点；先与自己的节点底稿组合，再导入完整配置。'}</p><div class="artifact-list">${variants.map(variant => artifact(client, variant)).join('')}</div>${composed}<p class="config-resources"><a href="#rules">浏览 ${client.rulesDirectory} 规则</a></p></div>`;
}
export function renderClientConfigs(): string {
  return `<section id="configs" data-view="configs" hidden><div class="config-intro"><h2>客户端配置</h2><p>选择客户端，复制配置 URL 或直接导入。</p></div><div class="client-switch" role="tablist" aria-label="选择客户端">${clients.map((client, index) => `<button type="button" role="tab" id="client-tab-${client.id}" aria-controls="client-panel-${client.id}" tabindex="${index === 0 ? 0 : -1}" data-client="${client.id}" aria-selected="${index === 0}">${client.label}</button>`).join('')}</div>${clients.map(panel).join('')}<footer class="config-footer"><a href="Config/README.md">配置说明</a><a href="Config/capability-gaps.json">客户端能力差异</a></footer></section>`;
}
export function clientConfigScript(): string {
  const definitions = clients.reduce<Record<string, { prefix: string, encoded: boolean, fragment: boolean }>>((result, client) => {
    result[client.id] = { prefix: client.importPrefix, encoded: client.encodedUrl, fragment: !!client.importFragment };
    return result;
  }, {});
  return `
const definitions=${JSON.stringify(definitions)};
const clientButtons=[...document.querySelectorAll('[data-client]')];
const clientPanels=[...document.querySelectorAll('[data-client-panel]')];
for(const button of clientButtons)button.addEventListener('click',()=>{
  for(const candidate of clientButtons){candidate.setAttribute('aria-selected',String(candidate===button));candidate.tabIndex=candidate===button?0:-1;}
  for(const panel of clientPanels)panel.hidden=panel.dataset.clientPanel!==button.dataset.client;
});
for(const button of clientButtons)button.addEventListener('keydown',event=>{
  const index=clientButtons.indexOf(button),last=clientButtons.length-1;
  let next=index;
  if(event.key==='ArrowRight')next=(index+1)%clientButtons.length;
  else if(event.key==='ArrowLeft')next=(index+last)%clientButtons.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=last;
  else return;
  event.preventDefault();clientButtons[next].click();clientButtons[next].focus();
});
async function copyUrl(button){
  const label=button.textContent;
  try{
    const value=button.dataset.copyUrl;
    try{await navigator.clipboard.writeText(value)}catch{
      const field=document.createElement('textarea');field.value=value;field.setAttribute('readonly','');
      field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();
      const copied=document.execCommand('copy');field.remove();
      if(!copied)throw new Error('Clipboard unavailable');
    }
    button.textContent='已复制';
  }catch{button.textContent='复制失败'}
  setTimeout(()=>button.textContent=label,1500);
}
for(const button of document.querySelectorAll('[data-copy-url]'))button.addEventListener('click',()=>void copyUrl(button));
for(const form of document.querySelectorAll('[data-import-client]'))form.addEventListener('submit',event=>{
  event.preventDefault();
  const input=form.querySelector('input'),error=form.querySelector('.import-error');
  try{
    let url;try{url=new URL(input.value)}catch{throw new Error('请输入完整的 HTTPS 配置 URL')}
    if(url.protocol!=='https:'||url.username||url.password)throw new Error('请使用不含账号密码的 HTTPS 配置 URL');
    const definition=definitions[form.dataset.importClient];
    if(!definition)throw new Error('Unknown client');
    error.textContent='';
    location.href=definition.prefix+(definition.encoded?encodeURIComponent(url.href):url.href)+(definition.fragment?'#RuleMesh':'');
  }catch(reason){error.textContent=reason instanceof Error?reason.message:'Invalid configuration URL'}
});`;
}
