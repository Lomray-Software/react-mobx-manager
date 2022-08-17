import { withStores } from '@lomray/react-mobx-manager';
import stores from './index.stores';
import ExtraInfo from './index';

export default withStores(ExtraInfo, stores);
