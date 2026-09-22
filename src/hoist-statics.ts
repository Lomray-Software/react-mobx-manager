/**
 * Keys that belong to the function or to React itself and must stay on the wrapper.
 */
const reservedStatics = new Set<string | symbol>([
  // function
  'name',
  'length',
  'prototype',
  'caller',
  'callee',
  'arguments',
  'arity',
  // react component, memo, forwardRef
  '$$typeof',
  'type',
  'render',
  'compare',
  'childContextTypes',
  'contextType',
  'contextTypes',
  'defaultProps',
  'displayName',
  'getDefaultProps',
  'getDerivedStateFromError',
  'getDerivedStateFromProps',
  'mixins',
  'propTypes',
]);

/**
 * Copy the custom static properties of a component (and of its parent classes) to its wrapper
 */
const hoistStatics = <T extends object>(target: T, source: object): T => {
  for (
    let current: object | null = source;
    current && current !== Function.prototype && current !== Object.prototype;
    current = Object.getPrototypeOf(current) as object | null
  ) {
    for (const key of Reflect.ownKeys(current)) {
      if (reservedStatics.has(key)) {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(current, key);

      if (descriptor && !Object.prototype.hasOwnProperty.call(target, key)) {
        try {
          Object.defineProperty(target, key, descriptor);
        } catch {
          // read-only wrapper property, keep it
        }
      }
    }
  }

  return target;
};

export default hoistStatics;
