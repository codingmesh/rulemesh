import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

import { SpanCategory, task } from './trace';
import { treeDir, TreeFileType } from './lib/tree-dir';
import type { TreeType, TreeTypeArray } from './lib/tree-dir';

import { OUTPUT_MOCK_DIR, OUTPUT_MODULES_DIR, PUBLIC_DIR, ROOT_DIR } from './constants/dir';
import { writeFile } from './lib/misc';
import { fastStringCompare } from 'foxts/fast-string-compare';
import { tagged as html } from 'foxts/tagged';
import { compareAndWriteFile } from './lib/create-file';
import { appendArrayInPlace } from 'foxts/append-array-in-place';
import { copyBuildFile, hasOutput, recordInput, settleBuildWork } from './lib/build-output';
import { renderClientConfigs, clientConfigScript } from './lib/client-config-view';
import { buildIdentity } from './lib/build-identity';
import process from 'node:process';

const priorityOrder: Record<'default' | string & {}, number> = {
  LICENSE: 0,
  domainset: 10,
  non_ip: 20,
  ip: 30,
  List: 40,
  Config: 45,
  Shadowrocket: 50,
  Surge: 60,
  Clash: 70,
  'sing-box': 80,
  Surfboard: 90,
  Modules: 100,
  Script: 110,
  Mock: 120,
  Assets: 130,
  Internal: 140,
  default: Number.MAX_VALUE
};

const closedRootFolders = [
  'Mock',
  'Internal'
];

const hiddenRootEntries = new Set(['Config']);

const rLeadingSlash = /^\/+/;

async function copyDirContents(srcDir: string, destDir: string): Promise<void> {
  const entries = await fsp.readdir(srcDir, { withFileTypes: true });
  await settleBuildWork(entries.map(async entry => {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirContents(src, dest);
    } else if (!hasOutput(dest)) {
      await copyBuildFile(src, dest, 'buildPublic static assets');
    }
  }));
}

export const buildPublic = task(require.main === module, __filename)(async (span) => {
  const identity = await buildIdentity();
  recordInput({ source: `RuleMesh code tree (${identity.commit}${identity.dirty ? ', working tree' : ''})`, role: 'source', sha256: identity.sha256 });
  await span.traceChild('copy rest of the files', SpanCategory.FsWrite).traceAsyncFn(async () => {
    await settleBuildWork([
      copyDirContents(path.join(ROOT_DIR, 'Modules'), OUTPUT_MODULES_DIR),
      copyDirContents(path.join(ROOT_DIR, 'Mock'), OUTPUT_MOCK_DIR)
    ]);
  });

  const tree = await span
    // crawls the whole public dir; the html templating itself is trivial
    .traceChild('generate index.html', SpanCategory.FsRead)
    .traceAsyncFn(() => treeDir(PUBLIC_DIR));

  return settleBuildWork([
    compareAndWriteFile(
      span,
      appendArrayInPlace(
        [
          '/*',
          '  cache-control: public, max-age=300, stale-while-revalidate=30, stale-if-error=60',
          'https://:project.pages.dev/*',
          '  X-Robots-Tag: noindex'
        ],
        Object.keys(priorityOrder).map((name) => `/${name}/*\n  content-type: text/plain; charset=utf-8\n  X-Robots-Tag: noindex`)
      ),
      path.join(PUBLIC_DIR, '_headers')
    ),
    compareAndWriteFile(
      span,
      [
        '# <pre>',
        '#########################################',
        '# RuleMesh - 404 Not Found',
        '################## EOF ##################</pre>'
      ],
      path.join(PUBLIC_DIR, '404.html')
    ),
    compareAndWriteFile(
      span,
      [
        '# RuleMesh',
        '',
        '多客户端规则组与配置，基于 [SukkaW/Surge](https://github.com/SukkaW/Surge) 持续维护。',
        '',
        '**[客户端配置与导入](https://codingmesh.github.io/ruleset/#configs)** · [规则目录](https://codingmesh.github.io/ruleset/#rules)',
        '',
        '本仓库由 [RuleMesh 源码仓库](https://github.com/codingmesh/rulemesh) 自动生成。规则修改、自定义维护和问题反馈请到源码仓库进行。',
        '',
        '许可与归属见 [LICENSE](LICENSE)、[NOTICE](NOTICE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。'
      ],
      path.join(PUBLIC_DIR, 'README.md')
    ),
    writeFile(path.join(PUBLIC_DIR, '.nojekyll'), ''),
    writeFile(path.join(PUBLIC_DIR, '.RULEMESH_RULESET_SERVER'), 'SUKKAW_SURGE_BASED\n'),
    writeFile(path.join(PUBLIC_DIR, 'deploy-check.txt'), `${process.env.GITHUB_SHA ?? (identity.dirty ? `working-tree:${identity.sha256}` : identity.commit)}\n`),
    copyBuildFile(path.join(ROOT_DIR, 'LICENSE'), path.join(PUBLIC_DIR, 'LICENSE'), 'buildPublic license'),
    copyBuildFile(path.join(ROOT_DIR, 'NOTICE'), path.join(PUBLIC_DIR, 'NOTICE'), 'buildPublic attribution'),
    copyBuildFile(path.join(ROOT_DIR, 'THIRD_PARTY_NOTICES.md'), path.join(PUBLIC_DIR, 'THIRD_PARTY_NOTICES.md'), 'buildPublic attribution'),
    writeFile(path.join(PUBLIC_DIR, 'index.html'), generateSiteHtml(tree))
  ]);
});

