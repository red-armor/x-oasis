import WriteBaseBuffer from './WriteBaseBuffer';

/**
 * JSON-based write buffer implementation
 * Default serializer using JSON.stringify
 */
export default class WriteBuffer extends WriteBaseBuffer {
  encode(data: any): string {
    return JSON.stringify(data);
  }

  getFormat(): string {
    return 'json';
  }
}
