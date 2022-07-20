import type { FC, PropsWithChildren } from 'react';

/**
 * Custom Type for a React functional component with props AND CHILDREN
 */
export type FCC<TP extends object = any> = FC<PropsWithChildren<TP>>;
