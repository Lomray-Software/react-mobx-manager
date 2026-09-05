# Packed-package regressions

Copy these fixtures to a temporary ESM consumer and install the tarball produced by
`npm pack ./lib`, React/react-dom 19.2.8, MobX 7, mobx-react-lite 5, jsdom, Vite 8,
TypeScript 6.0.3, and the corresponding React/Node/lodash/hoist-non-react-statics types.
Run from that temporary directory:

```sh
node vite-cache.mjs
node ssr-isolated.mjs
node provider-init.mjs
node package-imports.mjs
npx --no-install tsc -p tsconfig.bundler.json --noEmit
npx --no-install tsc -p tsconfig.node16.json --noEmit
```

The Vite probe creates two builds with a retained cache and verifies rejection of a
duplicate cache. It removes the temporary consumer's manager ID cache. The SSR probe
uses separate server and client processes, with zero hydration warnings required for
scalar, shortened-array, and streamed suspense state. Both TypeScript configurations
check extensionless and explicit `.js` consumers with `skipLibCheck: false`.
