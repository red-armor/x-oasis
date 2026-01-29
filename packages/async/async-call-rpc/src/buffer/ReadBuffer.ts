import ReadBaseBuffer from './ReadBaseBuffer';

export enum DataType {
  Undefined = 0,
  String = 1,
  Buffer = 2,
  VSBuffer = 3,
  Array = 4,
  Object = 5,
  Int = 6,
}

/**
 * JSON-based read buffer implementation
 * Default deserializer using JSON.parse
 */
export default class ReadBuffer extends ReadBaseBuffer {
  decode(data: string | ArrayBuffer | Uint8Array): any {
    // Handle binary input (convert to string first)
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      const decoder = new TextDecoder();
      const text = decoder.decode(data);
      return JSON.parse(text);
    }
    // Handle string input
    return JSON.parse(data as string);
  }

  getFormat(): string {
    return 'json';
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
