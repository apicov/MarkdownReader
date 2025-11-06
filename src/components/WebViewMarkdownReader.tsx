import React, {useRef, useState, useEffect, useImperativeHandle, forwardRef} from 'react';
import {View, StyleSheet, ActivityIndicator} from 'react-native';
import WebView from 'react-native-webview';
import {useTheme} from '../contexts/ThemeContext';
import {File, Directory, Paths} from 'expo-file-system';
import {IMAGE_CLICK_LISTENER_SCRIPT, getImageClickListenerScript} from '../utils/webViewHelpers';
import {MARKED_JS, KATEX_JS, KATEX_CSS, AUTO_RENDER_JS} from '../utils/bundledLibraries';

interface WebViewMarkdownReaderProps {
  markdown: string;
  fontSize: number;
  baseUrl?: string;
  imagePaths?: string[];
  onTextSelected?: (text: string) => void;
  onImageModalStateChange?: (isOpen: boolean) => void;
  onWebViewLoaded?: () => void;
}

export interface WebViewMarkdownReaderRef {
  closeImageModal: () => boolean;
  scrollPage: (direction: 'up' | 'down') => void;
  getScrollPosition: () => Promise<number>;
  scrollToPosition: (position: number) => void;
  scrollToHeading: (headingId: string) => void;
}

