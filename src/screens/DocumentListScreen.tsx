import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../contexts/ThemeContext';
import {useSettings} from '../contexts/SettingsContext';
import {Document} from '../types';
import {getDocuments} from '../utils/documentService';

const DOCUMENTS_CACHE_KEY = '@documents_cache';

interface DocumentListScreenProps {
  onDocumentSelect: (doc: Document) => void;
  onOpenSettings: () => void;
}

export const DocumentListScreen: React.FC<DocumentListScreenProps> = ({
  onDocumentSelect,
  onOpenSettings,
}) => {
  const {theme, isDarkMode, toggleTheme} = useTheme();
  const {settings, isLoading: settingsLoading} = useSettings();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastDocsPath, setLastDocsPath] = useState<string>('');

  // Load cached documents on mount
  useEffect(() => {
    loadCachedDocuments();
  }, []);

  // Only load documents when docs path changes
  useEffect(() => {
    if (!settingsLoading && settings.docsPath && settings.docsPath !== lastDocsPath) {
      loadDocuments();
      setLastDocsPath(settings.docsPath);
    }
  }, [settings.docsPath, settingsLoading]);

  const loadCachedDocuments = async () => {
    try {
      const cached = await AsyncStorage.getItem(DOCUMENTS_CACHE_KEY);
      if (cached) {
        setDocuments(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Error loading cached documents:', error);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = getDocuments(settings.docsPath);
      setDocuments(docs);
      // Save to cache
      await AsyncStorage.setItem(DOCUMENTS_CACHE_KEY, JSON.stringify(docs));
    } catch (error) {
      console.error('Error loading documents:', error);
    }
    setLoading(false);
  };

  const handleOpenFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/*',
        copyToCacheDirectory: false,
      });

      if (result.canceled) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        // Extract folder path from file URI
        const folderPath = file.uri.substring(0, file.uri.lastIndexOf('/'));
        // Create a temporary document object for the selected file
        const tempDoc: Document = {
          id: file.uri,
          title: file.name,
          folderPath: folderPath,
          markdownFile: file.uri,
        };
        onDocumentSelect(tempDoc);
      }
    } catch (error) {
      console.error('File picker error:', error);
      Alert.alert('Error', 'Failed to open file');
    }
  };

  const renderDocument = ({item}: {item: Document}) => (
    <TouchableOpacity
      style={[styles.documentItem, {borderBottomColor: theme.border}]}
      onPress={() => onDocumentSelect(item)}>
      <Text style={[styles.documentTitle, {color: theme.text}]}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <View style={styles.header}>
        <Text style={[styles.headerTitle, {color: theme.text}]}>
          Markdown Reader
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={handleOpenFile} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, {color: theme.accent}]}>
              📄
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={loadDocuments} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, {color: theme.accent}]}>
              🔄
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, {color: theme.accent}]}>
              {isDarkMode ? '☀️' : '🌙'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenSettings} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, {color: theme.accent}]}>
              ⚙️
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.loadingText, {color: theme.text}]}>
            Loading documents...
          </Text>
        </View>
      ) : documents.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, {color: theme.text}]}>
            {settings.docsPath
              ? 'No documents found'
              : 'No folder selected'}
          </Text>
          <Text style={[styles.emptySubtext, {color: theme.text}]}>
            {settings.docsPath
              ? 'Tap the 🔄 button to scan for documents'
              : 'Tap the ⚙️ icon and select a folder from your phone'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderDocument}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 4,
  },
  headerButtonText: {
    fontSize: 24,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  documentItem: {
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  documentTitle: {
    fontSize: 18,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'left',
    marginTop: 16,
    fontFamily: 'monospace',
  },
  setupButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
