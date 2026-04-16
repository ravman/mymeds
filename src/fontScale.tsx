// src/fontScale.tsx
// Provides dynamic font sizes that respond to the user's font size preference.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSettings, saveSettings } from './storage';
import { fontSize as baseFontSize } from './theme';
import { AppSettings } from './types';

// Scale multipliers relative to the theme's BASE sizes.
// 'large' = 1.0 keeps everything exactly as the theme defines it (the default).
const SCALES: Record<AppSettings['fontSize'], number> = {
  normal: 0.88,
  large: 1.0,
  xlarge: 1.2,
};

type FontSizes = typeof baseFontSize;

function buildFontSizes(pref: AppSettings['fontSize']): FontSizes {
  const s = SCALES[pref];
  const result = {} as FontSizes;
  for (const key in baseFontSize) {
    const k = key as keyof FontSizes;
    result[k] = Math.round(baseFontSize[k] * s);
  }
  return result;
}

interface FontScaleCtx {
  fs: FontSizes;
  fontSizePref: AppSettings['fontSize'];
  setFontSizePref: (pref: AppSettings['fontSize']) => void;
}

const FontScaleContext = createContext<FontScaleCtx>({
  fs: baseFontSize,
  fontSizePref: 'large',
  setFontSizePref: () => {},
});

export const FontScaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pref, setPref] = useState<AppSettings['fontSize']>('large');
  const [fs, setFs] = useState<FontSizes>(baseFontSize);

  useEffect(() => {
    getSettings().then(s => {
      setPref(s.fontSize);
      setFs(buildFontSizes(s.fontSize));
    });
  }, []);

  const setFontSizePref = useCallback((newPref: AppSettings['fontSize']) => {
    setPref(newPref);
    setFs(buildFontSizes(newPref));
    // Also persist so the provider picks it up on next launch
    getSettings().then(s => saveSettings({ ...s, fontSize: newPref }));
  }, []);

  const value = useMemo(
    () => ({ fs, fontSizePref: pref, setFontSizePref }),
    [fs, pref, setFontSizePref],
  );

  return (
    <FontScaleContext.Provider value={value}>
      {children}
    </FontScaleContext.Provider>
  );
};

export function useFontSizes(): FontSizes {
  return useContext(FontScaleContext).fs;
}

export function useFontSizePref(): [AppSettings['fontSize'], (p: AppSettings['fontSize']) => void] {
  const { fontSizePref, setFontSizePref } = useContext(FontScaleContext);
  return [fontSizePref, setFontSizePref];
}
