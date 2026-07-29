import { Box, CircularProgress, Typography } from "@mui/material";

export function Loading({ label = "Loading Enschedule" }: { label?: string }) {
  return (
    <Box minHeight="240px" display="grid" sx={{ placeItems: "center" }}>
      <Box display="flex" alignItems="center" gap={2}>
        <CircularProgress size={28} />
        <Typography>{label}</Typography>
      </Box>
    </Box>
  );
}
