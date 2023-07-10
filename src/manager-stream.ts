import type Manager from './manager';

/**
 * Stream mobx manager stores
 */
class ManagerStream {
  /**
   * Already pushed preamble
   */
  protected isPreamblePushed = false;

  /**
   * Mobx store manager
   */
  protected manager: Manager;

  /**
   * @constructor
   */
  public constructor(manager: Manager) {
    this.manager = manager;
  }

  /**
   * Return script with suspense stores to push on stream
   */
  public take(suspenseId: string): string | void {
    const storesIds = this.manager.getSuspenseRelations().get(suspenseId);

    if (!storesIds?.size) {
      return;
    }

    const storesState = JSON.stringify(this.manager.toJSON([...storesIds]));
    const chunk = this.isPreamblePushed
      ? ''
      : '<script>!window.mbxM && (window.mbxM = []);</script>';

    if (!this.isPreamblePushed) {
      this.isPreamblePushed = true;
    }

    return `${chunk}<script>window.mbxM.push(${storesState});</script>`;
  }
}

export default ManagerStream;
