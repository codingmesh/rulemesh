# RuleMesh architecture

RuleMesh is a direct downstream development of SukkaW/Surge. There is one rules engine and one build graph.

## Inherited flow

`Source` files are read by `Build/build-common.ts`. `FileOutput` owns normalized rule data and fans it out through the writers in `Build/lib/writing-strategy`. Focused build tasks join that same graph in `Build/index.ts`. `Build/build-public.ts` generates the published directory and the Sukka-style rules tree.

## Downstream changes

RuleMesh edits those modules directly:

- additional categories live beside inherited rules in `Source`;
- Shadowrocket is another writer in the existing fan-out;
- complete configurations are build outputs under `public/Config` and are omitted from the root rules tree;
- branding, source links and legal notices identify both RuleMesh and SukkaW/Surge.

A second source model, wrapper generator, vendored copy, submodule, or extension-layer directory is out of scope.

## Publication shape

The source repository contains maintainable inputs and build code. The generated repository contains the current `public` tree. Its root page is a ruleset server directory. Configuration documentation belongs in the source repository; generated configurations may share the same HTTPS host under `Config/` without appearing in the rules directory.
