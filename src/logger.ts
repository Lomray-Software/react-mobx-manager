import type Manager from './manager';

export interface ILoggerOpts {
  /**
   * 0 - disabled
   * 1 - error
   * 2 - warning
   * 3 - info
   * 4 - debug
   */
  level: number;
  manager: Manager;
}

type LogMethod = 'log' | 'error' | 'warn' | 'info';

export interface ILoggerLogOpts {
  level: ILoggerOpts['level'];
  err?: Error;
  payload?: Record<string, any>;
}

class Logger {
  /**
   * Logger options
   */
  protected options: ILoggerOpts;

  /**
   * @constructor
   */
  constructor(opts: ILoggerOpts) {
    this.options = opts;
  }

  /**
   * Log message
   */
  public log(msg: string, { level, err, payload }: ILoggerLogOpts): void {
    if (this.options.level < level) {
      return;
    }

    let type: LogMethod = 'log';

    switch (level) {
      case 1:
        type = 'error';
        break;

      case 2:
        type = 'warn';
        break;

      case 3:
        type = 'info';
        break;
    }

    console[type](...[msg, err, payload].filter(Boolean));
  }

  /**
   * Log error message
   */
  public err(msg: string, err?: unknown, payload?: Record<string, any>): void {
    this.log(msg, { err: err as Error, level: 1, payload });
  }

  /**
   * Log warning message
   */
  public warn(msg: string, payload?: Record<string, any>): void {
    this.log(msg, { level: 2, payload });
  }

  /**
   * Log info message
   */
  public info(msg: string, payload?: Record<string, any>): void {
    this.log(msg, { level: 3, payload });
  }

  /**
   * Log debug message
   */
  public debug(msg: string, payload: Record<string, any> = {}, hasSnapshot = false): void {
    if (hasSnapshot) {
      payload.additional = {
        relations: Object.fromEntries(this.options.manager.getStoresRelations().entries()),
      };
    }

    this.log(`DEBUG: ${msg}`, { level: 4, payload: { ...payload } });
  }
}

export default Logger;
