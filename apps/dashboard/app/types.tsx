import type React from 'react';

export type NavBarTab = {
  to: string;
  label: string;
};

export type NavBar = {
  title: string;
  actions?: React.ReactNode;
  subTitle?: string;
  tabs?: NavBarTab[];
};

export type Breadcrumb = { title: string; href: string };
export type HandleParams<LoaderData extends unknown> = { data: LoaderData; pathname: string };
export type Handle<LoaderData extends unknown> = {
  breadcrumb?: (params: HandleParams<LoaderData>) => Breadcrumb[];
  navbar?: (params: HandleParams<LoaderData>) => NavBar;
};
