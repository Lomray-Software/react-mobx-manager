import type Manager from '@src/manager';
import ManagerHmr from './service';
import type { IHmrOptions, IHmrRuntime } from './types';

type TConnectOptions = Omit<IHmrOptions, 'manager'>;

const connectHmrRuntime = (
  manager: Manager,
  runtime?: IHmrRuntime,
  options: TConnectOptions = {},
): ManagerHmr => {
  const bridge = new ManagerHmr({ manager, ...options });

  if (runtime) {
    bridge.bind(runtime);
  } else {
    bridge.restore();
  }

  return bridge;
};

export const connectViteHmr = (
  manager: Manager,
  runtime?: IHmrRuntime,
  options: TConnectOptions = {},
): ManagerHmr => connectHmrRuntime(manager, runtime, options);

export const connectWebpackHmr = (
  manager: Manager,
  runtime?: IHmrRuntime,
  options: TConnectOptions = {},
): ManagerHmr => connectHmrRuntime(manager, runtime, options);

export const connectReactNativeHmr = (
  manager: Manager,
  runtime?: IHmrRuntime,
  options: TConnectOptions = {},
): ManagerHmr => connectHmrRuntime(manager, runtime, options);

export default connectHmrRuntime;
