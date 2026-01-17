/* eslint-disable no-param-reassign */

export interface ErrorResponseDetail<Error = unknown> {
  readonly code: number;
  readonly message: string;
  readonly data?: Error;
}

export type ID = string | number | null | undefined;

export interface ErrorResponse<Error = unknown> {
  readonly jsonrpc: '2.0';
  readonly id?: ID;
  readonly error: ErrorResponseDetail<Error>;
}

export const makeErrorResponse = <T>(
  id: ID,
  code: number,
  message: string,
  data?: T
): ErrorResponse<T> => {
  if (id === undefined) id = null;
  code = Math.floor(code);
  if (Number.isNaN(code)) code = -1;
  const x: ErrorResponse<T> = {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
  return x;
};
