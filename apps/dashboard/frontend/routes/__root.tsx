import { Alert, Box, Button, CssBaseline, GlobalStyles, createTheme, ThemeProvider } from "@mui/material";
import { Outlet, createRootRoute } from "@richie-router/react";

export const Route = createRootRoute({
  component: Root,
  errorComponent: ({ error }) => (
    <Box p={4}><Alert severity="error" action={<Button onClick={() => location.reload()}>Reload</Button>}>{error instanceof Error ? error.message : "Unexpected error"}</Alert></Box>
  ),
  notFoundComponent: () => <Box p={4}>Page not found.</Box>,
});

const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  cssVariables: { colorSchemeSelector: "class" },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backdropFilter: "blur(8px)",
          boxShadow: "none",
          borderBottom: `thin solid ${theme.palette.divider}`,
          backgroundColor: `rgba(${theme.vars.palette.background.paperChannel} / 0.8)`,
        }),
      },
    },
  },
});

function Root() {
  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
      <GlobalStyles styles={{
        "html, body, #app": {
          minHeight: "100%",
          backgroundColor: "var(--mui-palette-background-default)",
          color: "var(--mui-palette-text-primary)",
        },
        body: { minHeight: "100vh" },
      }} />
      <Outlet />
    </ThemeProvider>
  );
}
