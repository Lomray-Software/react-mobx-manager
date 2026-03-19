# SSR

## Supported

Yes, the library supports SSR, but you should treat each request as a separate manager lifecycle.

For real-world integrations, look at:

- [Vite demo app](https://github.com/Lomray-Software/vite-template)
- [After.js / Razzle example](https://github.com/Lomray-Software/microservices-dashboard/blob/staging/src/pages/user/index.tsx#L82)
- [NextJS example](https://github.com/Lomray-Software/nextjs-mobx-store-manager-example)

## Recommended pattern

Create a new manager per request and destroy it at the end:

```ts
const manager = new Manager();

try {
  await manager.init();
  // render request
} finally {
  manager.destroy();
}
```

## Why `destroy()` matters

GC handles unreachable objects, but it does not unsubscribe listeners registered on long-lived resources for you.

Examples that need cleanup:

- `process.on(...)`
- global event emitters
- sockets
- intervals
- database or cache subscriptions

`manager.destroy()` gives you explicit teardown and triggers:

- `onDestroy`
- cleanup returned from `init`
- internal store cleanup

## Practical guidance

Do:

- create one manager per request
- call `manager.destroy()` in `finally`
- keep SSR `initState` request-scoped
- disable persist on the server when needed

Do not:

- share request stores across requests
- keep request-local stores in module-level singletons
- rely on GC as a replacement for explicit teardown
