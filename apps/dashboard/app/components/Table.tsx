import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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

export const checkboxCol = <T,>(): ColumnDef<T> => ({
  id: "select",
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

const usePagination = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // const searchParams = new URLSearchParams();
  // const setSearchParams = (
  //   params: URLSearchParams | ((oldParams: URLSearchParams) => URLSearchParams)
  // ) => {};

  const getSorting = (): SortingState => {
    return (searchParams.getAll("sorting") ?? []).map((value) => {
      const [id, sorting] = value.split(".");
      return {
        id,
        desc: sorting === "desc",
      };
    });
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
  const rowsPerPage: number = Number(searchParams.get("rowsPerPage")) || 5;

  const setSorting: OnChangeFn<SortingState> = (newSortingFn) => {
    let newSorting =
      typeof newSortingFn === "function"
        ? newSortingFn(sortingRef.current)
        : newSortingFn;

    setSearchParams((prevParams) => {
      prevParams.delete("sorting");
      newSorting.forEach((sorting) => {
        prevParams.append(
          "sorting",
          `${sorting.id}.${sorting.desc ? "desc" : "asc"}`
        );
      });
      return prevParams;
    });
  };

  const setPage = (page: number) => {
    setSearchParams((prevParams) => {
      // 1 indexed in url, 0 index in pagination api
      prevParams.set("page", String(page + 1));
      return prevParams;
    });
  };
  const setRowsPerPage = (page: number) => {
    setSearchParams((prevParams) => {
      prevParams.set("rowsPerPage", String(page));
      return prevParams;
    });
  };

  const clearPagination = () => {
    setSearchParams(() => {
      return new URLSearchParams();
    });
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
  columns,
  ...paperProps
}: {
  rows: T[];
  renderRow: (row: Row<T>) => React.ReactNode;
  columns: ColumnDef<T, any>[];
} & PaperProps) {
  const {
    sorting,
    setSorting,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    clearPagination,
  } = usePagination();
  // const [page, setPage] = React.useState(0);
  // const [rowsPerPage, setRowsPerPage] = React.useState(5);
  // const [sorting, setSorting] = React.useState<SortingState>([]);
  // const clearPagination = () => {};

  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableExpanding: true,
    state: {
      sorting,
      expanded,
    },
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
  });

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
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
      <TableContainer>
        <Table sx={{ minWidth: 750 }} size={"small"}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup, index) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isCheckbox = header.column.id === "select";
                  const isSorted = isCheckbox
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
                      open
                        ? undefined
                        : { "&, .MuiTableCell-root": { borderBottom: "unset" } }
                    }
                    hover
                    onClick={() => {
                      row.toggleExpanded();
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
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        data-testid="pagination"
        rowsPerPageOptions={[5, 10, 25]}
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
