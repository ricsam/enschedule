import { Cloud, FilterList as FilterListIcon } from "@mui/icons-material";
import { Popover, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import { alpha } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useSearchParams } from "@remix-run/react";
import type { RowSelectionState, Table } from "@tanstack/react-table";
import React from "react";

const SelectedContext = React.createContext<
  | undefined
  | {
      selected: string[];
      table: Table<any>;
      rowSelection: RowSelectionState;
      setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
    }
>(undefined);

export const useSelected = () => {
  const ctx = React.useContext(SelectedContext);
  if (!ctx) {
    throw new Error(
      "You must wrap this component in a SelectedProvider before using this hook"
    );
  }
  return ctx;
};

export const SelectedProvider = ({
  children,
  selected,
  table,
  rowSelection,
  setRowSelection,
}: {
  selected: string[];
  children: React.ReactNode;
  table: Table<any>;
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
}) => {
  return (
    <SelectedContext.Provider
      value={{ selected, table, rowSelection, setRowSelection }}
    >
      {children}
    </SelectedContext.Provider>
  );
};

export function EnhancedTableToolbar({
  title,
  totalCount,
  retrieved,
  msButtons,
}: {
  title: React.ReactNode;
  totalCount: number;
  retrieved: number;
  msButtons?: React.ReactNode;
}) {
  const { selected } = useSelected();
  const numSelected = selected.length;
  const isSelected = numSelected > 0;

  return (
    <Toolbar
      variant="dense"
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
        ...(isSelected && {
          bgcolor: (theme) =>
            alpha(
              theme.palette.primary.main,
              theme.palette.action.activatedOpacity
            ),
        }),
      }}
    >
      {isSelected ? (
        <Typography
          sx={{ flex: "1 1 100%" }}
          color="inherit"
          variant="subtitle1"
          component="div"
        >
          {numSelected} selected
        </Typography>
      ) : (
        <Typography
          sx={{ flex: "1 1 100%" }}
          variant="h6"
          id="tableTitle"
          component="div"
        >
          {title}
        </Typography>
      )}
      {isSelected ? (
        <Box display="flex" gap={2} whiteSpace="nowrap">
          {msButtons}
        </Box>
      ) : null}
      {!isSelected && (
        <Box display="flex" gap={2} alignItems="center" pr={1}>
          <Box display="flex" gap={1} alignItems="center">
            <FilterButton />
            <Typography color="text.primary" variant="body2">
              {new Intl.NumberFormat("en-GB").format(retrieved)}
            </Typography>
          </Box>
          <Box display="flex" gap={1} alignItems="center">
            <Cloud color={"action"} fontSize="small" />
            <Typography
              color="text.primary"
              variant="body2"
              data-puppeteer-id="rows-in-db"
            >
              {new Intl.NumberFormat("en-GB").format(totalCount)}
            </Typography>
          </Box>
        </Box>
      )}
    </Toolbar>
  );
}

function FilterButton() {
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(
    null
  );

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const [searchParams, setSearchParams] = useSearchParams();

  const limit: number = Math.max(Number(searchParams.get("limit")) || 500, 0);
  const offset: number = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const setLimit = (limit: number) => {
    setSearchParams((params) => {
      params.set("limit", String(limit));
      return params;
    });
  };

  const setOffset = (offset: number) => {
    setSearchParams((params) => {
      params.set("offset", String(offset));
      return params;
    });
  };

  return (
    <>
      <IconButton size="small" onClick={handleClick}>
        <FilterListIcon fontSize="small" />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        <TextField
          label="Limit"
          type="number"
          variant="filled"
          value={limit}
          onChange={(ev) => {
            setLimit(Number(ev.target.value));
          }}
        />
        <TextField
          label="Offset"
          type="number"
          variant="filled"
          value={offset}
          onChange={(ev) => {
            setOffset(Number(ev.target.value));
          }}
        />
      </Popover>
    </>
  );
}
