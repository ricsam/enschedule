import type { LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import type { PublicJobRun } from '@enschedule/types';
import { RootLayout } from '~/components/Layout';
import RunsTable from '~/components/RunsTable';
import { scheduler } from '~/scheduler.server';
import type { Breadcrumb } from '~/types';

export type LoaderData = {
  runs: PublicJobRun[];
};

export const loader: LoaderFunction = async () => {
  const runs: PublicJobRun[] = await scheduler.getRuns();
  return json({ runs });
};

export function useData() {
  return useLoaderData<LoaderData>();
}

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [{ title: 'Runs', href: '/runs' }];
};

export default function Runs() {
  const { runs } = useData();

  return (
    <RootLayout
      navbar={{
        title: 'All Runs',
        subTitle: `Listing all runs in the system.`,
      }}
      breadcrumbs={useBreadcrumbs()}
    >
      <RunsTable runs={runs} />
    </RootLayout>
  );
}
