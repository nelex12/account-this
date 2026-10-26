// TopAppBar.tsx
import { useOnlineStatus } from '../useOnlineStatus';
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

import {
  ArrowBackIcon
} from '../Icons';

/**
 * Fixed content height of the desktop top bar (the 1px bottom border is extra).
 * The navigation rail header uses the same value so its logo block and divider
 * line up exactly with the top bar.
 */
export const TOP_APP_BAR_DESKTOP_HEIGHT = 112;
const TOP_APP_BAR_MOBILE_HEIGHT = 64;

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
  /** Renders a back button on the left (any screen width). */
  onBack?: () => void;
  /** Free slot at the far right, after the status chip (e.g. a profile IconButton). Any screen width. */
  trailing?: ReactNode;
}

/**
 * Layout
 *   desktop: [ Back | Title block (fills) ............ | Secondary | Primary | Status | Trailing ]
 *   mobile:  [ Back | Title block (fills) ................................. | Status | Trailing ]
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
  trailing,
}: TopAppBarDesktopProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const online = useOnlineStatus();

  const hasDesktopActions = !isMobile && Boolean(secondaryAction || primaryAction);
  const hasStatus = Boolean(statusLabel);
  const hasTrailing = Boolean(trailing);

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          // Desktop: an exact height (not min-height), so the bar can never grow or
          // shrink depending on its content (title only, actions, chip, back button).
          ...(isMobile
            ? { minHeight: TOP_APP_BAR_MOBILE_HEIGHT }
            : {
                height: TOP_APP_BAR_DESKTOP_HEIGHT,
                minHeight: TOP_APP_BAR_DESKTOP_HEIGHT,
                maxHeight: TOP_APP_BAR_DESKTOP_HEIGHT,
              }),
          boxSizing: 'border-box',
          py: isMobile ? '8px' : 0,
          px: isMobile ? '8px' : '15px',
          gap: isMobile ? '8px' : '20px',
          alignItems: 'center',
        }}
      >
        {/* Back button */}
        {onBack && (
          <IconButton edge="start" onClick={onBack} aria-label="Назад">
            <ArrowBackIcon />
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

        {/* Right side: actions (desktop) + status chip + trailing slot */}
        {(hasDesktopActions || hasStatus || hasTrailing) && (
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
              // the label comes from the route ("В сети"); the real connection state overrides it
              <Chip color={online ? 'success' : 'warning'} label={online ? statusLabel : 'Нет сети'} />
            )}

            {trailing}
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
}