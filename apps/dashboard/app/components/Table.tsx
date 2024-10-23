import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import type { PaperProps } from "@mui/material/Paper";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import { visuallyHidden } from "@mui/utils";
import type {
  ColumnDef,
  ExpandedState,
  Row,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React from "react";
import { EnhancedTableToolbar, TableProvider } from "./EnhancedTableToolbar";
import { usePagination } from "./usePagination";

export const checkboxCol = <T,>(): ColumnDef<T> => ({
  id: "select",
  header: ({ table }) => (
    <Checkbox
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
});

export const expandCol = <T,>(): ColumnDef<T> => ({
  id: "expand",
  header: ({ table }) => (
    <IconButton
      aria-label="expand row"
      size="small"
      onClick={table.getToggleAllRowsExpandedHandler()}
    >
      {table.getIsAllRowsExpanded() ? (
        <KeyboardArrowUpIcon />
      ) : table.getIsSomeRowsExpanded() ? (
        <KeyboardArrowRightIcon />
      ) : (
        <KeyboardArrowDownIcon />
      )}
    </IconButton>
  ),
  cell: ({ row }) => (
    <IconButton
      aria-label="expand row"
      size="small"
      onClick={(ev) => {
        ev.stopPropagation();
        row.toggleExpanded();
      }}
    >
      {row.getIsExpanded() ? (
        <KeyboardArrowUpIcon />
      ) : (
        <KeyboardArrowDownIcon />
      )}
    </IconButton>
  ),
});

export function ExpandableTable<T>({
  rows,
  renderRow,
  columns: _columns,
  title,
  defaultSorting,
  msButtons,
  ToolbarWrapper: _ToolbarWrapper,
  count,
  ...paperProps
}: {
  rows: T[];
  title: React.ReactNode;
  defaultSorting?: SortingState;
  renderRow?: (row: Row<T>) => React.ReactNode;
  msButtons?: React.ReactNode;
  columns: ColumnDef<T, any>[];
  ToolbarWrapper?: React.ComponentType<{ children: React.ReactNode }>;
  count?: number;
} & PaperProps) {
  const columns = React.useMemo((): ColumnDef<T, any>[] => {
    const cols = [..._columns];
    if (renderRow) {
      cols.unshift(expandCol());
    }
    if (msButtons) {
      cols.unshift(checkboxCol());
    }
    return cols;
  }, [msButtons, _columns, renderRow]);
  const paginationFns = usePagination(defaultSorting);
  const {
    sorting,
    setSorting,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    clearPagination,
  } = paginationFns;
  // const [page, setPage] = React.useState(0);
  // const [rowsPerPage, setRowsPerPage] = React.useState(5);
  // const [sorting, setSorting] = React.useState<SortingState>([]);
  // const clearPagination = () => {};

  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  const pagination = React.useMemo(
    () => ({
      pageIndex: page,
      pageSize: rowsPerPage,
    }),
    [page, rowsPerPage]
  );

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const rowLen = count ?? rows.length;

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: msButtons ? setRowSelection : undefined,
    manualPagination: count !== undefined,
    manualSorting: count !== undefined,
    enableExpanding: !!renderRow,
    pageCount: Math.ceil(rowLen / pagination.pageSize),
    state: {
      sorting,
      expanded: renderRow ? expanded : undefined,
      pagination,
      rowSelection: rowSelection,
    },
    onExpandedChange: renderRow ? setExpanded : undefined,
    getExpandedRowModel: renderRow ? getExpandedRowModel() : undefined,
  });

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(Number(event.target.value));
    setPage(0);
  };

  if (page * rowsPerPage >= rowLen && page > 0) {
    return (
      <Box sx={{ maxWidth: 600 }}>
        <Box pb={1.5} />
        <Stack sx={{ width: "100%" }} spacing={2}>
          <Alert
            variant="outlined"
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                onClick={clearPagination}
                sx={{ whiteSpace: "nowrap" }}
              >
                Go back
              </Button>
            }
          >
            <AlertTitle>Pagination is out of range</AlertTitle>
            There are only {rowLen} rows in this table, and you want to view
            page {page + 1} with {rowsPerPage} rows per page.
          </Alert>
        </Stack>
      </Box>
    );
  }

  const ToolbarWrapper = _ToolbarWrapper ? _ToolbarWrapper : React.Fragment;

  return (
    <Paper sx={{ width: "100%", mb: 2 }} {...paperProps}>
      <TableProvider
        selected={Object.keys(rowSelection)}
        table={table}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
        {...paginationFns}
      >
        <ToolbarWrapper>
          <EnhancedTableToolbar
            title={title}
            totalCount={rowLen}
            retrieved={rows.length}
            msButtons={msButtons}
          />
        </ToolbarWrapper>
      </TableProvider>
      <TableContainer>
        <Table sx={{ minWidth: 750 }} size={"small"}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup, index) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSorted =
                    header.column.id === "select" ||
                    header.column.id === "expand"
                      ? false
                      : header.column.getIsSorted();
                  let children = (
                    <>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {!(
                        header.column.id === "select" ||
                        header.column.id === "expand"
                      ) && isSorted ? (
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
                      sx={{
                        whiteSpace: "nowrap",
                      }}
                      key={header.id}
                      align="left"
                      padding={
                        header.column.id === "select" ||
                        header.column.id === "expand"
                          ? "checkbox"
                          : "normal"
                      }
                      sortDirection={isSorted}
                    >
                      {!(
                        header.column.id === "select" ||
                        header.column.id === "expand"
                      ) ? (
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
          <TableBody>
            {table.getRowModel().rows.map((row, index) => {
              const isItemSelected = row.getIsExpanded();
              const labelId = `enhanced-table-checkbox-${index}`;
              const open = row.getIsExpanded();
              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-testid={`table-row-${index + 1}`}
                    sx={
                      open || !renderRow
                        ? undefined
                        : { "&, .MuiTableCell-root": { borderBottom: "unset" } }
                    }
                    hover
                    onClick={() => {
                      row.toggleSelected();
                    }}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    selected={isItemSelected}
                  >
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <TableCell
                          sx={{
                            whiteSpace: "nowrap",
                          }}
                          id={labelId}
                          scope="row"
                          key={cell.id}
                          padding={
                            cell.column.id === "select" ||
                            cell.column.id === "expand"
                              ? "checkbox"
                              : "normal"
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
                  {renderRow ? (
                    <TableRow>
                      <TableCell
                        style={{ paddingBottom: 0, paddingTop: 0 }}
                        colSpan={columns.length}
                      >
                        <Collapse in={open} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>{renderRow(row)}</Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        data-testid="pagination"
        data-rows-per-page={rowsPerPage}
        component="div"
        count={rowLen}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
}
