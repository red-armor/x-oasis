export enum DataType {
  Undefined = 0,
  String = 1,
  Buffer = 2,
  VSBuffer = 3,
  Array = 4,
  Object = 5,
  Int = 6,
}

export default class ReadBuffer {
  decode(data: any) {
    return JSON.parse(data);
  }
}

// export class BufferReader implements IReader {

// 	private pos = 0;

// 	constructor(private buffer: VSBuffer) { }

// 	read(bytes: number): VSBuffer {
// 		const result = this.buffer.slice(this.pos, this.pos + bytes);
// 		this.pos += result.byteLength;
// 		return result;
// 	}
// }

// export class BufferWriter implements IWriter {

// 	private buffers: VSBuffer[] = [];

// 	get buffer(): VSBuffer {
// 		return VSBuffer.concat(this.buffers);
// 	}

// 	write(buffer: VSBuffer): void {
// 		this.buffers.push(buffer);
// 	}
// }
