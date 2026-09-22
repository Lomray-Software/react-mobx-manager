import type Manager from '../../manager';
import StateListener from './state-listener';

function connectDevExtension(storeManager: Manager): void {
  (window as Window & { __MOBX_STORE_MANAGER__?: Manager })['__MOBX_STORE_MANAGER__'] =
    new StateListener(storeManager).subscribe();
}

export default connectDevExtension;
