import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { afterAll, afterEach, beforeEach } from 'vitest';

chai.use(sinonChai);

const consoleOriginal = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

const noop = () => undefined;

beforeEach(() => {
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
});

afterEach(() => {
  console.log = consoleOriginal.log;
  console.info = consoleOriginal.info;
  console.warn = consoleOriginal.warn;
  console.error = consoleOriginal.error;
  console.debug = consoleOriginal.debug;
});

afterAll(() => {
  sinon.restore();
});
