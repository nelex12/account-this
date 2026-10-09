// TopAppBarDesktop.tsx
import type { ReactNode } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ReactIcon from '../../assets/react.svg';

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
  /** Secondary (outlined) button, rendered before the primary one. Desktop only. */
  secondaryAction?: TopAppBarAction;
  /** Primary (contained) button. Desktop only. */
  primaryAction?: TopAppBarAction;
  /** Status chip text, e.g. "В сети" */
  statusLabel?: string;
  /** Renders a back button on the left in mobile layout. */
  onBack?: () => void;
}

/**
 * Layout
 *   desktop: [ Title block (fills) ........................ | Secondary | Primary | Status ]
 *   mobile:  [ Back | Title block (fills) ............................... | Status ]
 *
 * All parts except the title are optional.
 */
export default function TopAppBar({
  title,
  supportingText,
  secondaryAction,
  primaryAction,
  statusLabel,
  onBack,
}: TopAppBarDesktopProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const hasDesktopActions = !isMobile && Boolean(secondaryAction || primaryAction);
  const hasStatus = Boolean(statusLabel);

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
          minHeight: isMobile ? 64 : 112,
          py: isMobile ? '8px' : '15px',
          px: isMobile ? '8px' : '15px',
          gap: isMobile ? '8px' : '20px',
          alignItems: 'center',
        }}
      >
        {/* Back button — mobile only */}
        {isMobile && onBack && (
          <IconButton edge="start" onClick={onBack} aria-label="Назад">
            <ReactIcon />
          </IconButton>
        )}

        {/* Title block: fills remaining width */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant={isMobile ? 'h6' : 'h4'} component="h1" noWrap>
            {title}
          </Typography>
          {supportingText && !isMobile && (
            <Typography variant="subtitle1" color="text.secondary" noWrap>
              {supportingText}
            </Typography>
          )}
        </Box>

        {/* Right side: actions (desktop) + status chip (both) */}
        {(hasDesktopActions || hasStatus) && (
          <Stack
            direction="row"
            spacing={isMobile ? 1 : 2}
            sx={{ alignItems: 'center', justifyContent: 'flex-end' }}
          >
            {hasDesktopActions && secondaryAction && (
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

            {hasDesktopActions && primaryAction && (
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

            {hasStatus && (
              <Chip color="success" label={statusLabel} />
            )}
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
}