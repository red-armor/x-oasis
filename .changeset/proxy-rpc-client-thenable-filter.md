---
'@x-oasis/async-call-rpc': minor
---

fix(ProxyRPCClient): filter thenable / symbol probes in `createProxy()`

The proxy returned by `ProxyRPCClient.createProxy()` previously synthesized
a method for **any** property access, including:

- `then` / `catch` / `finally` — read by the JS engine whenever the proxy
  flowed through `await` (legitimate when a factory returns the proxy
  through an async function);
- `Symbol.toPrimitive` / `Symbol.iterator` / `Symbol.asyncIterator` /
  `Symbol.toStringTag` — read during string coercion, iteration, and
  `console.log` inspection;
- `constructor` / `toJSON` — read by various inspector / serialization
  paths.

Each such probe was dispatched as a real RPC request. The remote service
of course had no `then` handler, replied with `-32601 Method not found`,
and the rejection surfaced at the original `await` site as a confusing
`UnhandledPromiseRejection` — making the proxy effectively impossible to
return from any `async` factory.

The trap now returns `undefined` for symbols and for the small fixed set
of well-known thenable / inspector property names listed above; only
genuine method calls are forwarded to `channel.makeRequest()`.

Discovered while wiring the pagelet ↔ pagelet (P↔P) demo in
`examples/orchestrator/multi-page-router-di`, where
`await pageletWorker.connectToPeer(...)` triggered the thenable probe
path on every call.
