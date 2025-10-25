import React, {useEffect, useState, useRef, useCallback} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Text,
  ActivityIndicator,
  BackHandler,
  Alert,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../contexts/ThemeContext';
import {useSettings} from '../contexts/SettingsContext';
import {Document} from '../types';
import {readMarkdownFile} from '../utils/documentService';
import {WebViewMarkdownReader, WebViewMarkdownReaderRef} from './WebViewMarkdownReader';
import {saveReadingPosition, getReadingPosition} from '../utils/readingPositionService';

interface TocItem {
  level: number;
  text: string;
  id: string;
  hasChildren?: boolean;
}

interface MarkdownReaderProps {
  document: Document;
  onBack: () => void;
}

interface ImageRendererProps {
  src: string;
  fileMap: Map<string, string>;
  style: any;
  onPress: (uri: string) => void;
}

const ImageRenderer: React.FC<ImageRendererProps> = ({src, fileMap, style, onPress}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (src.startsWith('http')) {
      setImageUri(src);
      return;
    }

    // Get the image filename from src
    const imageName = src.replace(/^\/+/, '');

    // Look up in the pre-built file map - instant O(1) lookup!
    const uri = fileMap.get(imageName);

    if (!uri) {
      setErrorMsg(`Image not found: ${imageName}`);
      return;
    }

    setImageUri(uri);
  }, [src, fileMap]);

  if (errorMsg || !imageUri) {
    return (
      <View style={{padding: 10, backgroundColor: '#ffcccc', borderRadius: 5, marginVertical: 5}}>
        <Text style={{color: '#cc0000', fontSize: 10}}>{errorMsg || `Failed: ${src}`}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={() => onPress(imageUri)}>
      <Image
        source={{uri: imageUri}}
        style={[style, {width: 300, height: 200}]}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
};

export const MarkdownReader: React.FC<MarkdownReaderProps> = ({
  document,
  onBack,
}) => {
  const {theme, isDarkMode, toggleTheme} = useTheme();
  const {settings, updateSettings} = useSettings();
  const [content, setContent] = useState('');
  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [translationModal, setTranslationModal] = useState({
    visible: false,
    translation: '',
    loading: false,
  });
  const [fontSizeModalVisible, setFontSizeModalVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const webViewRef = useRef<WebViewMarkdownReaderRef>(null);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const scrollPositionToRestore = useRef<number | null>(null);
  const hasRestoredPosition = useRef<boolean>(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [tocModalVisible, setTocModalVisible] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const fullMarkdownRef = useRef<string>('');
  const currentLoadedEndRef = useRef<number>(0);
  const isLoadingMoreRef = useRef<boolean>(false);
  const lastScrollEventTime = useRef<number>(0);
  const CHUNK_SIZE = 100000; // Larger chunks to reduce loading frequency

  const scrollPage = (direction: 'up' | 'down') => {
    webViewRef.current?.scrollPage(direction);
  };

  const handleBack = async () => {
    // If image is expanded, close it instead of going back
    if (isImageExpanded && webViewRef.current?.closeImageModal()) {
      return;
    }

    // Show confirmation dialog before going back
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
            // Save scroll position when user confirms close
            try {
              const scrollPosition = await webViewRef.current?.getScrollPosition();
              if (scrollPosition !== undefined && scrollPosition >= 0) {
                await saveReadingPosition(document.id, scrollPosition);
              }
            } catch (error) {
              console.error('Failed to save reading position:', error);
            }
            onBack();
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, [isImageExpanded, onBack]);

  // Periodic auto-save of scroll position
  useEffect(() => {
    if (!isReady || !webViewLoaded) return;

    const saveInterval = setInterval(async () => {
      try {
        const scrollPosition = await webViewRef.current?.getScrollPosition();
        if (scrollPosition !== undefined) {
          await saveReadingPosition(document.id, scrollPosition);
        }
      } catch (error) {
        console.error('Failed to auto-save reading position:', error);
      }
    }, 3000); // Auto-save every 3 seconds

    return () => clearInterval(saveInterval);
  }, [document.id, isReady, webViewLoaded]);

  useEffect(() => {
    loadDocument();

    // Save position on unmount
    const currentWebViewRef = webViewRef;
    const currentDocumentId = document.id;

    return () => {
      // Synchronously get and save position on unmount
      (async () => {
        try {
          const scrollPosition = await currentWebViewRef.current?.getScrollPosition();
          if (scrollPosition !== undefined && scrollPosition > 0) {
            await saveReadingPosition(currentDocumentId, scrollPosition);
          }
        } catch (error) {
          console.error('Failed to save reading position on unmount:', error);
        }
      })();
    };
  }, [document.id]);

  const extractTocFromMarkdown = (markdown: string): TocItem[] => {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const toc: TocItem[] = [];
    let match;
    let index = 0;

    while ((match = headingRegex.exec(markdown)) !== null) {
      const level = match[1].length;
      let text = match[2].trim();

      // Clean up markdown formatting from heading text
      // Remove bold/italic
      text = text.replace(/\*\*(.+?)\*\*/g, '$1');  // **bold**
      text = text.replace(/\*(.+?)\*/g, '$1');      // *italic*
      text = text.replace(/__(.+?)__/g, '$1');      // __bold__
      text = text.replace(/_(.+?)_/g, '$1');        // _italic_

      // Remove inline code
      text = text.replace(/`(.+?)`/g, '$1');        // `code`

      // Remove links but keep text
      text = text.replace(/\[(.+?)\]\(.+?\)/g, '$1'); // [text](url)

      // Remove HTML tags
      text = text.replace(/<[^>]+>/g, '');

      // Decode common HTML entities
      text = text.replace(/&nbsp;/g, ' ');
      text = text.replace(/&lt;/g, '<');
      text = text.replace(/&gt;/g, '>');
      text = text.replace(/&amp;/g, '&');
      text = text.replace(/&quot;/g, '"');

      const id = `heading-${index++}`;
      toc.push({ level, text, id });
    }

    // Mark items that have children
    for (let i = 0; i < toc.length; i++) {
      const currentLevel = toc[i].level;
      // Check if next item is a child (has higher level number = deeper nesting)
      if (i + 1 < toc.length && toc[i + 1].level > currentLevel) {
        toc[i].hasChildren = true;
      }
    }

    return toc;
  };

  const loadDocument = async () => {
    setIsReady(false);
    setWebViewLoaded(false);
    hasRestoredPosition.current = false;
    isLoadingMoreRef.current = false;
    try {
      // Read the full markdown to extract TOC (lightweight operation)
      const fullMarkdown = await readMarkdownFile(document.markdownFile);
      fullMarkdownRef.current = fullMarkdown;

      // Extract TOC from full markdown
      const toc = extractTocFromMarkdown(fullMarkdown);
      setTocItems(toc);

      // Load initial chunk only
      const initialEnd = Math.min(CHUNK_SIZE, fullMarkdown.length);
      const initialContent = fullMarkdown.substring(0, initialEnd);
      currentLoadedEndRef.current = initialEnd;

      console.log(`Document: ${fullMarkdown.length} chars, loading first ${initialEnd} chars`);

      setContent(initialContent);
      setBaseUrl(document.folderPath);

      // Load saved position
      const savedPosition = await getReadingPosition(document.id);
      scrollPositionToRestore.current = savedPosition?.scrollOffset ?? null;

      setIsReady(true);
    } catch (error) {
      console.error('Error loading document:', error);
      setContent('Error loading document');
      setIsReady(true);
    }
  };

  const loadMoreContent = useCallback(async () => {
    if (isLoadingMoreRef.current) return;

    const fullMarkdown = fullMarkdownRef.current;
    const currentEnd = currentLoadedEndRef.current;

    // Check if there's more content to load
    if (currentEnd >= fullMarkdown.length) return;

    // Debounce: only trigger once per 3 seconds
    const now = Date.now();
    if (now - lastScrollEventTime.current < 3000) {
      return;
    }
    lastScrollEventTime.current = now;

    isLoadingMoreRef.current = true;

    // Load next chunk
    const nextEnd = Math.min(currentEnd + CHUNK_SIZE, fullMarkdown.length);
    const nextChunk = fullMarkdown.substring(currentEnd, nextEnd);

    console.log(`Appending: ${currentEnd} -> ${nextEnd} of ${fullMarkdown.length}`);

    // Append content directly to WebView without recreating it
    webViewRef.current?.appendContent(nextChunk);
    currentLoadedEndRef.current = nextEnd;

    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, 500);
  }, []);

  const loadPreviousContent = useCallback(async () => {
    // For now, disable loading previous content to simplify
    // User can scroll back up through already-loaded content
  }, []);

  const handleWebViewLoaded = () => {
    setWebViewLoaded(true);

    // Restore scroll position now that WebView is fully loaded
    // Only restore once per document load, and only if position > 0
    if (!hasRestoredPosition.current && scrollPositionToRestore.current !== null && scrollPositionToRestore.current > 0) {
      hasRestoredPosition.current = true; // Mark as restored immediately to prevent multiple attempts
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        const posToRestore = scrollPositionToRestore.current;
        if (posToRestore !== null && posToRestore > 0) {
          webViewRef.current?.scrollToPosition(posToRestore);
        }
      }, 800); // Longer delay to ensure WebView is fully ready
    }
  };

  const handleImageModalStateChange = (isOpen: boolean) => {
    setIsImageExpanded(isOpen);
  };

  const handleTocItemPress = (headingId: string) => {
    setTocModalVisible(false);
    webViewRef.current?.scrollToHeading(headingId);
  };

  const toggleTocItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const shouldShowTocItem = (index: number): boolean => {
    if (index === 0) return true;

    const currentLevel = tocItems[index].level;

    // Find the parent (previous item with lower level)
    for (let i = index - 1; i >= 0; i--) {
      if (tocItems[i].level < currentLevel) {
        // Found parent, check if it's expanded
        return expandedItems.has(i) && shouldShowTocItem(i);
      }
    }

    // No parent found (top level item)
    return true;
  };

  const handleTextSelected = async (text: string) => {
    // Check if translation is enabled in settings
    if (!settings.translationEnabled) {
      return;
    }

    // Validate configuration before making the request
    if (!settings.llmApiUrl) {
      Alert.alert(
        'Translation Error',
        'API URL is not configured. Please set it in Settings.',
        [{text: 'OK'}]
      );
      return;
    }

    if (!settings.llmApiKey) {
      Alert.alert(
        'Translation Error',
        'API Key is not configured. Please set it in Settings.',
        [{text: 'OK'}]
      );
      return;
    }

    if (!settings.llmModel) {
      Alert.alert(
        'Translation Error',
        'Model is not configured. Please set it in Settings.',
        [{text: 'OK'}]
      );
      return;
    }

    try {
      setTranslationModal({
        visible: true,
        translation: '',
        loading: true,
      });

      const targetLanguage = settings.targetLanguage || 'Spanish';
      const prompt = `Translate the following text to ${targetLanguage}. If the text is already in ${targetLanguage}, rewrite it in a simpler and more understandable way:\n\n${text}`;

      const response = await fetch(settings.llmApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.llmApiKey}`,
        },
        body: JSON.stringify({
          model: settings.llmModel,
          messages: [
            {
              role: 'system',
              content: `You are a helpful translation and simplification assistant. When translating, provide ONLY the translated text without any labels, prefixes, or explanations like "Translation:" or "Traducción:". When the text is already in the target language, rewrite it in simpler, clearer language while preserving the meaning. Return ONLY the final text, nothing else.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        let errorTitle = 'Translation Error';
        let errorMessage = '';

        if (response.status === 401) {
          errorMessage = 'Invalid API Key. Please check your credentials in Settings.';
        } else if (response.status === 404) {
          errorMessage = 'Invalid API URL or endpoint not found. Please check the URL in Settings.';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        } else if (response.status === 400) {
          errorMessage = 'Invalid request. Please check your Model name in Settings.';
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }

        // Close the loading modal
        setTranslationModal({
          visible: false,
          translation: '',
          loading: false,
        });

        // Show alert dialog
        Alert.alert(errorTitle, errorMessage, [{text: 'OK'}]);
        return;
      }

      const data = await response.json();
      const result = data.choices?.[0]?.message?.content || 'No translation available';

      setTranslationModal({
        visible: true,
        translation: result,
        loading: false,
      });
    } catch (error) {
      console.error('Translation error:', error);

      let errorMessage = '';

      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = 'Unknown error occurred. Please try again.';
      }

      // Close the loading modal
      setTranslationModal({
        visible: false,
        translation: '',
        loading: false,
      });

      // Show alert dialog
      Alert.alert('Translation Error', errorMessage, [{text: 'OK'}]);
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
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
          style={styles.themeButton}
          disabled={tocItems.length === 0}>
          <Text style={[styles.themeButtonText, {color: tocItems.length > 0 ? theme.accent : theme.border}]}>
            ≡
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFontSizeModalVisible(true)} style={styles.themeButton}>
          <Text style={[styles.themeButtonText, {color: theme.accent}]}>
            Aa
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleTheme} style={styles.themeButton}>
          <Text style={[styles.themeButtonText, {color: theme.accent}]}>
            {isDarkMode ? '☀️' : '🌙'}
          </Text>
        </TouchableOpacity>
      </View>

        {!isReady ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, {color: theme.text}]}>
              Loading document...
            </Text>
          </View>
        ) : (
          <SafeAreaView edges={['bottom']} style={styles.contentContainer}>
            <TouchableOpacity
              style={styles.tapArea}
              activeOpacity={1}
              onPress={() => scrollPage('up')}>
              <View style={styles.tapZone} />
            </TouchableOpacity>

            <WebViewMarkdownReader
              ref={webViewRef}
              markdown={content}
              fontSize={fontSize}
              baseUrl={baseUrl}
              onTextSelected={handleTextSelected}
              onImageModalStateChange={handleImageModalStateChange}
              onWebViewLoaded={handleWebViewLoaded}
              onScrollNearEnd={loadMoreContent}
              onScrollNearStart={loadPreviousContent}
            />

            <TouchableOpacity
              style={styles.tapArea}
              activeOpacity={1}
              onPress={() => scrollPage('down')}>
              <View style={styles.tapZone} />
            </TouchableOpacity>

            {translationModal.visible && (
              <View style={styles.translationOverlayAbsolute} pointerEvents="box-none">
                <SafeAreaView edges={['bottom']} style={styles.translationSafeArea} pointerEvents="box-none">
                  <View
                    pointerEvents="auto"
                    style={[
                      styles.translationFloating,
                      {backgroundColor: theme.background, borderColor: theme.border},
                    ]}>
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => {
                        setTranslationModal(prev => ({...prev, visible: false}));
                      }}>
                      <Text style={[styles.closeButtonText, {color: theme.text}]}>✕</Text>
                    </TouchableOpacity>
                    {translationModal.loading ? (
                      <ActivityIndicator color={theme.accent} />
                    ) : (
                      <Text style={[styles.translationText, {color: theme.text}]}>
                        {translationModal.translation}
                      </Text>
                    )}
                  </View>
                </SafeAreaView>
              </View>
            )}
          </SafeAreaView>
        )}

        <Modal
          visible={tocModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setTocModalVisible(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setTocModalVisible(false)}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[
                styles.tocModal,
                {backgroundColor: theme.background, borderColor: theme.border},
              ]}>
              <View style={styles.tocHeader}>
                <Text style={[styles.tocTitle, {color: theme.text}]}>Table of Contents</Text>
                <TouchableOpacity onPress={() => setTocModalVisible(false)}>
                  <Text style={[styles.closeButtonText, {color: theme.text}]}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.tocList}>
                {tocItems.map((item, index) => {
                  if (!shouldShowTocItem(index)) return null;

                  const isExpanded = expandedItems.has(index);

                  return (
                    <View key={index} style={[
                      styles.tocItem,
                      {paddingLeft: (item.level - 1) * 16 + 16},
                    ]}>
                      <View style={styles.tocItemRow}>
                        {item.hasChildren && (
                          <TouchableOpacity
                            onPress={() => toggleTocItem(index)}
                            style={styles.tocExpandButton}
                            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                            <Text style={[styles.tocExpandIcon, {color: theme.accent}]}>
                              {isExpanded ? '−' : '+'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.tocItemTextContainer, !item.hasChildren && styles.tocItemTextContainerNoIcon]}
                          onPress={() => handleTocItemPress(item.id)}>
                          <Text
                            style={[
                              styles.tocItemText,
                              {
                                color: theme.text,
                                fontSize: Math.max(14, 18 - item.level),
                                fontWeight: item.level === 1 ? 'bold' : item.level === 2 ? '600' : 'normal',
                              },
                            ]}
                            numberOfLines={2}>
                            {item.text}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={fontSizeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFontSizeModalVisible(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setFontSizeModalVisible(false)}>
            <View
              style={[
                styles.fontSizeModal,
                {backgroundColor: theme.background, borderColor: theme.border},
              ]}>
              <Text style={[styles.modalLabel, {color: theme.text, marginBottom: 20}]}>
                Font Size: {fontSize}
              </Text>
              <View style={styles.fontSizeButtons}>
                <TouchableOpacity
                  style={[styles.fontSizeButton, {backgroundColor: theme.accent}]}
                  onPress={() => {
                    const newSize = Math.max(12, fontSize - 2);
                    setFontSize(newSize);
                    updateSettings({fontSize: newSize});
                  }}>
                  <Text style={styles.fontSizeButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fontSizeButton, {backgroundColor: theme.accent}]}
                  onPress={() => {
                    const newSize = Math.min(32, fontSize + 2);
                    setFontSize(newSize);
                    updateSettings({fontSize: newSize});
                  }}>
                  <Text style={styles.fontSizeButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  translationOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  translationOverlayAbsolute: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  translationSafeArea: {
    width: '100%',
  },
  translationFloating: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    minHeight: 80,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    opacity: 0.7,
  },
  translationText: {
    fontSize: 16,
    lineHeight: 24,
    paddingRight: 40,
  },
  themeButton: {
    padding: 8,
    marginLeft: 8,
  },
  themeButtonText: {
    fontSize: 24,
  },
  fontSizeModal: {
    width: '80%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  fontSizeButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  fontSizeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontSizeButtonText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  tocModal: {
    width: '85%',
    maxHeight: '70%',
    marginTop: 'auto',
    marginBottom: 'auto',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tocTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tocList: {
    maxHeight: '100%',
  },
  tocItem: {
    paddingVertical: 8,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tocItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tocExpandButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tocExpandIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tocItemTextContainer: {
    flex: 1,
    paddingVertical: 4,
  },
  tocItemTextContainerNoIcon: {
    marginLeft: 32,
  },
  tocItemText: {
    lineHeight: 20,
  },
  modalLabel: {
    fontSize: 16,
  },
});
