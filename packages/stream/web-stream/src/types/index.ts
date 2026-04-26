// ---------------------------------------------------------------------------
// SSE (Server-Sent Events) types
// ---------------------------------------------------------------------------

/**
 * A parsed SSE message, corresponding to a single `data:` / `event:` block.
 */
export interface SseMessage {
  /** The `event:` field value, or empty string if omitted. */
  event: string;
  /** The `data:` field value (concatenated if multi-line). */
  data: string;
  /** The `id:` field value, if present. */
  id?: string;
  /** The `retry:` field value in milliseconds, if present. */
  retry?: number;
}

// ---------------------------------------------------------------------------
// JSON parse result (subset of @ai-sdk/provider-utils ParseResult)
// ---------------------------------------------------------------------------

/**
 * Result of a safe JSON parse operation.
 */
export type JsonParseResult<T> =
  | { success: true; value: T; rawValue: unknown }
  | { success: false; error: Error; rawValue: unknown };

// ---------------------------------------------------------------------------
// Bedrock EventStream types
// ---------------------------------------------------------------------------

/**
 * A decoded AWS EventStream frame.
 */
export interface BedrockDecodedEvent {
  /** The `:message-type` header value (e.g. "event", "exception"). */
  messageType: string;
  /** The `:event-type` header value (e.g. "chunk"). */
  eventType: string;
  /** The decoded body payload as a UTF-8 string. */
  data: string;
}

// ---------------------------------------------------------------------------
// Streaming tool call types (provider-agnostic replacements for @ai-sdk/provider)
// ---------------------------------------------------------------------------

/**
 * Minimal delta describing a single streaming tool call chunk.
 * Compatible with OpenAI, Anthropic, and other chat-completion APIs.
 */
export interface StreamingToolCallDelta {
  index?: number | null;
  id?: string | null;
  type?: string | null;
  function?: {
    name?: string | null;
    arguments?: string | null;
  } | null;
}

/**
 * Events emitted by `StreamingToolCallTracker` during streaming.
 */
export type ToolCallStreamPart =
  | { type: 'tool-input-start'; id: string; toolName: string }
  | { type: 'tool-input-delta'; id: string; delta: string }
  | { type: 'tool-input-end'; id: string }
  | {
      type: 'tool-call';
      toolCallId: string;
      toolName: string;
      input: string;
      metadata?: Record<string, unknown>;
    };

/**
 * Options for `StreamingToolCallTracker`.
 */
export interface StreamingToolCallTrackerOptions {
  /**
   * ID generator for tool call IDs when the delta lacks one.
   * Defaults to a simple counter-based generator.
   */
  generateId?: () => string;

  /**
   * How to validate the `type` field on new tool call deltas.
   * - `'none'`: no validation (default)
   * - `'if-present'`: throw if type is present and not `'function'`
   * - `'required'`: throw if type is not exactly `'function'`
   */
  typeValidation?: 'none' | 'if-present' | 'required';

  /**
   * Extract provider-specific metadata from a tool call delta.
   * Called once when a new tool call is detected.
   */
  extractMetadata?: (
    delta: StreamingToolCallDelta
  ) => Record<string, unknown> | undefined;

  /**
   * Build the final `metadata` object for the `tool-call` event.
   * Receives metadata previously extracted via `extractMetadata`.
   */
  buildToolCallMetadata?: (
    metadata: Record<string, unknown> | undefined
  ) => Record<string, unknown> | undefined;
}
