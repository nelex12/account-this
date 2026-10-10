// src/app/providers/theme.ts
// MUI theme generated from the Penpot design tokens
// (sets: "Colors", "Colors Dark", "Typography") and the "Designs / *" components.
import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

/* -------------------------------------------------------------------------- */
/*                                   Scale                                    */
/* -------------------------------------------------------------------------- */

/**
 * The Penpot design is drawn for a 1920px canvas, so sizes are large.
 * SCALE shrinks every size from the design (fonts, heights, paddings, radii)
 * for a real desktop app. 1 = exactly as in the design; try 0.7 – 0.9.
 */
const SCALE = 0.8;
const MIN_FONT = 12;

/** Scales a dimension from the design (px) */
const px = (n: number): number => Math.round(n * SCALE);
/** Scales a font size from the design (px), never below MIN_FONT */
const fs = (n: number): number => Math.max(MIN_FONT, px(n));

/* -------------------------------------------------------------------------- */
/*                                   Tokens                                   */
/* -------------------------------------------------------------------------- */

const font = {
  heading: '"Montserrat", "Inter", system-ui, sans-serif', // font.family.heading
  body: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif', // font.family.body
};

const weight = { regular: 400, medium: 500, semibold: 600, bold: 700 };
const lineHeight = { tight: 1.2, normal: 1.4, relaxed: 1.5 };
const letterSpacing = { normal: '0px', wide: '0.2px' };

// Raw palette (color.*)
const orange = { 50: '#FFF6E5', 100: '#FFE5B7', 300: '#FFC766', 500: '#FFA500', 600: '#E69500', 700: '#B36B00' };
const blue = { 100: '#E5E5FF', 500: '#0000FF', 700: '#0000B3' };

