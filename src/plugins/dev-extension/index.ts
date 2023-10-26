import type Manager from '../../manager';
import StateListener from './state-listener';

function connectDevExtension(storeManager: Manager) {
  window['__MOBX_STORE_MANAGER__'] = new StateListener(storeManager).subscribe();
}

export default connectDevExtension;
