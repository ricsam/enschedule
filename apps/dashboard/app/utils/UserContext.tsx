import { createContext, useContext } from "react";
import type { User } from "~/types";

const UserContext = createContext<User | undefined>(undefined);

export const UserProvider = ({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: User;
}) => {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
};
export const useUser = () => {
  return useContext(UserContext);
};
