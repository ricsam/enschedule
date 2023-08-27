import type { Breadcrumb } from '~/types';

export function extendBreadcrumbs(breadcrumbs: Breadcrumb[], newBreadcrumbs: Breadcrumb[]) {
  const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];

  return [
    ...breadcrumbs,
    ...newBreadcrumbs.map((bc) => {
      if (!lastBreadcrumb) {
        return bc;
      }
      return {
        ...bc,
        href: lastBreadcrumb.href + bc.href,
      };
    }),
  ];
}
