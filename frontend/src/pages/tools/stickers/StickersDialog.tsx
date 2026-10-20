// StickersDialog.tsx — "Печать/Загрузка наклеек".
//
// Pick tools (search, select all), pick the sticker size, then:
//   - "Печать"  : A4 sheet with a grid of stickers -> browser print dialog (also "Save as PDF")
//   - "Скачать" : 1 tool -> .png, several -> .zip of .png files
// The QR holds {"toolId","toolName"} (see buildToolSticker) — what the Worker's scanner reads.
// Written-off tools (isActive = false) are not listed: nobody needs a sticker for them.
import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { useTools } from '../../../api/tools';
import { DownloadIcon, PrintIcon, SearchIcon } from '../../../shared/Icons';
import {
  STICKER_SIZES,
  downloadBlob,
  printStickers,
  stickerFileName,
  stickerToPng,
  stickersToZip,
  type StickerSizeId,
} from './stickerRender';

interface StickersDialogProps {
  open: boolean;
  /** Tools ticked when the dialog opens. */
  preselectedIds?: string[];
  onClose: () => void;
}

export default function StickersDialog({ open, preselectedIds = [], onClose }: StickersDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const { data, isLoading, error } = useTools();
  const tools = useMemo(() => (data ?? []).filter((t) => t.isActive), [data]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sizeId, setSizeId] = useState<StickerSizeId>('M');
  const [busy, setBusy] = useState<'print' | 'download' | null>(null);
  const [failure, setFailure] = useState<string>();

  // Fresh state each time the dialog opens
  useEffect(() => {
    if (open) {
      setSelected(new Set(preselectedIds));
      setQuery('');
      setFailure(undefined);
    }
    // preselectedIds is only read at the moment of opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tools.filter((t) => t.name.toLowerCase().includes(q)) : tools;
  }, [tools, query]);

  const chosen = tools.filter((t) => selected.has(t.id));
  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));
  const widthMm = STICKER_SIZES.find((s) => s.id === sizeId)!.widthMm;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of visible) {
        if (allVisibleSelected) next.delete(t.id);
        else next.add(t.id);
      }
      return next;
    });

  const run = async (kind: 'print' | 'download') => {
    setBusy(kind);
    setFailure(undefined);
    try {
      if (kind === 'print') {
        await printStickers(chosen, widthMm);
      } else if (chosen.length === 1) {
        downloadBlob(await stickerToPng(chosen[0], widthMm), stickerFileName(chosen[0]));
      } else {
        downloadBlob(await stickersToZip(chosen, widthMm), 'stickers.zip');
      }
    } catch {
      setFailure(
        kind === 'print'
          ? 'Не удалось открыть печать. Попробуйте скачать наклейки'
          : 'Не удалось создать файл с наклейками',
      );
    } finally {
      setBusy(null);
    }
  };

  const canAct = chosen.length > 0 && busy === null;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>Печать/Загрузка наклеек</DialogTitle>
      <DialogContent dividers>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">Не удалось загрузить инструменты</Alert>}

        {!isLoading && !error && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                type="search"
                label="Название"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                fullWidth
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
              <TextField
                select
                label="Размер наклейки"
                value={sizeId}
                onChange={(e) => setSizeId(e.target.value as StickerSizeId)}
                sx={{ minWidth: 210 }}
              >
                {STICKER_SIZES.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <FormControlLabel
                label="Выбрать все"
                control={
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={!allVisibleSelected && visible.some((t) => selected.has(t.id))}
                    onChange={toggleAllVisible}
                    disabled={visible.length === 0}
                  />
                }
              />
              <Typography variant="body2" color="text.secondary">
                Выбрано: {chosen.length}
              </Typography>
            </Stack>

            {tools.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                Инструментов пока нет
              </Typography>
            ) : (
              <List dense disablePadding sx={{ maxHeight: { sm: 320 }, overflow: 'auto' }}>
                {visible.map((tool) => (
                  <ListItemButton key={tool.id} onClick={() => toggle(tool.id)} sx={{ borderRadius: 1 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Checkbox
                        edge="start"
                        checked={selected.has(tool.id)}
                        tabIndex={-1}
                        disableRipple
                        slotProps={{ input: { 'aria-label': tool.name } }}
                      />
                    </ListItemIcon>
                    <ListItemText primary={tool.name} />
                  </ListItemButton>
                ))}
                {visible.length === 0 && (
                  <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                    Ничего не найдено
                  </Typography>
                )}
              </List>
            )}

            <Typography variant="caption" color="text.secondary">
              Печать: лист A4 с пунктирными линиями для обрезки (в окне печати можно сохранить в PDF).
              Скачать: один инструмент — PNG, несколько — ZIP с PNG.
            </Typography>

            {failure && <Alert severity="error">{failure}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} disabled={busy !== null}>
          Закрыть
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={busy === 'download' ? <CircularProgress size={18} /> : <DownloadIcon />}
          onClick={() => void run('download')}
          disabled={!canAct}
        >
          Скачать
        </Button>
        <Button
          variant="contained"
          startIcon={busy === 'print' ? <CircularProgress size={18} color="inherit" /> : <PrintIcon />}
          onClick={() => void run('print')}
          disabled={!canAct}
        >
          Печать
        </Button>
      </DialogActions>
    </Dialog>
  );
}
