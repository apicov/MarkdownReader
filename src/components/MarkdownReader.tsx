/**
 * Markdown Reader Component
 *
 * Main orchestrator for the markdown reading experience.
 * Coordinates document loading, TOC navigation, translation,
 * and scroll position management.
 *
 * This component focuses on high-level orchestration, delegating:
 * - Translation to useTranslation hook
 * - TOC extraction to tocService
 * - Rendering and lazy image loading to WebViewMarkdownReader
 * - UI modals to separate components
 */

import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  BackHandler,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../contexts/ThemeContext';
import {useSettings} from '../contexts/SettingsContext';
import {Document} from '../types';
import {readMarkdownFile} from '../utils/documentService';
import {WebViewMarkdownReader, WebViewMarkdownReaderRef} from './WebViewMarkdownReader';
import {saveReadingPosition, getReadingPosition} from '../utils/readingPositionService';
import {extractTableOfContents, TocItem} from '../utils/tocService';
import {useTranslation} from '../hooks/useTranslation';
import {TranslationModal} from './TranslationModal';
import {TableOfContentsModal} from './TableOfContentsModal';
import {FontSizeModal} from './FontSizeModal';
import {
  AUTO_SAVE_INTERVAL_MS,
  SCROLL_RESTORE_DELAY_MS,
} from '../constants';

interface MarkdownReaderProps {
  document: Document;
  onBack: () => void;
}

/**
 * Main markdown reader component
 *
 * Handles document loading, chunked pagination, navigation, and user interactions.
 */
