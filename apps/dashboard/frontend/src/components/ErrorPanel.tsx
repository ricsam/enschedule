import { Alert, AlertTitle, Button } from "@mui/material";

export function ErrorPanel({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Alert severity="error" action={retry ? <Button onClick={retry}>Retry</Button> : undefined}>
      <AlertTitle>Unable to load Enschedule</AlertTitle>
      {error instanceof Error ? error.message : String(error)}
    </Alert>
  );
}
