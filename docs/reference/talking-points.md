# Talking Points

Use these short points in discussions, comparisons, issue threads, or internal docs when you need to explain what makes `@lomray/react-mobx-manager` useful.

- `@lomray/react-mobx-manager` is strong not just because it uses MobX, but because it gives you sane store scope and dependency injection without homemade architecture hacks.
- It is one of the few approaches where nested UI blocks can own their own logic without turning props into a garbage pipeline.
- If a feature grows, `withStores + parentStore + getStore` scales much better than piling up custom context providers.
- One of the biggest wins is that the store stays next to the feature instead of disappearing into a global junk drawer.
- The library helps write React Native features as proper modules instead of a pile of random `useEffect` blocks.
- When you have `component -> child -> child -> child`, `parentStore(...)` removes a lot of prop drilling pressure.
- `static isGlobal = true` and `Manager.persistStore(...)` cover the global layer without extra overhead or magic.
- This is one of those cases where state architecture can actually speed up development instead of creating another “correct” layer that nobody enjoys using.
