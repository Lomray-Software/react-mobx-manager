import { isObservableArray } from 'mobx';

/**
 * Helper function to check if a variable is an object
 */
const isObject = (obj: unknown): obj is Record<string, unknown> =>
  obj !== null && typeof obj === 'object';

/**
 * Custom small deep merge function for restore store state
 */
const deepMerge = (target: unknown, source: unknown): boolean => {
  if (!isObject(target) || !isObject(source)) {
    return false;
  }

  if (Array.isArray(target) && Array.isArray(source)) {
    // Spreading the source into splice() overflows the call stack for very large arrays.
    const items = source as unknown[];

    if (isObservableArray(target)) {
      target.replace(items);
    } else {
      target.length = items.length;

      for (let index = 0; index < items.length; index++) {
        target[index] = items[index];
      }
    }

    return true;
  }

  for (const key in source) {
    if (target.hasOwnProperty(key)) {
      if (
        isObject(target[key]) &&
        isObject(source[key]) &&
        Array.isArray(target[key]) === Array.isArray(source[key])
      ) {
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    } else {
      target[key] = source[key];
    }
  }

  return true;
};

export default deepMerge;
