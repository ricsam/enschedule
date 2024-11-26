import { useLocation, useRevalidator } from "@remix-run/react";
import React from "react";

export const useLiveData = (deactivate?: boolean) => {
  const revalidator = useRevalidator();

  const [windowState, setWindowState] = React.useState<"navigating" | "idle">(
    "navigating"
  );

  const pathname = useLocation().pathname;

  React.useEffect(() => {
    if (windowState === "idle") {
      setWindowState("navigating");
    }
    const timeout = setTimeout(() => {
      setWindowState("idle");
    }, 5000);
    return () => {
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  React.useEffect(() => {
    if (windowState === "navigating") {
      return;
    }
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
  }, [revalidator, deactivate, windowState]);
};
