import type { ReactNode } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';

export interface TopAppBarAction {
  label: string;
  onClick?: () => void;
  /** Optional leading icon (e.g. <QrCodeScannerIcon />) */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TopAppBarDesktopProps {
  /** Screen title, e.g. "Заголовок экрана" */
  title: string;
  /** Date or short description under the title */
  supportingText?: string;
  /** Secondary (outlined) button, rendered before the primary one */
  secondaryAction?: TopAppBarAction;
  /** Primary (contained) button */
  primaryAction?: TopAppBarAction;
  /** Status chip text, e.g. "В сети" */
  statusLabel?: string;
}

/**
 * Layout
 *   [ Title block (fills) ........................ | Secondary | Primary | Status ]
 *
 * All parts except the title are optional
 */
export default function TopAppBarDesktop({
  title,
  supportingText,
  secondaryAction,
  primaryAction,
  statusLabel,
}: TopAppBarDesktopProps) {
  const hasActions = Boolean(secondaryAction || primaryAction || statusLabel);

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar
        disableGutters
        sx={{
          // Design: 112px tall bar, 18px vertical / 30px horizontal padding, 20px gap
          minHeight: 112,
          py: '15px',
          px: '15px',
          gap: '20px',
          alignItems: 'center',
        }}
      >
        {/* Title block: fills remaining width */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h4" component="h1" noWrap>
            {title}
          </Typography>
          {supportingText && (
            <Typography variant="subtitle1" color="text.secondary" noWrap>
              {supportingText}
            </Typography>
          )}
        </Box>

        {/* Actions: right-aligned row, 16px gap */}
        {hasActions && (
          <Stack direction="row" spacing={2} 
          sx={{alignItems: "center", justifyContent: "flex-end"}}>
            {secondaryAction && (
              <Button
                variant="outlined"
                size="large"
                startIcon={secondaryAction.icon}
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
              >
                {secondaryAction.label}
              </Button>
            )}

            {primaryAction && (
              <Button
                variant="contained"
                size="large"
                startIcon={primaryAction.icon}
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
              >
                {primaryAction.label}
              </Button>
            )}

            {statusLabel && (
              <Chip
                color="success"
                label={statusLabel}
                /*
                </Chip>
                icon={<FiberManualRecordIcon />}
                */
              />
            )}
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
}