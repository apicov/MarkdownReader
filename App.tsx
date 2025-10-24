import React, {useState, useEffect} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {BackHandler} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import {ThemeProvider} from './src/contexts/ThemeContext';
import {SettingsProvider} from './src/contexts/SettingsContext';
import {DocumentListScreen} from './src/screens/DocumentListScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {MarkdownReader} from './src/components/MarkdownReader';
import {Document} from './src/types';

type Screen = 'list' | 'settings' | 'reader';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('list');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      const {status} = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Storage permission not granted');
      }
    })();
  }, []);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentScreen === 'reader' || currentScreen === 'settings') {
        handleBackToList();
        return true; // Prevent default behavior (exit app)
      }
      return false; // Allow default behavior (exit app) on list screen
    });

    return () => backHandler.remove();
  }, [currentScreen]);

  const handleDocumentSelect = (doc: Document) => {
    setSelectedDocument(doc);
    setCurrentScreen('reader');
  };

  const handleBackToList = () => {
    setCurrentScreen('list');
    setSelectedDocument(null);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'settings':
        return <SettingsScreen onBack={handleBackToList} />;
      case 'reader':
        return selectedDocument ? (
          <MarkdownReader document={selectedDocument} onBack={handleBackToList} />
        ) : null;
      case 'list':
      default:
        return (
          <DocumentListScreen
            onDocumentSelect={handleDocumentSelect}
            onOpenSettings={() => setCurrentScreen('settings')}
          />
        );
    }
  };

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
