import type { FC, SuspenseProps } from 'react';
import React, { Suspense, useId, Children } from 'react';
import { StoreManagerSuspenseProvider } from './context';

/**
 * Wrapper around react suspense
 * Create unique id for each suspense (used for create/stream stores state)
 * @constructor
 */
const MobxSuspense: FC<SuspenseProps> = ({ children, fallback, ...props }) => {
  const id = useId();
  const childrenWithContext = Children.map(children, (child, index) => (
    <StoreManagerSuspenseProvider id={`${id}${index}`}>{child}</StoreManagerSuspenseProvider>
  ));
  const fallbackWithId = (
    <>
      <script data-context-id={id} data-count={childrenWithContext?.length ?? 0} />
      {fallback}
    </>
  );

  return <Suspense {...props} children={childrenWithContext} fallback={fallbackWithId} />;
};

export default MobxSuspense;
