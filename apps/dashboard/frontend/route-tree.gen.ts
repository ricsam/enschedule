/* eslint-disable */
import { routerSchema } from '../shared/router-schema.ts';
import type { RouterSchema } from '../shared/router-schema.ts';
import { getRouteSchemaEntry, getRouterSchemaHostedRouting } from '@richie-router/core';
import type { InferRouterSearchSchema, RouteUsesServerHead, RouterSchemaRouteIds } from '@richie-router/core';

import { Route as __rootRouteImport } from './routes/__root.tsx';
import { Route as IndexRouteImport } from './routes/index.tsx';
import { Route as AdminRouteImport } from './routes/admin.tsx';
import { Route as DefinitionsIndexRouteImport } from './routes/definitions.index.tsx';
import { Route as DefinitionsSplatfunctionIdRouteImport } from './routes/definitions.$functionId.tsx';
import { Route as DefinitionsSplatfunctionIdIndexRouteImport } from './routes/definitions.$functionId.index.tsx';
import { Route as DefinitionsSplatfunctionIdSchedulesRouteImport } from './routes/definitions.$functionId.schedules.tsx';
import { Route as LoginRouteImport } from './routes/login.tsx';
import { Route as ProfileRouteImport } from './routes/profile.tsx';
import { Route as RunRouteImport } from './routes/run.tsx';
import { Route as RunsIndexRouteImport } from './routes/runs.index.tsx';
import { Route as RunsSplatrunIdRouteImport } from './routes/runs.$runId.tsx';
import { Route as SchedulesIndexRouteImport } from './routes/schedules.index.tsx';
import { Route as SchedulesSplatscheduleIdRouteImport } from './routes/schedules.$scheduleId.tsx';
import { Route as SchedulesSplatscheduleIdIndexRouteImport } from './routes/schedules.$scheduleId.index.tsx';
import { Route as SchedulesSplatscheduleIdRunsRouteImport } from './routes/schedules.$scheduleId.runs.tsx';
import { Route as SchedulesSplatscheduleIdRunsSplatrunIdRouteImport } from './routes/schedules.$scheduleId.runs.$runId.tsx';
import { Route as WorkersIndexRouteImport } from './routes/workers.index.tsx';
import { Route as WorkersSplatworkerIdRouteImport } from './routes/workers.$workerId.tsx';

const __rootRoute = __rootRouteImport._setSearchSchema(getRouteSchemaEntry(routerSchema, '__root__')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '__root__')?.serverHead)._setHostedRouting(getRouterSchemaHostedRouting(routerSchema));

