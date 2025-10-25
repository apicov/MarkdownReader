import React, {useRef, useState} from 'react';
import {View, StyleSheet, ActivityIndicator} from 'react-native';
import WebView from 'react-native-webview';
import {useTheme} from '../contexts/ThemeContext';

interface WebViewMarkdownReaderProps {
  markdown: string;
  fontSize: number;
  onTextSelected?: (text: string) => void;
}

export const WebViewMarkdownReader: React.FC<WebViewMarkdownReaderProps> = ({
  markdown,
  fontSize,
  onTextSelected,
}) => {
  const {theme} = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  // Generate HTML with markdown rendering and text selection support
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
    const markdown = ${JSON.stringify(markdown)};
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

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'loaded') {
        setLoading(false);
      } else if (data.type === 'textSelected' && onTextSelected) {
        onTextSelected(data.text);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const highlightText = (text: string) => {
    webViewRef.current?.injectJavaScript(`highlightText(${JSON.stringify(text)});`);
  };

  // Expose highlightText method
  React.useImperativeHandle(webViewRef, () => ({
    highlightText,
  }));

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{html}}
        onMessage={handleMessage}
        style={styles.webview}
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
        scalesPageToFit={false}
      />
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
