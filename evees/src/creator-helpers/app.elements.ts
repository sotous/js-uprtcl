import { Secured } from 'src/cas/utils/cid-hash';
import { Evees } from 'src/evees/evees.service';
import { RemoteEvees } from 'src/evees/interfaces/remote.evees';
import { Perspective } from '../evees/interfaces/types';

/** a services that builds tree of perspectives that is apended to
 * the home space of the logged user. This services creates this
 * tree of perspectives and offers methods to navigate it */
export interface AppElement {
  path: string;
  getInitData?: (children?: AppElement[]) => any;
  perspective?: Secured<Perspective>;
  children?: AppElement[];
}
/** the relative (to home) path of each app element */
export class AppElements {
  readonly remote: RemoteEvees;

  constructor(protected evees: Evees, protected home: AppElement, remoteId?: string) {
    this.remote = this.evees.getRemote(remoteId);
  }

  async check(): Promise<void> {
    if (!this.remote.getHome) throw new Error(`Remote don't have a home default`);

    /** home space perspective is deterministic */
    this.home.perspective = await this.remote.getHome();
    await this.checkOrCreatePerspective(this.home.perspective);

    /** all other objects are obtained relative to the home perspective */
    await this.getOrCreateElementData(this.home);
  }

  /** Returns the appElement from the path */
  getElement(path: string): AppElement {
    let thisElement = this.home;

    let childElements = thisElement.children;
    const pathSections = path.split('/');

    while (pathSections.length > 0) {
      if (!childElements)
        throw new Error(`AppElement ${JSON.stringify(thisElement)} don't have children`);
      const thisPath = pathSections.pop();
      const childFound = childElements.find((e) => {
        const path = e.path.split('/')[1];
        return path === thisPath;
      });
      if (!childFound) {
        throw new Error('Element not found at path');
      }
      thisElement = childFound;
      childElements = thisElement.children;
    }

    return thisElement;
  }

  async get(path): Promise<Secured<Perspective>> {
    const element = await this.getElement(path);

    if (!element) throw new Error(`element not found at path ${path}`);
    if (!element.perspective) throw new Error(`perspective not found at path ${path}`);

    return element.perspective;
  }

  async createSnapElementRec(element: AppElement) {
    element.perspective = await this.remote.snapPerspective({});
    if (element.children) {
      await Promise.all(element.children.map((child) => this.createSnapElementRec(child)));
    }
  }

  async initPerspectiveDataRec(element: AppElement) {
    if (!element.getInitData)
      throw new Error(`getInitData not found for element ${JSON.stringify(element)}`);

    const data = element.getInitData(element.children);

    if (!element.perspective)
      throw new Error(`perspective not found for element ${JSON.stringify(element)}`);

    this.evees.updatePerspectiveData(element.perspective.id, data);

    if (this.home.children) {
      await Promise.all(this.home.children.map((child) => this.initPerspectiveDataRec(child)));
    }
  }

  // make sure a perspective exist, or creates it
  async checkOrCreatePerspective(perspective: Secured<Perspective>) {
    const { details } = await this.evees.client.getPerspective(perspective.id);

    /** canUpdate is used as the flag to detect if the home space exists */
    if (!details.canUpdate) {
      /** create the home perspective as it did not existed */
      const id = await this.evees.createEvee({
        partialPerspective: perspective.object.payload,
      });
    }
  }

  async getOrCreateElementData(element: AppElement) {
    if (!element.perspective)
      throw new Error(`perspective not found for element ${JSON.stringify(element)}`);

    const data = await this.evees.getPerspectiveData(element.perspective.id);
    if (!data) {
      await this.initTree(element);
    }
  }

  async initTree(element: AppElement) {
    // Create perspectives from top to bottom
    if (element.children) {
      // snap all perspectives
      await Promise.all(element.children.map((child) => this.createSnapElementRec(child)));

      // set perspective data
      await this.initPerspectiveDataRec(this.home);
    }

    await this.evees.client.flush();
  }
}
