import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';
const [phase, scenario] = process.argv.slice(2);
if (!phase) {
  for (const scenario of ['scalar', 'array', 'stream'])
    for (const phase of ['server', 'client']) {
      const r = spawnSync(process.execPath, [import.meta.filename, phase, scenario], {
        encoding: 'utf8',
      });
      process.stdout.write(r.stdout);
      process.stderr.write(r.stderr);
      assert.equal(r.status, 0);
    }
} else {
  const React = await import('react');
  const { act } = React;
  const h = React.createElement;
  const { makeAutoObservable, runInAction } = await import('mobx');
  const { enableStaticRendering } = await import('mobx-react-lite');
  const { Manager, StoreManagerProvider, withStores } = await import('@lomray/react-mobx-manager');
  const { default: ManagerStream } = await import('@lomray/react-mobx-manager/manager-stream.js');
  const { default: SuspenseQuery } = await import('@lomray/react-mobx-manager/suspense-query.js');
  const { ConsistentSuspenseProvider, Suspense } = await import('@lomray/consistent-suspense');
  let fetches = 0;
  class Store {
    items = ['default-a', 'default-b'];
    count = 0;
    value = 'pending';
    suspense;
    constructor() {
      this.suspense = new SuspenseQuery(this);
      makeAutoObservable(this, { suspense: false });
    }
    load = () =>
      this.suspense.query(() => {
        fetches++;
        return new Promise((resolve) =>
          setTimeout(() => {
            runInAction(() => {
              this.value = 'streamed';
            });
            resolve();
          }, 40),
        );
      });
  }
  const Child = withStores(
    ({ store }) => {
      if (scenario === 'stream') store.load();
      return h(
        'p',
        null,
        scenario === 'array'
          ? store.items.join(',')
          : scenario === 'scalar'
            ? String(store.count)
            : store.value,
      );
    },
    { store: Store },
  );
  const wrap = (manager) =>
    h(
      React.StrictMode,
      null,
      h(
        ConsistentSuspenseProvider,
        null,
        h(
          StoreManagerProvider,
          { storeManager: manager },
          h(
            'main',
            null,
            h('header', null, 'shell|'),
            h(Suspense, { fallback: h('i', null, 'loading') }, h(Child)),
          ),
        ),
      ),
    );
  const fixturePath = new URL('./ssr-' + scenario + '.json', import.meta.url);
  if (phase === 'server') {
    enableStaticRendering(true);
    const manager = new Manager({ options: { shouldDisablePersist: true } });
    const { renderToString, renderToPipeableStream } = await import('react-dom/server');
    let html = '',
      state,
      takes = 0,
      chunks = 0;
    if (scenario !== 'stream') {
      renderToString(wrap(manager));
      runInAction(() => {
        const store = [...manager.getStores().values()][0];
        store.count = 42;
        store.items = ['server'];
      });
      html = renderToString(wrap(manager));
      state = JSON.parse(JSON.stringify(manager.toJSON()));
    } else {
      const { StreamSuspense } = await import('@lomray/consistent-suspense/server/index.js');
      const ms = new ManagerStream(manager);
      const ss = StreamSuspense.create((id) => {
        takes++;
        return ms.take(id);
      });
      await new Promise((resolve, reject) => {
        const dest = new Writable({
          write(chunk, enc, next) {
            const raw = chunk.toString();
            chunks++;
            html += ss.analyze(raw) ?? raw;
            next();
          },
        });
        dest.on('finish', resolve);
        const stream = renderToPipeableStream(wrap(manager), {
          onShellReady() {
            state = JSON.parse(JSON.stringify(manager.toJSON()));
            stream.pipe(dest);
          },
          onError: reject,
        });
      });
    }
    const result = {
      html,
      state,
      ids: [...manager.getStores().keys()],
      finalState: manager.toJSON(),
      takes,
      chunks,
      fetches,
    };
    fs.writeFileSync(fixturePath, JSON.stringify(result));
    console.log(
      JSON.stringify({
        phase,
        scenario,
        ids: result.ids,
        chunks,
        managerStreamCalls: takes,
        statePush: html.includes('window.mbxM.push'),
        fetches,
      }),
    );
    manager.destroy();
  } else {
    const fixture = JSON.parse(fs.readFileSync(fixturePath));
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!doctype html><div id="root">' + fixture.html + '</div>', {
      url: 'https://audit.test',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
    });
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    await new Promise((r) => setTimeout(r, 60));
    const container = document.getElementById('root');
    const visible = () => container.querySelector('main').textContent;
    const before = visible();
    const manager = new Manager({
      initState: fixture.state,
      options: { shouldDisablePersist: true },
    });
    enableStaticRendering(false);
    const { hydrateRoot } = await import('react-dom/client');
    const errors = [];
    const original = console.error;
    console.error = (...args) => errors.push(args.map(String).join(' '));
    let root;
    await act(async () => {
      root = hydrateRoot(container, wrap(manager), {
        onRecoverableError: (e) => errors.push(e.message),
      });
    });
    for (let i = 0; i < 4; i++)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });
    console.error = original;
    const after = visible();
    console.log(
      JSON.stringify({
        phase,
        scenario,
        serverText: before,
        clientText: after,
        ids: [...manager.getStores().keys()],
        hydrationErrors: errors.length,
        errors: errors.map((s) => s.split('\n')[0]),
        fetches,
        clientState: manager.toJSON(),
      }),
    );
    if (scenario === 'stream') {
      assert.equal(fixture.takes, 1);
      assert.equal(fixture.chunks, 2);
      assert.equal(errors.length, 0);
      assert.equal(fetches, 0);
      assert.equal(before, after);
      assert.deepEqual(JSON.parse(JSON.stringify(manager.toJSON())), fixture.finalState);
    }
    if (scenario === 'scalar') {
      assert.equal(errors.length, 0);
      assert.equal(before, after);
      assert.deepEqual([...manager.getStores().keys()], fixture.ids);
    }
    if (scenario === 'array') {
      assert.equal(errors.length, 0);
      assert.equal(before, after);
      assert.deepEqual(JSON.parse(JSON.stringify(manager.toJSON())), fixture.finalState);
    }
    await act(async () => root.unmount());
    manager.destroy();
    dom.window.close();
  }
}