export const WebViewMarkdownReader = forwardRef<WebViewMarkdownReaderRef, WebViewMarkdownReaderProps>(({
  markdown,
  fontSize,
  baseUrl = '',
  imagePaths = [],
  onTextSelected,
  onImageModalStateChange,
  onWebViewLoaded,
}, ref) => {
  const {theme} = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const webViewReadyRef = useRef<boolean>(false);
  const pendingImagesRef = useRef<Map<string, string> | null>(null);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  // Create HTML file when markdown or theme changes
  useEffect(() => {
    createHtmlFile();
  }, [markdown, fontSize, theme]);

  const createHtmlFile = async () => {
    // Reset WebView ready state when creating new HTML
    setWebViewReady(false);
    webViewReadyRef.current = false;
    setLoading(true);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>${KATEX_CSS}</style>
  <script>
    // Polyfill for Array.at() - not supported in Android 10 WebView
    if (!Array.prototype.at) {
      Array.prototype.at = function(index) {
        if (index < 0) {
          index = this.length + index;
        }
        return this[index];
      };
    }
    // Polyfill for String.at() - not supported in Android 10 WebView
    if (!String.prototype.at) {
      String.prototype.at = function(index) {
        if (index < 0) {
          index = this.length + index;
        }
        return this[index];
      };
    }
  </script>
  <script>${MARKED_JS}</script>
  <script>${KATEX_JS}</script>
  <script>${AUTO_RENDER_JS}</script>
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
      opacity: 0;
      transition: opacity 0.3s ease-in;
    }
    img.loaded {
      opacity: 1;
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
      opacity: 1 !important;
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
    const markdown = ${JSON.stringify(markdown)};
    document.getElementById('content').innerHTML = marked.parse(markdown);

    // Render LaTeX with KaTeX
    renderMathInElement(document.getElementById('content'), {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\\\[', right: '\\\\]', display: true},
        {left: '\\\\(', right: '\\\\)', display: false}
      ],
      throwOnError: false,
      errorColor: '#cc0000',
      strict: false
    });

    // Add IDs to headings after rendering for TOC navigation
    const headings = document.querySelectorAll('#content h1, #content h2, #content h3, #content h4, #content h5, #content h6');
    headings.forEach((heading, index) => {
      heading.id = 'heading-' + index;
    });

    // Convert image src to data-src for lazy loading
    const images = document.querySelectorAll('#content img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      // Only process local images, not http/https URLs
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        img.setAttribute('data-src', src);
        img.removeAttribute('src');
      } else if (src) {
        // For external images, mark as loaded immediately
        img.classList.add('loaded');
      }
    });

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

    // For external (http/https) images only, set up lazy loading immediately
    // Local images will be handled by loadImagesAsync which injects base64 data
    const externalImages = document.querySelectorAll('img[data-src]');
    const hasExternalImages = Array.from(externalImages).some(img => {
      const src = img.getAttribute('data-src');
      return src && (src.startsWith('http://') || src.startsWith('https://'));
    });

    if (hasExternalImages) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              const srcToLoad = img.dataset.src;
              // Only load external images here
              if (srcToLoad.startsWith('http://') || srcToLoad.startsWith('https://')) {
                img.src = srcToLoad;
                img.onload = () => {
                  img.classList.add('loaded');
                  // Add click listener after image is fully loaded
                  ${IMAGE_CLICK_LISTENER_SCRIPT}
                };
                img.onerror = () => {
                  img.classList.add('loaded'); // Show broken image icon
                };
                delete img.dataset.src;
                observer.unobserve(img);
              }
            }
          }
        });
      }, {
        rootMargin: '50px' // Start loading slightly before image enters viewport
      });

      // Only observe external images
      externalImages.forEach(img => {
        const src = img.getAttribute('data-src');
        if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
          imageObserver.observe(img);
        }
      });
    }

    // Add error handler to catch any JavaScript errors
    window.onerror = function(msg, url, lineNo, columnNo, error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        error: {
          message: msg,
          url: url,
          lineNo: lineNo,
          columnNo: columnNo,
          stack: error ? error.stack : 'no stack'
        }
      }));
      return false;
    };

    // Add promise rejection handler
    window.addEventListener('unhandledrejection', function(event) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        error: {
          message: 'Unhandled promise rejection: ' + event.reason
        }
      }));
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

      // Store image paths for lazy loading after WebView is ready
      if (baseUrl && imagePaths.length > 0) {
        pendingImagesRef.current = new Map(imagePaths.map((path, idx) => [path, `img-${idx}`]));
      }
    } catch (error) {
      console.error('Error creating HTML file:', error);
    }
  };

  const loadImagesAsync = async (imagePaths: Map<string, string>) => {
    try {
      const baseDir = new Directory(baseUrl);

      // Build file map
      const fileMap = new Map<string, File>();
      const items = baseDir.list();

      for (const item of items) {
        if (item instanceof File) {
          fileMap.set(item.name, item);
        }
      }

      // Convert all images to base64 and inject into WebView as a batch
      const imageData: Record<string, string> = {};

      for (const [imagePath] of imagePaths) {
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
            imageData[imagePath] = dataUri;
          } catch (error) {
            console.error(`Failed to load image ${imagePath}:`, error);
          }
        }
      }

      // Inject all image data into WebView at once
      const webView = webViewRef.current as any;
      if (webViewReadyRef.current && webView && typeof webView.injectJavaScript === 'function') {
        const script = `
          (function() {
            const imageData = ${JSON.stringify(imageData)};

            // Update all images with data-src attributes
            document.querySelectorAll('img[data-src]').forEach(img => {
              const src = img.getAttribute('data-src');
              if (imageData[src]) {
                img.setAttribute('data-src', imageData[src]);
              }
            });

            // Re-observe images for lazy loading with updated data-src
            const imageObserver = new IntersectionObserver((entries, observer) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  const img = entry.target;
                  if (img.dataset.src) {
                    const srcToLoad = img.dataset.src;
                    img.src = srcToLoad;
                    img.onload = () => {
                      img.classList.add('loaded');
                      // Add click listener after image is fully loaded
                      ${IMAGE_CLICK_LISTENER_SCRIPT}
                    };
                    img.onerror = () => {
                      img.classList.add('loaded');
                    };
                    delete img.dataset.src;
                    observer.unobserve(img);
                  }
                }
              });
            }, {
              rootMargin: '50px'
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
              imageObserver.observe(img);
            });
          })();
        `;
        webView.injectJavaScript(script);
      }
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  };

  const scrollPositionResolverRef = useRef<((position: number) => void) | null>(null);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'loaded') {
        setLoading(false);
        setWebViewReady(true);
        webViewReadyRef.current = true;

        // Load pending images now that WebView is ready
        if (pendingImagesRef.current && pendingImagesRef.current.size > 0) {
          loadImagesAsync(pendingImagesRef.current);
          pendingImagesRef.current = null;
        }

        // Notify parent that WebView is fully loaded and ready for scroll restoration
        if (onWebViewLoaded) {
          onWebViewLoaded();
        }
      } else if (data.type === 'textSelected' && onTextSelected) {
        onTextSelected(data.text);
      } else if (data.type === 'imageModalStateChanged') {
        setIsImageExpanded(data.isOpen);
        if (onImageModalStateChange) {
          onImageModalStateChange(data.isOpen);
        }
      } else if (data.type === 'scrollPosition' && scrollPositionResolverRef.current) {
        scrollPositionResolverRef.current(data.position);
        scrollPositionResolverRef.current = null;
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

  const getScrollPosition = (): Promise<number> => {
    return new Promise((resolve) => {
      // Check if WebView is ready before attempting to get position
      if (!webViewReady || !webViewRef.current) {
        resolve(0);
        return;
      }

      const webView = webViewRef.current as any;
      if (webView && typeof webView.injectJavaScript === 'function') {
        scrollPositionResolverRef.current = resolve;

        webView.injectJavaScript(`
          (function() {
            var pos = window.pageYOffset || document.documentElement.scrollTop;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'scrollPosition',
              position: pos
            }));
          })();
        `);

        // Timeout fallback
        setTimeout(() => {
          if (scrollPositionResolverRef.current === resolve) {
            scrollPositionResolverRef.current = null;
            resolve(0);
          }
        }, 2000);
      } else {
        resolve(0);
      }
    });
  };

  const scrollToPosition = (position: number) => {
    // Check if WebView is ready before attempting to scroll
    if (!webViewReady || !webViewRef.current) {
      return;
    }

    const webView = webViewRef.current as any;
    if (webView && typeof webView.injectJavaScript === 'function') {
      const script = `
        (function() {
          // Try multiple methods to ensure scroll works
          window.scrollTo(0, ${position});
          document.documentElement.scrollTop = ${position};
          document.body.scrollTop = ${position};
        })();
      `;
      webView.injectJavaScript(script);
    }
  };

  const scrollToHeading = (headingId: string) => {
    if (!webViewReady || !webViewRef.current) {
      console.log(`scrollToHeading: WebView not ready for ${headingId}`);
      return;
    }

    const webView = webViewRef.current as any;
    if (webView && typeof webView.injectJavaScript === 'function') {
      const script = `
        (function() {
          // Debug: List all heading IDs in the document
          const allHeadings = document.querySelectorAll('#content h1, #content h2, #content h3, #content h4, #content h5, #content h6');
          const headingIds = Array.from(allHeadings).map(h => h.id);
          console.log('All heading IDs in DOM:', headingIds.slice(0, 10), '... (showing first 10)');

          const element = document.getElementById('${headingId}');
          if (element) {
            console.log('Found element ${headingId}, scrolling to it');
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'debug',
              message: 'Scrolled to ${headingId}'
            }));
          } else {
            console.log('Element ${headingId} NOT FOUND');
            console.log('Total headings in DOM:', headingIds.length);
            if (headingIds.length > 0) {
              console.log('First heading:', headingIds[0], 'Last heading:', headingIds[headingIds.length - 1]);
            }
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'debug',
              message: 'Element ${headingId} not found. Have ' + headingIds.length + ' headings from ' + headingIds[0] + ' to ' + headingIds[headingIds.length - 1]
            }));
          }
        })();
      `;
      webView.injectJavaScript(script);
    }
  };


  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    closeImageModal,
    scrollPage,
    getScrollPosition,
    scrollToPosition,
    scrollToHeading,
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
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            setLoading(false);
          }}
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
