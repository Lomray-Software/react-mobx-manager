import axios from 'axios';
import { action, makeObservable, observable } from 'mobx';

export interface IUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

/**
 * User page store
 */
class UserPageStore {
  /**
   * User
   */
  public user: IUser | null = null;

  /**
   * API request error
   */
  public error: string | null = null;

  /**
   * Indicating request executing
   */
  public isLoading = false;

  /**
   * @constructor
   */
  constructor() {
    makeObservable(this, {
      user: observable,
      error: observable,
      isLoading: observable,
      setUser: action.bound,
      setError: action.bound,
      setIsLoading: action.bound,
    });
  }

  /**
   * Set users
   */
  public setUser(user: IUser): void {
    this.user = user;
  }

  /**
   * Set error
   */
  public setError(message: string | null): void {
    this.error = message;
  }

  /**
   * Set loading state
   */
  public setIsLoading(state: boolean): void {
    this.isLoading = state;
  }

  /**
   * Get user
   */
  public getUser = async (id: string): Promise<void> => {
    this.setIsLoading(true);
    this.setError(null);

    try {
      const { data } = await axios.request({
        url: `https://randomuser.me/api/?seed=${id}`,
      });

      const [{ name, email, picture }] = data.results;

      const user: IUser = {
        id,
        name: Object.values(name as Record<string, string>).join(' '),
        email,
        avatar: picture.medium,
      };

      this.setUser(user);
    } catch (e) {
      this.setError(e.message as string);
    }

    this.setIsLoading(false);
  };
}

export default UserPageStore;
