import type { ActionFunction, LoaderFunction, SerializeFrom } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import type { Params } from '@remix-run/react';
import { useLoaderData } from '@remix-run/react';
import { z } from 'zod';
import { RootLayout } from '~/components/Layout';
import SchedulePage from '~/components/SchedulePage';
import { scheduler } from '~/scheduler.server';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { Form } from '@remix-run/react';

import type { PublicJobSchedule } from '@enschedule/types';
import type { Breadcrumb } from '~/types';
import { extendBreadcrumbs } from '~/utils/extendBreadcrumbs';
import { useBreadcrumbs as useParentBreadcrumbs } from '..'; // Importing from parent

export function Actions({ id }: { id: number }) {
  return (
    <>
      <Box display="flex" gap={2}>
        <Form method="post">
          <Button type="submit" variant="outlined">
            Delete
          </Button>
          <input type="hidden" name="action" value="delete" />
        </Form>
        <Form method="post">
          <Button type="submit" variant="contained">
            Run now
          </Button>
          <input type="hidden" name="action" value="run" />
        </Form>
      </Box>
    </>
  );
}

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

export const useBreadcrumbs = (schedule: SerializeFrom<PublicJobSchedule>): Breadcrumb[] => {
  const parentBreadcrumbs = useParentBreadcrumbs();
  return extendBreadcrumbs(parentBreadcrumbs, [{ title: schedule.title, href: '/' + String(schedule.id) }]);
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

export function Page() {
  const { schedule, runs } = useLoaderData<LoaderData>();
  return <SchedulePage schedule={schedule} runs={runs} />;
}

export const useNavbar = () => {
  const data = useData();

  return {
    title: data.schedule.title,
    subTitle: data.schedule.description,
    tabs: [
      {
        label: 'Details',
        to: `/schedules/${data.schedule.id}`,
      },
      {
        label: 'Runs',
        to: `/schedules/${data.schedule.id}/runs`,
      },
    ],
    actions: <Actions id={data.schedule.id} />,
  };
};

export default function Schedule() {
  const data = useData();
  return (
    <RootLayout breadcrumbs={useBreadcrumbs(data.schedule)} navbar={useNavbar()}>
      <Page />
    </RootLayout>
  );
}
