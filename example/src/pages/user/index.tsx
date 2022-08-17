import type { FC } from 'react';
import React, { useEffect } from 'react';
import type { StoreProps } from './index.stores';
import Info from './info';

interface IUser {
  userId: string;
}

type Props = IUser & StoreProps;

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

export default User;
