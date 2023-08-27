import type { ActionFunction, LoaderFunction, SerializeFrom } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import type { Params } from '@remix-run/react';
import { useLoaderData } from '@remix-run/react';
import type { PublicJobSchedule } from '@enschedule/types';
import { z } from 'zod';
import { RootLayout } from '~/components/Layout';
import RunsTable from '~/components/RunsTable';
import { scheduler } from '~/scheduler';
import type { Breadcrumb } from '~/types';
import { extendBreadcrumbs } from '~/utils/extendBreadcrumbs';
import { useBreadcrumbs as useParentBreadcrumbs, useNavbar } from '..';

const getScheduleId = (params: Params<string>): number => {
  const scheduleId = params.scheduleId;
  const id = Number(scheduleId);
  if (Number.isNaN(id)) {
    throw new Error('invalid id');
  }
  return id;
};

export const getLoaderData = async (params: Params) => {
  const id = getScheduleId(params);
  const schedule = await scheduler.getSchedule(id);
  if (!schedule) {
    throw new Error('invalid id');
  }
  const runs = await scheduler.getRuns(schedule.id);

  return { schedule, runs };
};

export type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const loader: LoaderFunction = async ({ params }) => {
  const loaderData = await getLoaderData(params);
  return json(loaderData);
};

export const useData = () => {
  return useLoaderData<LoaderData>();
};

export const action: ActionFunction = async ({ request, params }) => {
  const fd = await request.formData();
  const action = z.union([z.literal('delete'), z.literal('run')]).parse(fd.get('action'));

  if (action === 'run') {
    const id = getScheduleId(params);
    await scheduler.runSchedule(id);
    return redirect(request.url);
  } else {
    // const id = getScheduleId(params);
    // TODO delete
    return redirect('..');
  }
};

export const useBreadcrumbs = (schedule: SerializeFrom<PublicJobSchedule>): Breadcrumb[] => {
  return extendBreadcrumbs(useParentBreadcrumbs(schedule), [{ title: 'Runs', href: '/runs' }]);
};

export default function Runs() {
  const { runs, schedule } = useData();
  const breadcrumbs = useBreadcrumbs(schedule);
  return (
    <RootLayout breadcrumbs={breadcrumbs} navbar={useNavbar()}>
      <RunsTable runs={runs} />
    </RootLayout>
  );
}
