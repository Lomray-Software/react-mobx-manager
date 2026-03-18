import type Manager from '@src/manager';

export interface IHmrSnapshot {
  stores: Record<string, Record<string, any>>;
}

export interface IHmrOptions {
  manager: Manager;
  appId?: string;
}

export interface IHmrRuntime {
  data?: Record<string, unknown>;
  accept: (callback?: () => void) => void;
  dispose: (callback: (data: Record<string, unknown>) => void) => void;
}