const prioritySorter = (a: TreeType, b: TreeType) => ((priorityOrder[a.name] || priorityOrder.default) - (priorityOrder[b.name] || priorityOrder.default)) || fastStringCompare(a.name, b.name);

export function treeHtml(tree: TreeTypeArray, level = 0, closedFolderList: string[] = [], hrefPrefix = ''): string {
  let result = '';
  tree = [...tree].sort(prioritySorter);

  for (let i = 0, len = tree.length; i < len; i++) {
    const entry = tree[i];
    if (level === 0 && hiddenRootEntries.has(entry.name)) {
      continue;
    }
    const open = closedFolderList.includes(entry.name) ? '' : (level === 0 ? 'open' : '');

    if (entry.type === TreeFileType.DIRECTORY) {
      result += html`
        <li class="folder">
          <details ${open}>
            <summary>${entry.name}</summary>
            <ul>${treeHtml(entry.children, level + 1, closedFolderList, hrefPrefix)}</ul>
          </details>
        </li>
      `;
    } else if (/* entry.type === 'file' && */ !entry.name.endsWith('.html') && entry.name[0] !== '_') {
      const relativePath = entry.path.replaceAll('\\', '/').replace(rLeadingSlash, '');
      result += html`
        <li class="file"><a class="file-link" href="${hrefPrefix}${relativePath}">${entry.name}</a></li>
      `;
    }
  }
  return result;
}

