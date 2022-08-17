import axios from 'axios';
import { action, makeObservable, observable } from 'mobx';
import type { IConstructorParams } from '@lomray/react-mobx-manager';
import UserPageStore from '../index';

/**
 * Store for Extra info component
 */
class ExtraInfoStore {
  /**
   * User phone
   */
  public phone: string | null = null;

  /**
   * @private
   */
  private readonly userPageStore: UserPageStore | undefined;

  /**
   * @constructor
   */
  constructor({ storeManager }: IConstructorParams) {
    this.userPageStore = storeManager.getStore(UserPageStore);

    makeObservable(this, {
      phone: observable,
      setPhone: action.bound,
    });
  }

  /**
   * Set user phone
   */
  public setPhone(phone: string): void {
    this.phone = phone;
  }

  /**
   * Get extra user info
   */
  public getExtraInfo = async (): Promise<void> => {
    const userId = this.userPageStore?.user?.id;

    if (!userId) {
      return;
    }

    const { data } = await axios.request({
      url: `https://randomuser.me/api/?seed=${userId}`,
    });

    const [{ phone }] = data.results;

    this.setPhone(phone as string);
  };
}

export default ExtraInfoStore;
