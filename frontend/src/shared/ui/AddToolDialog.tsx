// AddToolDialog.tsx
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

export interface AddToolFormValues {
  name: string;
  inventoryNumber: string;
  location: string;
}

const emptyValues: AddToolFormValues = {
  name: '',
  inventoryNumber: '',
  location: '',
};

interface AddToolDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (values: AddToolFormValues) => void;
}

export default function AddToolDialog({ open, onClose, onSubmit }: AddToolDialogProps) {
  const [values, setValues] = useState<AddToolFormValues>(emptyValues);

  // Reset the form each time the dialog opens
  useEffect(() => {
    if (open) setValues(emptyValues);
  }, [open]);

  const handleChange =
    (field: keyof AddToolFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = () => {
    onSubmit?.(values);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Добавить инструмент</DialogTitle>

      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Заполните данные, чтобы добавить инструмент в реестр.
          Наклейку можно распечатать позже.
        </DialogContentText>

        <Stack spacing={2}>
          <TextField
            label="Название"
            placeholder="Например, Дрель Bosch SGB 235"
            helperText="Марка и модель"
            value={values.name}
            onChange={handleChange('name')}
            fullWidth
          />

          <TextField
            label="Инвентарный номер"
            placeholder="№0000"
            helperText="Печатается на наклейке"
            value={values.inventoryNumber}
            onChange={handleChange('inventoryNumber')}
            fullWidth
          />

          <TextField
            label="Местоположение"
            placeholder="Склад А"
            helperText="Где хранится инструмент"
            value={values.location}
            onChange={handleChange('location')}
            fullWidth
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleSubmit}>Добавить</Button>
      </DialogActions>
    </Dialog>
  );
}