function generateSiteHtml(tree: TreeTypeArray) {
  return html`
      <!DOCTYPE html>
      <html lang="zh-CN">

      <head>
        <meta charset="utf-8">
        <title>RuleMesh</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <meta name="description" content="RuleMesh maintained rulesets for Surge, Shadowrocket, Mihomo, sing-box and compatible clients">

        <meta property="og:title" content="RuleMesh">
        <meta property="og:type" content="Website">
        <meta property="og:url" content="https://codingmesh.github.io/ruleset/">
        <meta property="og:description" content="Maintained multi-client rulesets based on SukkaW/Surge">
        <meta name="twitter:card" content="summary">
        <link rel="canonical" href="https://codingmesh.github.io/ruleset/">
        <style>
          :root {
            --font-family: system-ui, -apple-system, "Segoe UI", "Roboto", "Ubuntu", "Cantarell", "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
            --line-height: 1.5;
            --font-weight: 400;
            --font-size: 16px;
            --border-radius: 0.25rem;
            --border-width: 1px;
            --outline-width: 3px;
            --spacing: 1rem;
            --typography-spacing-vertical: 1.5rem;
            --block-spacing-vertical: calc(var(--spacing)*2);
            --block-spacing-horizontal: var(--spacing);
            --nav-element-spacing-vertical: 1rem;
            --nav-element-spacing-horizontal: 0.5rem;
            --nav-link-spacing-vertical: 0.5rem;
            --nav-link-spacing-horizontal: 0.5rem;
            --form-label-font-weight: var(--font-weight);
            --transition: 0.2s ease-in-out
          }

          @media (min-width:576px) {
            :root {
              --font-size: 17px
            }
          }

          @media (min-width:768px) {
            :root {
              --font-size: 18px
            }
          }

          @media (min-width:992px) {
            :root {
              --font-size: 19px
            }
          }

          @media (min-width:1200px) {
            :root {
              --font-size: 20px
            }
          }

        a {
          --text-decoration: none
        }

        a.contrast,
        a.secondary {
          --text-decoration: underline
        }

        small {
          --font-size: 0.875em
        }

      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        --font-weight: 700
      }

      h1 {
        --font-size: 2rem;
        --typography-spacing-vertical: 3rem
      }

      :not(thead):not(tfoot)>*>td {
        --font-size: 0.875em
      }

      code,
      kbd,
      pre,
      samp {
        --font-family: "Menlo", "Consolas", "Roboto Mono", "Ubuntu Monospace", "Noto Mono", "Oxygen Mono", "Liberation Mono", monospace, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"
      }

      kbd {
        --font-weight: bolder
      }

      :root:not([data-theme=dark]),
      [data-theme=light] {
        --background-color: #fff;
        --color: #415462;
        --h1-color: #1b2832;
        --h2-color: #24333e;
        --h3-color: #2c3d49;
        --h4-color: #374956;
        --h5-color: #415462;
        --h6-color: #4d606d;
        --muted-color: #73828c;
        --muted-border-color: #edf0f3;
        --primary: #1095c1;
        --primary-hover: #08769b;
        --primary-focus: rgba(16, 149, 193, .125);
        --primary-inverse: #fff;
        --secondary: #596b78;
        --secondary-hover: #415462;
        --secondary-focus: rgba(89, 107, 120, .125);
        --secondary-inverse: #fff;
        --contrast: #1b2832;
        --contrast-hover: #000;
        --contrast-focus: rgba(89, 107, 120, .125);
        --contrast-inverse: #fff;
        --mark-background-color: #fff2ca;
        --mark-color: #543a26;
        --modal-overlay-background-color: rgba(213, 220, 226, .8);
        --loading-spinner-opacity: 0.5;
        --icon-folder: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23415462' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.06-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.38a1.5 1.5 0 0 1-1.06-.44Z'/%3E%3C/svg%3E");
        --icon-file: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23415462' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 14.25v-2.63a3.38 3.38 0 0 0-3.38-3.37h-1.5a1.13 1.13 0 0 1-1.12-1.13v-1.5a3.38 3.38 0 0 0-3.38-3.37H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.62c-.62 0-1.12.5-1.12 1.13v17.25c0 .62.5 1.12 1.13 1.12h12.75c.62 0 1.12-.5 1.12-1.13v-9.37a9 9 0 0 0-9-9Z'/%3E%3C/svg%3E");
        --icon-folder-open: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23415462' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M3.75 9.78c.11-.02.23-.03.34-.03h15.82c.11 0 .23 0 .34.03m-16.5 0a2.25 2.25 0 0 0-1.88 2.54l.85 6a2.25 2.25 0 0 0 2.23 1.93h14.1a2.25 2.25 0 0 0 2.23-1.93l.85-6a2.25 2.25 0 0 0-1.88-2.54m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.88a1.5 1.5 0 0 1 1.06.44l2.12 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.78'/%3E%3C/svg%3E");
        color-scheme: light
      }

      @media only screen and (prefers-color-scheme:dark) {
        :root:not([data-theme=light]) {
          --background-color: #11191f;
          --color: #bbc6ce;
          --h1-color: #edf0f3;
          --h2-color: #e1e6eb;
          --h3-color: #d5dce2;
          --h4-color: #c8d1d8;
          --h5-color: #bbc6ce;
          --h6-color: #afbbc4;
          --muted-color: #73828c;
          --muted-border-color: #1f2d38;
          --primary: #1095c1;
          --primary-hover: #1ab3e6;
          --primary-focus: rgba(16, 149, 193, .25);
          --primary-inverse: #fff;
          --secondary: #596b78;
          --secondary-hover: #73828c;
          --secondary-focus: rgba(115, 130, 140, .25);
          --secondary-inverse: #fff;
          --contrast: #edf0f3;
          --contrast-hover: #fff;
          --contrast-focus: rgba(115, 130, 140, .25);
          --contrast-inverse: #000;
          --mark-background-color: #d1c284;
          --mark-color: #11191f;
          --modal-overlay-background-color: rgba(36, 51, 62, .9);
          --loading-spinner-opacity: 0.5;
          --icon-folder: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='none' stroke='%23bbc6ce' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'%3E%3Cpath d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'/%3E%3C/svg%3E");
          --icon-file: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23bbc6ce' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 14.25v-2.63a3.38 3.38 0 0 0-3.38-3.37h-1.5a1.13 1.13 0 0 1-1.12-1.13v-1.5a3.38 3.38 0 0 0-3.38-3.37H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.62c-.62 0-1.12.5-1.12 1.13v17.25c0 .62.5 1.12 1.13 1.12h12.75c.62 0 1.12-.5 1.12-1.13v-9.37a9 9 0 0 0-9-9Z'/%3E%3C/svg%3E");
          --icon-folder-open: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23bbc6ce' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M3.75 9.78c.11-.02.23-.03.34-.03h15.82c.11 0 .23 0 .34.03m-16.5 0a2.25 2.25 0 0 0-1.88 2.54l.85 6a2.25 2.25 0 0 0 2.23 1.93h14.1a2.25 2.25 0 0 0 2.23-1.93l.85-6a2.25 2.25 0 0 0-1.88-2.54m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.88a1.5 1.5 0 0 1 1.06.44l2.12 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.78'/%3E%3C/svg%3E");
          color-scheme: dark
        }
      }

      *,
      :after,
      :before {
        background-repeat: no-repeat;
        box-sizing: border-box
      }

      :after,
      :before {
        text-decoration: inherit;
        vertical-align: inherit
      }

      :where(:root) {
        -webkit-tap-highlight-color: transparent;
        -webkit-text-size-adjust: 100%;
        -moz-text-size-adjust: 100%;
        text-size-adjust: 100%;
        background-color: var(--background-color);
        color: var(--color);
        cursor: default;
        font-family: var(--font-family);
        font-size: var(--font-size);
        font-weight: var(--font-weight);
        line-height: var(--line-height);
        overflow-wrap: break-word;
        -moz-tab-size: 4;
        -o-tab-size: 4;
        tab-size: 4;
        text-rendering: optimizeLegibility
      }

      main {
        display: block
      }

      body {
        margin: 0;
        width: 100%
      }

      body>footer,
      body>header,
      body>main {
        margin-left: auto;
        margin-right: auto;
        padding: var(--block-spacing-vertical) 0;
        width: 100%
      }

      .container,
      .container-fluid {
        margin-left: auto;
        margin-right: auto;
        padding-left: var(--spacing);
        padding-right: var(--spacing);
        width: 100%
      }

      @media (min-width:576px) {
        .container {
          max-width: 510px;
          padding-left: 0;
          padding-right: 0
        }
      }

      @media (min-width:768px) {
        .container {
          max-width: 700px
        }
      }

      @media (min-width:992px) {
        .container {
          max-width: 920px
        }
      }

      @media (min-width:1200px) {
        .container {
          max-width: 1130px
        }
      }

      section {
        margin-bottom: var(--block-spacing-vertical)
      }

      b,
      strong {
        font-weight: bolder
      }

      address,
      blockquote,
      dl,
      figure,
      form,
      ol,
      p,
      pre,
      table,
      ul {
        color: var(--color);
        font-size: var(--font-size);
        font-style: normal;
        font-weight: var(--font-weight);
        margin-bottom: var(--typography-spacing-vertical);
        margin-top: 0
      }

      [role=link],
      a:not(.file-link) {
        --color: var(--primary);
        --background-color: transparent;
        background-color: var(--background-color);
        color: var(--color);
        outline: none;
        -webkit-text-decoration: var(--text-decoration);
        text-decoration: var(--text-decoration)
      }

      [role=link]:is([aria-current], :hover, :active, :focus):not(.file-link),
      a:is([aria-current], :hover, :active, :focus):not(.file-link) {
        color: var(--primary-hover);
        text-decoration: underline
      }

      [role=link]:focus:not(.file-link),
      a:focus:not(.file-link) {
        --background-color: var(--primary-focus)
      }

      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        color: var(--color);
        font-family: var(--font-family);
        font-size: var(--font-size);
        font-weight: var(--font-weight);
        margin-bottom: var(--typography-spacing-vertical);
        margin-top: 0
      }

      h1 {
        --color: var(--h1-color)
      }

      h2 {
        --color: var(--h2-color)
      }

      h3 {
        --color: var(--h3-color)
      }

      h4 {
        --color: var(--h4-color)
      }

      h5 {
        --color: var(--h5-color)
      }

      h6 {
        --color: var(--h6-color)
      }

      :where(address, blockquote, dl, figure, form, ol, p, pre, table, ul)~:is(h1, h2, h3, h4, h5, h6) {
        margin-top: var(--typography-spacing-vertical)
      }

      p {
        margin-bottom: var(--typography-spacing-vertical)
      }

      small {
        font-size: var(--font-size)
      }

      :where(dl, ol, ul) {
        -webkit-padding-start: var(--spacing);
        -webkit-padding-end: 0;
        padding-left: var(--spacing);
        padding-right: 0;
        padding-inline-end: 0;
        padding-inline-start: var(--spacing)
      }

      :where(dl, ol, ul) li {
        margin-bottom: calc(var(--typography-spacing-vertical)*.25)
      }

      :where(dl, ol, ul) :is(dl, ol, ul) {
        margin: 0;
        margin-top: calc(var(--typography-spacing-vertical)*.25)
      }

      mark {
        background-color: var(--mark-background-color);
        color: var(--mark-color);
        padding: .125rem .25rem;
        vertical-align: baseline
      }

      ::-moz-selection {
        background-color: var(--primary-focus)
      }

      ::selection {
        background-color: var(--primary-focus)
      }

      :where(audio, canvas, iframe, img, svg, video) {
        vertical-align: middle
      }

      img {
        border-style: none;
        height: auto;
        max-width: 100%
      }

      :where(svg:not([fill])) {
        fill: currentColor
      }

      svg:not(:root) {
        overflow: hidden
      }

      legend {
        color: inherit;
        max-width: 100%;
        padding: 0;
        white-space: normal
      }

      ::-webkit-inner-spin-button,
      ::-webkit-outer-spin-button {
        height: auto
      }

      ::-moz-focus-inner {
        border-style: none;
        padding: 0
      }

      :-moz-focusring {
        outline: none
      }

      :-moz-ui-invalid {
        box-shadow: none
      }

      ::-ms-expand {
        display: none
      }

      fieldset {
        border: 0;
        margin: 0;
        margin-bottom: var(--spacing);
        padding: 0
      }

      fieldset legend,
      label {
        display: block;
        font-weight: var(--form-label-font-weight, var(--font-weight));
        margin-bottom: calc(var(--spacing)*.25)
      }

      [aria-controls] {
        cursor: pointer
      }

      [aria-disabled=true],
      [disabled] {
        cursor: not-allowed
      }

      [aria-hidden=false][hidden] {
        display: initial
      }

      [aria-hidden=false][hidden]:not(:focus) {
        clip: rect(0, 0, 0, 0);
        position: absolute
      }

      [tabindex],
      a,
      area,
      button,
      input,
      label,
      select,
      summary,
      textarea {
        -ms-touch-action: manipulation
      }

      .tree {
        --tree-spacing: 1.5rem;
        --radius: 10px;
      }

      .tree a {
        border-bottom: 1px solid transparent;
        border-color: var(--secondary);
        color: var(--color);
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .tree a:hover {
        border-color: var(--secondary-hover);
        color: var(--h3-color);
      }

      .tree,
      .tree ul,
      .tree li {
        list-style: none;
        list-style-type: none;
      }

      .tree .folder li {
        display: block;
        position: relative;
        padding-left: calc(2 * var(--tree-spacing) - var(--radius) - 2px);
      }

      .tree ul {
        margin-left: calc(var(--radius) - var(--tree-spacing));
        padding-left: 0;
      }

      .tree summary {
        display: block;
        cursor: pointer;
      }

      .tree summary::marker,
      .tree summary::-webkit-details-marker {
        display: none;
      }

      .tree summary:focus {
        outline: none;
      }

      .tree summary:focus-visible {
        outline: 1px dotted #000;
      }

      .tree li.file::before {
        margin-right: 10px;
        vertical-align: middle;
        height: 20px;
        width: 20px;
        content: '';
        display: inline-block;
        background-image: var(--icon-file);
        background-position: top;
        background-size: 75% auto;
      }

      .tree li.folder>details>summary::before {
        z-index: 1;

        margin-right: 10px;
        vertical-align: middle;
        height: 20px;
        width: 20px;
        content: '';
        display: inline-block;
        background-image: var(--icon-folder);
        background-position: top;
        background-size: 75% auto;
      }

      .tree li.folder>details[open]>summary::before {
        background-image: var(--icon-folder-open);
      }
      .site-header { position:sticky; top:0; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:20px; padding:16px 0; margin-bottom:32px; border-bottom:1px solid var(--muted-border-color); background:var(--background-color) }
      .site-header h1 { margin:0; font:650 28px/1.2 "Avenir Next",system-ui,sans-serif; letter-spacing:-1px }
      .site-nav { display:flex; flex-wrap:wrap; gap:4px }
      .site-header .site-nav a { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:8px 14px; border-radius:6px; color:var(--h2-color); font:500 14px/1.4 var(--font-family); text-decoration:none }
      .site-header .site-nav a[aria-current=page] { background:var(--primary-focus); color:var(--h1-color) }
      .site-header .site-nav a:hover { text-decoration:none; background:var(--primary-focus) }
      [data-view] { scroll-margin-top:96px }
      [data-view][hidden], [data-client-panel][hidden] { display:none }
      .intro { max-width:48rem; color:var(--color) }
      .entry-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(14rem,1fr)); gap:1rem; margin:2rem 0 }
      .entry { border:1px solid var(--muted-border-color); border-radius:.75rem; padding:1.2rem }
      .entry h2 { margin-bottom:.5rem }
      #configs { --font-size:16px; --config-surface:#fff; --config-soft:#f3f7fa; --config-border:#d5e0e7; --config-muted:#536875; --config-ink:#172f40; --config-accent:#086d8b; --config-inverse:#fff; font:400 16px/1.6 var(--font-family); color:var(--config-ink) }
      #configs h2, #configs h3, #configs h4 { font-family:"Avenir Next",var(--font-family); color:var(--config-ink); letter-spacing:-.4px }
      #configs h2 { margin:0 0 8px; font-size:32px; line-height:1.25; font-weight:650 }
      #configs h3 { margin:0; font-size:23px; line-height:1.4; font-weight:600 }
      #configs h4 { margin:0; font-size:20px; line-height:1.4; font-weight:600 }
      #configs p { margin:0 }
      #configs a { color:var(--config-accent) }
      #configs :is(a,button,input,summary):focus-visible, .site-nav a:focus-visible { outline:2px solid var(--primary); outline-offset:4px }
      .config-intro p { color:var(--config-muted) }
      .client-switch { display:flex; flex-wrap:wrap; gap:6px; margin:24px 0 28px; padding:6px; border:1px solid var(--config-border); border-radius:10px; background:var(--config-soft); width:fit-content; max-width:100% }
      #configs .client-switch button { display:inline-flex; align-items:center; justify-content:center; min-height:44px; margin:0; padding:10px 16px; border:1px solid transparent; border-radius:6px; background:transparent; color:var(--config-muted); font:500 14px/1.4 var(--font-family); cursor:pointer }
      #configs .client-switch button[aria-selected=true] { border-color:var(--config-border); background:var(--config-surface); color:var(--config-ink); box-shadow:0 1px 3px #0000000a }
      .client-heading, .artifact-heading { display:flex; align-items:center; flex-wrap:wrap; gap:12px }
      .config-kind { color:var(--config-muted); font-size:13px }
      #configs .client-note { margin:8px 0 20px; color:var(--config-muted); max-width:760px }
      .artifact-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; gap:20px }
      .artifact { min-width:0; border:1px solid var(--config-border); border-radius:10px; padding:24px; background:var(--config-surface) }
      .config-badge { font:500 12px/1.5 var(--font-family); padding:3px 8px; border-radius:4px; color:var(--config-accent); background:var(--config-soft) }
      #configs .variant-description { margin:8px 0 20px; color:var(--config-muted); font-size:14px }
      .config-url { display:flex; align-items:center; gap:12px; padding:10px 12px; border:1px solid var(--config-border); border-radius:6px; background:var(--config-soft) }
      .config-url code { flex:1; min-width:0; overflow-wrap:anywhere; font:400 13px/1.7 "SFMono-Regular",Menlo,Consolas,monospace; color:var(--config-muted); background:none; padding:0 }
      #configs .config-url button { flex:none; min-height:44px; margin:0; padding:8px; border:0; border-radius:4px; background:none; color:var(--config-accent); font:600 13px/1.4 var(--font-family); cursor:pointer; white-space:nowrap }
      #configs .config-url button:hover { background:var(--primary-focus) }
      .actions { display:flex; align-items:center; flex-wrap:wrap; gap:20px; margin-top:20px }
      #configs .config-button { display:inline-flex; align-items:center; justify-content:center; gap:12px; min-height:44px; margin:0; padding:10px 16px; border:1px solid var(--config-accent); border-radius:6px; background:var(--config-accent); color:var(--config-inverse); font:600 14px/1.5 var(--font-family); text-decoration:none; cursor:pointer }
      #configs .config-button:hover { filter:brightness(.9); text-decoration:none }
      .config-source { font-size:14px; text-underline-offset:4px }
      .config-qr { margin-top:20px; padding-top:14px; border-top:1px solid var(--config-border) }
      .config-qr summary { width:fit-content; color:var(--config-accent); font-size:14px; cursor:pointer; min-height:28px }
      .qr-content { display:flex; align-items:center; flex-wrap:wrap; gap:20px; margin-top:16px }
      .qr-content img { display:block; width:208px; height:208px; max-width:100%; background:white; border:1px solid var(--config-border); border-radius:6px }
      #configs .qr-content p { color:var(--config-muted); font-size:13px; max-width:180px }
      .compose-help { margin-top:28px; padding:24px; border:1px solid var(--config-border); border-radius:10px; background:var(--config-soft) }
      #configs .compose-help h4 { margin-bottom:8px; font-size:18px }
      #configs .compose-help p { color:var(--config-muted); font-size:14px }
      .compose-help pre { margin:14px 0; padding:14px 16px; border:1px solid var(--config-border); border-radius:6px; background:var(--config-surface); white-space:pre-wrap; overflow-wrap:anywhere }
      .compose-help pre code { font:400 13px/1.7 "SFMono-Regular",Menlo,Consolas,monospace }
      .import-composed { margin-top:20px }
      .import-composed label { margin-bottom:8px; font-size:14px; font-weight:600 }
      .import-row { display:flex; align-items:stretch; gap:12px }
      #configs .import-row input { flex:1; min-width:0; width:100%; margin:0; padding:12px 14px; border:1px solid var(--config-border); border-radius:6px; background:var(--config-surface); color:var(--config-ink); font:400 16px/1.4 var(--font-family) }
      .import-row button { flex:none }
      #configs .import-error { color:var(--del-color); font-size:14px; margin-top:8px }
      .import-error:empty { display:none }
      #configs .config-resources { margin-top:24px; font-size:14px }
      .config-footer { display:flex; flex-wrap:wrap; gap:24px; margin-top:32px; padding-top:20px; border-top:1px solid var(--config-border); font-size:13px }
      @media (prefers-color-scheme:dark) { #configs { --config-surface:#14222c; --config-soft:#101b23; --config-border:#30414e; --config-muted:#b0c1ce; --config-ink:#e6edf2; --config-accent:#8dd5eb; --config-inverse:#10212a } }
      @media (max-width:700px) { .artifact-list { grid-template-columns:1fr } .artifact, .compose-help { padding:20px } .import-row { flex-direction:column } }
      @media (max-width:600px) { .site-header { align-items:flex-start; flex-direction:column; gap:10px; padding:12px 0; margin-bottom:24px } .site-nav { gap:0 } .site-header .site-nav a { padding:8px 12px } [data-view] { scroll-margin-top:150px } .client-switch { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); width:100% } #configs .client-switch button { padding:10px 8px } #configs h2 { font-size:28px } .config-url { flex-direction:column; align-items:stretch; gap:4px } .config-url button { align-self:flex-end } }
      code { overflow-wrap:anywhere }
      </style>
      </head>
      <body>
        <main class="container">
          <header class="site-header"><h1>RuleMesh</h1><nav class="site-nav" aria-label="RuleMesh 导航"><a href="#overview" data-nav="overview">概览</a><a href="#rules" data-nav="rules">规则目录</a><a href="#configs" data-nav="configs">客户端配置</a><a href="https://github.com/codingmesh/rulemesh">GitHub ↗</a></nav></header>
          <section id="overview" data-view="overview"><p class="intro">按服务分类的规则组与多客户端配置，支持 Shadowrocket、Surge、Mihomo 和 sing-box。</p><div class="entry-grid"><article class="entry"><h2>规则目录</h2><p>沿用 Sukka 目录展示，按客户端和分类查找规则。</p><p><a href="#rules">浏览规则</a></p></article><article class="entry"><h2>客户端配置</h2><p>选择标准或广告档，使用自己的节点导入配置。</p><p><a href="#configs">选择配置</a></p></article><article class="entry"><h2>自定义与维护</h2><p>添加自己的规则，查看来源和维护文档。</p><p><a href="https://github.com/codingmesh/rulemesh">查看源码</a></p></article></div><p>基于 <a href="https://github.com/SukkaW/Surge">SukkaW/Surge</a> · <a href="LICENSE">AGPL-3.0</a></p></section>
          <section id="rules" data-view="rules" hidden><h2>规则目录</h2><ul class="tree">${treeHtml(tree, 0, closedRootFolders)}</ul></section>
          ${renderClientConfigs()}
        </main>
        <script>const views=[...document.querySelectorAll('[data-view]')],nav=[...document.querySelectorAll('[data-nav]')];function showView(){const name=location.hash.slice(1)||'overview';for(const view of views)view.hidden=view.dataset.view!==name;for(const link of nav)link.setAttribute('aria-current',link.dataset.nav===name?'page':'false')}addEventListener('hashchange',showView);showView();${clientConfigScript()}</script>
      </body>
    </html>
  `;
}
