// src/theme.ts

export const colors = {
  primary: '#1B5FA8',
  primaryLight: '#E6EFF9',
  primaryDark: '#0D3D6E',
  accent: '#E8841A',
  accentLight: '#FDF1E0',
  success: '#1E8C5A',
  successLight: '#E4F5ED',
  danger: '#C0392B',
  dangerLight: '#FAEAEA',
  warning: '#D4820F',
  warningLight: '#FEF3DC',
  purple: '#6B4FA0',
  purpleLight: '#EDE8F7',

  background: '#F5F3EF',
  surface: '#FFFFFF',
  surfaceAlt: '#FAF8F5',
  border: '#E0D9D0',
  borderStrong: '#C4BBB0',

  text: '#1A1714',
  textSecondary: '#5C5650',
  textMuted: '#9E9690',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  pillColors: [
    '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71',
    '#1ABC9C', '#3498DB', '#9B59B6', '#E91E8C',
    '#795548', '#607D8B',
  ],
};

// Scale up everything for seniors
const BASE = 1.15;

export const fontSize = {
  xs: Math.round(11 * BASE),
  sm: Math.round(13 * BASE),
  md: Math.round(15 * BASE),
  lg: Math.round(18 * BASE),
  xl: Math.round(22 * BASE),
  xxl: Math.round(28 * BASE),
  xxxl: Math.round(36 * BASE),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  full: 999,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.11,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
};
