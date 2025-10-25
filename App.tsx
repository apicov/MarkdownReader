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
      if (currentScreen === 'settings') {
        handleBackToList();
        return true; // Prevent default behavior (exit app)
      }
      // Note: 'reader' screen handles its own back button in MarkdownReader component
      return false; // Allow default behavior (exit app) on list screen or let reader handle it
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
