import { expect } from 'chai';
import sinon from 'sinon';
import { afterEach, describe, it, vi } from 'vitest';

describe('context', () => {
  const childNode = 'child-node';
  const fallbackNode = 'fallback-node';

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('react');
  });

  it('should initialize manager provider and parent provider', async () => {
    const setInit = sinon.stub();
    const contexts: { value: unknown }[] = [];
    const ReactMock = {
      createContext: (value: unknown) => {
        const context = {
          value,
          Provider: ({ children, value: nextValue }: { children: unknown; value: unknown }) => {
            context.value = nextValue;

            return children;
          },
        };

        contexts.push(context);

        return context;
      },
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
      useContext: (context: { value: unknown }) => context.value,
      useEffect: (callback: () => void) => callback(),
      useState: (value: boolean) => [value, setInit],
    };

    vi.doMock('react', () => ({
      default: ReactMock,
      ...ReactMock,
    }));

    const {
      StoreManagerParentProvider,
      StoreManagerProvider,
      useStoreManager,
      useStoreManagerParent,
    } = await import('@src/context');
    const storeManager = {
      init: sinon.stub().resolves(),
      touchedStores: sinon.stub(),
    };

    contexts[0].value = storeManager;
    const parentResult = StoreManagerParentProvider({
      parentId: 'parent-id',
      touchableStores: { store: {} },
      children: childNode,
    });

    expect(parentResult).to.equal(childNode);
    sinon.assert.calledOnceWithExactly(storeManager.touchedStores, { store: {} });

    const providerResult = StoreManagerProvider({
      storeManager: storeManager as never,
      shouldInit: true,
      fallback: fallbackNode as never,
      children: childNode,
    });

    expect(providerResult).to.equal(fallbackNode);
    sinon.assert.calledOnce(storeManager.init);

    contexts[0].value = storeManager;
    contexts[1].value = 'parent-id';

    expect(useStoreManager()).to.equal(storeManager);
    expect(useStoreManagerParent()).to.equal('parent-id');
  });
});
