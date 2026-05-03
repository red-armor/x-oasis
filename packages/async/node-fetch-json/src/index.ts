import fetch, { Response as NodeFetchResponse } from 'node-fetch';

type AnyJson = Record<string, any>;

export async function post(
  url: string,
  body: AnyJson,
  init: AnyJson = {}
): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    body: JSON.stringify(body),
    ...init,
  } as any);
  return decorate(res as unknown as NodeFetchResponse);
}

export async function get(url: string, init: AnyJson = {}): Promise<any> {
  const res = await fetch(url, { method: 'GET', ...init } as any);
  return decorate(res as unknown as NodeFetchResponse);
}

async function decorate(res: NodeFetchResponse): Promise<any> {
  let data: any;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { text };
  }
  if (data === null || typeof data !== 'object') data = { value: data };
  data.raw = res;
  return data;
}
