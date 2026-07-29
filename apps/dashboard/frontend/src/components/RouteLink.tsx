import React from "react";
import { Link } from "@richie-router/react";

export const RouteLink = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }>(
  function RouteLink({ to, ...props }, ref) {
    return <Link ref={ref} to={to as never} {...props} />;
  },
);
