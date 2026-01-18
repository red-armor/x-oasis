import WriteBaseBuffer from './WriteBaseBuffer';

export default class WriteBuffer extends WriteBaseBuffer {
  encode(data: any) {
    return JSON.stringify(data);
  }
}
