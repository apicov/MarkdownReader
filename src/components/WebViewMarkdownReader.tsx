import React, {useRef, useState, useEffect, useImperativeHandle, forwardRef} from 'react';
import {View, StyleSheet, ActivityIndicator} from 'react-native';
import WebView from 'react-native-webview';
import {useTheme} from '../contexts/ThemeContext';
import {File, Directory, Paths} from 'expo-file-system';

interface WebViewMarkdownReaderProps {
  markdown: string;
  fontSize: number;
  baseUrl?: string;
  onTextSelected?: (text: string) => void;
  onImageModalStateChange?: (isOpen: boolean) => void;
}

export interface WebViewMarkdownReaderRef {
  closeImageModal: () => boolean;
  scrollPage: (direction: 'up' | 'down') => void;
}

export const WebViewMarkdownReader = forwardRef<WebViewMarkdownReaderRef, WebViewMarkdownReaderProps>(({
  markdown,
  fontSize,
  baseUrl = '',
  onTextSelected,
  onImageModalStateChange,
}, ref) => {
  const {theme} = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const pendingImagesRef = useRef<Map<string, string> | null>(null);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  // Create HTML file when markdown or theme changes
  useEffect(() => {
    createHtmlFile();
  }, [markdown, fontSize, theme]);

  const createHtmlFile = async () => {
    // Replace images with placeholders first, then load them async
    let processedMarkdown = markdown;
    const imagePlaceholders = new Map<string, string>(); // imagePath -> placeholder ID

    if (baseUrl) {
      // Replace image paths with placeholder IDs
      let placeholderIndex = 0;
      processedMarkdown = markdown.replace(/!\[([^\]]*)\]\((?!http)([^)]+)\)/g, (match, alt, imagePath) => {
        const cleanPath = imagePath.trim().replace(/^\.?\//, '');
        const placeholderId = `img-placeholder-${placeholderIndex++}`;
        imagePlaceholders.set(cleanPath, placeholderId);
        return `![${alt}](#${placeholderId})`;
      });
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      overflow-x: hidden;
      width: 100%;
      max-width: 100%;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${fontSize}px;
      line-height: ${fontSize * 1.6}px;
      color: ${theme.text};
      background-color: ${theme.background};
      padding: 16px;
      -webkit-user-select: text;
      user-select: text;
      overflow-y: auto;
      overflow-x: hidden;
    }
    #content {
      max-width: 100%;
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: break-word;
    }
    h1 { font-size: ${fontSize * 1.8}px; margin: 20px 0 10px; }
    h2 { font-size: ${fontSize * 1.5}px; margin: 16px 0 8px; }
    h3 { font-size: ${fontSize * 1.3}px; margin: 12px 0 6px; }
    p {
      margin-bottom: 12px;
      max-width: 100%;
      overflow-wrap: break-word;
    }
    img {
      max-width: 100%;
      height: auto;
      margin: 10px 0;
      display: block;
      cursor: pointer;
    }
    #imageModal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    }
    #imageModal.active {
      display: flex;
    }
    body.modal-open {
      overflow: hidden;
    }
    #imageModal img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      transition: transform 0.2s;
    }
    table {
      max-width: 100%;
      overflow-x: auto;
      display: block;
    }
    code {
      background-color: ${theme.border};
      color: ${theme.accent};
      padding: 2px 6px;
      border-radius: 4px;
      font-size: ${fontSize * 0.9}px;
    }
    pre {
      background-color: ${theme.border};
      padding: 10px;
      border-radius: 8px;
      margin: 10px 0;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    a { color: ${theme.accent}; }

  </style>
</head>
<body>
  <div id="content"></div>
  <div id="imageModal">
    <img id="modalImage" />
  </div>
  <script>
    // Render markdown
    const markdown = ${JSON.stringify(processedMarkdown)};
    document.getElementById('content').innerHTML = marked.parse(markdown);

    // Image modal functionality
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    window.currentScale = 1;
    window.currentX = 0;
    window.currentY = 0;
    let lastTouchDistance = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let wasPinching = false;
    let pinchEndTime = 0;

    // Add click listeners to all images
    function setupImageListeners() {
      document.querySelectorAll('#content img').forEach(img => {
        img.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          modalImage.src = img.src;
          modal.classList.add('active');
          document.body.classList.add('modal-open');
          window.currentScale = 1;
          window.currentX = 0;
          window.currentY = 0;
          updateModalImageTransform();
          // Notify React Native that image modal is open
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'imageModalStateChanged',
            isOpen: true
          }));
        });
      });
    }

    setupImageListeners();

    // Prevent scrolling on modal
    modal.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });

    // Close modal on click/tap outside image
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        // Notify React Native that image modal is closed
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'imageModalStateChanged',
          isOpen: false
        }));
      }
    });

    // Pinch to zoom
    modalImage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        wasPinching = true;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTouchDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
      } else if (e.touches.length === 1) {
        // Don't start dragging immediately after pinch (300ms grace period)
        const timeSincePinch = Date.now() - pinchEndTime;
        if (!wasPinching || timeSincePinch > 300) {
          isDragging = true;
          dragStartX = e.touches[0].clientX - window.currentX;
          dragStartY = e.touches[0].clientY - window.currentY;
        }
      }
    });

    modalImage.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        wasPinching = true;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        if (lastTouchDistance > 0) {
          const scale = distance / lastTouchDistance;
          window.currentScale = Math.min(Math.max(1, window.currentScale * scale), 5);
          updateModalImageTransform();
        }
        lastTouchDistance = distance;
      } else if (e.touches.length === 1 && isDragging && window.currentScale > 1) {
        // Don't drag if we just finished pinching
        const timeSincePinch = Date.now() - pinchEndTime;
        if (!wasPinching || timeSincePinch > 300) {
          e.preventDefault();
          window.currentX = e.touches[0].clientX - dragStartX;
          window.currentY = e.touches[0].clientY - dragStartY;
          updateModalImageTransform();
        }
      }
    });

    modalImage.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        lastTouchDistance = 0;
        if (wasPinching) {
          pinchEndTime = Date.now();
        }
      }
      if (e.touches.length === 0) {
        isDragging = false;
        setTimeout(() => {
          wasPinching = false;
        }, 300);
      }
    });

    window.updateModalImageTransform = function() {
      modalImage.style.transform = \`translate(\${window.currentX}px, \${window.currentY}px) scale(\${window.currentScale})\`;
    };
    const updateModalImageTransform = window.updateModalImageTransform;

    // Function to close image modal (can be called from React Native)
    window.closeImageModal = function() {
      if (modal.classList.contains('active')) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'imageModalStateChanged',
          isOpen: false
        }));
        return true;
      }
      return false;
    };

    // Detect text selection - wait longer to ensure full selection is captured
    let selectionTimeout;
    document.addEventListener('selectionchange', () => {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText.length > 0) {
          // Send selected text to React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'textSelected',
            text: selectedText
          }));
        }
      }, 500); // Increased timeout to capture full selection
    });


    // Signal that page is loaded
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'loaded'
    }));
  </script>
</body>
</html>
`;

    try {
      // Write HTML to temporary file using new File API
      const tempFileName = `markdown_${Date.now()}.html`;
      const tempHtmlFile = new File(Paths.cache, tempFileName);
      await tempHtmlFile.write(html);
      setHtmlUri(tempHtmlFile.uri);

      // Store pending images to load after WebView is ready
      if (baseUrl && imagePlaceholders.size > 0) {
        pendingImagesRef.current = imagePlaceholders;
      }
    } catch (error) {
      console.error('Error creating HTML file:', error);
    }
  };

  const loadImagesAsync = async (imagePlaceholders: Map<string, string>) => {
    try {
      const baseDir = new Directory(baseUrl);
      const items = baseDir.list();
      const fileMap = new Map<string, File>();

      for (const item of items) {
        if (item instanceof File) {
          fileMap.set(item.name, item);
        }
      }

      // Load images one by one and inject into WebView
      for (const [imagePath, placeholderId] of imagePlaceholders.entries()) {
        const file = fileMap.get(imagePath);
        if (file) {
          try {
            const base64 = await file.base64();
            const ext = file.extension?.toLowerCase() || 'jpeg';
            const mimeType = ext === 'png' ? 'image/png' :
                            ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                            ext === 'gif' ? 'image/gif' :
                            ext === 'webp' ? 'image/webp' : 'image/jpeg';
            const dataUri = `data:${mimeType};base64,${base64}`;

            // Inject JavaScript to replace placeholder with actual image
            const script = `
              (function() {
                const img = document.querySelector('img[src="#${placeholderId}"]');
                if (img) {
                  img.src = ${JSON.stringify(dataUri)};
                  // Add click listener for image expansion
                  img.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const modal = document.getElementById('imageModal');
                    const modalImage = document.getElementById('modalImage');
                    modalImage.src = img.src;
                    modal.classList.add('active');
                    document.body.classList.add('modal-open');
                    window.currentScale = 1;
                    window.currentX = 0;
                    window.currentY = 0;
                    if (window.updateModalImageTransform) {
                      window.updateModalImageTransform();
                    }
                    // Notify React Native that image modal is open
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'imageModalStateChanged',
                      isOpen: true
                    }));
                  });
                }
              })();
            `;

            // Use the WebView ref directly - check if method exists
            const webView = webViewRef.current as any;
            if (webView && typeof webView.injectJavaScript === 'function') {
              webView.injectJavaScript(script);
            } else {
              console.error('WebView injectJavaScript not available');
            }
          } catch (error) {
            console.error(`Failed to load image ${imagePath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'loaded') {
        setLoading(false);
        setWebViewReady(true);

        // Load pending images now that WebView is ready
        if (pendingImagesRef.current && pendingImagesRef.current.size > 0) {
          loadImagesAsync(pendingImagesRef.current);
          pendingImagesRef.current = null;
        }
      } else if (data.type === 'textSelected' && onTextSelected) {
        onTextSelected(data.text);
      } else if (data.type === 'imageModalStateChanged') {
        setIsImageExpanded(data.isOpen);
        if (onImageModalStateChange) {
          onImageModalStateChange(data.isOpen);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const closeImageModal = (): boolean => {
    if (isImageExpanded && webViewRef.current) {
      const webView = webViewRef.current as any;
      if (webView && typeof webView.injectJavaScript === 'function') {
        webView.injectJavaScript('window.closeImageModal();');
        return true;
      }
    }
    return false;
  };

  const scrollPage = (direction: 'up' | 'down') => {
    if (webViewRef.current) {
      const webView = webViewRef.current as any;
      if (webView && typeof webView.injectJavaScript === 'function') {
        const scrollAmount = direction === 'down' ? 'window.innerHeight' : '-window.innerHeight';
        const script = `
          window.scrollBy({
            top: ${scrollAmount},
            behavior: 'smooth'
          });
        `;
        webView.injectJavaScript(script);
      }
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    closeImageModal,
    scrollPage,
  }));

  return (
    <View style={styles.container}>
      {(loading || !htmlUri) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )}
      {htmlUri && (
        <WebView
          ref={webViewRef}
          source={{uri: htmlUri}}
          originWhitelist={['*']}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          onMessage={handleMessage}
          style={styles.webview}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          scalesPageToFit={false}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
