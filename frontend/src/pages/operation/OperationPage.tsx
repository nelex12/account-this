// OperationPage.tsx — "Tool Operation Board / Worker" (Mobile Light).
// Tool card, "take / return" choice, tool condition, button "Создать qr-код".
//
// The tool comes from the scan page via router state: navigate('/operation', { state: { tool } }).
// A held tool on the overview passes { tool, action: 'GIVE' } so "Возвращаю" is already selected.
// Top bar ("Операция" + back) comes from the route's `handle.topBar` + SimpleLayout.
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { QrCodeScannerIcon } from '../../shared/Icons';
import type {
  ApiToolCondition,
  OperationChoice,
  RentalAction,
  ScannedTool,
} from '../../entities/operationModel';

const ACTIONS: { value: RentalAction; label: string }[] = [
  { value: 'TAKE', label: 'Беру' },
  { value: 'GIVE', label: 'Возвращаю' },
];

const CONDITIONS: { value: ApiToolCondition; label: string }[] = [
  { value: 'Good', label: 'Исправен' },
  { value: 'Damaged', label: 'Поврежден' },
  { value: 'Broken', label: 'Сломан' },
];

/** Big pill option, selected one is tinted (design: "Group Button"). */
function OptionGroup<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <FormControl component="fieldset" fullWidth>
      <Typography id={`${name}-label`} variant="subtitle1" component="legend" sx={{ mb: 1.5 }}>
        {label}
      </Typography>
      <RadioGroup
        aria-labelledby={`${name}-label`}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        <Stack spacing={1.5}>
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <FormControlLabel
                key={o.value}
                value={o.value}
                control={<Radio />}
                label={<Typography variant="h6" component="span">{o.label}</Typography>}
                sx={{
                  m: 0,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '16px',
                  bgcolor: selected ? 'primary.light' : 'action.hover',
                  transition: 'background-color .15s',
                }}
              />
            );
          })}
        </Stack>
      </RadioGroup>
    </FormControl>
  );
}

export interface OperationPageProps {
  /** Overrides the tool from router state (stories, tests). */
  tool?: ScannedTool;
  /** Called with the choice. Default: go to /qr with the choice in router state. */
  onCreateQr?: (choice: OperationChoice) => void;
}

export default function OperationPage({ tool: toolProp, onCreateQr }: OperationPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { tool?: ScannedTool; action?: RentalAction } | null;
  const tool = toolProp ?? routeState?.tool;

  const [action, setAction] = useState<RentalAction>(routeState?.action ?? 'TAKE');
  const [toolCondition, setToolCondition] = useState<ApiToolCondition>('Good');

  // Opened directly (reload / deep link): there is no scanned tool, start over.
  if (!tool) return <Navigate to="/scan" replace />;

  const submit = () => {
    const choice: OperationChoice = { tool, action, toolCondition };
    if (onCreateQr) onCreateQr(choice);
    else navigate('/qr', { state: { choice } });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100dvh - 65px)',
        p: 2.5,
        pb: 3,
        width: '100%',
        maxWidth: 560,
        mx: 'auto',
      }}
    >
      <Stack spacing={3} sx={{ flexGrow: 1 }}>
        {/* Tool header */}
        <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
          <Box
            aria-hidden
            sx={{ width: 72, height: 72, flexShrink: 0, borderRadius: '12px', bgcolor: 'action.selected' }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ wordBreak: 'break-word' }}>
              {tool.name}
            </Typography>
            {tool.details && (
              <Typography variant="body2" color="text.secondary">
                {tool.details}
              </Typography>
            )}
          </Box>
        </Card>

        <OptionGroup label="Укажите действие" name="action" value={action} options={ACTIONS} onChange={setAction} />
        <OptionGroup
          label="Состояние оборудования"
          name="condition"
          value={toolCondition}
          options={CONDITIONS}
          onChange={setToolCondition}
        />
      </Stack>

      <Button
        variant="contained"
        size="large"
        fullWidth
        startIcon={<QrCodeScannerIcon />}
        onClick={submit}
        sx={{ mt: 3 }}
      >
        Создать qr-код
      </Button>
    </Box>
  );
}