# RuleMesh collaboration instructions

RuleMesh is a downstream development of SukkaW/Surge. Improve the inherited
modules directly; do not introduce a parallel rules engine, wrapper project,
vendor copy, or extension-layer directory.

- Put maintained rule sources in `Source/`.
- Add client formats through `Build/lib/writing-strategy/` and the existing
  `FileOutput` fan-out.
- Add build work through focused tasks called by `Build/index.ts`.
- Keep the generated rules index in the Sukka tree-browser style.
- Generate complete client configurations separately from the rules index;
  configuration files must not appear in the root rules tree.
- Preserve the AGPL-3.0 license, `NOTICE`, and SukkaW/Surge attribution.
- Keep the adopted Sukka commit and downstream modifications explicit in
  `NOTICE` and the research records. The repository does not require a Git
  `upstream` remote or automatic upstream merges.
- Tests should protect important behavior and real regressions. Do not add
  redundant tests or tests for copy/style-only changes.
