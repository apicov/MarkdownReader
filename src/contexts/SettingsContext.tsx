import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppSettings} from '../types';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: AppSettings = {
  fontSize: 16,
  isDarkMode: false,
  docsPath: '', // User must select a folder from device
  llmApiUrl: '',
  llmApiKey: '',
  llmModel: '',
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{children: ReactNode}> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('appSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure new fields are present
        setSettings({...defaultSettings, ...parsed});
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const updated = {...settings, ...newSettings};
      setSettings(updated);
      await AsyncStorage.setItem('appSettings', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <SettingsContext.Provider value={{settings, updateSettings, isLoading}}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
