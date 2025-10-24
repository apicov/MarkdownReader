import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {useSettings} from '../contexts/SettingsContext';
import {Document} from '../types';
import {getDocuments} from '../utils/documentService';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!settingsLoading) {
      loadDocuments();
    }
  }, [settings.docsPath, settingsLoading]);

  const loadDocuments = () => {
    setLoading(true);
    try {
      const docs = getDocuments(settings.docsPath);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
    setLoading(false);
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
              ? `No markdown folders found in:\n${settings.docsPath}`
              : 'Tap the ⚙️ icon and select a folder from your phone'}
          </Text>
          {!settings.docsPath && (
            <TouchableOpacity
              style={[styles.setupButton, {backgroundColor: theme.accent}]}
              onPress={onOpenSettings}>
              <Text style={styles.setupButtonText}>Open Settings</Text>
            </TouchableOpacity>
          )}
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
