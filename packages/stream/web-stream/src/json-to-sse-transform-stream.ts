/**
 * A TransformStream that converts arbitrary values to Server-Sent Events (SSE)
 * format.
 *
 * Each incoming chunk is JSON-serialized and wrapped in `data: ...\n\n`.
 * When the stream ends (flush), a final `data: [DONE]\n\n` sentinel is emitted
 * to signal completion to the SSE consumer.
 */
export class JsonToSseTransformStream extends TransformStream<unknown, string> {
  constructor() {
    super({
      transform(part, controller) {
        controller.enqueue(`data: ${JSON.stringify(part)}\n\n`);
      },
      flush(controller) {
        controller.enqueue('data: [DONE]\n\n');
      },
    });
  }
}
