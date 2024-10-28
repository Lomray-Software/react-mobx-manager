import type Manager from './manager';

const ESCAPE_LOOKUP: { [match: string]: string } = {
  '&': '\\u0026',
  '>': '\\u003e',
  '<': '\\u003c',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};
const ESCAPE_REGEX = /[&><\u2028\u2029]/g;

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
   * This utility is based on https://github.com/zertosh/htmlescape
   * License: https://github.com/zertosh/htmlescape/blob/0527ca7156a524d256101bb310a9f970f63078ad/LICENSE
   */
  private htmlEscape(str: string): string {
    return str.replace(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match]);
  }

  /**
   * Return script with suspense stores to push on stream
   */
  public take(suspenseId: string): string | void {
    const storesIds = this.manager.getSuspenseRelations().get(suspenseId);

    if (!storesIds?.size) {
      return;
    }

    const storesState = this.htmlEscape(
      JSON.stringify(JSON.stringify(this.manager.toJSON([...storesIds]))),
    );
    const chunk = this.isPreamblePushed
      ? ''
      : '<script>!window.mbxM && (window.mbxM = []);</script>';

    if (!this.isPreamblePushed) {
      this.isPreamblePushed = true;
    }

    return `${chunk}<script>window.mbxM.push(JSON.parse(${storesState}));</script>`;
  }
}

export default ManagerStream;
