/**
 * Mock for expo-asset
 */

export class Asset {
  localUri: string | null = null;
  uri: string = '';
  name: string = '';
  type: string = '';
  hash: string | null = null;
  width: number | null = null;
  height: number | null = null;

  constructor(metadata: { uri: string; name: string; type: string }) {
    this.uri = metadata.uri;
    this.name = metadata.name;
    this.type = metadata.type;
  }

  async downloadAsync(): Promise<void> {
    // Simulate download by setting localUri
    this.localUri = '/mock/bundled/database.db';
  }

  static fromModule(moduleId: number | { uri: string }): Asset {
    const asset = new Asset({
      uri: 'asset://database.db',
      name: 'database.db',
      type: 'db',
    });
    return asset;
  }

  static fromURI(uri: string): Asset {
    return new Asset({
      uri,
      name: 'unknown',
      type: 'unknown',
    });
  }

  static loadAsync(moduleId: number | number[]): Promise<Asset[]> {
    const ids = Array.isArray(moduleId) ? moduleId : [moduleId];
    return Promise.resolve(ids.map(() => Asset.fromModule(0)));
  }
}

export default { Asset };
