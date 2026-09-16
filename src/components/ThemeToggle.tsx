import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'rounded-2xl' | 'circle';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'rounded-2xl',
  className = '',
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'circle') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`w-10 h-10 rounded-full border border-slate-200/90 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-amber-400 hover:bg-indigo-50 dark:hover:bg-slate-800 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center shadow-2xs shrink-0 ${className}`}
        title={isDark ? 'Ganti ke Mode Terang (Light)' : 'Ganti ke Mode Gelap (Dark)'}
        aria-label="Toggle Dark Mode"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 animate-in fade-in zoom-in duration-200" />
        ) : (
          <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300 animate-in fade-in zoom-in duration-200" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-amber-400 hover:bg-indigo-50 dark:hover:bg-slate-700/80 active:scale-95 border border-slate-200/80 dark:border-slate-700 transition-all duration-200 cursor-pointer flex items-center justify-center ${className}`}
      title={isDark ? 'Ganti ke Mode Terang (Light)' : 'Ganti ke Mode Gelap (Dark)'}
      aria-label="Toggle Dark Mode"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 animate-in fade-in zoom-in duration-200" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300 animate-in fade-in zoom-in duration-200" />
      )}
    </button>
  );
};
