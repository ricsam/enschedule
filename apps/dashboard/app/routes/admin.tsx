import { type UserSchema } from "@enschedule/types";
import { Paper } from "@mui/material";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type {
  ActionFunction,
  LoaderFunctionArgs,
  SerializeFrom,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import type { ColumnDef} from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import React from "react";
import { z } from "zod";
import { RootLayout } from "~/components/Layout";
import { ExpandableTable } from "~/components/Table";
import { getWorker } from "~/createWorker.server";
import { getAuthHeader } from "~/sessions";
import type { Breadcrumb } from "~/types";
import { authenticate } from "~/utils/user.server";

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [{ title: "Admin area", href: "/admin" }];
};

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
  const session = await authenticate(request);
  if (!session || !session.user.admin) {
    const url = new URL(request.url);
    url.pathname = "/login";
    url.search = "";
    const redirectUrl = new URL(request.url);
    url.searchParams.set("redirect", redirectUrl.pathname + redirectUrl.search);
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  const users = await (
    await getWorker(context.worker)
  ).getUsers(session.authHeader);

  return json({ users });
};

export const action: ActionFunction = async ({ request, context }) => {
  const fd = await request.formData();
  const action = z
    .union([z.literal("reset-enschedule"), z.literal("placeholder")])
    .parse(fd.get("action"));
  const authHeader = await getAuthHeader(request);
  if (action === "reset-enschedule") {
    let success = await (await getWorker(context.worker)).reset(authHeader);
    return json({ success });
  }
  return json({ success: false });
};

type RowData = SerializeFrom<z.output<typeof UserSchema>>;
const columnHelper = createColumnHelper<RowData>();

const columns: ColumnDef<RowData, any>[] = [
  columnHelper.accessor("username", {
    header: "Username",
  }),
  columnHelper.accessor("name", {
    header: "Name",
  }),
  columnHelper.accessor("email", {
    header: "Email",
  }),
  columnHelper.accessor("admin", {
    header: "Admin",
    cell: (info) => {
      return info.getValue() ? "Yes" : "No";
    },
  }),
  columnHelper.accessor("createdAt", {
    header: "Created At",
    cell: (info) => {
      return new Date(info.getValue()).toLocaleString();
    },
  }),
];

export default function AdminArea() {
  const bc = useBreadcrumbs();
  const data = useLoaderData<typeof loader>();
  if ("error" in data) {
    return (
      <RootLayout breadcrumbs={bc}>
        <Box>
          <Typography variant="h4">Unauthorized</Typography>
          <Box py={2}>
            <Typography variant="body2">
              You are not authorized to access this page
            </Typography>
          </Box>
        </Box>
      </RootLayout>
    );
  }
  return (
    <RootLayout breadcrumbs={bc}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Box>
          <Typography variant="h5">Users</Typography>
          <Box pb={1.5} />
          <Stack sx={{ width: "100%" }} spacing={2}>
            <Paper>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  pt: 2,
                  pr: 2,
                  pb: 2,
                }}
              >
                <Button variant="outlined">Create user</Button>
              </Box>
              <ExpandableTable
                columns={columns}
                rows={data.users}
                title="Users"
              />
            </Paper>
          </Stack>
        </Box>
        <Box>
          <Typography variant="h5">Danger Zone</Typography>
          <Box pb={1.5} />
          <Stack sx={{ width: "100%" }} spacing={2}>
            <Alert
              variant="outlined"
              severity="error"
              action={<DeleteButton />}
            >
              <AlertTitle>Reset Enscheudle</AlertTitle>
              Delete all runs, schedules and workers in the system
            </Alert>
          </Stack>
        </Box>
      </Box>
    </RootLayout>
  );
}

function DeleteButton() {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Button
        color="inherit"
        size="small"
        variant="outlined"
        data-testid="reset-enschedule"
        onClick={handleClickOpen}
      >
        Delete
      </Button>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>
          {"Are you sure you want to reset Enschedule?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will delete all runs, schedules and workers
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Form method="post">
            <Button
              onClick={handleClose}
              autoFocus
              data-testid="confirm-reset-enschedule"
              type="submit"
              color="error"
            >
              Reset Enschedule
            </Button>
            <input type="hidden" name="action" value="reset-enschedule" />
          </Form>
        </DialogActions>
      </Dialog>
    </>
  );
}
