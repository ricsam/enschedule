import { Button } from '@mui/material';
import type { ActionFunction, LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import type { Params } from '@remix-run/react';
import { Link as RemixLink, useLoaderData } from '@remix-run/react';
import type { PublicJobDefinition, PublicJobSchedule } from '@enschedule/types';
import assert from 'assert';
import { z } from 'zod';
import { RootLayout } from '~/components/Layout';
import SchedulesTable from '~/components/SchedulesTable';
import { scheduler } from '~/scheduler';
import type { Breadcrumb } from '~/types';

type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export async function getLoaderData(params: Params<string>): Promise<{
  schedules: PublicJobSchedule[];
  definition?: PublicJobDefinition;
}> {
  const definitionId = params.definitionId;
  const definition = definitionId ? scheduler.getJobDefinition(definitionId) : undefined;
  const schedules = await scheduler.getSchedules(definitionId);
  return { schedules, definition };
}

export const loader: LoaderFunction = async ({ params }) => {
  return json<LoaderData>(await getLoaderData(params));
};

export const action: ActionFunction = async ({ request }) => {
  const fd = await request.formData();
  assert(fd.has('schedule'), 'you must provide schedule field in the form data');
  const action = z.union([z.literal('delete'), z.literal('run')]).parse(fd.get('action'));
  const selected = z.array(z.number().int()).parse(fd.getAll('schedule').map(Number));
  if (action === 'run') {
    await Promise.all(
      selected.map(async (id) => {
        return scheduler.runSchedule(id);
      })
    );
  } else if (action === 'delete') {
    await scheduler.deleteSchedules(selected);
  }
  return json({ success: true });
};

export const useData = () => {
  return useLoaderData<LoaderData>();
};

export function Page() {
  const { schedules } = useLoaderData<LoaderData>();

  return <SchedulesTable schedules={schedules} />;
}

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [
    {
      title: 'Schedules',
      href: '/schedules',
    },
  ];
};

export default function Schedules() {
  return (
    <RootLayout
      navbar={{
        title: 'Schedules',
        subTitle: 'All schedules',
        actions: (
          <>
            <Button variant="contained" LinkComponent={RemixLink} component={RemixLink} to={'/run'}>
              Create schedule
            </Button>
          </>
        ),
      }}
      breadcrumbs={useBreadcrumbs()}
    >
      <Page />
    </RootLayout>
  );
}
