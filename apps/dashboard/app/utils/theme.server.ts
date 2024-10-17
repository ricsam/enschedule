import { getCookies } from "~/sessions";
import type { Theme } from "./theme-provider";
import { isTheme } from "./theme-provider";

async function getThemeSession(request: Request) {
  const cookies = await getCookies(request);
  return {
    getTheme: () => {
      const themeValue = cookies.theme.session.get("theme");
      return isTheme(themeValue) ? themeValue : undefined;
    },
    setTheme: (theme: Theme) => cookies.theme.session.set("theme", theme),
    commit: () => cookies.theme.commit(),
  };
}

export { getThemeSession };
