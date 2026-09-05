# React MobX Manager

<p align="center">
    <img  src="./logo.png" alt="Mobx stores manager logo" width="250" height="253">
</p>

Clean React components. Encapsulated business logic. No state-tree pain.

It is built for apps that want explicit store ownership, SSR support, persistence, lifecycle cleanup and development tooling without forcing everything into one global state tree.

## Why use it

- One way to escape state tree 🌲🌳🌴.
- Ready to use with Suspense.
- Support SSR.
- Support render to stream.
- Relative stores for component-owned state
- Parent stores for subtree reuse
- Global stores for app-wide state
- Small package size.
- Support code splitting out of the box.
- Access stores from other stores.
- Can be a replacement for react context.
- Persistence support
- Vite plugin support
- Best-effort HMR
- And many other nice things 😎

<p align="center">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=reliability_rating" alt="reliability">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=security_rating" alt="Security Rating">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=sqale_rating" alt="Maintainability Rating">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=vulnerabilities" alt="Vulnerabilities">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=bugs" alt="Bugs">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=ncloc" alt="Lines of Code">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_react-mobx-manager&metric=coverage" alt="code coverage">
  <img src="https://img.shields.io/bundlephobia/minzip/@lomray/react-mobx-manager" alt="size">
  <img src="https://img.shields.io/npm/l/@lomray/react-mobx-manager" alt="size">
  <img src="https://img.shields.io/npm/v/@lomray/react-mobx-manager?label=semantic%20release&logo=semantic-release" alt="semantic version">
</p>

## Install

```bash
npm i @lomray/react-mobx-manager @lomray/consistent-suspense
```

Supports MobX 6 (>=6.9.0) and 7 with mobx-react-lite 3, 4, or 5; consumers must choose compatible peers, as mobx-react-lite 5 requires MobX 7 and React 18+ (React 17 remains supported with mobx-react-lite 3 or 4).

## Documentation

Full documentation lives in [here](https://lomray-software.github.io/react-mobx-manager/)

## License
Made with 💚

Published under [MIT License](./LICENSE).

With `shouldInit`, `StoreManagerProvider` renders only the fallback (or nothing) until initialization finishes. Consumers needing immediate content should initialize the manager before rendering and omit `shouldInit`, as the Vite template does.

`makeFetching` is available as a named root export. Public subpaths support both extensionless imports and explicit `.js` paths (use `/index.js` for directory entries), including native Node ESM consumers.
