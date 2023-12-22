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
import type { ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form } from "@remix-run/react";
import React from "react";
import { z } from "zod";
import { RootLayout } from "~/components/Layout";
import { getWorker } from "~/createWorker";
import type { Breadcrumb } from "~/types";

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [{ title: "Settings", href: "/settings" }];
};

export const action: ActionFunction = async ({ request, context }) => {
  const fd = await request.formData();
  const action = z
    .union([z.literal("reset-enschedule"), z.literal("placeholder")])
    .parse(fd.get("action"));
  if (action === "reset-enschedule") {
    await (await getWorker(context.worker)).reset();
  }
  return json({ success: true });
};

export default function Settings() {
  return (
    <RootLayout breadcrumbs={useBreadcrumbs()}>
      <Box sx={{ maxWidth: 600 }}>
        <Typography variant="h5">Danger Zone</Typography>
        <Box pb={1.5} />
        <Stack sx={{ width: "100%" }} spacing={2}>
          <Alert variant="outlined" severity="error" action={<DeleteButton />}>
            <AlertTitle>Reset Enscheudle</AlertTitle>
            Delete all runs, schedules and workers in the system
          </Alert>
        </Stack>
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
