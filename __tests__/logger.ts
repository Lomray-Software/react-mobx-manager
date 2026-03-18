import sinon from 'sinon';
import { afterEach, describe, it } from 'vitest';
import Logger from '@src/logger';

describe('Logger', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should skip logging when level is too low', () => {
    const log = sandbox.stub(console, 'log');
    const logger = new Logger({ level: 1, manager: {} as never });

    logger.log('message', { level: 4 });

    sinon.assert.notCalled(log);
  });

  it('should route log messages to mapped console methods', () => {
    const error = sandbox.stub(console, 'error');
    const warn = sandbox.stub(console, 'warn');
    const info = sandbox.stub(console, 'info');
    const log = sandbox.stub(console, 'log');
    const logger = new Logger({ level: 4, manager: {} as never });

    logger.err('error-message', new Error('boom'));
    logger.warn('warn-message', { foo: 'bar' });
    logger.info('info-message');
    logger.log('plain-message', { level: 4 });

    sinon.assert.calledOnce(error);
    sinon.assert.calledOnce(warn);
    sinon.assert.calledOnce(info);
    sinon.assert.calledOnce(log);
  });

  it('should append relations snapshot in debug mode when requested', () => {
    const log = sandbox.stub(console, 'log');
    const logger = new Logger({
      level: 4,
      manager: {
        getStoresRelations: () => new Map([['ctx', { ids: new Set(['store']), parentId: 'root' }]]),
      } as never,
    });

    logger.debug('snapshot', { foo: 'bar' }, true);

    sinon.assert.calledWith(
      log,
      'DEBUG: snapshot',
      sinon.match({
        foo: 'bar',
        additional: {
          relations: {
            ctx: {
              ids: new Set(['store']),
              parentId: 'root',
            },
          },
        },
      }),
    );
  });
});
