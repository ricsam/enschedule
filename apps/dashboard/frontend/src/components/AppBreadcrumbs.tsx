import { Breadcrumbs, Link as MuiLink, Typography } from "@mui/material";
import { RouteLink } from "./RouteLink";

export interface Breadcrumb {
  title: string;
  href: string;
}

export function AppBreadcrumbs({ breadcrumbs }: { breadcrumbs: Breadcrumb[] }) {
  return (
    <Breadcrumbs aria-label="breadcrumb">
      <MuiLink underline="hover" color="inherit" component={RouteLink} to="/">Home</MuiLink>
      {breadcrumbs.map((breadcrumb, index) => index === breadcrumbs.length - 1 ? (
        <Typography color="text.primary" key={breadcrumb.href}>{breadcrumb.title}</Typography>
      ) : (
        <MuiLink underline="hover" color="inherit" component={RouteLink} to={breadcrumb.href} key={breadcrumb.href}>{breadcrumb.title}</MuiLink>
      ))}
    </Breadcrumbs>
  );
}
