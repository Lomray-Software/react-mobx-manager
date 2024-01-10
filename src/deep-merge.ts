/**
 * Helper function to check if a variable is an object
 */
const isObject = (obj: any) => obj !== null && typeof obj === 'object';

/**
 * Custom small deep merge function for restore store state
 */
const deepMerge = (target: any, source: any) => {
  if (!isObject(target) || !isObject(source)) {
    return;
  }

  for (const key in source) {
    if (target.hasOwnProperty(key)) {
      if (isObject(target[key]) && isObject(source[key])) {
        deepMerge(target[key] as Record<string, any>, source[key] as Record<string, any>);
      } else {
        target[key] = source[key];
      }
    } else {
      target[key] = source[key];
    }
  }
};

export default deepMerge;
