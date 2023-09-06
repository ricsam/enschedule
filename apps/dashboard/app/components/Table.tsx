import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper, { PaperProps } from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import { visuallyHidden } from '@mui/utils';
import type { ColumnDef, ExpandedState, Row, SortingState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import React from 'react';

export const checkboxCol = <T extends unknown>(): ColumnDef<T> => ({
  id: 'select',
  header: ({ table }) => (
    <IconButton aria-label="expand row" size="small" onClick={table.getToggleAllRowsExpandedHandler()}>
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
      {row.getIsExpanded() ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
    </IconButton>
  ),
});

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
  const [sorting, setSorting] = React.useState<SortingState>([]);
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

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Paper sx={{ width: '100%', mb: 2 }} {...paperProps}>
      <TableContainer>
        <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle" size={'small'}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isCheckbox = header.column.id === 'select';
                  const isSorted = isCheckbox ? false : header.column.getIsSorted();
                  let children = (
                    <>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {isCheckbox && isSorted ? (
                        <Box component="span" sx={visuallyHidden}>
                          {isSorted === 'desc' ? 'sorted descending' : 'sorted ascending'}
                        </Box>
                      ) : null}
                    </>
                  );
                  return (
                    <TableCell
                      key={header.id}
                      align="left"
                      padding={isCheckbox ? 'checkbox' : 'normal'}
                      sortDirection={isSorted}
                    >
                      {!isCheckbox ? (
                        <TableSortLabel
                          active={!!isSorted}
                          direction={isSorted || 'asc'}
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
                    sx={open ? undefined : { '&, .MuiTableCell-root': { borderBottom: 'unset' } }}
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
                          padding={cell.column.id === 'select' ? 'checkbox' : 'normal'}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={columns.length}>
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
