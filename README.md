# React MobX Manager

<p align="center">
    <img  src="./logo.png" alt="Mobx stores manager logo" width="250" height="253">
</p>

MobX store manager for React with relative, parent and global stores.

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

## Install

```bash
npm i @lomray/react-mobx-manager @lomray/consistent-suspense
```

## Documentation

Full documentation lives in [here](https://lomray-software.github.io/react-mobx-manager/)

## License
Made with 💚

Published under [MIT License](./LICENSE).
