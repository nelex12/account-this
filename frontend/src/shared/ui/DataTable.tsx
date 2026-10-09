import type { ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  /** Optional column width, e.g. '22%' (table uses fixed layout) */
  width?: string;
  render: (row: T) => ReactNode;
}

export interface DataTablePagination {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Omit to render the table without a footer */
  pagination?: DataTablePagination;
}

/** Generic table built from default MUI components only. */
export default function DataTable<T>({ columns, rows, getRowId, pagination }: DataTableProps<T>) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.key} sx={{ width: column.width }}>
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowId(row)} hover>
              {columns.map((column) => (
                <TableCell key={column.key}>{column.render(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination && (
        <TablePagination
          component="div"
          count={pagination.count}
          page={pagination.page}
          rowsPerPage={pagination.rowsPerPage}
          rowsPerPageOptions={[]}
          onPageChange={(_, page) => pagination.onPageChange(page)}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
        />
      )}
    </TableContainer>
  );
}