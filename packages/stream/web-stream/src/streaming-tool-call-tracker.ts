import {
  StreamingToolCallDelta,
  StreamingToolCallTrackerOptions,
  ToolCallStreamPart,
} from './types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;

function defaultGenerateId(): string {
  return `toolcall_${Date.now()}_${++_idCounter}`;
}

function isParsableJson(input: string): boolean {
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tracked state
// ---------------------------------------------------------------------------

interface TrackedToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
  hasFinished: boolean;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Tracks streaming tool call state across multiple deltas from an
 * OpenAI-compatible chat completion stream.
 *
 * Handles argument accumulation, emits `tool-input-start` / `tool-input-delta`
 * / `tool-input-end` and `tool-call` events, and finalizes unfinished tool
 * calls on flush.
 *
 * This is a provider-agnostic replacement for `@ai-sdk/provider-utils`'s
 * `StreamingToolCallTracker`. All provider-specific types have been replaced
 * with lightweight inline definitions (see `types/index.ts`).
 *
 * @example
 * ```ts
 * const tracker = new StreamingToolCallTracker();
 * // Inside a TransformStream:
 * tracker.processDelta(delta, (part) => controller.enqueue(part));
 * // In flush:
 * tracker.flush((part) => controller.enqueue(part));
 * ```
 */
export class StreamingToolCallTracker {
  private toolCalls: TrackedToolCall[] = [];
  private readonly _generateId: () => string;
  private readonly typeValidation: 'none' | 'if-present' | 'required';
  private readonly extractMetadata?: (
    delta: StreamingToolCallDelta
  ) => Record<string, unknown> | undefined;
  private readonly buildToolCallMetadata?: (
    metadata: Record<string, unknown> | undefined
  ) => Record<string, unknown> | undefined;

  constructor(options: StreamingToolCallTrackerOptions = {}) {
    this._generateId = options.generateId ?? defaultGenerateId;
    this.typeValidation = options.typeValidation ?? 'none';
    this.extractMetadata = options.extractMetadata;
    this.buildToolCallMetadata = options.buildToolCallMetadata;
  }

  /**
   * Process a tool call delta from a streaming response chunk.
   *
   * Emits `tool-input-start`, `tool-input-delta`, `tool-input-end`, and
   * `tool-call` events as appropriate.
   */
  processDelta(
    toolCallDelta: StreamingToolCallDelta,
    enqueue: (part: ToolCallStreamPart) => void
  ): void {
    const index = toolCallDelta.index ?? this.toolCalls.length;

    if (this.toolCalls[index] == null) {
      this._processNewToolCall(index, toolCallDelta, enqueue);
    } else {
      this._processExistingToolCall(index, toolCallDelta, enqueue);
    }
  }

  /**
   * Finalize any unfinished tool calls. Should be called during the stream's
   * flush handler to ensure all tool calls are properly completed.
   */
  flush(enqueue: (part: ToolCallStreamPart) => void): void {
    for (const toolCall of this.toolCalls) {
      if (!toolCall.hasFinished) {
        this._finishToolCall(toolCall, enqueue);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private _processNewToolCall(
    index: number,
    delta: StreamingToolCallDelta,
    enqueue: (part: ToolCallStreamPart) => void
  ): void {
    // Type validation
    if (this.typeValidation === 'required') {
      if (delta.type !== 'function') {
        throw new Error(
          `StreamingToolCallTracker: expected type 'function', got '${delta.type}'`
        );
      }
    } else if (this.typeValidation === 'if-present') {
      if (delta.type != null && delta.type !== 'function') {
        throw new Error(
          `StreamingToolCallTracker: expected type 'function', got '${delta.type}'`
        );
      }
    }

    if (delta.id == null) {
      throw new Error("StreamingToolCallTracker: expected 'id' to be a string");
    }

    if (delta.function?.name == null) {
      throw new Error(
        "StreamingToolCallTracker: expected 'function.name' to be a string"
      );
    }

    enqueue({
      type: 'tool-input-start',
      id: delta.id,
      toolName: delta.function.name,
    });

    const metadata = this.extractMetadata?.(delta);

    this.toolCalls[index] = {
      id: delta.id,
      type: 'function',
      function: {
        name: delta.function.name,
        arguments: delta.function.arguments ?? '',
      },
      hasFinished: false,
      metadata,
    };

    const toolCall = this.toolCalls[index];

    // Emit initial delta if arguments already present
    if (toolCall.function.arguments.length > 0) {
      enqueue({
        type: 'tool-input-delta',
        id: toolCall.id,
        delta: toolCall.function.arguments,
      });
    }

    // Check if tool call is complete (some providers send everything in one chunk)
    if (isParsableJson(toolCall.function.arguments)) {
      this._finishToolCall(toolCall, enqueue);
    }
  }

  private _processExistingToolCall(
    index: number,
    delta: StreamingToolCallDelta,
    enqueue: (part: ToolCallStreamPart) => void
  ): void {
    const toolCall = this.toolCalls[index];

    if (toolCall.hasFinished) {
      return;
    }

    if (delta.function?.arguments != null) {
      toolCall.function.arguments += delta.function.arguments;

      enqueue({
        type: 'tool-input-delta',
        id: toolCall.id,
        delta: delta.function.arguments,
      });
    }

    // Check if tool call is complete
    if (isParsableJson(toolCall.function.arguments)) {
      this._finishToolCall(toolCall, enqueue);
    }
  }

  private _finishToolCall(
    toolCall: TrackedToolCall,
    enqueue: (part: ToolCallStreamPart) => void
  ): void {
    enqueue({
      type: 'tool-input-end',
      id: toolCall.id,
    });

    const metadata = this.buildToolCallMetadata?.(toolCall.metadata);

    enqueue({
      type: 'tool-call',
      toolCallId: toolCall.id ?? this._generateId(),
      toolName: toolCall.function.name,
      input: toolCall.function.arguments,
      ...(metadata ? { metadata } : {}),
    });

    toolCall.hasFinished = true;
  }
}
