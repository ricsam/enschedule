import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import AddIcon from "@mui/icons-material/Add";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import UserIcon from "@mui/icons-material/AccountCircle";
import MenuIcon from "@mui/icons-material/Menu";
import { ListSubheader, Tab, Tabs, Typography } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import {
  Link,
  Link as RemixLink,
  NavLink,
  useLocation,
} from "@remix-run/react";
import { pascalCase } from "pascal-case";
import React from "react";
import logo from "~/logo.svg";
import type { Breadcrumb, NavBar } from "~/types";
import { Theme, useTheme } from "~/utils/theme-provider";
import { AppBreadcrumbs } from "./AppBreadcrumbs";
import { useLiveData } from "./useLiveData";
import { useUser } from "~/utils/UserContext";

const drawerWidth = 240;

export function RootLayout({
  navbar,
  children,
  breadcrumbs,
  withoutLiveData
}: {
  navbar?: NavBar;
  children: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  withoutLiveData?: boolean;
}) {
  useLiveData(withoutLiveData);

  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };
  const pathname = useLocation().pathname;

  const renderMenuItem = (text: string) => {
    return (
      <ListItem key={text} disablePadding>
        <ListItemButton
          to={`/${text}`}
          component={Link}
          selected={pathname.startsWith(`/${text}`)}
        >
          <ListItemText
            primary={text === "definitions" ? "Functions" : pascalCase(text)}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  const drawer = (
    <div>
      <Toolbar>
        <Link to="/" style={{ display: "flex", alignItems: "center" }} data-testid="enschedule-logo">
          <img src={logo} alt="Enschedule" style={{ width: "100%" }} />
          {/* Schedule */}
        </Link>
      </Toolbar>
      <Divider />
      <Box pt={2} />
      <Box display="flex" justifyContent="center" px={2}>
        <NavLink
          to="/run"
          style={({ isActive }) => ({
            width: "100%",
            textDecoration: "none",
            cursor: isActive ? "default" : "pointer",
          })}
        >
          {({ isActive }) => (
            <Button
              variant="contained"
              endIcon={<AddIcon />}
              disabled={isActive}
              sx={{ width: "100%" }}
            >
              Run
            </Button>
          )}
        </NavLink>
      </Box>
      <ListSubheader>In database</ListSubheader>
      <List>{["schedules", "runs"].map(renderMenuItem)}</List>
      <Divider />
      <ListSubheader>On worker</ListSubheader>
      <List>{["definitions", "workers"].map(renderMenuItem)}</List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton
            to={"/settings"}
            component={Link}
            selected={pathname.startsWith("/settings")}
          >
            <ListItemText primary={"Settings"} />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );
  const [theme, setTheme] = useTheme();

  const container =
    typeof window !== "undefined" ? () => window.document.body : undefined;

  const location = useLocation();
  const currentTab =
    location.pathname !== "/" ? location.pathname.replace(/\/$/, "") : "/";

  const user = useUser();

  return (
    <Box
      sx={{
        display: "flex",
      }}
    >
      <AppBar
        elevation={0}
        position="fixed"
        enableColorOnDark={true}
        color="transparent"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          // backdropFilter: 'blur(8px)',
          // boxShadown: 'none',
          // borderStyle: 'solid',
          // borderWidth: 0,
          // borderBottomWidth: 'thin',
          // borderColor: '#E7EBF0',
          // backgroundColor: 'rgba(255,255,255,0.8)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ width: "100%" }}>
            {breadcrumbs && <AppBreadcrumbs breadcrumbs={breadcrumbs} />}
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <IconButton
              sx={{ ml: 1 }}
              onClick={() => {
                setTheme((prevTheme) =>
                  prevTheme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT
                );
              }}
              color="inherit"
            >
              {theme === Theme.DARK ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
            <>
              {!user ? (
                <Button
                  color="inherit"
                  LinkComponent={RemixLink}
                  component={RemixLink}
                  data-testid="login-link"
                  to="/login"
                >
                  Login
                </Button>
              ) : (
                <IconButton
                  sx={{ ml: 1 }}
                  color="inherit"
                  LinkComponent={RemixLink}
                  component={RemixLink}
                  data-testid="profile-link"
                  to="/profile"
                >
                  <UserIcon />
                </IconButton>
              )}
            </>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* The implementation can be swapped with js to avoid SEO duplication of links. */}
        <Drawer
          container={container}
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: "100%", sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
        }}
      >
        <Box sx={navbar ? { backgroundColor: "background.paper" } : undefined}>
          <Toolbar />
          {navbar && (
            <Box
              sx={{
                px: 3,
                pt: 2,
                borderBottomWidth: "thin",
                borderBottomStyle: "solid",
                borderBottomColor: "divider",
              }}
            >
              <Box display="flex">
                <Box flex="1">
                  <Typography variant="h4" color="text.primary">
                    {navbar.title}
                  </Typography>
                  {navbar.subTitle && (
                    <>
                      <Box pt={1}></Box>
                      <Typography variant="body2" color="text.secondary">
                        {navbar.subTitle}
                      </Typography>
                    </>
                  )}
                </Box>
                {navbar.actions && (
                  <>
                    <Box pr={3}></Box>
                    <Box>{navbar.actions}</Box>
                  </>
                )}
              </Box>
              <Box pt={3}></Box>
              {navbar.tabs && (
                <Tabs value={currentTab}>
                  {navbar.tabs.map((tab) => (
                    <Tab
                      key={tab.to}
                      label={tab.label}
                      LinkComponent={RemixLink}
                      to={tab.to}
                      component={RemixLink}
                      value={tab.match?.find((m) => m === currentTab) ?? tab.to}
                    />
                  ))}
                </Tabs>
              )}
            </Box>
          )}
        </Box>
        <Box
          p={3}
          flex="1"
          display="flex"
          flexDirection="column"
          justifyContent="flex-start"
          alignItems="stretch"
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
