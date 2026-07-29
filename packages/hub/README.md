# @enschedule/hub

Bun-native composition for embedding an Enschedule worker, Richie RPC API, and the Vite dashboard fetch handler.

```ts
import { enschedule } from "@enschedule/hub";

const hub = await enschedule({
  api: true,
  dashboard: true,
  worker: { type: "inline" },
  handlers: [],
});

hub.serve({ port: 3000 });
```

`hub.fetch` can also be mounted in an existing `Bun.serve` composition. Express and Remix adapters are no longer part of the package.
