import { FilterList as FilterListIcon } from "@mui/icons-material";
import { Button } from "@mui/material";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import { alpha } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import { Link as RemixLink, useFetcher } from "@remix-run/react";
import type {
  ColumnDef,
  RowSelectionState,
  SortingState,
  Table as TanTable,
} from "@tanstack/react-table";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { formatDate } from "~/utils/formatDate";
import type { SerializeFrom } from "@remix-run/node";
import type { PublicJobSchedule } from "@enschedule/types";

export type RowData = SerializeFrom<PublicJobSchedule>;

const columnHelper = createColumnHelper<RowData>();

const columns: ColumnDef<RowData, any>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        sx={{ p: 0 }}
        {...{
          checked: table.getIsAllRowsSelected(),
          indeterminate: table.getIsSomeRowsSelected(),
          onChange: table.getToggleAllRowsSelectedHandler(),
        }}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        {...{
          checked: row.getIsSelected(),
          indeterminate: row.getIsSomeSelected(),
          onChange: row.getToggleSelectedHandler(),
        }}
      />
    ),
  },
  columnHelper.accessor("title", {
    cell: (info) => {
      const scheduleId = info.row.original.id;
      return (
        <MuiLink
          to={String(scheduleId)}
          component={RemixLink}
          onClick={(ev) => ev.stopPropagation()}
          data-testid="schedule-link"
        >
          {info.getValue()}
        </MuiLink>
      );
    },
    header: "Title",
  }),
  columnHelper.accessor("description", {
    cell: (info) => {
      return info.getValue();
    },
    header: "Description",
  }),
  columnHelper.accessor("runAt", {
    cell: (info) => {
      const value = formatDate(new Date(info.getValue()), false);
      return value.label;
    },
    header: "Next scheduled run",
  }),
  columnHelper.accessor(
    (data) => {
      return data.lastRun?.startedAt ?? "-";
    },
    {
      cell: (info) => {
        const lastRun = info.getValue();
        if (lastRun === "-") {
          return "-";
        }
        const value = formatDate(new Date(info.getValue()), false);
        return value.label;
      },
      header: "Last run",
    }
  ),
  columnHelper.accessor("numRuns", {
    cell: (info) => {
      return info.getValue();
    },
    header: "Number of runs",
  }),
  columnHelper.accessor("jobDefinition.title", {
    cell: (info) => {
      return info.getValue();
    },
    header: "Job definition",
  }),
];

interface EnhancedTableProps {
  rowCount: number;
  table: TanTable<RowData>;
}

function EnhancedTableHead(props: EnhancedTableProps) {
  const { table } = props;

  return (
    <TableHead>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id} sx={{ whiteSpace: "nowrap" }}>
          {headerGroup.headers.map((header) => {
            const isCheckbox = header.column.id === "select";
            const isSorted = isCheckbox ? false : header.column.getIsSorted();
            let children = (
              <>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                {isCheckbox && isSorted ? (
                  <Box component="span" sx={visuallyHidden}>
                    {isSorted === "desc"
                      ? "sorted descending"
                      : "sorted ascending"}
                  </Box>
                ) : null}
              </>
            );
            return (
              <TableCell
                key={header.id}
                align="left"
                padding={isCheckbox ? "checkbox" : "normal"}
                sortDirection={isSorted}
              >
                {!isCheckbox ? (
                  <TableSortLabel
                    active={!!isSorted}
                    direction={isSorted || "asc"}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {children}
                  </TableSortLabel>
                ) : (
                  children
                )}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </TableHead>
  );
}

function EnhancedTableToolbar({
  selected,
  table,
}: {
  selected: string[];
  table: TanTable<RowData>;
}) {
  const numSelected = selected.length;
  const isSelected = numSelected > 0;

  const fetcher = useFetcher();

  const submit = (action: "delete" | "run") => {
    const formData = new FormData();
    formData.set("action", action);
    const selected = table
      .getSelectedRowModel()
      .rows.map(({ original: { id } }) => id);
    selected.forEach((selected) => {
      formData.append("schedule", String(selected));
    });
    fetcher.submit(formData, { method: "post", action: "/schedules?index" });
  };

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
          Schedules
        </Typography>
      )}
      {isSelected ? (
        <Box display="flex" gap={2} whiteSpace="nowrap">
          <Button variant="text" color="inherit">
            Edit data
          </Button>
          <Button variant="text" color="inherit">
            Unschedule
          </Button>
          <Button
            variant="text"
            color="inherit"
            onClick={() => {
              submit("run");
            }}
          >
            Run
          </Button>
          <Box
            borderRight={(theme) => `thin solid ${theme.palette.divider}`}
            height={32}
          />
          <Button
            variant="text"
            color="inherit"
            onClick={() => {
              submit("delete");
            }}
          >
            Delete
          </Button>
        </Box>
      ) : (
        <Tooltip title="Filter list">
          <IconButton>
            <FilterListIcon />
          </IconButton>
        </Tooltip>
      )}
    </Toolbar>
  );
}

export default function SchedulesTable({
  schedules,
}: {
  schedules: RowData[];
}) {
  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: "runAt",
      desc: true,
    },
  ]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const table = useReactTable({
    data: schedules,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
      sorting,
    },
  });

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box sx={{ width: "100%" }} id="SchedulesTable">
      <Paper sx={{ width: "100%", mb: 2 }}>
        <EnhancedTableToolbar
          selected={Object.keys(rowSelection)}
          table={table}
        />
        <TableContainer>
          <Table
            sx={{ minWidth: 750 }}
            aria-labelledby="tableTitle"
            size={"small"}
          >
            <EnhancedTableHead table={table} rowCount={schedules.length} />
            <TableBody>
              {table.getRowModel().rows.map((row, index) => {
                const isItemSelected = row.getIsSelected();
                const labelId = `enhanced-table-checkbox-${index}`;
                return (
                  <TableRow
                    data-testid={`table-row-${index + 1}`}
                    key={row.id}
                    hover
                    onClick={row.getToggleSelectedHandler()}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    selected={isItemSelected}
                  >
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <TableCell
                          component="th"
                          id={labelId}
                          scope="row"
                          key={cell.id}
                          padding={
                            cell.column.id === "select" ? "checkbox" : "normal"
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={schedules.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
}