// Semantic colors per mode (color.* and color.dark.*)
const modeColors = {
  light: {
    bgPage: orange[100], // color.bg.page (kept for reference, see notes)
    bgSurface: '#FFFFFF',
    bgSubtle: '#F2F2F2',
    bgSelected: orange[100],
    textPrimary: '#000000',
    textSecondary: '#565656',
    textDisabled: '#8A8A8A',
    textLink: blue[500],
    textLinkStrong: blue[700],
    textAccent: orange[700],
    borderDefault: '#565656',
    borderStrong: '#333333',
    borderSubtle: '#D0D0D0',
    success: { main: '#2E9E5B', container: '#DFF3E7', text: '#2E9E5B' },
    error: { main: '#D93025', container: '#FBE3E1', text: '#D93025' },
    warning: { main: '#E8B400', container: '#FFF4CC', text: orange[700] },
    info: { main: blue[500], container: blue[100], text: blue[700] },
    shadow: 'rgba(0, 0, 0, 0.2)',
  },
  dark: {
    bgPage: '#121212',
    bgSurface: '#1E1E1E',
    bgSubtle: '#2A2A2A',
    bgSelected: '#4A3200',
    textPrimary: '#F2F2F2',
    textSecondary: '#B8B8B8',
    textDisabled: '#8A8A8A',
    textLink: '#8AB4FF',
    textLinkStrong: '#8AB4FF',
    textAccent: orange[300],
    borderDefault: '#8A8A8A',
    borderStrong: '#B8B8B8',
    borderSubtle: '#3D3D3D',
    success: { main: '#5FD38D', container: '#1F3D2B', text: '#5FD38D' },
    error: { main: '#FF6B5E', container: '#4A2220', text: '#FF6B5E' },
    warning: { main: '#F2C94C', container: '#4A3E10', text: '#F2C94C' },
    info: { main: '#8AB4FF', container: '#1F2A44', text: '#8AB4FF' },
    shadow: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

/** typography.* tokens as MUI typography variants (font size is scaled) */
const typo = (
  family: string,
  fontSize: number,
  fontWeight: number,
  lh: number,
  ls: string = letterSpacing.normal,
) => ({
  fontFamily: family,
  fontSize: `${fs(fontSize)}px`,
  fontWeight,
  lineHeight: lh,
  letterSpacing: ls,
  textTransform: 'none' as const,
});

const typography = {
  fontFamily: font.body,
  fontWeightRegular: weight.regular,
  fontWeightMedium: weight.medium,
  fontWeightBold: weight.bold,

  h1: typo(font.heading, 40, weight.semibold, lineHeight.tight), // typography.display
  h2: typo(font.heading, 36, weight.semibold, lineHeight.tight), // typography.headline.l
  h3: typo(font.heading, 32, weight.semibold, lineHeight.tight), // typography.headline.m
  h4: typo(font.heading, 30, weight.semibold, lineHeight.tight), // typography.headline.s
  h5: typo(font.heading, 28, weight.semibold, lineHeight.tight), // typography.title.l
  h6: typo(font.heading, 24, weight.semibold, lineHeight.tight), // typography.title.m

  subtitle1: typo(font.body, 20, weight.regular, lineHeight.normal), // body.l.regular
  subtitle2: typo(font.body, 18, weight.medium, lineHeight.normal), // body.m.medium

  body1: typo(font.body, 18, weight.regular, lineHeight.normal), // body.m.regular
  body2: typo(font.body, 16, weight.regular, lineHeight.normal), // body.s.regular

  button: typo(font.body, 20, weight.medium, lineHeight.normal), // body.l.medium
  caption: typo(font.body, 14, weight.regular, lineHeight.normal), // body.caption.regular
  overline: typo(font.body, 12, weight.medium, lineHeight.normal, letterSpacing.wide), // body.label.medium
};

/* -------------------------------------------------------------------------- */
/*                                   Theme                                    */
/* -------------------------------------------------------------------------- */

export function createAppTheme(mode: PaletteMode = 'light'): Theme {
  const c = modeColors[mode];

  const semantic = (key: 'success' | 'error' | 'warning' | 'info') => ({
    main: c[key].main,
    light: c[key].container,
    dark: c[key].text,
    contrastText: mode === 'light' ? '#FFFFFF' : '#000000',
  });

  // Status badge ("Designs / Status Badge *"): pill 36px, tinted container, colored dot, primary text
  const badgeVariants = (['success', 'error', 'warning', 'info'] as const).flatMap((color) =>
    (['filled', 'outlined'] as const).map((variant) => ({
      props: { color, variant },
      style: {
        height: px(36),
        borderRadius: px(18),
        backgroundColor: c[color].container,
        color: c.textPrimary,
        border: 'none',
        fontFamily: font.body,
        fontSize: fs(18),
        fontWeight: weight.medium,
        gap: px(8),
        '&::before': {
          content: '""',
          flexShrink: 0,
          width: px(12),
          height: px(12),
          marginLeft: px(12),
          borderRadius: '50%',
          backgroundColor: c[color].main,
        },
        '& .MuiChip-label': { padding: `0 ${px(14)}px 0 0` },
      },
    })),
  );

  const fabShadow = `0 ${px(4)}px ${px(8)}px 0 ${alpha('#000000', 0.25)}`;
  const switchTrack = px(40); // switch height; width = 65 / 40 of height

  return createTheme({
    palette: {
      mode,
      primary: {
        main: orange[500], // color.button.primary.bg
        dark: orange[600], // color.button.primary.hover
        light: orange[300], // color.button.primary.disabled
        contrastText: '#000000', // color.text.on-primary
      },
      // Links / text buttons are blue in the design (color.text.link)
      secondary: {
        main: c.textLink,
        dark: c.textLinkStrong,
        light: mode === 'light' ? blue[100] : '#1F2A44',
        contrastText: mode === 'light' ? '#FFFFFF' : '#000000',
      },
      success: semantic('success'),
      error: semantic('error'),
      warning: semantic('warning'),
      info: semantic('info'),
      text: {
        primary: c.textPrimary,
        secondary: c.textSecondary,
        disabled: c.textDisabled,
      },
      divider: c.borderSubtle,
      background: {
        default: c.bgSurface,
        paper: c.bgSurface,
      },
      action: {
        hover: c.bgSubtle, // color.bg.subtle
        selected: c.bgSelected, // color.bg.selected
        focus: c.bgSubtle,
        disabled: c.textDisabled,
        disabledBackground: orange[300],
      },
    },

    typography,
    shape: { borderRadius: px(5) }, // text field radius

    components: {
      /* ------------------------------- Baseline ------------------------------ */
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: c.bgSurface,
            color: c.textPrimary,
          },
        },
      },

      /* -------------------------------- Buttons ------------------------------ */
      MuiButtonBase: { defaultProps: { disableRipple: false } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: px(40),
            fontFamily: font.body,
            fontWeight: weight.medium,
            whiteSpace: 'nowrap',
          },
          // Sizes: medium = card/filled button (50px), large = top bar/form button (60px)
          sizeMedium: { minHeight: px(50), padding: `0 ${px(28)}px`, fontSize: fs(20) },
          sizeLarge: {
            minHeight: px(60),
            padding: `0 ${px(30)}px`,
            fontFamily: font.heading,
            fontSize: fs(24),
            fontWeight: weight.semibold,
          },
          sizeSmall: { minHeight: px(40), padding: `0 ${px(20)}px`, fontSize: fs(16) },

          // Secondary Button: outlined, link-colored text
          outlined: {
            borderWidth: 1,
            borderColor: c.borderDefault,
            color: c.textLink,
            '&:hover': { borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.bgSubtle },
          },
          // Text Button: pill 50px, link-colored label
          text: {
            borderRadius: px(25),
            minHeight: px(50),
            padding: `0 ${px(20)}px`,
            color: c.textLink,
            '&:hover': { backgroundColor: c.bgSubtle },
          },
        },
        variants: [
          // Primary Button
          {
            props: { variant: 'contained', color: 'primary' },
            style: {
              backgroundColor: orange[500],
              color: '#000000',
              '&:hover': { backgroundColor: orange[600] },
              '&:active': { backgroundColor: orange[700] },
              '&.Mui-disabled': { backgroundColor: orange[300], color: alpha('#000000', 0.38) },
            },
          },
          {
            props: { variant: 'outlined', color: 'primary' },
            style: {
              borderColor: c.borderDefault,
              color: c.textLink,
              '&:hover': { borderColor: c.borderStrong, backgroundColor: c.bgSubtle },
            },
          },
          {
            props: { variant: 'text', color: 'primary' },
            style: {
              color: c.textLink,
              '&:hover': { backgroundColor: c.bgSubtle },
            },
          },
        ],
      },
      MuiFab: {
        styleOverrides: {
          root: {
            width: px(70),
            height: px(70),
            borderRadius: px(20),
            backgroundColor: orange[500],
            color: '#000000',
            boxShadow: fabShadow,
            '&:hover': { backgroundColor: orange[600] },
            '&:active': { backgroundColor: orange[700], boxShadow: fabShadow },
          },
          extended: {
            width: 'auto',
            minWidth: px(70),
            padding: `0 ${px(28)}px`,
            gap: px(12),
            fontFamily: font.body,
            fontSize: fs(20),
            fontWeight: weight.medium,
            textTransform: 'none',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { color: c.textSecondary } },
      },

      /* ------------------------------ Text fields ---------------------------- */
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: px(5),
            backgroundColor: c.bgSurface,
            fontFamily: font.heading,
            fontSize: fs(24),
            fontWeight: weight.semibold,
            lineHeight: 1.25,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: c.borderDefault, borderWidth: 1 },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: c.borderStrong },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: orange[500], borderWidth: 2 },
            '&.MuiInputBase-multiline': { padding: 0 },
            '&.MuiInputBase-adornedEnd': { paddingRight: px(20) },
            '&.MuiInputBase-adornedStart': { paddingLeft: px(20) },
            '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: c.error.main },
            '&.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: c.borderSubtle },
          },
          input: {
            height: 'auto',
            padding: `${px(20)}px ${px(20)}px`,
            boxSizing: 'border-box',
            '&::placeholder': { color: c.textSecondary, opacity: 1 },
            '&.Mui-disabled': { WebkitTextFillColor: c.textDisabled },
            '&.MuiInputBase-inputSizeSmall': { padding: `${px(12)}px ${px(16)}px`, fontSize: fs(18) },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontFamily: font.body,
            fontSize: fs(24), // scaled by 0.75 when shrunk (body.m.medium in the design)
            fontWeight: weight.medium,
            color: c.textSecondary,
            '&.Mui-focused': { color: c.textAccent },
            '&.Mui-error': { color: c.error.text },
            '&.Mui-disabled': { color: c.textDisabled },
          },
          outlined: {
            transform: `translate(${px(20)}px, ${px(20) - 1}px) scale(1)`,
            '&.MuiInputLabel-shrink': { transform: `translate(${px(14)}px, -${px(9)}px) scale(0.75)` },
            '&.MuiInputLabel-sizeSmall': {
              fontSize: fs(18),
              transform: `translate(${px(16)}px, ${px(12)}px) scale(1)`,
            },
            '&.MuiInputLabel-sizeSmall.MuiInputLabel-shrink': {
              fontSize: fs(18),
              transform: `translate(${px(14)}px, -${px(9)}px) scale(0.75)`,
            },
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            ...typo(font.body, 16, weight.regular, lineHeight.normal),
            color: c.textSecondary,
            margin: `${px(6)}px ${px(20)}px 0`, // supporting text is inset 20px
            '&.Mui-error': { color: c.error.text },
          },
        },
      },
      MuiRadio: {
        styleOverrides: {
          root: { color: c.textSecondary, '&.Mui-checked': { color: orange[500] } },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: { color: c.textSecondary, '&.Mui-checked': { color: orange[500] } },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: {
            color: c.textPrimary,
            fontWeight: weight.medium,
            '&.Mui-focused': { color: c.textPrimary },
          },
        },
      },

      /* -------------------------------- Switch ------------------------------- */
      MuiSwitch: {
        styleOverrides: {
          root: { width: px(65), height: switchTrack, padding: 0, overflow: 'visible' },
          switchBase: {
            padding: 0,
            top: 0,
            left: 0,
            width: switchTrack,
            height: switchTrack,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&.Mui-checked': {
              transform: `translateX(${px(25)}px)`,
              color: '#FFFFFF',
              '& + .MuiSwitch-track': { backgroundColor: orange[500], border: '2px solid transparent', opacity: 1 },
              '& .MuiSwitch-thumb': { width: px(32), height: px(32), backgroundColor: '#FFFFFF' },
            },
            '&.Mui-disabled + .MuiSwitch-track': { opacity: 0.5 },
          },
          thumb: {
            width: px(20),
            height: px(20),
            backgroundColor: c.borderDefault,
            boxShadow: 'none',
          },
          track: {
            borderRadius: px(20),
            boxSizing: 'border-box',
            backgroundColor: c.bgSubtle,
            border: `2px solid ${c.borderDefault}`,
            opacity: 1,
          },
        },
      },

      /* ------------------------------ Chips / badges ------------------------- */
      MuiChip: {
        styleOverrides: {
          root: {
            height: px(40),
            borderRadius: px(10),
            fontFamily: font.body,
            fontSize: fs(18),
            fontWeight: weight.medium,
          },
          label: { padding: `0 ${px(16)}px` },
          // Filter chip (unselected)
          outlined: {
            borderColor: c.borderDefault,
            color: c.textSecondary,
            '&.MuiChip-clickable:hover': { backgroundColor: c.bgSubtle },
          },
          sizeSmall: { height: px(36) },
        },
        variants: [
          // Filter chip (selected): color="primary" + variant="filled"
          {
            props: { color: 'primary', variant: 'filled' },
            style: {
              backgroundColor: c.bgSelected,
              color: c.textPrimary,
              border: `1px solid ${c.bgSelected}`,
              '&.MuiChip-clickable:hover': { backgroundColor: c.bgSelected },
            },
          },
          {
            props: { color: 'default', variant: 'filled' },
            style: { backgroundColor: c.bgSubtle, color: c.textPrimary },
          },
          // Status badges: semantic color chips, any variant
          ...badgeVariants,
        ],
      },

      /* --------------------------------- Tabs -------------------------------- */
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: px(60), borderBottom: `1px solid ${c.borderSubtle}` },
          indicator: { height: px(4), backgroundColor: orange[500] },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: px(60),
            padding: `0 ${px(24)}px`,
            textTransform: 'none',
            fontFamily: font.body,
            fontSize: fs(20),
            fontWeight: weight.medium,
            color: c.textSecondary,
            '&.Mui-selected': { color: c.textPrimary },
          },
        },
      },

      /* ---------------------------- Cards and surfaces ----------------------- */
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: c.borderSubtle },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { borderRadius: px(15), border: `1px solid ${c.borderSubtle}` },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: px(25), '&:last-child': { paddingBottom: px(25) } },
        },
      },
      MuiDivider: { styleOverrides: { root: { borderColor: c.borderSubtle } } },
      MuiAvatar: {
        styleOverrides: {
          root: {
            backgroundColor: c.bgSelected,
            color: c.textPrimary,
            fontFamily: font.body,
            fontWeight: weight.medium,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: { root: { boxShadow: 'none', backgroundImage: 'none' } },
      },

      /* --------------------------------- Table ------------------------------- */
      MuiTableContainer: {
        styleOverrides: { root: { borderRadius: px(16), overflow: 'hidden' } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            ...typo(font.body, 18, weight.regular, lineHeight.normal),
            color: c.textPrimary,
            padding: `${px(12)}px ${px(24)}px`,
            height: px(72),
            borderBottom: `1px solid ${c.borderSubtle}`,
          },
          head: {
            ...typo(font.body, 14, weight.medium, lineHeight.normal, letterSpacing.wide),
            height: px(56),
            backgroundColor: c.bgSubtle,
            color: c.textSecondary,
          },
          footer: { height: px(60) },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': { backgroundColor: c.bgSubtle },
            '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: c.bgSelected },
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: { borderTop: `1px solid ${c.borderSubtle}`, color: c.textSecondary },
          toolbar: { minHeight: px(60), padding: `0 ${px(24)}px` },
          displayedRows: { ...typo(font.body, 18, weight.regular, lineHeight.normal), color: c.textSecondary },
        },
      },

      /* ----------------------------- Dialog / sheet -------------------------- */
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: px(35),
            backgroundImage: 'none',
            boxShadow: `0 ${px(8)}px ${px(32)}px 0 ${c.shadow}`,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            ...typo(font.heading, 30, weight.semibold, lineHeight.tight),
            padding: `${px(30)}px ${px(30)}px ${px(20)}px`,
          },
        },
      },
      MuiDialogContent: { styleOverrides: { root: { padding: `0 ${px(30)}px ${px(20)}px` } } },
      MuiDialogContentText: {
        styleOverrides: { root: { ...typo(font.body, 18, weight.regular, lineHeight.normal), color: c.textSecondary } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { padding: `${px(10)}px ${px(30)}px ${px(30)}px`, gap: px(8) } },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            width: px(500),
            maxWidth: '100vw',
            backgroundImage: 'none',
            border: `1px solid ${c.borderSubtle}`,
            boxShadow: `-${px(4)}px 0 ${px(24)}px 0 ${c.shadow}`,
            '&.MuiDrawer-paperAnchorRight': { borderRadius: `${px(20)}px 0 0 ${px(20)}px` },
          },
        },
      },

      /* ------------------------------ Navigation ----------------------------- */
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: px(20),
            '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: c.bgSelected },
            '&:hover': { backgroundColor: c.bgSubtle },
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: {
            ...typo(font.body, 18, weight.medium, lineHeight.normal),
          },
        },
      },
      MuiListItemIcon: { styleOverrides: { root: { color: c.textSecondary, minWidth: px(40) } } },
      MuiBottomNavigation: {
        styleOverrides: { root: { height: px(100), backgroundColor: c.bgSubtle } },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            color: c.textSecondary,
            paddingTop: px(10),
            '&.Mui-selected': { color: c.textPrimary },
          },
          label: {
            ...typo(font.body, 18, weight.medium, lineHeight.normal),
            '&.Mui-selected': { fontSize: fs(18) },
          },
        },
      },

      /* -------------------------------- Links ------------------------------- */
      MuiLink: {
        defaultProps: { underline: 'hover' },
        styleOverrides: { root: { color: c.textLink } },
      },
    },
  });
}

export const lightTheme = createAppTheme('light');
export const darkTheme = createAppTheme('dark');