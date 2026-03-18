import { expect } from 'chai';
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

    expect(log).to.have.callCount(0);
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

    expect(error).to.have.been.calledOnce;
    expect(warn).to.have.been.calledOnce;
    expect(info).to.have.been.calledOnce;
    expect(log).to.have.been.calledOnce;
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

    expect(log).to.have.been.calledWith(
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
