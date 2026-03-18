# AI Usage

This page is the strict usage guide for AI agents and new developers.

## Store type rules

- Use relative stores by default.
- Use global stores only for truly app-wide state.
- Use parent lookup only when a child component must reuse a relative store from an ancestor context.

## Component props rules

- `componentProps` are supported only for relative stores.
- Parent lookup must not rely on `componentProps`.
- Global stores must not rely on `componentProps`.
- Relative stores may implement `onComponentPropsUpdate(props)` for prop updates.

## Lifecycle rules

- `init` may return a cleanup callback.
- Cleanup returned from `init` runs on destroy.
- `onDestroy` runs on destroy.
- Use `manager.destroy()` in SSR teardown and explicit reset flows.

## HMR rules

- HMR restore is best-effort and keyed by `libStoreId`.
- If ids change, state restore is skipped for that store.
- HMR support restores state, not old instance identity.

## Parent store rules

- Parent is not a separate store type.
- Prefer `parentStore(Store)` over inline `{ isParent: true, store: Store }`.

## Persistence rules

- Persisted stores should use `Manager.persistStore(...)`.
- Do not assume every field is automatically safe to export or persist.

## SSR rules

- Create one manager per request.
- Always call `manager.destroy()` in `finally`.

## What to avoid

- Do not treat global stores as a default.
- Do not use parent lookup as hidden globals.
- Do not attach long-lived listeners in `init` without cleanup.
