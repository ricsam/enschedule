import type { LoaderFunction, SerializeFrom } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { differenceInMilliseconds } from 'date-fns';
import { RootLayout } from '~/components/Layout';
import RunPage from '~/components/RunPage';
import type { Breadcrumb } from '~/types';
import { useRunBreadcrumbs } from '~/utils/breadcrumbUtils';
import { extendBreadcrumbs } from '~/utils/extendBreadcrumbs';
import { formatDate } from '~/utils/formatDate';
import { getRunData } from '~/utils/loaderUtils';

import { useBreadcrumbs as useParentBreadcrumbs } from '..';

export const useBreadcrumbs = (data: SerializeFrom<LoaderData>): Breadcrumb[] => {
  return extendBreadcrumbs(useParentBreadcrumbs(data.jobSchedule), useRunBreadcrumbs(data));
};

const getLoaderData = getRunData;

export const loader: LoaderFunction = async (args) => {
  const { params } = args;
  return json(await getLoaderData(params));
};

export type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

function useData() {
  const run = useLoaderData<LoaderData>();
  return run;
}

export default function Run() {
  const data = useData();

  return (
    <RootLayout
      breadcrumbs={useBreadcrumbs(data)}
      navbar={{
        title: `Run #${data.id}`,
        subTitle: `Ran ${data.jobSchedule.title} which completed ${
          formatDate(data.finishedAt).label
        } and took ${differenceInMilliseconds(
          new Date(data.finishedAt),
          new Date(data.startedAt)
        )} ms to run`,
      }}
    >
      <RunPage run={data} schedule={data.jobSchedule} />
    </RootLayout>
  );
}
