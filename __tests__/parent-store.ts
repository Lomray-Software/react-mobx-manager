import { describe, expect, it } from 'vitest';
import parentStore from '@src/parent-store';

describe('parentStore', () => {
  it('should wrap store constructor as parent store definition', () => {
    class ChatStore {}

    expect(parentStore(ChatStore as never)).to.deep.equal({
      store: ChatStore,
      isParent: true,
    });
  });
});
