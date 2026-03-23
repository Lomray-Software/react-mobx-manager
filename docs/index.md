---
layout: home

hero:
  name: React MobX Manager
  text: Clean React components. Encapsulated business logic. No state-tree pain.
  tagline: A simple MobX store manager that keeps UI focused on layout and interaction, while stores own state and business logic.
  image:
    src: https://raw.githubusercontent.com/Lomray-Software/react-mobx-manager/prod/logo.png
    alt: React MobX Manager logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/manager
    - theme: alt
      text: GitHub
      link: https://github.com/Lomray-Software/react-mobx-manager

features:
  - title: UI And Logic Stay Separate
    details: Components focus on rendering and layout. Stores hold state, actions and business logic.
  - title: Scoped DI For Features
    details: Each part of the UI gets the stores it actually needs, without pushing everything into one global layer.
  - title: Two Real Store Modes
    details: Use relative stores for component-owned state and global stores for app-wide state. Parent is a lookup mode, not a third store kind.
  - title: Ready For Production Flows
    details: SSR, stream rendering, persistence, React Native and development tooling are part of the package story.
---

## Why this exists

This library is built for React applications that want MobX stores without pushing everything into one big state tree and without leaking business logic into components.

It gives you:

- clean UI components that mostly describe layout
- stores that own state and business logic
- scoped dependency injection for feature-level state
- relative stores for local ownership
- global stores for app-wide ownership
- parent lookup when a child component should reuse an ancestor relative store
- SSR, stream rendering, persistence and development support under the hood
- stable store methods and state access without hook dependency boilerplate in components

<div class="home-callout">
  <p>
    The core idea is simple: state and business logic live in stores, UI stays in components, and the
    manager creates only what is needed for the current part of the tree.
  </p>
</div>

## What makes it different

The package is opinionated in the useful places:

- it acts like scoped DI for feature-level state and logic
- it separates `global` and `relative` store ownership
- it lets child components reach ancestor stores through parent lookup
- it avoids keeping unnecessary store instances alive
- it lets stores compose with other stores without prop drilling
- it keeps methods and state on stores, so components do not need hook dependency gymnastics
- it works with Suspense, SSR, streams, persistence and React Native scenarios

If that model matches how your app is structured, the library becomes straightforward to use and scale.

<div class="home-grid">
  <div class="item">
    <strong>Relative stores</strong>
    Belong to concrete components or subtrees and disappear with them.
  </div>
  <div class="item">
    <strong>Global stores</strong>
    Are created once per manager and reused anywhere in the app.
  </div>
  <div class="item">
    <strong>Parent lookup</strong>
    Lets child components reuse ancestor relative stores without inventing another global layer.
  </div>
  <div class="item">
    <strong>Store composition</strong>
    Local stores can use parent or global stores through <code>getStore(...)</code> without prop drilling through component layers.
  </div>
  <div class="item">
    <strong>Operational support</strong>
    Persistence, SSR, stream rendering, HMR and React Native are already in the conversation.
  </div>
</div>

## Why it actually helps

`@lomray/react-mobx-manager` is not just state management.

It helps solve several problems at once:

- scoped DI for a feature or subtree
- store-to-store composition without manual prop drilling
- local stores living next to the components that own them
- predictable lifecycle for screens, modals, and nested UI blocks
- stable methods, functions, and properties on stores without hook dependency noise in components

In practice:

- a screen gets its own store through `withStores`
- child components reuse that store through `parentStore(...)`
- local UI blocks can own their own stores and still access parent or global stores through `getStore(...)`
- truly global things like auth, current user, or settings live separately and are not duplicated

That is why the library is closer to a context and dependency manager for MobX applications than to just another MobX wrapper.

<div class="home-callout">
  <p>
    One of the biggest practical wins is simple: the store stays next to the feature instead of
    disappearing into a global junk drawer, while nested components can still reuse it through
    <code>parentStore(...)</code>.
  </p>
</div>

## Read this first

- Start with [Getting Started](/guide/getting-started)
- Then read [Core Concepts](/guide/core-concepts)
- If you work with SSR, read [SSR](/guide/ssr)
- If you develop with fast refresh, read [HMR](/guide/hmr)
- For common usage patterns, read [Examples / Recipes](/examples/recipes)
- For short comparison and promo phrasing, read [Talking Points](/reference/talking-points)
- If you want exact rules for AI agents or new team members, read [AI / LLM Guide](/ai-usage)
