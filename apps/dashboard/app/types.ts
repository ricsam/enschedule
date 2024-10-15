import type { Worker } from "@enschedule/worker";
import type { WorkerAPI } from "@enschedule/worker-api";
import type React from "react";
import { z } from "zod";

export type NavBarTab = {
  to: string;
  label: string;
  match?: string[];
};

export type NavBar = {
  title: string;
  actions?: React.ReactNode;
  subTitle?: React.ReactNode;
  tabs?: NavBarTab[];
};

export type Breadcrumb = { title: string; href: string };
export type HandleParams<LoaderData> = {
  data: LoaderData;
  pathname: string;
};
export type Handle<LoaderData> = {
  breadcrumb?: (params: HandleParams<LoaderData>) => Breadcrumb[];
  navbar?: (params: HandleParams<LoaderData>) => NavBar;
};

export type DashboardWorker = WorkerAPI | Worker;

export type User = {
  userId: number;
};
export const UserSchema = z.object({
  userId: z.number(),
});
