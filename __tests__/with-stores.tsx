import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it, vi } from 'vitest';

const reactModuleId = 'react';
const mobxReactLiteModuleId = 'mobx-react-lite';
const hoistModuleId = 'hoist-non-react-statics';
const suspenseModuleId = '@lomray/consistent-suspense';
const contextModuleId = '@src/context';

describe('withStores', () => {
  const componentResult = 'component-result';
  const parentId = 'parent-id';
  const suspenseId = 'suspense-id';
  const autoId = 'auto-id';
  const globalStoreId = 'global-store';
  const localStoreId = 'local-store';

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('react');
    vi.doUnmock('mobx-react-lite');
    vi.doUnmock('hoist-non-react-statics');
    vi.doUnmock('@lomray/consistent-suspense');
    vi.doUnmock('@src/context');
  });

  it('should create and mount stores for wrapped component', async () => {
    const mount = sinon.stub().returns(() => undefined);
    const componentSpy = sinon.stub();
    const onComponentPropsUpdate = sinon.stub();
    const ReactMock = {
      createElement: (
        type: ((props: Record<string, unknown>) => unknown) | string,
        props: Record<string, unknown> | null,
        ...children: unknown[]
      ) => {
        const nextProps = {
          ...(props ?? {}),
          children:
            children.length === 0
              ? props?.children
              : children.length === 1
                ? children[0]
                : children,
        };

        return typeof type === 'function' ? type(nextProps) : nextProps.children;
      },
      useEffect: (callback: () => (() => void) | void) => callback(),
      useRef: <T,>(value: T) => ({ current: value }),
      useState: (factory: () => unknown) => [factory(), sinon.stub()],
    };
    const storeManager = {
      createStores: sinon.stub().returns({
        globalStores: {
          globalStore: {
            libStoreId: globalStoreId,
            isGlobal: true,
            onComponentPropsUpdate: sinon.stub(),
          },
        },
        relativeStores: {
          localStore: {
            libStoreId: localStoreId,
            isGlobal: false,
            onComponentPropsUpdate,
          },
        },
        parentStores: { parentStore: { libStoreId: 'parent-store' } },
        hasCreationFailure: false,
      }),
      mountStores: mount,
    };
    const parentProvider = sinon.stub().callsFake(({ children }) => children);
    const hoist = sinon.stub();
    const component = function View(props: Record<string, unknown>) {
      componentSpy(props);

      return componentResult;
    };

    vi.doMock(reactModuleId, () => ({
      default: ReactMock,
      ...ReactMock,
    }));
    vi.doMock(mobxReactLiteModuleId, () => ({
      observer: (target: unknown) => target,
    }));
    vi.doMock(hoistModuleId, () => ({
      default: hoist,
    }));
    vi.doMock(suspenseModuleId, () => ({
      useConsistentSuspense: () => ({ suspenseId }),
      useId: () => autoId,
    }));
    vi.doMock(contextModuleId, () => ({
      useStoreManager: () => storeManager,
      useStoreManagerParent: () => parentId,
      StoreManagerParentProvider: parentProvider,
    }));

    const { default: withStores } = await import('@src/with-stores');
    const Wrapped = withStores(
      component as never,
      { localStore: class TestStore {} },
      {
        customContextId: 'custom-id',
      },
    );

    const result = Wrapped({ foo: 'bar' } as never);

    sinon.assert.calledOnce(storeManager.createStores);
    sinon.assert.calledWith(mount, 'custom-id', sinon.match.object);
    sinon.assert.calledWith(
      componentSpy,
      sinon.match({
        foo: 'bar',
        globalStore: { libStoreId: globalStoreId, isGlobal: true },
        localStore: { libStoreId: localStoreId, isGlobal: false },
        parentStore: { libStoreId: 'parent-store' },
      }),
    );
    sinon.assert.calledOnce(parentProvider);
    sinon.assert.calledOnce(hoist);
    sinon.assert.notCalled(onComponentPropsUpdate);
    expect(Wrapped.displayName).to.equal('Mobx(View)');
    expect(result).to.equal(componentResult);
  });

  it('should hide component when store creation fails', async () => {
    const component = sinon.stub().returns(componentResult);
    const ReactMock = {
      createElement: (
        type: ((props: Record<string, unknown>) => unknown) | string,
        props: Record<string, unknown> | null,
        ...children: unknown[]
      ) => {
        const nextProps = {
          ...(props ?? {}),
          children:
            children.length === 0
              ? props?.children
              : children.length === 1
                ? children[0]
                : children,
        };

        return typeof type === 'function' ? type(nextProps) : nextProps.children;
      },
      useEffect: () => undefined,
      useRef: <T,>(value: T) => ({ current: value }),
      useState: (factory: () => unknown) => [factory(), sinon.stub()],
    };

    vi.doMock(reactModuleId, () => ({
      default: ReactMock,
      ...ReactMock,
    }));
    vi.doMock(mobxReactLiteModuleId, () => ({
      observer: (target: unknown) => target,
    }));
    vi.doMock(hoistModuleId, () => ({
      default: sinon.stub(),
    }));
    vi.doMock(suspenseModuleId, () => ({
      useConsistentSuspense: () => ({ suspenseId }),
      useId: () => autoId,
    }));
    vi.doMock(contextModuleId, () => ({
      useStoreManager: () => ({
        createStores: () => ({
          globalStores: {},
          relativeStores: {},
          parentStores: {},
          hasCreationFailure: true,
        }),
        mountStores: sinon.stub(),
      }),
      useStoreManagerParent: () => parentId,
      StoreManagerParentProvider: ({ children }: { children: unknown }) => children,
    }));

    const { default: withStores } = await import('@src/with-stores');
    const Wrapped = withStores(component as never, {}, {});

    expect(Wrapped({} as never)).to.equal(false);
    sinon.assert.notCalled(component);
  });

  it('should call onComponentPropsUpdate only for relative stores on rerender', async () => {
    const relativeStore = {
      libStoreId: localStoreId,
      onComponentPropsUpdate: sinon.stub(),
    };
    const globalStore = {
      libStoreId: globalStoreId,
      isGlobal: true,
      onComponentPropsUpdate: sinon.stub(),
    };
    const effects: (() => (() => void) | void)[] = [];
    const ref = { current: false };
    let storedState: unknown;
    const ReactMock = {
      createElement: (
        type: ((props: Record<string, unknown>) => unknown) | string,
        props: Record<string, unknown> | null,
        ...children: unknown[]
      ) => {
        const nextProps = {
          ...(props ?? {}),
          children:
            children.length === 0
              ? props?.children
              : children.length === 1
                ? children[0]
                : children,
        };

        return typeof type === 'function' ? type(nextProps) : nextProps.children;
      },
      useEffect: (callback: () => (() => void) | void) => {
        effects.push(callback);

        return undefined;
      },
      useRef: <T,>(value: T) => {
        if (typeof value === 'boolean') {
          return ref as { current: T };
        }

        return { current: value };
      },
      useState: (factory: () => unknown) => {
        if (storedState === undefined) {
          storedState = factory();
        }

        return [storedState, sinon.stub()];
      },
    };

    vi.doMock(reactModuleId, () => ({
      default: ReactMock,
      ...ReactMock,
    }));
    vi.doMock(mobxReactLiteModuleId, () => ({
      observer: (target: unknown) => target,
    }));
    vi.doMock(hoistModuleId, () => ({
      default: sinon.stub(),
    }));
    vi.doMock(suspenseModuleId, () => ({
      useConsistentSuspense: () => ({ suspenseId }),
      useId: () => autoId,
    }));
    vi.doMock(contextModuleId, () => ({
      useStoreManager: () => ({
        createStores: () => ({
          globalStores: { globalStore },
          relativeStores: { localStore: relativeStore },
          parentStores: {},
          hasCreationFailure: false,
        }),
        mountStores: sinon.stub().returns(() => undefined),
      }),
      useStoreManagerParent: () => parentId,
      StoreManagerParentProvider: ({ children }: { children: unknown }) => children,
    }));

    const { default: withStores } = await import('@src/with-stores');
    const Wrapped = withStores((() => componentResult) as never, {}, {});

    Wrapped({ foo: 'bar' } as never);
    effects[1]?.();
    Wrapped({ foo: 'baz' } as never);
    effects[3]?.();

    sinon.assert.calledOnceWithExactly(relativeStore.onComponentPropsUpdate, { foo: 'baz' });
    sinon.assert.notCalled(globalStore.onComponentPropsUpdate);
  });
});
