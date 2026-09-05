/**
 * Helper function to check if a variable is an object
 */
const isObject = (obj: any) => obj !== null && typeof obj === 'object';

/**
 * Custom small deep merge function for restore store state
 */
const deepMerge = (target: any, source: any): boolean => {
  if (!isObject(target) || !isObject(source)) {
    return false;
  }

  if (Array.isArray(target) && Array.isArray(source)) {
    target.splice(0, target.length, ...(source as unknown[]));

    return true;
  }

  for (const key in source) {
    if (target.hasOwnProperty(key)) {
      if (
        isObject(target[key]) &&
        isObject(source[key]) &&
        Array.isArray(target[key]) === Array.isArray(source[key])
      ) {
        deepMerge(target[key] as Record<string, any>, source[key] as Record<string, any>);
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
