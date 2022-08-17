import type { StoresType } from '@lomray/react-mobx-manager';
import ExtraInfoStore from '../../../../stores/pages/user/extra-info';

const stores = {
  extraInfoStore: ExtraInfoStore,
};

export type StoreProps = StoresType<typeof stores>;

export default stores;
