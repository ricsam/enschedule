import React, { useDebugValue } from "react";

/**
 * helper function to create context and hook to consume context
 */
export function createContext<T, U>(
  useContextValue: (props: U) => T,
  options:
    | string
    | {
        name: string;
        providerName?: string;
        hookName?: string;
        contextName?: string;
      }
    | {
        providerName: string;
        hookName: string;
        contextName: string;
      }
): [() => T, React.FC<{ children: React.ReactNode } & U>] {
  const context = React.createContext<undefined | T>(undefined);

  const casing = (v: string) => v[0].toUpperCase() + v.slice(1);

  const _options = typeof options === "string" ? { name: options } : options;

  const hookName = !("name" in _options)
    ? _options.hookName
    : _options.hookName ?? `use${casing(_options.name)}`;
  const providerName = !("name" in _options)
    ? _options.providerName
    : _options.providerName ?? `${casing(_options.name)}Provider`;
  const contextName = !("name" in _options)
    ? _options.contextName
    : _options.contextName ?? `${casing(_options.name)}Context`;

  context.displayName = contextName;

  const useContext = (): T => {
    useDebugValue(hookName);
    const ctx = React.useContext(context);
    if (!ctx) {
      throw new Error(
        `You must wrap this component in a <${providerName} /> component`
      );
    }
    return ctx;
  };

  const Provider = ({
    children,
    ...props
  }: { children: React.ReactNode } & U) => {
    const value = useContextValue(props as any);
    return <context.Provider value={value}>{children}</context.Provider>;
  };

  Provider.displayName = providerName;

  return [useContext, Provider];
}
