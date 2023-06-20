import type Manager from '../manager';

/**
 * Stream mobx manager stores
 * NOTE: use with renderToPipeableStream
 */
class StreamStores {
  /**
   * Obtained suspensions from application shell
   * @protected
   */
  protected suspendIds: Map<string, { contextId: string; count: number }>;

  /**
   * Mobx store manager instance
   * @protected
   */
  protected readonly manager: Manager;

  /**
   * @constructor
   * @protected
   */
  protected constructor(manager: Manager) {
    this.manager = manager;
  }

  /**
   * Create stream stores service
   */
  public static create(manager: Manager, isAttach = true): StreamStores {
    const streamStores = new StreamStores(manager);

    if (isAttach) {
      manager.streamStores = streamStores;
    }

    return streamStores;
  }

  /**
   * Listen react stream and return suspense stores state to client
   */
  public getStreamState(html: string): string | undefined {
    this.obtainSuspensions(html);

    return this.obtainCompleteSuspense(html);
  }

  /**
   * Parse suspensions and related stores context id from application shell
   * @protected
   */
  protected obtainSuspensions(html: string): void {
    // If app shell streams only once, run parser only once
    if (this.suspendIds) {
      return;
    }

    // try to find suspensions ids with store context ids (react doesn't provide any api to obtain suspend id)
    const matchedTemplates = [
      ...html.matchAll(
        /<template id="(?<templateId>[^"]+)".+?<script data-context-id="(?<contextId>[^"]+)".+?data-count="(?<count>[^"]+)">/g,
      ),
    ];

    if (!matchedTemplates.length) {
      return;
    }

    this.suspendIds = new Map();

    matchedTemplates.forEach(({ groups }) => {
      const { templateId, contextId, count } = groups ?? {};

      if (!templateId) {
        return;
      }

      this.suspendIds.set(templateId, { contextId, count: Number(count) });
    });
  }

  /**
   * Replace suspend id
   * @protected
   */
  protected replaceSuspendIds(formId: string, toId: string): string | undefined {
    if (!formId || !this.suspendIds.has(formId)) {
      return;
    }

    this.suspendIds.set(toId, this.suspendIds.get(formId)!);
    this.suspendIds.delete(formId);

    return toId;
  }

  /**
   * Parse complete suspense chunk
   * @protected
   */
  protected obtainCompleteSuspense(html: string): string | undefined {
    // each suspense begin from
    if (!html.startsWith('<div hidden id=')) {
      return;
    }

    // detect replaces suspense ids
    const { from, to } = html.match(/\$RC\("(?<from>[^"]+)","(?<to>[^"]+)"\)/)?.groups ?? {};
    const suspendId = this.replaceSuspendIds(from, to);

    if (!suspendId) {
      return;
    }

    const { contextId, count } = this.suspendIds.get(suspendId) ?? {};

    if (!contextId || !count) {
      return;
    }

    const storesRelations = this.manager.getStoresRelations();
    const ctxId = this.manager.createContextId(contextId);
    const storesIds: string[] = [...Array(count)].reduce((res: string[], _, i) => {
      const ctxIdIdx = `${ctxId}${i}`; // @see MobxSuspense id generation

      if (storesRelations.has(ctxIdIdx)) {
        res.push(...storesRelations.get(ctxIdIdx)!.ids);
      }

      return res;
    }, []);

    if (!storesIds.length) {
      return;
    }

    const storesState = JSON.stringify(this.manager.toJSON(storesIds));

    return `<script>window.mobxManager.pushInit(${storesState});</script>`;
  }
}

export default StreamStores;
