export const getParentUrl = (currentUrl: string) => {
  const url = new URL(currentUrl);
  if (url.pathname !== "/") {
    url.pathname = url.pathname
      .replace(/\/$/, "")
      .split("/")
      .slice(0, -1)
      .join("/");
  }
  return url.toString();
};
