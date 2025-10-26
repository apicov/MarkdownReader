/**
 * Settings Context
 *
 * Manages application-wide settings with persistent storage.
 * Settings include font size, document path, and LLM API configuration.
 * All settings are automatically saved to AsyncStorage.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppSettings} from '../types';
import {DEFAULT_FONT_SIZE, STORAGE_KEY_APP_SETTINGS} from '../constants';

/**
 * Context value provided to consumers
 */
interface SettingsContextType {
  /** Current settings object */
  settings: AppSettings;
  /** Update settings (merges with existing, auto-saves) */
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  /** Whether settings are currently being loaded from storage */
  isLoading: boolean;
}

/**
 * Default settings applied on first launch or after reset
 */
const defaultSettings: AppSettings = {
  fontSize: DEFAULT_FONT_SIZE,
  isDarkMode: false,
  docsPath: '', // User must select a folder from device
  llmApiUrl: '',
  llmApiKey: '',
  llmModel: '',
  targetLanguage: '',
  translationEnabled: true,
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

/**
 * Settings Provider Component
 *
 * Wraps the app to provide settings context to all children.
 * Automatically loads settings from storage on mount.
 */
export const SettingsProvider: React.FC<{children: ReactNode}> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from persistent storage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * Load settings from AsyncStorage
   * Merges with defaults to ensure backward compatibility when new fields are added
   */
  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_APP_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure new fields are present
        // This ensures backward compatibility when adding new settings
        setSettings({...defaultSettings, ...parsed});
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Continue with default settings on error
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update settings and persist to storage
   * Merges new settings with existing ones
   */
  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const updated = {...settings, ...newSettings};
      setSettings(updated);
      await AsyncStorage.setItem(STORAGE_KEY_APP_SETTINGS, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Don't revert state - keep UI consistent even if save fails
    }
  };

  return (
    <SettingsContext.Provider value={{settings, updateSettings, isLoading}}>
      {children}
    </SettingsContext.Provider>
  );
};

/**
 * Hook to access settings context
 *
 * Must be used within a SettingsProvider. Provides access to current settings
 * and the updateSettings function.
 *
 * @throws Error if used outside SettingsProvider
 * @returns Settings context with current settings and update function
 */
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