type Assert<T extends true> = T
type IsEqual<TLeft, TRight> = (<TValue>() => TValue extends TLeft ? 1 : 2) extends (<TValue>() => TValue extends TRight ? 1 : 2) ? true : false
type HasInlineHead<TRoute> = TRoute extends { __hasInlineHead: infer TValue } ? TValue : false
type FileRouteIds = '__root__' | '/' | '/admin' | '/definitions/' | '/definitions/$functionId' | '/definitions/$functionId/' | '/definitions/$functionId/schedules' | '/login' | '/profile' | '/run' | '/runs/' | '/runs/$runId' | '/schedules/' | '/schedules/$scheduleId' | '/schedules/$scheduleId/' | '/schedules/$scheduleId/runs' | '/schedules/$scheduleId/runs/$runId' | '/workers/' | '/workers/$workerId'
type RouterSchemaKeyAssertion = Assert<Exclude<RouterSchemaRouteIds<RouterSchema>, FileRouteIds> extends never ? true : false>
type __rootRouteIdAssertion = Assert<IsEqual<typeof __rootRouteImport['id'], '__root__'>>
type IndexRouteIdAssertion = Assert<IsEqual<typeof IndexRouteImport['id'], '/'>>
type AdminRouteIdAssertion = Assert<IsEqual<typeof AdminRouteImport['id'], '/admin'>>
type DefinitionsIndexRouteIdAssertion = Assert<IsEqual<typeof DefinitionsIndexRouteImport['id'], '/definitions/'>>
type DefinitionsSplatfunctionIdRouteIdAssertion = Assert<IsEqual<typeof DefinitionsSplatfunctionIdRouteImport['id'], '/definitions/$functionId'>>
type DefinitionsSplatfunctionIdIndexRouteIdAssertion = Assert<IsEqual<typeof DefinitionsSplatfunctionIdIndexRouteImport['id'], '/definitions/$functionId/'>>
type DefinitionsSplatfunctionIdSchedulesRouteIdAssertion = Assert<IsEqual<typeof DefinitionsSplatfunctionIdSchedulesRouteImport['id'], '/definitions/$functionId/schedules'>>
type LoginRouteIdAssertion = Assert<IsEqual<typeof LoginRouteImport['id'], '/login'>>
type ProfileRouteIdAssertion = Assert<IsEqual<typeof ProfileRouteImport['id'], '/profile'>>
type RunRouteIdAssertion = Assert<IsEqual<typeof RunRouteImport['id'], '/run'>>
type RunsIndexRouteIdAssertion = Assert<IsEqual<typeof RunsIndexRouteImport['id'], '/runs/'>>
type RunsSplatrunIdRouteIdAssertion = Assert<IsEqual<typeof RunsSplatrunIdRouteImport['id'], '/runs/$runId'>>
type SchedulesIndexRouteIdAssertion = Assert<IsEqual<typeof SchedulesIndexRouteImport['id'], '/schedules/'>>
type SchedulesSplatscheduleIdRouteIdAssertion = Assert<IsEqual<typeof SchedulesSplatscheduleIdRouteImport['id'], '/schedules/$scheduleId'>>
type SchedulesSplatscheduleIdIndexRouteIdAssertion = Assert<IsEqual<typeof SchedulesSplatscheduleIdIndexRouteImport['id'], '/schedules/$scheduleId/'>>
type SchedulesSplatscheduleIdRunsRouteIdAssertion = Assert<IsEqual<typeof SchedulesSplatscheduleIdRunsRouteImport['id'], '/schedules/$scheduleId/runs'>>
type SchedulesSplatscheduleIdRunsSplatrunIdRouteIdAssertion = Assert<IsEqual<typeof SchedulesSplatscheduleIdRunsSplatrunIdRouteImport['id'], '/schedules/$scheduleId/runs/$runId'>>
type WorkersIndexRouteIdAssertion = Assert<IsEqual<typeof WorkersIndexRouteImport['id'], '/workers/'>>
type WorkersSplatworkerIdRouteIdAssertion = Assert<IsEqual<typeof WorkersSplatworkerIdRouteImport['id'], '/workers/$workerId'>>
type __rootRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '__root__'> extends true ? HasInlineHead<typeof __rootRouteImport> extends true ? false : true : true>
type IndexRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/'> extends true ? HasInlineHead<typeof IndexRouteImport> extends true ? false : true : true>
type AdminRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/admin'> extends true ? HasInlineHead<typeof AdminRouteImport> extends true ? false : true : true>
type DefinitionsIndexRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/definitions/'> extends true ? HasInlineHead<typeof DefinitionsIndexRouteImport> extends true ? false : true : true>
type DefinitionsSplatfunctionIdRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/definitions/$functionId'> extends true ? HasInlineHead<typeof DefinitionsSplatfunctionIdRouteImport> extends true ? false : true : true>
type DefinitionsSplatfunctionIdIndexRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/definitions/$functionId/'> extends true ? HasInlineHead<typeof DefinitionsSplatfunctionIdIndexRouteImport> extends true ? false : true : true>
type DefinitionsSplatfunctionIdSchedulesRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/definitions/$functionId/schedules'> extends true ? HasInlineHead<typeof DefinitionsSplatfunctionIdSchedulesRouteImport> extends true ? false : true : true>
type LoginRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/login'> extends true ? HasInlineHead<typeof LoginRouteImport> extends true ? false : true : true>
type ProfileRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/profile'> extends true ? HasInlineHead<typeof ProfileRouteImport> extends true ? false : true : true>
type RunRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/run'> extends true ? HasInlineHead<typeof RunRouteImport> extends true ? false : true : true>
type RunsIndexRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/runs/'> extends true ? HasInlineHead<typeof RunsIndexRouteImport> extends true ? false : true : true>
type RunsSplatrunIdRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/runs/$runId'> extends true ? HasInlineHead<typeof RunsSplatrunIdRouteImport> extends true ? false : true : true>
type SchedulesIndexRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/schedules/'> extends true ? HasInlineHead<typeof SchedulesIndexRouteImport> extends true ? false : true : true>
type SchedulesSplatscheduleIdRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/schedules/$scheduleId'> extends true ? HasInlineHead<typeof SchedulesSplatscheduleIdRouteImport> extends true ? false : true : true>
type SchedulesSplatscheduleIdIndexRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/schedules/$scheduleId/'> extends true ? HasInlineHead<typeof SchedulesSplatscheduleIdIndexRouteImport> extends true ? false : true : true>
type SchedulesSplatscheduleIdRunsRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/schedules/$scheduleId/runs'> extends true ? HasInlineHead<typeof SchedulesSplatscheduleIdRunsRouteImport> extends true ? false : true : true>
type SchedulesSplatscheduleIdRunsSplatrunIdRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/schedules/$scheduleId/runs/$runId'> extends true ? HasInlineHead<typeof SchedulesSplatscheduleIdRunsSplatrunIdRouteImport> extends true ? false : true : true>
type WorkersIndexRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/workers/'> extends true ? HasInlineHead<typeof WorkersIndexRouteImport> extends true ? false : true : true>
type WorkersSplatworkerIdRouteServerHeadAssertion = Assert<RouteUsesServerHead<RouterSchema, '/workers/$workerId'> extends true ? HasInlineHead<typeof WorkersSplatworkerIdRouteImport> extends true ? false : true : true>

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/')?.serverHead);
const AdminRoute = AdminRouteImport.update({ id: '/admin', path: '/admin', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/admin')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/admin')?.serverHead);
const DefinitionsIndexRoute = DefinitionsIndexRouteImport.update({ id: '/definitions/', path: '/definitions/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/definitions/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/definitions/')?.serverHead);
const DefinitionsSplatfunctionIdRoute = DefinitionsSplatfunctionIdRouteImport.update({ id: '/definitions/$functionId', path: '/definitions/$functionId', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/definitions/$functionId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/definitions/$functionId')?.serverHead);
const DefinitionsSplatfunctionIdIndexRoute = DefinitionsSplatfunctionIdIndexRouteImport.update({ id: '/definitions/$functionId/', path: '/definitions/$functionId/', getParentRoute: () => DefinitionsSplatfunctionIdRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/definitions/$functionId/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/definitions/$functionId/')?.serverHead);
const DefinitionsSplatfunctionIdSchedulesRoute = DefinitionsSplatfunctionIdSchedulesRouteImport.update({ id: '/definitions/$functionId/schedules', path: '/definitions/$functionId/schedules', getParentRoute: () => DefinitionsSplatfunctionIdRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/definitions/$functionId/schedules')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/definitions/$functionId/schedules')?.serverHead);
const LoginRoute = LoginRouteImport.update({ id: '/login', path: '/login', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/login')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/login')?.serverHead);
const ProfileRoute = ProfileRouteImport.update({ id: '/profile', path: '/profile', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/profile')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/profile')?.serverHead);
const RunRoute = RunRouteImport.update({ id: '/run', path: '/run', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/run')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/run')?.serverHead);
const RunsIndexRoute = RunsIndexRouteImport.update({ id: '/runs/', path: '/runs/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/runs/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/runs/')?.serverHead);
const RunsSplatrunIdRoute = RunsSplatrunIdRouteImport.update({ id: '/runs/$runId', path: '/runs/$runId', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/runs/$runId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/runs/$runId')?.serverHead);
const SchedulesIndexRoute = SchedulesIndexRouteImport.update({ id: '/schedules/', path: '/schedules/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/schedules/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/schedules/')?.serverHead);
const SchedulesSplatscheduleIdRoute = SchedulesSplatscheduleIdRouteImport.update({ id: '/schedules/$scheduleId', path: '/schedules/$scheduleId', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId')?.serverHead);
const SchedulesSplatscheduleIdIndexRoute = SchedulesSplatscheduleIdIndexRouteImport.update({ id: '/schedules/$scheduleId/', path: '/schedules/$scheduleId/', getParentRoute: () => SchedulesSplatscheduleIdRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/')?.serverHead);
const SchedulesSplatscheduleIdRunsRoute = SchedulesSplatscheduleIdRunsRouteImport.update({ id: '/schedules/$scheduleId/runs', path: '/schedules/$scheduleId/runs', getParentRoute: () => SchedulesSplatscheduleIdRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/runs')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/runs')?.serverHead);
const SchedulesSplatscheduleIdRunsSplatrunIdRoute = SchedulesSplatscheduleIdRunsSplatrunIdRouteImport.update({ id: '/schedules/$scheduleId/runs/$runId', path: '/schedules/$scheduleId/runs/$runId', getParentRoute: () => SchedulesSplatscheduleIdRunsRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/runs/$runId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/runs/$runId')?.serverHead);
const WorkersIndexRoute = WorkersIndexRouteImport.update({ id: '/workers/', path: '/workers/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/workers/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/workers/')?.serverHead);
const WorkersSplatworkerIdRoute = WorkersSplatworkerIdRouteImport.update({ id: '/workers/$workerId', path: '/workers/$workerId', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/workers/$workerId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/workers/$workerId')?.serverHead);

export interface RouteSearchSchema {
  '__root__': InferRouterSearchSchema<RouterSchema, '__root__'>;
  '/': InferRouterSearchSchema<RouterSchema, '/'>;
  '/admin': InferRouterSearchSchema<RouterSchema, '/admin'>;
  '/definitions/': InferRouterSearchSchema<RouterSchema, '/definitions/'>;
  '/definitions/$functionId': InferRouterSearchSchema<RouterSchema, '/definitions/$functionId'>;
  '/definitions/$functionId/': InferRouterSearchSchema<RouterSchema, '/definitions/$functionId/'>;
  '/definitions/$functionId/schedules': InferRouterSearchSchema<RouterSchema, '/definitions/$functionId/schedules'>;
  '/login': InferRouterSearchSchema<RouterSchema, '/login'>;
  '/profile': InferRouterSearchSchema<RouterSchema, '/profile'>;
  '/run': InferRouterSearchSchema<RouterSchema, '/run'>;
  '/runs/': InferRouterSearchSchema<RouterSchema, '/runs/'>;
  '/runs/$runId': InferRouterSearchSchema<RouterSchema, '/runs/$runId'>;
  '/schedules/': InferRouterSearchSchema<RouterSchema, '/schedules/'>;
  '/schedules/$scheduleId': InferRouterSearchSchema<RouterSchema, '/schedules/$scheduleId'>;
  '/schedules/$scheduleId/': InferRouterSearchSchema<RouterSchema, '/schedules/$scheduleId/'>;
  '/schedules/$scheduleId/runs': InferRouterSearchSchema<RouterSchema, '/schedules/$scheduleId/runs'>;
  '/schedules/$scheduleId/runs/$runId': InferRouterSearchSchema<RouterSchema, '/schedules/$scheduleId/runs/$runId'>;
  '/workers/': InferRouterSearchSchema<RouterSchema, '/workers/'>;
  '/workers/$workerId': InferRouterSearchSchema<RouterSchema, '/workers/$workerId'>;
}

export interface FileRoutesById {
  '__root__': typeof __rootRoute;
  '/': typeof IndexRoute;
  '/admin': typeof AdminRoute;
  '/definitions/': typeof DefinitionsIndexRoute;
  '/definitions/$functionId': typeof DefinitionsSplatfunctionIdRouteWithChildren;
  '/definitions/$functionId/': typeof DefinitionsSplatfunctionIdIndexRoute;
  '/definitions/$functionId/schedules': typeof DefinitionsSplatfunctionIdSchedulesRoute;
  '/login': typeof LoginRoute;
  '/profile': typeof ProfileRoute;
  '/run': typeof RunRoute;
  '/runs/': typeof RunsIndexRoute;
  '/runs/$runId': typeof RunsSplatrunIdRoute;
  '/schedules/': typeof SchedulesIndexRoute;
  '/schedules/$scheduleId': typeof SchedulesSplatscheduleIdRouteWithChildren;
  '/schedules/$scheduleId/': typeof SchedulesSplatscheduleIdIndexRoute;
  '/schedules/$scheduleId/runs': typeof SchedulesSplatscheduleIdRunsRouteWithChildren;
  '/schedules/$scheduleId/runs/$runId': typeof SchedulesSplatscheduleIdRunsSplatrunIdRoute;
  '/workers/': typeof WorkersIndexRoute;
  '/workers/$workerId': typeof WorkersSplatworkerIdRoute;
}

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute;
  '/admin': typeof AdminRoute;
  '/definitions/': typeof DefinitionsIndexRoute;
  '/definitions/$functionId': typeof DefinitionsSplatfunctionIdRouteWithChildren;
  '/definitions/$functionId/': typeof DefinitionsSplatfunctionIdIndexRoute;
  '/definitions/$functionId/schedules': typeof DefinitionsSplatfunctionIdSchedulesRoute;
  '/login': typeof LoginRoute;
  '/profile': typeof ProfileRoute;
  '/run': typeof RunRoute;
  '/runs/': typeof RunsIndexRoute;
  '/runs/$runId': typeof RunsSplatrunIdRoute;
  '/schedules/': typeof SchedulesIndexRoute;
  '/schedules/$scheduleId': typeof SchedulesSplatscheduleIdRouteWithChildren;
  '/schedules/$scheduleId/': typeof SchedulesSplatscheduleIdIndexRoute;
  '/schedules/$scheduleId/runs': typeof SchedulesSplatscheduleIdRunsRouteWithChildren;
  '/schedules/$scheduleId/runs/$runId': typeof SchedulesSplatscheduleIdRunsSplatrunIdRoute;
  '/workers/': typeof WorkersIndexRoute;
  '/workers/$workerId': typeof WorkersSplatworkerIdRoute;
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute;
  '/admin': typeof AdminRoute;
  '/definitions': typeof DefinitionsIndexRoute;
  '/definitions/$functionId': typeof DefinitionsSplatfunctionIdIndexRoute;
  '/definitions/$functionId/schedules': typeof DefinitionsSplatfunctionIdSchedulesRoute;
  '/login': typeof LoginRoute;
  '/profile': typeof ProfileRoute;
  '/run': typeof RunRoute;
  '/runs': typeof RunsIndexRoute;
  '/runs/$runId': typeof RunsSplatrunIdRoute;
  '/schedules': typeof SchedulesIndexRoute;
  '/schedules/$scheduleId': typeof SchedulesSplatscheduleIdIndexRoute;
  '/schedules/$scheduleId/runs': typeof SchedulesSplatscheduleIdRunsRouteWithChildren;
  '/schedules/$scheduleId/runs/$runId': typeof SchedulesSplatscheduleIdRunsSplatrunIdRoute;
  '/workers': typeof WorkersIndexRoute;
  '/workers/$workerId': typeof WorkersSplatworkerIdRoute;
}

export interface FileRouteTypes {
  fullPaths: '/' | '/admin' | '/definitions' | '/definitions/$functionId' | '/definitions/$functionId/schedules' | '/login' | '/profile' | '/run' | '/runs' | '/runs/$runId' | '/schedules' | '/schedules/$scheduleId' | '/schedules/$scheduleId/runs' | '/schedules/$scheduleId/runs/$runId' | '/workers' | '/workers/$workerId';
  to: '/' | '/admin' | '/definitions' | '/definitions/$functionId' | '/definitions/$functionId/schedules' | '/login' | '/profile' | '/run' | '/runs' | '/runs/$runId' | '/schedules' | '/schedules/$scheduleId' | '/schedules/$scheduleId/runs' | '/schedules/$scheduleId/runs/$runId' | '/workers' | '/workers/$workerId';
  id: '__root__' | '/' | '/admin' | '/definitions/' | '/definitions/$functionId' | '/definitions/$functionId/' | '/definitions/$functionId/schedules' | '/login' | '/profile' | '/run' | '/runs/' | '/runs/$runId' | '/schedules/' | '/schedules/$scheduleId' | '/schedules/$scheduleId/' | '/schedules/$scheduleId/runs' | '/schedules/$scheduleId/runs/$runId' | '/workers/' | '/workers/$workerId';
  fileRoutesById: FileRoutesById;
  fileRoutesByTo: FileRoutesByTo;
  fileRoutesByFullPath: FileRoutesByFullPath;
}

declare module '@richie-router/react' {
  interface Register {
    routeTree: typeof routeTree;
    routeSearchSchema: RouteSearchSchema;
  }
}

const DefinitionsSplatfunctionIdRouteChildren = {
  DefinitionsSplatfunctionIdIndexRoute,
  DefinitionsSplatfunctionIdSchedulesRoute,
};
const DefinitionsSplatfunctionIdRouteWithChildren = DefinitionsSplatfunctionIdRoute._addFileChildren(DefinitionsSplatfunctionIdRouteChildren);
const SchedulesSplatscheduleIdRunsRouteChildren = {
  SchedulesSplatscheduleIdRunsSplatrunIdRoute,
};
const SchedulesSplatscheduleIdRunsRouteWithChildren = SchedulesSplatscheduleIdRunsRoute._addFileChildren(SchedulesSplatscheduleIdRunsRouteChildren);
const SchedulesSplatscheduleIdRouteChildren = {
  SchedulesSplatscheduleIdIndexRoute,
  SchedulesSplatscheduleIdRunsRouteWithChildren,
};
const SchedulesSplatscheduleIdRouteWithChildren = SchedulesSplatscheduleIdRoute._addFileChildren(SchedulesSplatscheduleIdRouteChildren);

const __rootRouteChildren = {
  IndexRoute,
  AdminRoute,
  DefinitionsIndexRoute,
  DefinitionsSplatfunctionIdRouteWithChildren,
  LoginRoute,
  ProfileRoute,
  RunRoute,
  RunsIndexRoute,
  RunsSplatrunIdRoute,
  SchedulesIndexRoute,
  SchedulesSplatscheduleIdRouteWithChildren,
  WorkersIndexRoute,
  WorkersSplatworkerIdRoute,
};
export const routeTree = __rootRoute._addFileChildren(__rootRouteChildren)._addFileTypes<FileRouteTypes>();
