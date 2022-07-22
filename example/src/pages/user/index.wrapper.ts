import { withStores } from '@lomray/react-mobx-manager';
import stores from './index.stores';
import User from './index';

export default withStores(User, stores);
