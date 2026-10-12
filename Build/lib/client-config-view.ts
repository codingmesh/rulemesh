import { clients, configPath, importUrl, SITE_BASE, variants } from './client-config/clients';
import type { ClientDefinition, Variant } from './client-config/clients';

function artifact(client: ClientDefinition, variant: Variant): string {
  const relative = configPath(client, variant);
  const url = SITE_BASE + relative;
  const label = variant === 'standard' ? 'Standard' : 'Advertising';
  const qr = client.qr ? `<a class="secondary" href="Config/${client.configDirectory}/${variant}.svg">QR</a>` : '';
  return `<article class="artifact"><h4>${label}</h4><span class="path">${relative}</span><div class="actions"><a href="${importUrl(client, url, `RuleMesh ${label}`)}">Open &amp; Import</a><button class="secondary" type="button" data-copy-url="${url}">Copy URL</button><a class="secondary" href="${relative}">View ${client.role === 'profile' ? 'Config' : 'Template'}</a>${qr}</div></article>`;
}
function panel(client: ClientDefinition): string {
  const composed = client.role === 'template' ? `<p><code>pnpm run config -- compose ${client.id} --nodes /absolute/path/base.${client.configExtension}</code></p><div class="import-composed" data-import-client="${client.id}"><h4>Import composed config</h4><label>Composed HTTPS config URL<input type="url" inputmode="url" placeholder="https://example.com/rulemesh.${client.configExtension}"></label><button type="button" data-import-open>Open &amp; Import in ${client.label}</button><p class="import-error" aria-live="polite"></p></div>` : '';
  return `<div id="client-panel-${client.id}" role="tabpanel" aria-labelledby="client-tab-${client.id}" data-client-panel="${client.id}"${client.id === clients[0].id ? '' : ' hidden'}><h3>${client.label}</h3><p>${client.role === 'profile' ? 'Complete profile using your existing client nodes.' : 'Structural template: compose with your real nodes before use.'}</p><div class="artifact-list">${variants.map(variant => artifact(client, variant)).join('')}</div>${composed}<p>Rules: <code>${client.rulesDirectory}/{domainset,non_ip,ip}/</code></p></div>`;
}
export function renderClientConfigs(): string {
  return `<section id="configs" data-view="configs" hidden><h2>Client Configs</h2><p>Every published configuration artifact is listed here. Switching clients only changes focus; credentials and node definitions are never hosted.</p><p>Every card can open its client, copy the public URL or show the file. Shadowrocket profiles use existing client nodes. Surge, Mihomo and sing-box files contain a <code>REPLACE-ME</code> placeholder and must first be composed with your node base.</p><p>Choose a default node, then adjust families and individual services in your client. Standard profiles exclude advertising; advertising profiles evaluate rejection before general routing.</p><div class="client-switch" role="tablist" aria-label="Client format">${clients.map((client, index) => `<button type="button" role="tab" id="client-tab-${client.id}" aria-controls="client-panel-${client.id}" tabindex="${index === 0 ? 0 : -1}" data-client="${client.id}" aria-selected="${index === 0}">${client.label}</button>`).join('')}</div>${clients.map(panel).join('')}<p><a href="Config/README.md">Configuration manifest</a> · <a href="Config/capability-gaps.json">Capability gaps</a></p></section>`;
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
    button.textContent='Copied';
  }catch{button.textContent='Copy failed'}
  setTimeout(()=>button.textContent=label,1500);
}
for(const button of document.querySelectorAll('[data-copy-url]'))button.addEventListener('click',()=>void copyUrl(button));
for(const form of document.querySelectorAll('[data-import-client]'))form.querySelector('[data-import-open]').addEventListener('click',()=>{
  const input=form.querySelector('input'),error=form.querySelector('.import-error');
  try{
    const url=new URL(input.value);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use a plain HTTPS URL');
    const definition=definitions[form.dataset.importClient];
    if(!definition)throw new Error('Unknown client');
    error.textContent='';
    location.href=definition.prefix+(definition.encoded?encodeURIComponent(url.href):url.href)+(definition.fragment?'#RuleMesh':'');
  }catch(reason){error.textContent=reason instanceof Error?reason.message:'Invalid configuration URL'}
});`;
}
