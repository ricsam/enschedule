import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@richie-router/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline } from "@mui/material";
import { router } from "./router";
import "./global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2_000,
      retry: 1,
    },
  },
});

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <CssBaseline />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