export const MarkdownReader: React.FC<MarkdownReaderProps> = ({
  document,
  onBack,
}) => {
  // ============================================================================
  // CONTEXTS & HOOKS
  // ============================================================================

  const {theme, isDarkMode, toggleTheme} = useTheme();
  const {settings, updateSettings} = useSettings();
  const {translate, state: translationState, clearTranslation} = useTranslation();

  // ============================================================================
  // STATE
  // ============================================================================

  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [fontSizeModalVisible, setFontSizeModalVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [tocModalVisible, setTocModalVisible] = useState(false);
  const [markdown, setMarkdown] = useState('');

  // ============================================================================
  // REFS
  // ============================================================================

  const webViewRef = useRef<WebViewMarkdownReaderRef>(null);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const scrollPositionToRestore = useRef<number | null>(null);
  const hasRestoredPosition = useRef<boolean>(false);


  // ============================================================================
  // SCROLL POSITION MANAGEMENT
  // ============================================================================

  /**
   * Save current reading position to persistent storage
   */
  const saveCurrentPosition = async () => {
    try {
      const scrollPosition = await webViewRef.current?.getScrollPosition();
      if (scrollPosition !== undefined && scrollPosition >= 0) {
        await saveReadingPosition(document.id, scrollPosition);
      }
    } catch (error) {
      console.error('Failed to save reading position:', error);
    }
  };

  /**
   * Restore scroll position after WebView loads
   */
  const restoreScrollPosition = () => {
    if (!hasRestoredPosition.current && scrollPositionToRestore.current !== null && scrollPositionToRestore.current > 0) {
      hasRestoredPosition.current = true;
      setTimeout(() => {
        const posToRestore = scrollPositionToRestore.current;
        if (posToRestore !== null && posToRestore > 0) {
          webViewRef.current?.scrollToPosition(posToRestore);
        }
      }, SCROLL_RESTORE_DELAY_MS);
    }
  };

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  /**
   * Handle back button - save position and exit
   */
  const handleBack = async () => {
    // If image is expanded, close it instead of going back
    if (isImageExpanded && webViewRef.current?.closeImageModal()) {
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Close Document',
      'Do you want to close this document?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Close',
          onPress: async () => {
            await saveCurrentPosition();
            onBack();
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  /**
   * Scroll by one page height
   */
  const scrollPage = (direction: 'up' | 'down') => {
    webViewRef.current?.scrollPage(direction);
  };

  // ============================================================================
  // TOC NAVIGATION
  // ============================================================================

  /**
   * Handle TOC item selection - jump to heading
   */
  const handleTocItemPress = async (headingId: string) => {
    setTocModalVisible(false);
    webViewRef.current?.scrollToHeading(headingId);
  };

  // ============================================================================
  // TRANSLATION
  // ============================================================================

  /**
   * Handle text selection from WebView
   */
  const handleTextSelected = async (text: string) => {
    const result = await translate(text);
    // Translation state is managed by the hook and displayed by TranslationModal
  };

  /**
   * Close translation modal
   */
  const handleCloseTranslation = () => {
    clearTranslation();
  };

  // ============================================================================
  // FONT SIZE
  // ============================================================================

  /**
   * Handle font size change from modal
   */
  const handleFontSizeChange = (newSize: number) => {
    setFontSize(newSize);
    updateSettings({fontSize: newSize});
  };

  // ============================================================================
  // DOCUMENT LOADING
  // ============================================================================

  /**
   * Load markdown document and initialize
   */
  const loadDocument = async () => {
    setIsReady(false);
    setWebViewLoaded(false);
    hasRestoredPosition.current = false;

    try {
      // Read full markdown content
      const content = await readMarkdownFile(document.markdownFile);

      // Extract table of contents
      const toc = extractTableOfContents(content);
      setTocItems(toc);

      // Load saved reading position
      const savedPosition = await getReadingPosition(document.id);
      const savedScrollOffset = savedPosition?.scrollOffset ?? 0;

      // Store scroll position to restore
      scrollPositionToRestore.current = savedScrollOffset;

      // Set base URL for images
      setBaseUrl(document.folderPath);

      // Set markdown content
      setMarkdown(content);
      setIsReady(true);

      console.log(`Document loaded: ${content.length} chars`);
    } catch (error) {
      console.error('Error loading document:', error);
      Alert.alert('Error', 'Failed to load document');
      setIsReady(true);
    }
  };


  // ============================================================================
  // WEBVIEW CALLBACKS
  // ============================================================================

  /**
   * Handle WebView load complete
   */
  const handleWebViewLoaded = () => {
    setWebViewLoaded(true);
    restoreScrollPosition();
  };

  /**
   * Handle image modal state changes
   */
  const handleImageModalStateChange = (isOpen: boolean) => {
    setIsImageExpanded(isOpen);
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load document on mount
  useEffect(() => {
    loadDocument();

    // Save position on unmount
    return () => {
      (async () => {
        await saveCurrentPosition();
      })();
    };
  }, [document.id]);

  // Auto-save position periodically
  useEffect(() => {
    if (!isReady || !webViewLoaded) return;

    const saveInterval = setInterval(async () => {
      await saveCurrentPosition();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => clearInterval(saveInterval);
  }, [document.id, isReady, webViewLoaded]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, [isImageExpanded, onBack]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, {color: theme.accent}]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, {color: theme.text}]}
          numberOfLines={1}>
          {document.title}
        </Text>
        <TouchableOpacity
          onPress={() => setTocModalVisible(true)}
          style={styles.headerButton}
          disabled={tocItems.length === 0}>
          <Text style={[styles.headerButtonText, {color: tocItems.length > 0 ? theme.accent : theme.border}]}>
            ≡
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFontSizeModalVisible(true)} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, {color: theme.accent}]}>
            Aa
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleTheme} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, {color: theme.accent}]}>
            {isDarkMode ? '☀️' : '🌙'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {!isReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, {color: theme.text}]}>
            Loading document...
          </Text>
        </View>
      ) : (
        <SafeAreaView edges={['bottom']} style={styles.contentContainer}>
          {/* Left tap zone */}
          <TouchableOpacity
            style={styles.tapArea}
            activeOpacity={1}
            onPress={() => scrollPage('up')}>
            <View style={styles.tapZone} />
          </TouchableOpacity>

          {/* WebView */}
          <WebViewMarkdownReader
            ref={webViewRef}
            markdown={markdown}
            fontSize={fontSize}
            baseUrl={baseUrl}
            onTextSelected={handleTextSelected}
            onImageModalStateChange={handleImageModalStateChange}
            onWebViewLoaded={handleWebViewLoaded}
          />

          {/* Right tap zone */}
          <TouchableOpacity
            style={styles.tapArea}
            activeOpacity={1}
            onPress={() => scrollPage('down')}>
            <View style={styles.tapZone} />
          </TouchableOpacity>

          {/* Translation Modal */}
          <TranslationModal
            visible={translationState.translation !== null}
            translation={translationState.translation}
            loading={translationState.isTranslating}
            onClose={handleCloseTranslation}
          />
        </SafeAreaView>
      )}

      {/* Table of Contents Modal */}
      <TableOfContentsModal
        visible={tocModalVisible}
        items={tocItems}
        onItemPress={handleTocItemPress}
        onClose={() => setTocModalVisible(false)}
      />

      {/* Font Size Modal */}
      <FontSizeModal
        visible={fontSizeModalVisible}
        fontSize={fontSize}
        onFontSizeChange={handleFontSizeChange}
        onClose={() => setFontSizeModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    paddingTop: 32,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerButtonText: {
    fontSize: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  tapArea: {
    width: 40,
    justifyContent: 'center',
  },
  tapZone: {
    flex: 1,
  },
});
