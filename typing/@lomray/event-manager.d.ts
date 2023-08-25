import type { IMobxManagerEvents } from '../../src';

declare module '@lomray/event-manager' {
  export interface IEventsPayload extends IMobxManagerEvents {}
}
