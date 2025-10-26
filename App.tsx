/**
 * Main Application Entry Point
 *
 * Manages top-level navigation between three screens:
 * - Document List: Browse available markdown documents
 * - Settings: Configure app preferences and LLM API
 * - Reader: View and interact with markdown content
 *
 * Wraps the app with required providers for gestures, themes, and settings.
 */

import React, {useState, useEffect} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {BackHandler, View} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import {ThemeProvider} from './src/contexts/ThemeContext';
import {SettingsProvider} from './src/contexts/SettingsContext';
import {DocumentListScreen} from './src/screens/DocumentListScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {MarkdownReader} from './src/components/MarkdownReader';
import {Document} from './src/types';

/** Available screen types for navigation */
type Screen = 'list' | 'settings' | 'reader';

export default function App() {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [currentScreen, setCurrentScreen] = useState<Screen>('list');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null,
  );

  // ============================================================================
  // PERMISSIONS
  // ============================================================================

  // Request media library permissions on mount (for future file access features)
  useEffect(() => {
    (async () => {
      const {status} = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Storage permission not granted');
      }
    })();
  }, []);

  // ============================================================================
  // ANDROID BACK BUTTON HANDLING
  // ============================================================================

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentScreen === 'settings') {
        handleBackToList();
        return true; // Prevent default behavior (exit app)
      }
      // Note: 'reader' screen handles its own back button in MarkdownReader component
      return false; // Allow default behavior (exit app) on list screen or let reader handle it
    });

    return () => backHandler.remove();
  }, [currentScreen]);

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  /**
   * Navigate to reader screen with selected document
   */
  const handleDocumentSelect = (doc: Document) => {
    setSelectedDocument(doc);
    setCurrentScreen('reader');
  };

  /**
   * Navigate back to document list from any screen
   */
  const handleBackToList = () => {
    setCurrentScreen('list');
    setSelectedDocument(null);
  };

  // ============================================================================
  // SCREEN RENDERING
  // ============================================================================

  /**
   * Render all screens with conditional display
   * Document list is kept mounted but hidden to preserve state
   */
  const renderScreen = () => {
    return (
      <>
        <View style={{flex: 1, display: currentScreen === 'list' ? 'flex' : 'none'}}>
          <DocumentListScreen
            onDocumentSelect={handleDocumentSelect}
            onOpenSettings={() => setCurrentScreen('settings')}
          />
        </View>
        {currentScreen === 'settings' && (
          <View style={{flex: 1}}>
            <SettingsScreen onBack={handleBackToList} />
          </View>
        )}
        {currentScreen === 'reader' && selectedDocument && (
          <View style={{flex: 1}}>
            <MarkdownReader document={selectedDocument} onBack={handleBackToList} />
          </View>
        )}
      </>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <SettingsProvider>
          <ThemeProvider>{renderScreen()}</ThemeProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
