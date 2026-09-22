import { describe, expect, it } from 'vitest';
import hoistStatics from '@src/hoist-statics';

describe('hoistStatics', () => {
  it('should copy custom statics, including inherited ones, and keep react and function keys', () => {
    class Base {
      public static getInitialProps = () => 'base';

      public static fromBase = 'base-only';
    }

    class Component extends Base {
      public static getInitialProps = () => 'component';

      public static displayName = 'Source';

      public static defaultProps = { source: true };

      public static propTypes = {};
    }

    const wrapper = (): null => null;
    const result = hoistStatics(wrapper, Component);
    const statics = result as unknown as Record<string, unknown>;

    expect(result).to.equal(wrapper);
    expect(statics.getInitialProps).to.equal(Component.getInitialProps);
    expect(statics.fromBase).to.equal('base-only');
    expect(statics.displayName).to.equal(undefined);
    expect(statics.defaultProps).to.equal(undefined);
    expect(statics.propTypes).to.equal(undefined);
    expect(wrapper.name).to.equal('wrapper');
    expect(wrapper.length).to.equal(0);
    expect(Object.keys(wrapper)).to.deep.equal(['getInitialProps', 'fromBase']);
  });
});
