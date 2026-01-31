'use client'

import { useInsertionEffect, useMemo } from 'react'
import { Toaster } from '@/components/ui/sonner'
import {
  applyThemePresetStyles,
  getThemePresetCss,
  THEME_STYLE_ELEMENT_ID
} from '@/lib/themes'
import { CacheKey } from '@/services/constant'
import { ThemeMode } from '@/types/theme'
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

const isValidTheme = (value?: string | null): value is ThemeMode =>
  value === 'light' || value === 'dark'
const DEFAULT_THEME_MODE: ThemeMode = isValidTheme(process.env.NEXT_PUBLIC_DEFAULT_THEME)
  ? (process.env.NEXT_PUBLIC_DEFAULT_THEME as ThemeMode)
  : 'light'

const PRESET_ID = 'supabase'

function ThemePresetStyle() {
  const css = useMemo(() => getThemePresetCss(PRESET_ID), [])

  return (
    <style
      id={THEME_STYLE_ELEMENT_ID}
      dangerouslySetInnerHTML={{ __html: css }}
      suppressHydrationWarning
    />
  )
}

const ThemePresetStyleScript = () => {
  const script = `(function() {
  try {
    document.documentElement.classList.add('theme-loading');
    var css = localStorage.getItem('${CacheKey.ThemePresetCss}');
    if (!css) return;
    var styleEl = document.getElementById('${THEME_STYLE_ELEMENT_ID}');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = '${THEME_STYLE_ELEMENT_ID}';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  } catch (error) {
    // Ignore errors (e.g., storage disabled)
  }
})();`
  return <script dangerouslySetInnerHTML={{ __html: script }} suppressHydrationWarning />
}

function ThemePresetSync() {
  useInsertionEffect(() => {
    applyThemePresetStyles(PRESET_ID)
    document.documentElement.classList.remove('theme-loading')
  }, [])

  return null
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      disableTransitionOnChange
      storageKey={CacheKey.Theme}
      defaultTheme={DEFAULT_THEME_MODE}
      {...props}
    >
      <ThemePresetStyleScript />
      <ThemePresetStyle />
      <ThemePresetSync />
      {children}
      <Toaster position="top-center" richColors />
    </NextThemesProvider>
  )
}
