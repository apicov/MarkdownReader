import React, {useRef, useState, useEffect} from 'react';
import {View, StyleSheet, ActivityIndicator} from 'react-native';
import WebView from 'react-native-webview';
import {useTheme} from '../contexts/ThemeContext';
import {File, Directory, Paths} from 'expo-file-system';

interface WebViewMarkdownReaderProps {
  markdown: string;
  fontSize: number;
  baseUrl?: string;
  onTextSelected?: (text: string) => void;
}

export const WebViewMarkdownReader: React.FC<WebViewMarkdownReaderProps> = ({
  markdown,
  fontSize,
  baseUrl = '',
  onTextSelected,
}) => {
  const {theme} = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const pendingImagesRef = useRef<Map<string, string> | null>(null);

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

    .highlight {
      background-color: ${theme.accent}33;
      padding: 4px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div id="content"></div>
  <script>
    // Render markdown
    const markdown = ${JSON.stringify(processedMarkdown)};
    document.getElementById('content').innerHTML = marked.parse(markdown);

    // Detect text selection
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
      }, 300);
    });

    // Function to highlight text (can be called from React Native)
    function highlightText(text) {
      // Remove existing highlights
      document.querySelectorAll('.highlight').forEach(el => {
        el.outerHTML = el.innerHTML;
      });

      if (!text) return;

      // Simple highlighting - wrap matching text in span
      const walker = document.createTreeWalker(
        document.getElementById('content'),
        NodeFilter.SHOW_TEXT,
        null
      );

      const textNodes = [];
      while(walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      textNodes.forEach(node => {
        if (node.textContent.includes(text)) {
          const span = document.createElement('span');
          span.className = 'highlight';
          span.textContent = node.textContent;
          node.parentNode.replaceChild(span, node);
        }
      });
    }

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
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const highlightText = (text: string) => {
    const webView = webViewRef.current as any;
    if (webView && typeof webView.injectJavaScript === 'function') {
      webView.injectJavaScript(`highlightText(${JSON.stringify(text)});`);
    }
  };

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
};

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
