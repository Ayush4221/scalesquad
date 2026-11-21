'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { themeCookie, themeStrings } from '@/constants/strings/theme';

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const theme = root.classList.contains('dark') ? 'light' : 'dark';
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    document.cookie = `${themeCookie}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={themeStrings.switchTheme}
    >
      <Sun className="hidden dark:block" aria-hidden="true" />
      <Moon className="block dark:hidden" aria-hidden="true" />
    </Button>
  );
}
