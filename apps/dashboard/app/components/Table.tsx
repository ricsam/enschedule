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
import { useSearchParams } from "@remix-run/react";
import type {
  ColumnDef,
  ExpandedState,
  OnChangeFn,
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
import { EnhancedTableToolbar, SelectedProvider } from "./EnhancedTableToolbar";

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

const usePagination = (defaultSorting?: SortingState) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const getSorting = (): SortingState => {
    return (searchParams.getAll("sorting") ?? defaultSorting ?? []).map(
      (value) => {
        const [id, sorting] = value.split(".");
        return {
          id,
          desc: sorting === "desc",
        };
      }
    );
  };

  const stringifySorting = (sorting: SortingState) => {
    return sorting
      .map((s) => `${s.id}.${s.desc ? "desc" : "asc"}`)
      .sort()
      .join("&");
  };

  const newSorting = getSorting();
  const sortingRef = React.useRef<SortingState>(newSorting);

  if (!sortingRef.current) {
    sortingRef.current = getSorting();
  }

  if (stringifySorting(newSorting) !== stringifySorting(sortingRef.current)) {
    sortingRef.current = newSorting;
  }

  /**
   * 1 indexed in url, 0 indexed in api
   */
  const page: number = Math.max((Number(searchParams.get("page")) || 1) - 1, 0);
  const rowsPerPage: number = Number(searchParams.get("rowsPerPage")) || 25;

  const setSorting: OnChangeFn<SortingState> = (newSortingFn) => {
    let newSorting =
      typeof newSortingFn === "function"
        ? newSortingFn(sortingRef.current)
        : newSortingFn;

    setSearchParams(
      (prevParams) => {
        prevParams.delete("sorting");
        newSorting.forEach((sorting) => {
          prevParams.append(
            "sorting",
            `${sorting.id}.${sorting.desc ? "desc" : "asc"}`
          );
        });
        return prevParams;
      },
      {
        replace: true,
      }
    );
  };

  const setPage = (page: number) => {
    setSearchParams(
      (prevParams) => {
        // 1 indexed in url, 0 index in pagination api
        prevParams.set("page", String(page + 1));
        return prevParams;
      },
      {
        replace: true,
      }
    );
  };
  const setRowsPerPage = (page: number) => {
    setSearchParams(
      (prevParams) => {
        prevParams.set("rowsPerPage", String(page));
        return prevParams;
      },
      {
        replace: true,
      }
    );
  };

  const clearPagination = () => {
    setSearchParams(
      () => {
        return new URLSearchParams();
      },
      {
        replace: true,
      }
    );
  };

  return {
    sorting: sortingRef.current,
    setSorting,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    clearPagination,
  };
};

export function ExpandableTable<T>({
  rows,
  renderRow,
  columns: _columns,
  title,
  defaultSorting,
  msButtons,
  ...paperProps
}: {
  rows: T[];
  title: React.ReactNode;
  defaultSorting?: SortingState;
  renderRow?: (row: Row<T>) => React.ReactNode;
  msButtons?: React.ReactNode;
  columns: ColumnDef<T, any>[];
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
  const {
    sorting,
    setSorting,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    clearPagination,
  } = usePagination(defaultSorting);
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

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: msButtons ? setSorting : undefined,
    getSortedRowModel: msButtons ? getSortedRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    enableExpanding: !!renderRow,
    pageCount: Math.ceil(rows.length / pagination.pageSize),
    state: {
      sorting: msButtons ? sorting : undefined,
      expanded: renderRow ? expanded : undefined,
      pagination,
      rowSelection,
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

  if (page * rowsPerPage >= rows.length && page > 0) {
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
            There are only {rows.length} rows in this table, and you want to
            view page {page + 1} with {rowsPerPage} rows per page.
          </Alert>
        </Stack>
      </Box>
    );
  }

  return (
    <Paper sx={{ width: "100%", mb: 2 }} {...paperProps}>
      <SelectedProvider
        selected={Object.keys(rowSelection)}
        table={table}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
      >
        <EnhancedTableToolbar
          title={title}
          totalCount={rows.length}
          retrieved={rows.length}
          msButtons={msButtons}
        />
      </SelectedProvider>
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
                          component="th"
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
        component="div"
        count={rows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
}
