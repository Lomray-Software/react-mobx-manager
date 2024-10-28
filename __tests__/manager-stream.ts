import { expect } from 'chai';
import sinon from 'sinon';
import { describe, it, afterEach } from 'vitest';
import type Manager from '@src/manager';
import ManagerStream from '@src/manager-stream';

describe('ManagerStream', () => {
  const sandbox = sinon.createSandbox();
  const manager = {
    getSuspenseRelations: sandbox.stub(),
    toJSON: sandbox.stub(),
  };

  afterEach(() => {
    sandbox.restore();
  });

  it('should return undefined if no suspense relations for given suspenseId', () => {
    const managerStream = new ManagerStream(manager as unknown as Manager);

    manager.getSuspenseRelations.returns(new Map());

    const result = managerStream.take('suspenseId');

    expect(result).to.be.undefined;
  });

  it('should return script chunk with suspense stores', () => {
    const storesIds = new Set(['store1', 'store2']);
    const managerStream = new ManagerStream(manager as unknown as Manager);

    manager.getSuspenseRelations.returns(new Map([['suspenseId', storesIds]]));
    manager.toJSON.returns({ store1: { data: 'value1' }, store2: { data: 'value2' } });

    const result = managerStream.take('suspenseId');

    expect(result).to.equal(
      '<script>!window.mbxM && (window.mbxM = []);</script><script>window.mbxM.push(JSON.parse("{\\"store1\\":{\\"data\\":\\"value1\\"},\\"store2\\":{\\"data\\":\\"value2\\"}}"));</script>',
    );
  });

  it('should only include preamble in the first call', () => {
    const storesIds = new Set(['store1', 'store2']);
    const managerStream = new ManagerStream(manager as unknown as Manager);

    manager.getSuspenseRelations.returns(new Map([['suspenseId', storesIds]]));
    manager.toJSON.returns({ store1: { data: 'value1' }, store2: { data: 'value2' } });

    managerStream.take('suspenseId'); // first call
    const result = managerStream.take('suspenseId'); // second call

    expect(result).to.equal(
      '<script>window.mbxM.push(JSON.parse("{\\"store1\\":{\\"data\\":\\"value1\\"},\\"store2\\":{\\"data\\":\\"value2\\"}}"));</script>',
    );
  });

  it('should properly escape JSON for usage as an object literal inside of a script tag', () => {
    const storesIds = new Set(['store1', 'store2']);
    const managerStream = new ManagerStream(manager as unknown as Manager);

    manager.getSuspenseRelations.returns(new Map([['suspenseId', storesIds]]));
    manager.toJSON.returns({
      store1: { data: 'value1' },
      store2: { data: '</script><script>console.log("Bad thing")</script>' },
    });

    managerStream.take('suspenseId'); // first call
    const result = managerStream.take('suspenseId'); // second call

    expect(result).to.equal(
      '<script>window.mbxM.push(JSON.parse("{\\"store1\\":{\\"data\\":\\"value1\\"},\\"store2\\":{\\"data\\":\\"\\u003c/script\\u003e\\u003cscript\\u003econsole.log(\\\\\\"Bad thing\\\\\\")\\u003c/script\\u003e\\"}}"));</script>',
    );
  });
});
