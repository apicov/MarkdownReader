/**
 * Theme Context
 *
 * Manages application theme (light/dark mode) and provides theme colors.
 * Dark mode uses a distinctive black background with red text for night reading.
 */

import React, {createContext, useContext, useState, ReactNode} from 'react';
import {Theme} from '../types';

/**
 * Context value provided to consumers
 */
interface ThemeContextType {
  /** Whether dark mode is currently active */
  isDarkMode: boolean;
  /** Current theme colors object */
  theme: Theme;
  /** Toggle between light and dark themes */
  toggleTheme: () => void;
}

/**
 * Light theme colors - standard appearance
 */
const lightTheme: Theme = {
  background: '#FFFFFF',
  text: '#000000',
  accent: '#007AFF', // iOS blue
  border: '#E5E5E5',
};

/**
 * Dark theme colors - optimized for night reading
 * Uses black background with red text to reduce eye strain in darkness
 */
const darkTheme: Theme = {
  background: '#000000',
  text: '#FF0000', // Red text for comfortable night reading
  accent: '#FF3333',
  border: '#330000',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Theme Provider Component
 *
 * Wraps the app to provide theme context to all children.
 * Manages theme state and provides toggle functionality.
 */
export const ThemeProvider: React.FC<{children: ReactNode}> = ({children}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // Select appropriate theme based on current mode
  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{isDarkMode, theme, toggleTheme}}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 *
 * Must be used within a ThemeProvider. Provides access to current theme colors,
 * dark mode state, and theme toggle function.
 *
 * @throws Error if used outside ThemeProvider
 * @returns Theme context with colors and toggle function
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
