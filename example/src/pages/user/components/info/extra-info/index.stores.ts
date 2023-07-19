import type { StoresType } from '@lomray/react-mobx-manager';
import ExtraInfoStore from './stores/main';

const stores = {
  extraInfoStore: ExtraInfoStore,
};

export type StoreProps = StoresType<typeof stores>;

export default stores;
