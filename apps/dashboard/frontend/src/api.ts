import { createClient } from "@richie-rpc/client";
import { createTanstackQueryApi } from "@richie-rpc/react-query";
import { enscheduleContract } from "@enschedule/types/contract";

export const client = createClient(enscheduleContract, {
  baseUrl: "/api",
  onResponse(response) {
    if (response.status === 401 && window.location.pathname !== "/login") {
      const redirect = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
  },
});

export const api = createTanstackQueryApi(client, enscheduleContract);
