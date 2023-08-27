import Breadcrumbs from '@mui/material/Breadcrumbs';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link, useMatches } from '@remix-run/react';
import type { Breadcrumb } from '~/types';

export const AppBreadcrumbs = ({ breadcrumbs }: { breadcrumbs: Breadcrumb[] }) => {
  return (
    <Breadcrumbs aria-label="breadcrumb">
      <MuiLink underline="hover" color="inherit" to="/" component={Link}>
        Home
      </MuiLink>
      {breadcrumbs.map(({ href, title }, index) => {
        const last = index === breadcrumbs.length - 1;
        if (last) {
          return (
            <Typography color="text.primary" key={index}>
              {title}
            </Typography>
          );
        }
        return (
          <MuiLink underline="hover" color="inherit" to={href} key={index} component={Link}>
            {title}
          </MuiLink>
        );
      })}
    </Breadcrumbs>
  );
};
