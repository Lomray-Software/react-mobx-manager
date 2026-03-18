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

  afterEach(() => {
    vi.resetModules();
    vi.unmock('react');
    vi.unmock('mobx-react-lite');
    vi.unmock('hoist-non-react-statics');
    vi.unmock('@lomray/consistent-suspense');
    vi.unmock('@src/context');
  });

  it('should create and mount stores for wrapped component', async () => {
    const mount = sinon.stub().returns(() => undefined);
    const componentSpy = sinon.stub();
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
      useState: (factory: () => unknown) => [factory(), sinon.stub()],
    };
    const storeManager = {
      createStores: sinon.stub().returns({
        globalStores: { globalStore: { libStoreId: 'global-store', isGlobal: true } },
        relativeStores: { localStore: { libStoreId: 'local-store', isGlobal: false } },
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
      useConsistentSuspense: () => ({ suspenseId: 'suspense-id' }),
      useId: () => 'auto-id',
    }));
    vi.doMock(contextModuleId, () => ({
      useStoreManager: () => storeManager,
      useStoreManagerParent: () => 'parent-id',
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

    expect(storeManager.createStores).to.have.been.calledOnce;
    expect(mount).to.have.been.calledWith('custom-id', sinon.match.object);
    expect(componentSpy).to.have.been.calledWith(
      sinon.match({
        foo: 'bar',
        globalStore: { libStoreId: 'global-store', isGlobal: true },
        localStore: { libStoreId: 'local-store', isGlobal: false },
        parentStore: { libStoreId: 'parent-store' },
      }),
    );
    expect(parentProvider).to.have.been.calledOnce;
    expect(hoist).to.have.been.calledOnce;
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
      useConsistentSuspense: () => ({ suspenseId: 'suspense-id' }),
      useId: () => 'auto-id',
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
      useStoreManagerParent: () => 'parent-id',
      StoreManagerParentProvider: ({ children }: { children: unknown }) => children,
    }));

    const { default: withStores } = await import('@src/with-stores');
    const Wrapped = withStores(component as never, {}, {});

    expect(Wrapped({} as never)).to.equal(false);
    expect(component).to.have.callCount(0);
  });
});
