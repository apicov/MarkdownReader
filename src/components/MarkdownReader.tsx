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
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../contexts/ThemeContext';
import {useSettings} from '../contexts/SettingsContext';
import {Document} from '../types';
import {readMarkdownFile} from '../utils/documentService';
import {WebViewMarkdownReader, WebViewMarkdownReaderRef} from './WebViewMarkdownReader';

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

  const scrollPage = (direction: 'up' | 'down') => {
    webViewRef.current?.scrollPage(direction);
  };

  const handleBack = () => {
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
          onPress: onBack,
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

  useEffect(() => {
    loadDocument();
  }, [document.id]);

  const loadDocument = async () => {
    setIsReady(false);
    try {
      const md = await readMarkdownFile(document.markdownFile);
      setContent(md);
      setBaseUrl(document.folderPath);
      setIsReady(true);
    } catch (error) {
      console.error('Error loading document:', error);
      setContent('Error loading document');
      setIsReady(true);
    }
  };

  const handleImageModalStateChange = (isOpen: boolean) => {
    setIsImageExpanded(isOpen);
  };

  const handleTextSelected = async (text: string) => {
    try {
      setTranslationModal({
        visible: true,
        translation: '',
        loading: true,
      });

      const targetLanguage = settings.targetLanguage || 'Spanish';
      const prompt = `Translate the following text to ${targetLanguage}. If the text is already in ${targetLanguage}, rewrite it in a simpler and more understandable way:\n\n${text}`;

      const response = await fetch(settings.llmApiUrl || '', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.llmApiKey}`,
        },
        body: JSON.stringify({
          model: settings.llmModel || 'gpt-3.5-turbo',
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
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const result = data.choices?.[0]?.message?.content || 'No translation available';

      setTranslationModal(prev => ({
        ...prev,
        translation: result,
        loading: false,
      }));
    } catch (error) {
      console.error('Translation error:', error);
      setTranslationModal({
        visible: true,
        translation: 'Failed to translate. Please configure API settings.',
        loading: false,
      });
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
});
