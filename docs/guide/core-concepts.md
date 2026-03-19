# Core Concepts

## Main idea

The manager exists to keep business logic and state inside stores while React components stay focused on UI and layout.

In practice:

- components describe rendering
- stores describe state and business logic
- the manager creates and wires stores to the right part of the tree
- each subtree gets its own scoped dependencies instead of pulling everything from one global state layer

This means the package is not only a state manager.

It also gives you:

- scoped DI for feature-level state
- store-to-store composition without prop drilling
- local stores that stay close to their UI owners
- predictable lifecycle for screens, modals, and nested UI blocks
- stable methods and properties on stores, so components do not have to fight hook dependency arrays

Typical flow:

- a screen gets a store through `withStores`
- child components reuse that store through `parentStore(...)`
- local child UI may own its own relative store
- stores can reach parent or global stores through `getStore(...)`
- truly global state like auth or user stays separate

## Relative store

Use a relative store when the state belongs to a component subtree.

Properties:

- created for a component context
- destroyed when that context is no longer used
- receives `componentProps` in constructor
- may receive `onComponentPropsUpdate(props)` on component updates

Use it for:

- screen state
- form state
- local async flows
- component-owned UI state

## Global store

Use a global store only for app-wide state.

Properties:

- singleton per manager instance
- created on first access
- not tied to component lifecycle
- do not rely on `componentProps`

Use it for:

- current user
- app settings
- theme
- shared application services

## Parent lookup

Parent is not a separate store type.

It is a lookup mode that allows a child component to reuse a relative store created in an ancestor context.

Properties:

- lookup happens through parent context chain
- lifecycle still belongs to the owner context where the store was created
- do not rely on `componentProps` for parent stores

Use it for:

- shared contextual state inside a subtree
- wizard or nested flow state
- reused screen-level state in child components

## Quick rules

Do:

- prefer relative stores by default
- use global stores only for truly app-wide state
- use parent lookup when state ownership is outside the current component but still inside the same subtree
- keep global stores small and intentional

Do not:

- use global stores for screen-local state
- rely on `componentProps` in parent or global stores
- treat parent lookup as hidden globals
