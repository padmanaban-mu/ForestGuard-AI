import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { readLocal, writeLocal } from '../utils/storage.js';
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => readLocal('forestguard:theme', 'light') === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    writeLocal('forestguard:theme', theme);
  }, [theme]);
  const value = useMemo(() => ({ theme, isDark: theme === 'dark', toggleTheme: () => setTheme((t) => t === 'dark' ? 'light' : 'dark'), setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
