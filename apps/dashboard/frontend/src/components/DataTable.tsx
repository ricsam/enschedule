import React from "react";
import {
  Box,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Typography,
} from "@mui/material";

export interface Column<T> {
  label: string;
  render: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id: number | string }>({
  id,
  title,
  rows,
  columns,
  selected,
  onSelected,
  actions,
}: {
  id: string;
  title: string;
  rows: T[];
  columns: Column<T>[];
  selected?: Set<number | string>;
  onSelected?: (selected: Set<number | string>) => void;
  actions?: React.ReactNode;
}) {
  const toggle = (rowId: number | string) => {
    if (!selected || !onSelected) return;
    const next = new Set(selected);
    next.has(rowId) ? next.delete(rowId) : next.add(rowId);
    onSelected(next);
  };
  return (
    <Paper id={id}>
      <Toolbar>
        <Typography variant="h6" flex={1}>{title}</Typography>
        {actions}
      </Toolbar>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {selected && <TableCell padding="checkbox" />}
              {columns.map((column) => <TableCell key={column.label}>{column.label}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.id} data-testid={`table-row-${index + 1}`} hover>
                {selected && (
                  <TableCell padding="checkbox">
                    <Checkbox checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                  </TableCell>
                )}
                {columns.map((column) => <TableCell key={column.label}>{column.render(row)}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {rows.length === 0 && <Box p={3} textAlign="center" color="text.secondary">No {title.toLowerCase()} found.</Box>}
    </Paper>
  );
}
