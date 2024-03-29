import type { IConstructorParams } from '@lomray/react-mobx-manager';
import axios from 'axios';
import { action, makeObservable, observable } from 'mobx';
import UserPageStore from '../../../../../stores/main';

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
  constructor({ getStore }: IConstructorParams) {
    this.userPageStore = getStore(UserPageStore);

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
