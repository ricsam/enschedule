import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Checkbox,
  Collapse,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Toolbar,
  Typography,
  alpha,
} from "@mui/material";
import type { ColumnDef, Row, RowSelectionState, SortingState } from "@tanstack/react-table";
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

export interface ClientTableProps<T extends { id: number | string }> {
  id?: string;
  rows: T[];
  columns: ColumnDef<T, any>[];
  title: React.ReactNode;
  defaultSorting?: SortingState;
  renderRow?: (row: Row<T>) => React.ReactNode;
  actions?: (selectedRows: T[], clear: () => void) => React.ReactNode;
  searchable?: boolean;
  initialPageSize?: number;
}

export function ClientTable<T extends { id: number | string }>({
  id,
  rows,
  columns: suppliedColumns,
  title,
  defaultSorting = [],
  renderRow,
  actions,
  searchable = true,
  initialPageSize = 25,
}: ClientTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(defaultSorting);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [expanded, setExpanded] = React.useState({});
  const [{ pageIndex, pageSize }, setPagination] = React.useState({ pageIndex: 0, pageSize: initialPageSize });

  const columns = React.useMemo<ColumnDef<T, any>[]>(() => {
    const result = [...suppliedColumns];
    if (renderRow) {
      result.unshift({
        id: "expand",
        header: ({ table }) => (
          <IconButton size="small" aria-label="Expand all rows" onClick={table.getToggleAllRowsExpandedHandler()}>
            {table.getIsAllRowsExpanded() ? <KeyboardArrowUpIcon /> : table.getIsSomeRowsExpanded() ? <KeyboardArrowRightIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        ),
        cell: ({ row }) => (
          <IconButton size="small" aria-label="Expand row" onClick={(event) => { event.stopPropagation(); row.toggleExpanded(); }}>
            {row.getIsExpanded() ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        ),
        enableSorting: false,
      });
    }
    if (actions) {
      result.unshift({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(event) => event.stopPropagation()}
          />
        ),
        enableSorting: false,
      });
    }
    return result;
  }, [actions, renderRow, suppliedColumns]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, rowSelection, expanded, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: renderRow ? getExpandedRowModel() : undefined,
  });

  React.useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(table.getFilteredRowModel().rows.length / pageSize) - 1);
    if (pageIndex > lastPage) setPagination((value) => ({ ...value, pageIndex: lastPage }));
  }, [pageIndex, pageSize, rows.length, globalFilter, table]);

  const selectedRows = table.getSelectedRowModel().flatRows.map((row) => row.original);
  const clearSelection = () => setRowSelection({});
  const specialColumn = (id: string) => id === "select" || id === "expand";

  return (
    <Paper id={id} sx={{ width: "100%", mb: 2, overflow: "hidden" }}>
      <Toolbar
        variant="dense"
        sx={{
          gap: 2,
          pl: { sm: 2 },
          pr: { xs: 1, sm: 1 },
          ...(selectedRows.length > 0 && { bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity) }),
        }}
      >
        <Typography variant="h6" component="div" sx={{ flex: "1 1 100%" }} data-testid="num-selected">
          {selectedRows.length ? `${selectedRows.length} selected` : title}
        </Typography>
        {selectedRows.length ? (
          <Box display="flex" alignItems="center" gap={1} whiteSpace="nowrap">{actions?.(selectedRows, clearSelection)}</Box>
        ) : (
          <Box display="flex" alignItems="center" gap={2}>
            {searchable && (
              <TextField
                size="small"
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder="Filter rows"
                inputProps={{ "aria-label": "Filter rows" }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            )}
            <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
              {table.getFilteredRowModel().rows.length} of {rows.length}
            </Typography>
          </Box>
        )}
      </Toolbar>
      <TableContainer>
        <Table size="small" sx={{ minWidth: 750 }}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = specialColumn(header.column.id) ? false : header.column.getIsSorted();
                  const content = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext());
                  return (
                    <TableCell key={header.id} padding={specialColumn(header.column.id) ? "checkbox" : "normal"} sortDirection={sorted || false} sx={{ whiteSpace: "nowrap" }}>
                      {specialColumn(header.column.id) || !header.column.getCanSort() ? content : (
                        <TableSortLabel active={!!sorted} direction={sorted || "asc"} onClick={header.column.getToggleSortingHandler()}>{content}</TableSortLabel>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.map((row, index) => (
              <React.Fragment key={row.id}>
                <TableRow className="table-row" data-testid={`table-row-${index + 1}`} hover selected={row.getIsSelected()} onClick={() => actions && row.toggleSelected()}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} padding={specialColumn(cell.column.id) ? "checkbox" : "normal"} sx={{ whiteSpace: "nowrap" }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {renderRow && (
                  <TableRow>
                    <TableCell colSpan={columns.length} sx={{ py: 0 }}>
                      <Collapse in={row.getIsExpanded()} timeout="auto" unmountOnExit><Box m={1}>{renderRow(row)}</Box></Collapse>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {table.getFilteredRowModel().rows.length === 0 && <Box p={3} textAlign="center" color="text.secondary">No matching rows.</Box>}
      <TablePagination
        data-testid="pagination"
        data-rows-per-page={pageSize}
        component="div"
        count={table.getFilteredRowModel().rows.length}
        rowsPerPage={pageSize}
        page={pageIndex}
        rowsPerPageOptions={[10, 25, 50, 100]}
        onPageChange={(_event, nextPage) => setPagination((value) => ({ ...value, pageIndex: nextPage }))}
        onRowsPerPageChange={(event) => setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })}
      />
    </Paper>
  );
}
