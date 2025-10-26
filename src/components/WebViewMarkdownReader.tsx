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
  onWebViewLoaded?: () => void;
  onScrollNearEnd?: () => void;
  onScrollNearStart?: () => void;
}

export interface WebViewMarkdownReaderRef {
  closeImageModal: () => boolean;
  scrollPage: (direction: 'up' | 'down') => void;
  getScrollPosition: () => Promise<number>;
  scrollToPosition: (position: number) => void;
  scrollToHeading: (headingId: string) => void;
  appendContent: (additionalMarkdown: string) => void;
  prependContent: (additionalMarkdown: string) => void;
  replaceContent: (newMarkdown: string, startHeadingIndex?: number, scrollBehavior?: 'preserve' | 'top' | 'bottom' | 'middle' | 'twothirds') => void;
}

export const WebViewMarkdownReader = forwardRef<WebViewMarkdownReaderRef, WebViewMarkdownReaderProps>(({
  markdown,
  fontSize,
  baseUrl = '',
  onTextSelected,
  onImageModalStateChange,
  onWebViewLoaded,
  onScrollNearEnd,
  onScrollNearStart,
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
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
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

    // Detect scroll near end or start to trigger loading more content
    let scrollTimeout;
    let lastScrollTop = 0;

    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        // Determine scroll direction
        const isScrollingDown = scrollTop > lastScrollTop;
        lastScrollTop = scrollTop;

        // Calculate distances
        const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
        const distanceFromTop = scrollTop;

        // Calculate scroll percentage through document
        const scrollPercent = scrollTop / (documentHeight - windowHeight);

        // Very tight trigger - only in the outer 10% to avoid the middle chunk
        const triggerDistance = windowHeight * 0.2;

        // Only trigger near END if in bottom 10% and scrolling down
        if (isScrollingDown && scrollPercent > 0.90 && distanceFromBottom < triggerDistance) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'scrollNearEnd'
          }));
        }

        // Only trigger near START if in top 10% and scrolling up
        if (!isScrollingDown && scrollPercent < 0.10 && distanceFromTop < triggerDistance) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'scrollNearStart'
          }));
        }
      }, 300);
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

      // Build file map asynchronously with yielding to prevent UI freeze
      const fileMap = new Map<string, File>();
      const items = baseDir.list();
      let processedCount = 0;

      for (const item of items) {
        // Yield to UI thread every 10 items
        if (processedCount % 10 === 0 && processedCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (item instanceof File) {
          fileMap.set(item.name, item);
        }
        processedCount++;
      }

      // Load images in small batches with yielding between batches
      const imageEntries = Array.from(imagePlaceholders.entries());
      const BATCH_SIZE = 2; // Process 2 images at a time

      for (let i = 0; i < imageEntries.length; i += BATCH_SIZE) {
        // Check if WebView is still available using ref (not state)
        if (!webViewReadyRef.current || !webViewRef.current) {
          return;
        }

        // Yield to UI thread between batches
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const batch = imageEntries.slice(i, i + BATCH_SIZE);

        // Process batch in parallel
        await Promise.all(batch.map(async ([imagePath, placeholderId]) => {
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

              // Check WebView readiness before injecting
              const webView = webViewRef.current as any;
              if (!webViewReadyRef.current || !webView || typeof webView.injectJavaScript !== 'function') {
                return; // Skip this image silently
              }

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

              webView.injectJavaScript(script);
            } catch (error) {
              console.error(`Failed to load image ${imagePath}:`, error);
            }
          }
        }));
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
      } else if (data.type === 'scrollNearEnd' && onScrollNearEnd) {
        onScrollNearEnd();
      } else if (data.type === 'scrollNearStart' && onScrollNearStart) {
        onScrollNearStart();
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
      return;
    }

    const webView = webViewRef.current as any;
    if (webView && typeof webView.injectJavaScript === 'function') {
      const script = `
        (function() {
          const element = document.getElementById('${headingId}');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        })();
      `;
      webView.injectJavaScript(script);
    }
  };

  const appendContent = (additionalMarkdown: string) => {
    if (!webViewReady || !webViewRef.current) {
      return;
    }

    const webView = webViewRef.current as any;
    if (webView && typeof webView.injectJavaScript === 'function') {
      // Process images in the additional markdown the same way as initial load
      let processedMarkdown = additionalMarkdown;
      const imagePlaceholders = new Map<string, string>();

      if (baseUrl) {
        let placeholderIndex = Date.now(); // Use timestamp to ensure unique IDs
        processedMarkdown = additionalMarkdown.replace(/!\[([^\]]*)\]\((?!http)([^)]+)\)/g, (match, alt, imagePath) => {
          const cleanPath = imagePath.trim().replace(/^\.?\//, '');
          const placeholderId = `img-placeholder-${placeholderIndex++}`;
          imagePlaceholders.set(cleanPath, placeholderId);
          return `![${alt}](#${placeholderId})`;
        });
      }

      const script = `
        (function() {
          const additionalMarkdown = ${JSON.stringify(processedMarkdown)};
          const additionalHtml = marked.parse(additionalMarkdown);

          // Get current heading count to continue ID sequence
          const existingHeadings = document.querySelectorAll('#content h1, #content h2, #content h3, #content h4, #content h5, #content h6');
          let headingIndex = existingHeadings.length;

          // Append new content
          const contentDiv = document.getElementById('content');
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = additionalHtml;

          // Render LaTeX in new content
          if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(tempDiv, {
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
          }

          // Add IDs to new headings
          const newHeadings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
          newHeadings.forEach(heading => {
            heading.id = 'heading-' + headingIndex++;
          });

          // Add click listeners to new images
          const newImages = tempDiv.querySelectorAll('img');
          newImages.forEach(img => {
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
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'imageModalStateChanged',
                isOpen: true
              }));
            });
          });

          contentDiv.appendChild(tempDiv);
        })();
      `;
      webView.injectJavaScript(script);

      // Load images asynchronously if there are any
      if (imagePlaceholders.size > 0) {
        loadImagesAsync(imagePlaceholders);
      }
    }
  };

  const prependContent = (additionalMarkdown: string) => {
    if (!webViewReady || !webViewRef.current) {
      return;
    }

    const webView = webViewRef.current as any;
    if (webView && typeof webView.injectJavaScript === 'function') {
      // Process images
      let processedMarkdown = additionalMarkdown;
      const imagePlaceholders = new Map<string, string>();

      if (baseUrl) {
        let placeholderIndex = Date.now();
        processedMarkdown = additionalMarkdown.replace(/!\[([^\]]*)\]\((?!http)([^)]+)\)/g, (match, alt, imagePath) => {
          const cleanPath = imagePath.trim().replace(/^\.?\//, '');
          const placeholderId = `img-placeholder-${placeholderIndex++}`;
          imagePlaceholders.set(cleanPath, placeholderId);
          return `![${alt}](#${placeholderId})`;
        });
      }

      const script = `
        (function() {
          const additionalMarkdown = ${JSON.stringify(processedMarkdown)};
          const additionalHtml = marked.parse(additionalMarkdown);

          // Save current scroll position
          const oldScrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const oldDocHeight = document.documentElement.scrollHeight;

          // Get current heading count to continue ID sequence
          const existingHeadings = document.querySelectorAll('#content h1, #content h2, #content h3, #content h4, #content h5, #content h6');
          const totalHeadings = existingHeadings.length;

          // Prepend new content
          const contentDiv = document.getElementById('content');
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = additionalHtml;

          // Render LaTeX in new content
          if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(tempDiv, {
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
          }

          // Add IDs to new headings (they come before existing ones, so start from 0)
          const newHeadings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
          let headingIndex = 0;
          newHeadings.forEach(heading => {
            heading.id = 'heading-' + headingIndex++;
          });

          // Re-number existing headings
          existingHeadings.forEach(heading => {
            heading.id = 'heading-' + headingIndex++;
          });

          // Add click listeners to new images
          const newImages = tempDiv.querySelectorAll('img');
          newImages.forEach(img => {
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
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'imageModalStateChanged',
                isOpen: true
              }));
            });
          });

          // Insert at the beginning
          contentDiv.insertBefore(tempDiv, contentDiv.firstChild);

          // Adjust scroll position to maintain visual position
          const newDocHeight = document.documentElement.scrollHeight;
          const heightAdded = newDocHeight - oldDocHeight;
          const newScrollTop = oldScrollTop + heightAdded;

          window.scrollTo(0, Math.max(0, newScrollTop));
        })();
      `;
      webView.injectJavaScript(script);

      // Load images asynchronously
      if (imagePlaceholders.size > 0) {
        loadImagesAsync(imagePlaceholders);
      }
    }
  };

  const replaceContent = (newMarkdown: string, startHeadingIndex: number = 0, scrollBehavior: 'preserve' | 'top' | 'bottom' | 'middle' | 'twothirds' = 'preserve') => {
    if (!webViewReady || !webViewRef.current) {
      return;
    }

    const webView = webViewRef.current as any;
    if (webView && typeof webView.injectJavaScript === 'function') {
      // Process images in the new markdown
      let processedMarkdown = newMarkdown;
      const imagePlaceholders = new Map<string, string>();

      if (baseUrl) {
        let placeholderIndex = Date.now();
        processedMarkdown = newMarkdown.replace(/!\[([^\]]*)\]\((?!http)([^)]+)\)/g, (match, alt, imagePath) => {
          const cleanPath = imagePath.trim().replace(/^\.?\//, '');
          const placeholderId = `img-placeholder-${placeholderIndex++}`;
          imagePlaceholders.set(cleanPath, placeholderId);
          return `![${alt}](#${placeholderId})`;
        });
      }

      const script = `
        (function() {
          const newMarkdown = ${JSON.stringify(processedMarkdown)};
          const newHtml = marked.parse(newMarkdown);
          const startHeadingIndex = ${startHeadingIndex};
          const scrollBehavior = '${scrollBehavior}';

          // Save current scroll information
          const oldScrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const oldDocHeight = document.documentElement.scrollHeight;
          const windowHeight = window.innerHeight;

          // Replace content
          const contentDiv = document.getElementById('content');
          contentDiv.innerHTML = newHtml;

          // Render LaTeX
          if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(contentDiv, {
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
          }

          // Add IDs to headings starting from the provided index
          const headings = contentDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
          headings.forEach((heading, idx) => {
            heading.id = 'heading-' + (startHeadingIndex + idx);
          });

          // Add click listeners to images
          const images = contentDiv.querySelectorAll('img');
          images.forEach(img => {
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
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'imageModalStateChanged',
                isOpen: true
              }));
            });
          });

          // Calculate new scroll position based on behavior
          let newScrollTop;
          const newDocHeight = document.documentElement.scrollHeight;

          if (scrollBehavior === 'top') {
            // Scroll to top
            newScrollTop = 0;
          } else if (scrollBehavior === 'bottom') {
            // Scroll to bottom
            newScrollTop = newDocHeight - windowHeight;
          } else if (scrollBehavior === 'middle') {
            // BACKWARD: User was at top of old window, reading first chunk
            // In new window, that chunk is now the middle one
            // Scroll to ~25-30% to show that chunk near the top with some previous context visible
            newScrollTop = newDocHeight * 0.28;
          } else if (scrollBehavior === 'twothirds') {
            // FORWARD: User was at bottom of old window, reading last chunk
            // In new window, that chunk is now the middle one (33-66%)
            // Scroll to ~50-55% to show that chunk filling the screen with its end visible
            newScrollTop = newDocHeight * 0.52;
          } else {
            // Preserve: try to keep the user at approximately the same visual position
            // When window shifts [A,B,C] -> [B,C,D], we lose chunk A from top
            // So we need to subtract approximately 1/3 of old height
            // When window shifts [B,C,D] -> [A,B,C], we add chunk A to top
            // So we need to add approximately 1/3 of new height

            // For now, just preserve percentage which works reasonably well
            const scrollPercent = oldDocHeight > 0 ? oldScrollTop / oldDocHeight : 0;
            newScrollTop = scrollPercent * newDocHeight;
          }

          window.scrollTo(0, Math.max(0, newScrollTop));
        })();
      `;
      webView.injectJavaScript(script);

      // Load images asynchronously
      if (imagePlaceholders.size > 0) {
        loadImagesAsync(imagePlaceholders);
      }
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    closeImageModal,
    scrollPage,
    getScrollPosition,
    scrollToPosition,
    scrollToHeading,
    appendContent,
    prependContent,
    replaceContent,
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
