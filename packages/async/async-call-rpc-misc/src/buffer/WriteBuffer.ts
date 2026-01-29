export default class WriteBuffer {
  encode(data: any) {
    return JSON.stringify(data);
  }
}
