/* eslint-disable */
import { createRouteNode, getRouteSchemaEntry, getRouterSchemaHostedRouting } from '@richie-router/core';
import { routerSchema } from './router-schema.ts';

const __rootRoute = createRouteNode('__root__', {}, { isRoot: true })._setSearchSchema(getRouteSchemaEntry(routerSchema, '__root__')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '__root__')?.serverHead);
const IndexRoute = createRouteNode('/', {}).update({ id: '/', path: '/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/')?.serverHead);
const AdminRoute = createRouteNode('/admin', {}).update({ id: '/admin', path: '/admin', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/admin')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/admin')?.serverHead);
const DefinitionsIndexRoute = createRouteNode('/definitions/', {}).update({ id: '/definitions/', path: '/definitions/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/definitions/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/definitions/')?.serverHead);
const DefinitionsSplatfunctionIdRoute = createRouteNode('/definitions/$functionId', {}).update({ id: '/definitions/$functionId', path: '/definitions/$functionId', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/definitions/$functionId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/definitions/$functionId')?.serverHead);
const DefinitionsSplatfunctionIdIndexRoute = createRouteNode('/definitions/$functionId/', {}).update({ id: '/definitions/$functionId/', path: '/definitions/$functionId/', getParentRoute: () => DefinitionsSplatfunctionIdRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/definitions/$functionId/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/definitions/$functionId/')?.serverHead);
const DefinitionsSplatfunctionIdSchedulesRoute = createRouteNode('/definitions/$functionId/schedules', {}).update({ id: '/definitions/$functionId/schedules', path: '/definitions/$functionId/schedules', getParentRoute: () => DefinitionsSplatfunctionIdRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/definitions/$functionId/schedules')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/definitions/$functionId/schedules')?.serverHead);
const LoginRoute = createRouteNode('/login', {}).update({ id: '/login', path: '/login', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/login')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/login')?.serverHead);
const ProfileRoute = createRouteNode('/profile', {}).update({ id: '/profile', path: '/profile', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/profile')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/profile')?.serverHead);
const RunRoute = createRouteNode('/run', {}).update({ id: '/run', path: '/run', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/run')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/run')?.serverHead);
const RunsIndexRoute = createRouteNode('/runs/', {}).update({ id: '/runs/', path: '/runs/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/runs/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/runs/')?.serverHead);
const RunsSplatrunIdRoute = createRouteNode('/runs/$runId', {}).update({ id: '/runs/$runId', path: '/runs/$runId', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/runs/$runId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/runs/$runId')?.serverHead);
const SchedulesIndexRoute = createRouteNode('/schedules/', {}).update({ id: '/schedules/', path: '/schedules/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/schedules/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/schedules/')?.serverHead);
const SchedulesSplatscheduleIdRoute = createRouteNode('/schedules/$scheduleId', {}).update({ id: '/schedules/$scheduleId', path: '/schedules/$scheduleId', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId')?.serverHead);
const SchedulesSplatscheduleIdIndexRoute = createRouteNode('/schedules/$scheduleId/', {}).update({ id: '/schedules/$scheduleId/', path: '/schedules/$scheduleId/', getParentRoute: () => SchedulesSplatscheduleIdRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/')?.serverHead);
const SchedulesSplatscheduleIdRunsRoute = createRouteNode('/schedules/$scheduleId/runs', {}).update({ id: '/schedules/$scheduleId/runs', path: '/schedules/$scheduleId/runs', getParentRoute: () => SchedulesSplatscheduleIdRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/runs')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/runs')?.serverHead);
const SchedulesSplatscheduleIdRunsSplatrunIdRoute = createRouteNode('/schedules/$scheduleId/runs/$runId', {}).update({ id: '/schedules/$scheduleId/runs/$runId', path: '/schedules/$scheduleId/runs/$runId', getParentRoute: () => SchedulesSplatscheduleIdRunsRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/runs/$runId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/schedules/$scheduleId/runs/$runId')?.serverHead);
const WorkersIndexRoute = createRouteNode('/workers/', {}).update({ id: '/workers/', path: '/workers/', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/workers/')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/workers/')?.serverHead);
const WorkersSplatworkerIdRoute = createRouteNode('/workers/$workerId', {}).update({ id: '/workers/$workerId', path: '/workers/$workerId', getParentRoute: () => __rootRoute } as const)._setSearchSchema(getRouteSchemaEntry(routerSchema, '/workers/$workerId')?.searchSchema as never)._setServerHead(getRouteSchemaEntry(routerSchema, '/workers/$workerId')?.serverHead);

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
export const routeManifest = __rootRoute._addFileChildren(__rootRouteChildren)._setHostedRouting(getRouterSchemaHostedRouting(routerSchema));
