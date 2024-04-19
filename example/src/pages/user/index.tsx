import { type StoresType, withStores } from "@lomray/react-mobx-manager";
import type { FC } from 'react';
import React, { useEffect } from 'react';
import Info from './components/info';
import UserPageStore from './stores/main';

interface IUser {
  userId: string;
}

const stores = {
  userPage: UserPageStore,
};

type Props = IUser & StoresType<typeof stores>;

const User: FC<Props> = ({ userId, userPage: { user, error, isLoading, getUser } }) => {
  useEffect(() => {
    void getUser(userId);
  }, [getUser, userId]);

  return (
    <div style={{ border: '1px solid' }}>
      <table>
        <thead>
          <tr>
            <th>Id</th>
            <th>Name</th>
            <th>Email</th>
            <th>Avatar</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>
          {user && <Info user={user} />}
          {isLoading && (
            <tr>
              <td colSpan={4}>Loading...</td>
            </tr>
          )}
          {error && (
            <tr>
              <td colSpan={4}>{error}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const UserWrapper = withStores(User, stores);

export default UserWrapper;
