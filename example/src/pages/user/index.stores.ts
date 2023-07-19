import type { StoresType } from '@lomray/react-mobx-manager';
import UserPageStore from './stores/main';

const stores = {
  userPage: UserPageStore,
};

export type StoreProps = StoresType<typeof stores>;

export default stores;
