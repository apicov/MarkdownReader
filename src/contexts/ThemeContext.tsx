import React, {createContext, useContext, useState, ReactNode} from 'react';
import {Theme} from '../types';

interface ThemeContextType {
  isDarkMode: boolean;
  theme: Theme;
  toggleTheme: () => void;
}

const lightTheme: Theme = {
  background: '#FFFFFF',
  text: '#000000',
  accent: '#007AFF',
  border: '#E5E5E5',
};

const darkTheme: Theme = {
  background: '#000000',
  text: '#FF0000',
  accent: '#FF3333',
  border: '#330000',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{children: ReactNode}> = ({children}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{isDarkMode, theme, toggleTheme}}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
