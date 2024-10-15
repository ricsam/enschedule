import { useRevalidator } from "@remix-run/react";
import React from "react";

export const useLiveData = (deactivate?: boolean) => {
  const revalidator = useRevalidator();

  React.useEffect(() => {
    if (deactivate) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const i = window.setInterval(() => {
      if (revalidator.state === "idle") {
        revalidator.revalidate();
      }
    }, 5000);

    return () => {
      window.clearInterval(i);
    };
  }, [revalidator, deactivate]);
};
