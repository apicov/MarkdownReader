import React, {useEffect, useState, useRef, useMemo, useCallback} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Text,
  ActivityIndicator,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
// Gesture handler removed - was causing native crashes with ScrollView
import Markdown from 'react-native-markdown-display';
import {useTheme} from '../contexts/ThemeContext';
import {useSettings} from '../contexts/SettingsContext';
import {Document} from '../types';
import {readMarkdownFile} from '../utils/documentService';
import {
  saveReadingPosition,
  getReadingPosition,
} from '../utils/readingPositionService';
import {translateWord} from '../utils/llmService';
import {ImageZoom} from './ImageZoom';
import {splitMarkdownIntoChunks, MarkdownChunk} from '../utils/markdownPagination';
import {File, Directory} from 'expo-file-system';

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
  const [chunks, setChunks] = useState<MarkdownChunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [renderedChunks, setRenderedChunks] = useState<string>(''); // Combined prev + current + next
  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [translationModal, setTranslationModal] = useState({
    visible: false,
    word: '',
    translation: '',
    explanation: '',
    loading: false,
  });
  const [fontSizeModalVisible, setFontSizeModalVisible] = useState(false);
  const [fileMap, setFileMap] = useState<Map<string, string>>(new Map());

  const scrollViewRef = useRef<ScrollView>(null);
  const lastScrollOffset = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const hasRestoredPosition = useRef(false);
  const isUserInteracting = useRef(false);

  useEffect(() => {
    loadDocument();
  }, [document.id]);

  useEffect(() => {
    return () => {
      saveReadingPosition(document.id, lastScrollOffset.current, currentChunkIndex);
    };
  }, [document.id, currentChunkIndex]);

  const loadDocument = async () => {
    setIsReady(false);
    hasRestoredPosition.current = false;
    isUserInteracting.current = false;
    try {
      // Build file map for fast image lookups
      const map = new Map<string, string>();
      try {
        const dir = new Directory(document.folderPath);
        const items = dir.list();
        for (const item of items) {
          if (item instanceof File) {
            map.set(item.name, item.uri);
          }
        }
      } catch (error) {
        // Folder can't be listed (e.g., when opening a single file)
        // Images won't work but document can still be read
        console.log('Could not list folder contents:', error);
      }
      setFileMap(map);

      // Parallelize file read and position read
      const [md, position] = await Promise.all([
        readMarkdownFile(document.markdownFile),
        getReadingPosition(document.id),
      ]);

      // Split content into chunks for better performance
      const markdownChunks = splitMarkdownIntoChunks(md);

      // Determine which chunk to start on based on saved position
      let initialChunkIndex = 0;
      if (position?.chunkIndex !== undefined) {
        initialChunkIndex = Math.min(position.chunkIndex, markdownChunks.length - 1);
      }

      // Set all state at once
      setContent(md);
      setChunks(markdownChunks);
      setCurrentChunkIndex(initialChunkIndex);
      lastScrollOffset.current = position?.scrollOffset || 0;
      setIsReady(true);
    } catch (error) {
      console.error('Error loading document:', error);
      setContent('Error loading document');
      setChunks([{content: 'Error loading document', startLine: 0, endLine: 0}]);
      setCurrentChunkIndex(0);
      lastScrollOffset.current = 0;
      setIsReady(true);
    }
  };

  // Update rendered content when chunk changes
  useEffect(() => {
    if (chunks.length === 0) return;
    setRenderedChunks(chunks[currentChunkIndex]?.content || '');
  }, [currentChunkIndex, chunks]);

  const handleScroll = (event: any) => {
    const {contentOffset} = event.nativeEvent;
    lastScrollOffset.current = contentOffset.y;
    isUserInteracting.current = true;
  };

  const goToNextChunk = () => {
    if (currentChunkIndex < chunks.length - 1) {
      setCurrentChunkIndex(prev => prev + 1);
      // Go to top of next chunk
      setTimeout(() => scrollViewRef.current?.scrollTo({y: 0, animated: false}), 100);
    }
  };

  const goToPrevChunk = () => {
    if (currentChunkIndex > 0) {
      setCurrentChunkIndex(prev => prev - 1);
      // Go to bottom of previous chunk
      setTimeout(() => scrollViewRef.current?.scrollToEnd({animated: false}), 100);
    }
  };

  const handlePageTap = (side: 'left' | 'right') => {
    if (!isReady) return;

    isUserInteracting.current = true;
    hasRestoredPosition.current = true;

    const screenHeight = Dimensions.get('window').height - 100;

    if (side === 'left') {
      // Scroll up or go to previous chunk if at top
      if (lastScrollOffset.current > 100) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, lastScrollOffset.current - screenHeight),
          animated: true,
        });
      } else if (currentChunkIndex > 0) {
        goToPrevChunk();
      }
    } else {
      // Scroll down or go to next chunk if near bottom
      scrollViewRef.current?.scrollTo({
        y: lastScrollOffset.current + screenHeight,
        animated: true,
      });
    }
  };

  const handleContentSizeChange = useCallback(() => {
    // Only restore position once, and only if user hasn't interacted yet
    if (!hasRestoredPosition.current &&
        !isUserInteracting.current &&
        lastScrollOffset.current > 0 &&
        scrollViewRef.current) {
      hasRestoredPosition.current = true;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: lastScrollOffset.current,
          animated: false,
        });
      }, 50);
    }
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    isUserInteracting.current = true;
    hasRestoredPosition.current = true;
  }, []);

  // Pinch gesture removed to fix native crash with ScrollView
  // TODO: Implement font size controls via buttons instead

  const handleLongPress = async (word: string) => {
    setTranslationModal({
      visible: true,
      word,
      translation: '',
      explanation: '',
      loading: true,
    });

    const result = await translateWord(
      word,
      settings.llmApiUrl || '',
      settings.llmApiKey || '',
    );

    setTranslationModal(prev => ({
      ...prev,
      translation: result.translation,
      explanation: result.explanation,
      loading: false,
    }));
  };

  const markdownStyles = useMemo(() => ({
    body: {
      color: theme.text,
      fontSize: fontSize,
      lineHeight: fontSize * 1.6,
    },
    heading1: {
      color: theme.text,
      fontSize: fontSize * 1.8,
      marginTop: 20,
      marginBottom: 10,
    },
    heading2: {
      color: theme.text,
      fontSize: fontSize * 1.5,
      marginTop: 16,
      marginBottom: 8,
    },
    heading3: {
      color: theme.text,
      fontSize: fontSize * 1.3,
      marginTop: 12,
      marginBottom: 6,
    },
    paragraph: {
      color: theme.text,
      marginBottom: 12,
    },
    image: {
      maxWidth: 200,
      maxHeight: 150,
      resizeMode: 'contain',
      marginVertical: 10,
    },
    code_inline: {
      backgroundColor: theme.border,
      color: theme.accent,
      padding: 4,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: theme.border,
      color: theme.text,
      padding: 10,
      borderRadius: 8,
      marginVertical: 10,
    },
    link: {
      color: theme.accent,
    },
  }), [theme.text, theme.border, theme.accent, fontSize]);

  const markdownRules = useMemo(() => ({
    image: (node: any) => {
      const src = node.attributes?.src || '';

      return (
        <ImageRenderer
          key={String(node.key)}
          src={src}
          fileMap={fileMap}
          style={markdownStyles.image}
          onPress={setSelectedImage}
        />
      );
    },
  }), [markdownStyles.image, fileMap]);

  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, {color: theme.accent}]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, {color: theme.text}]}
          numberOfLines={1}>
          {document.title}
        </Text>
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
          <View style={styles.contentContainer}>
            <TouchableOpacity
              style={styles.tapArea}
              activeOpacity={1}
              onPress={() => handlePageTap('left')}>
              <View style={styles.tapZoneLeft} />
            </TouchableOpacity>

            <View style={{flex: 1}}>
              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                onScroll={handleScroll}
                onScrollBeginDrag={handleScrollBeginDrag}
                scrollEventThrottle={16}
                onContentSizeChange={handleContentSizeChange}>
                {renderedChunks ? (
                  <Markdown
                    style={markdownStyles}
                    rules={markdownRules}>
                    {renderedChunks}
                  </Markdown>
                ) : (
                  <Text style={{color: theme.text, padding: 16}}>No content</Text>
                )}
              </ScrollView>

              {chunks.length > 1 && (
                <SafeAreaView edges={['bottom']} style={[styles.chunkNavContainer, {backgroundColor: theme.background}]}>
                  <View style={[styles.chunkNav, {borderTopColor: theme.border}]}>
                    <TouchableOpacity
                      onPress={goToPrevChunk}
                      disabled={currentChunkIndex === 0}
                      style={[styles.chunkButton, currentChunkIndex === 0 && styles.chunkButtonDisabled]}>
                      <Text style={[styles.chunkButtonText, {color: currentChunkIndex === 0 ? theme.border : theme.accent}]}>
                        ← Prev
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.chunkText, {color: theme.text}]}>
                      {currentChunkIndex + 1} / {chunks.length}
                    </Text>
                    <TouchableOpacity
                      onPress={goToNextChunk}
                      disabled={currentChunkIndex === chunks.length - 1}
                      style={[styles.chunkButton, currentChunkIndex === chunks.length - 1 && styles.chunkButtonDisabled]}>
                      <Text style={[styles.chunkButtonText, {color: currentChunkIndex === chunks.length - 1 ? theme.border : theme.accent}]}>
                        Next →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </SafeAreaView>
              )}
            </View>

            <TouchableOpacity
              style={styles.tapArea}
              activeOpacity={1}
              onPress={() => handlePageTap('right')}>
              <View style={styles.tapZoneRight} />
            </TouchableOpacity>
          </View>
        )}

        {selectedImage && (
          <ImageZoom
            imageUrl={selectedImage}
            visible={!!selectedImage}
            onClose={() => setSelectedImage(null)}
          />
        )}

        <Modal
          visible={translationModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setTranslationModal(prev => ({...prev, visible: false}))
          }>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() =>
              setTranslationModal(prev => ({...prev, visible: false}))
            }>
            <View
              style={[
                styles.translationModal,
                {backgroundColor: theme.background, borderColor: theme.border},
              ]}>
              <Text style={[styles.modalWord, {color: theme.accent}]}>
                {translationModal.word}
              </Text>
              {translationModal.loading ? (
                <ActivityIndicator color={theme.accent} />
              ) : (
                <>
                  <Text style={[styles.modalLabel, {color: theme.text}]}>
                    Translation:
                  </Text>
                  <Text style={[styles.modalText, {color: theme.text}]}>
                    {translationModal.translation}
                  </Text>
                  <Text
                    style={[styles.modalLabel, {color: theme.text, marginTop: 10}]}>
                    Explanation:
                  </Text>
                  <Text style={[styles.modalText, {color: theme.text}]}>
                    {translationModal.explanation}
                  </Text>
                </>
              )}
            </View>
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
  tapZoneLeft: {
    flex: 1,
  },
  tapZoneRight: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  translationModal: {
    width: '80%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalWord: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalText: {
    fontSize: 16,
  },
  chunkNavContainer: {
    borderTopWidth: 1,
  },
  chunkNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 2,
    paddingHorizontal: 16,
  },
  chunkButton: {
    padding: 10,
  },
  chunkButtonDisabled: {
    opacity: 0.3,
  },
  chunkButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chunkText: {
    fontSize: 12,
    opacity: 0.6,
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
});
