// src/pages/tools/ToolsPage.tsx
import { useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import TablePagination from '@mui/material/TablePagination';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import StatusBadge from '../../shared/ui/StatusBadge';
import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable';
import { SearchIcon } from '../../shared/Icons';

import { useTools } from '../../api/tools';
import {
  formatUnix,
  getToolLocation,
  isFaulty,
  isIssued,
  type Tool,
} from '../../entities/toolsModel';

import ToolCard from './ToolCard';
import { conditionBadge } from './toolCondition';

/* ----------------------------------- Data ----------------------------------- */

type ToolFilter = 'all' | 'inStock' | 'issued' | 'faulty';

const filters: { value: ToolFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'inStock', label: 'На месте' },
  { value: 'issued', label: 'На руках' },
  { value: 'faulty', label: 'Неисправные' },
];

const filterPredicates: Record<ToolFilter, (tool: Tool) => boolean> = {
  all: () => true,
  inStock: (tool) => !isIssued(tool),
  issued: isIssued,
  faulty: isFaulty,
};

const columns: DataTableColumn<Tool>[] = [
  {
    key: 'tool',
    label: 'ИНСТРУМЕНТ',
    width: '36%',
    render: (tool) => <Typography>{tool.name}</Typography>,
  },
  {
    key: 'condition',
    label: 'СОСТОЯНИЕ',
    width: '16%',
    render: (tool) => <StatusBadge {...conditionBadge[tool.condition]} />,
  },
  {
    key: 'location',
    label: 'МЕСТОПОЛОЖЕНИЕ',
    width: '20%',
    render: (tool) => getToolLocation(tool),
  },
  {
    key: 'heldSince',
    label: 'НА РУКАХ С',
    width: '16%',
    render: (tool) =>
      tool.heldSince !== null ? (
        <Typography color="text.secondary">
          {formatUnix(tool.heldSince)}
        </Typography>
      ) : (
        <Typography color="text.secondary">—</Typography>
      ),
  },
  {
    key: 'actions',
    label: 'ДЕЙСТВИЯ',
    width: '15%',
    render: () => <Button>Подробнее</Button>,
  },
];

const ROWS_PER_PAGE = 8;

/* ----------------------------------- Page ----------------------------------- */

export default function ToolsPage() {
  const theme = useTheme();
  // Same breakpoint as AppLayout / TopAppBar: phones get cards instead of a table
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { data: tools, isLoading, error } = useTools();

  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<ToolFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filteredTools = useMemo(() => {
    if (!tools) return [];
    const q = query.trim().toLowerCase();
    return tools.filter(
      (tool) =>
        filterPredicates[filter](tool) &&
        (!q || tool.name.toLowerCase().includes(q)),
    );
  }, [tools, filter, query]);

  const pageTools = filteredTools.slice(
    page * ROWS_PER_PAGE,
    (page + 1) * ROWS_PER_PAGE,
  );

  const handleFilterChange = (value: ToolFilter) => {
    setFilter(value);
    setPage(0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(0);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Не удалось загрузить инструменты</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={isMobile ? 2 : 3} sx={{ p: isMobile ? 2 : 3 }}>
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
        <Tab label="Таблица" />
        <Tab label="Стенд" />
      </Tabs>

      {tab === 0 && (
        <>
          <Stack
            direction={isMobile ? 'column' : 'row'}
            spacing={2}
            sx={{ alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap' }}
          >
            <TextField
              type="search"
              label="Название"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              fullWidth={isMobile}
              sx={{ minWidth: isMobile ? 0 : 320 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* On phones the chips scroll horizontally instead of wrapping */}
            <Stack
              direction="row"
              spacing={1}
              sx={{
                overflowX: isMobile ? 'auto' : 'visible',
                pb: isMobile ? 0.5 : 0,
              }}
            >
              {filters.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  clickable
                  color={filter === value ? 'primary' : 'default'}
                  variant={filter === value ? 'filled' : 'outlined'}
                  onClick={() => handleFilterChange(value)}
                />
              ))}
            </Stack>
          </Stack>

          {isMobile ? (
            <>
              <Stack spacing={1.5}>
                {pageTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}

                {pageTools.length === 0 && (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    Ничего не найдено
                  </Typography>
                )}
              </Stack>

              <Box>
                <TablePagination
                  component="div"
                  count={filteredTools.length}
                  page={page}
                  rowsPerPage={ROWS_PER_PAGE}
                  rowsPerPageOptions={[]}
                  onPageChange={(_, nextPage) => setPage(nextPage)}
                  labelDisplayedRows={({ from, to, count }) =>
                    `${from}–${to} из ${count}`
                  }
                />
              </Box>
            </>
          ) : (
            <DataTable
              columns={columns}
              rows={pageTools}
              getRowId={(tool) => tool.id}
              pagination={{
                count: filteredTools.length,
                page,
                rowsPerPage: ROWS_PER_PAGE,
                onPageChange: setPage,
              }}
            />
          )}
        </>
      )}
    </Stack>
  );
}