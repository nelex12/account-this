import { useState } from 'react';
import AddToolDialog from './shared/ui/AddToolDialog.tsx';
import { Button } from '@mui/material';
import DetailsDrawer, {type OperationDetails} from './shared/ui/DetailsDrawer.tsx'

export default function Temp() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OperationDetails | null>(null);

  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)}>
        Добавить инструмент
      </Button>

      <AddToolDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(values) => {
          // TODO: POST to API
          console.log(values);
        }}
      />
      <DetailsDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        operation={selected}
        onEdit={(op) => {
          // TODO: open edit dialog, or navigate to /operations/:id/edit
          console.log('edit', op.id);
        }}
      />
    </>
  );
}