import type { StoresType } from '@lomray/react-mobx-manager';
import UserPageStore from '../../stores/pages/user';

const stores = {
  userPage: UserPageStore,
};

export type StoreProps = StoresType<typeof stores>;

export default stores;
