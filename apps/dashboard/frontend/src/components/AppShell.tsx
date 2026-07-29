import React from "react";
import AccountCircle from "@mui/icons-material/AccountCircle";
import Add from "@mui/icons-material/Add";
import Brightness4 from "@mui/icons-material/Brightness4";
import Brightness7 from "@mui/icons-material/Brightness7";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Tab,
  Tabs,
  Toolbar,
  Typography,
  useColorScheme,
} from "@mui/material";
import { Link, useLocation } from "@richie-router/react";
import { api } from "../api";
import { AppBreadcrumbs, type Breadcrumb } from "./AppBreadcrumbs";
import { RouteLink } from "./RouteLink";

const drawerWidth = 240;
const databaseNav = [["Schedules", "/schedules"], ["Runs", "/runs"]] as const;
const workerNav = [["Functions", "/definitions"], ["Workers", "/workers"]] as const;

export interface AppTab { label: string; to: string; match?: string[] }

export function AppShell({ children, title, subtitle, actions, breadcrumbs, tabs }: {
  children: React.ReactNode;
  title?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  tabs?: AppTab[];
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();
  const { mode, setMode } = useColorScheme();
  const session = api.session.useQuery({ queryKey: ["session"], queryData: {}, retry: false });
  const user = session.data?.payload.user;
  const currentPath = location.pathname !== "/" ? location.pathname.replace(/\/$/, "") : "/";

  const navItems = (items: readonly (readonly [string, string])[]) => items.map(([label, to]) => (
    <ListItemButton key={to} component={RouteLink} to={to} selected={currentPath.startsWith(to)}>
      <ListItemText primary={label} />
    </ListItemButton>
  ));

  const drawer = (
    <>
      <Toolbar>
        <Link to="/" data-testid="enschedule-logo" style={{ textDecoration: "none", width: "100%" }}>
          <Typography variant="h5" fontWeight={800} sx={{ background: "radial-gradient(circle at center, #907dff, #ff5520)", backgroundClip: "text", color: "transparent" }}>Enschedule</Typography>
        </Link>
      </Toolbar>
      <Divider />
      <Box pt={2} px={2}>
        <Button fullWidth variant="contained" endIcon={<Add />} component={RouteLink} to="/run">Run</Button>
      </Box>
      <ListSubheader>In database</ListSubheader>
      <List>{navItems(databaseNav)}</List>
      <Divider />
      <ListSubheader>On worker</ListSubheader>
      <List>{navItems(workerNav)}</List>
      {user?.admin && <><Divider /><List><ListItemButton component={RouteLink} to="/admin" selected={currentPath.startsWith("/admin")}><ListItemText primary="Admin area" /></ListItemButton></List></>}
    </>
  );

  return (
    <Box display="flex" minHeight="100vh">
      <AppBar elevation={0} position="fixed" color="transparent" sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` } }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 2, display: { sm: "none" } }}><MenuIcon /></IconButton>
          <Box flex={1}>{breadcrumbs?.length ? <AppBreadcrumbs breadcrumbs={breadcrumbs} /> : null}</Box>
          <IconButton color="inherit" onClick={() => setMode(mode === "dark" ? "light" : "dark")} aria-label="Toggle theme">{mode === "dark" ? <Brightness7 /> : <Brightness4 />}</IconButton>
          {user ? <IconButton component={RouteLink} to="/profile" color="inherit" data-testid="profile-link"><AccountCircle /></IconButton> : <Button component={RouteLink} to="/login" color="inherit" data-testid="login-link">Login</Button>}
        </Toolbar>
      </AppBar>
      <Box component="nav" width={{ sm: drawerWidth }} flexShrink={{ sm: 0 }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: "block", sm: "none" }, "& .MuiDrawer-paper": { width: drawerWidth } }}>{drawer}</Drawer>
        <Drawer variant="permanent" open sx={{ display: { xs: "none", sm: "block" }, "& .MuiDrawer-paper": { width: drawerWidth } }}>{drawer}</Drawer>
      </Box>
      <Box component="main" flexGrow={1} minWidth={0} width={{ xs: "100%", sm: `calc(100% - ${drawerWidth}px)` }}>
        <Box sx={title ? { bgcolor: "background.paper" } : undefined}>
          <Toolbar />
          {title && <Box px={3} pt={2} borderBottom="thin solid" borderColor="divider">
            <Box display="flex" alignItems="flex-start" gap={3}>
              <Box flex={1}><Typography variant="h4">{title}</Typography>{subtitle && <Typography mt={1} variant="body2" color="text.secondary">{subtitle}</Typography>}</Box>
              {actions}
            </Box>
            {tabs?.length ? <Tabs value={tabs.find((tab) => (tab.match ?? [tab.to]).includes(currentPath))?.to ?? false} sx={{ mt: 2 }}>{tabs.map((tab) => <Tab key={tab.to} label={tab.label} value={tab.to} component={RouteLink} to={tab.to} />)}</Tabs> : <Box pb={2} />}
          </Box>}
        </Box>
        <Box p={3}>{children}</Box>
      </Box>
    </Box>
  );
}
