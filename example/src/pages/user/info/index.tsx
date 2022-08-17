import type { FC } from 'react';
import React from 'react';
import type { IUser } from '../../../stores/pages/user';
import ExtraInfo from './extra-info/index.wrapper';

interface IInfo {
  user: IUser;
}

const Info: FC<IInfo> = ({ user: { id, name, email, avatar } }) => (
  <tr>
    <td>{id}</td>
    <td>{name}</td>
    <td>{email}</td>
    <td>
      <img src={avatar} alt="user" />
    </td>
    <td>
      <ExtraInfo />
    </td>
  </tr>
);

export default Info;
