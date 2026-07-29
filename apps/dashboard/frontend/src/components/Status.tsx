
import { Tooltip, Typography } from "@mui/material";
import { sentenceCase } from "sentence-case";

const icons: Record<string, string> = {
  FAILED: "!",
  SCHEDULED: "◷",
  UNSCHEDULED: "○",
  RETRYING: "↻",
  RUNNING: "▶",
  SUCCESS: "✓",
  NO_WORKER: "!",
  LOST: "?",
  PENDING: "!",
  UP: "✓",
  DOWN: "×",
};

const colors: Record<string, string> = {
  SUCCESS: "success.main",
  UP: "success.main",
  RUNNING: "info.main",
  SCHEDULED: "info.main",
  RETRYING: "warning.main",
  PENDING: "warning.main",
  FAILED: "error.main",
  DOWN: "error.main",
  NO_WORKER: "error.main",
  LOST: "text.secondary",
  UNSCHEDULED: "text.secondary",
};

export function Status({ value }: { value: string }) {
  return (
    <Tooltip title={sentenceCase(value)} disableInteractive>
      <Typography
        component="span"
        variant="inherit"
        data-testid="status"
        data-status={value}
        sx={{ color: colors[value] ?? "text.primary", cursor: "default", fontWeight: 700 }}
      >
        {icons[value] ?? value}
      </Typography>
    </Tooltip>
  );
}
