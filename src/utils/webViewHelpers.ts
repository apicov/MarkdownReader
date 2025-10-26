/**
 * WebView Helper Utilities
 *
 * Provides reusable JavaScript code snippets for WebView injection.
 * These are used by WebViewMarkdownReader to manipulate content dynamically.
 */

/**
 * JavaScript code to add click listeners to images for modal expansion
 * This is injected after new images are loaded
 *
 * Note: This is a function body that expects 'img' to be defined in scope
 */
export const IMAGE_CLICK_LISTENER_SCRIPT = `
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
`;

/**
 * Generate complete JavaScript function to add image click listener
 *
 * @param imgSelector - CSS selector for the image element (e.g., 'img[src="#placeholder-123"]')
 * @returns JavaScript code as string to execute in WebView
 */
export const getImageClickListenerScript = (imgSelector: string): string => `
  (function() {
    const img = document.querySelector('${imgSelector}');
    if (img) {
      ${IMAGE_CLICK_LISTENER_SCRIPT}
    }
  })();
`;

/**
 * JavaScript code to render LaTeX equations using KaTeX
 * This is called after markdown is converted to HTML
 */
export const LATEX_RENDER_SCRIPT = `
  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(targetElement, {
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
`;

/**
 * Process markdown to replace local image paths with placeholder IDs
 *
 * Images are loaded asynchronously for performance, so we first replace them
 * with placeholders, then inject the actual base64 data later.
 *
 * @param markdown - Raw markdown content
 * @param baseUrl - Base URL for resolving relative image paths
 * @returns Object with processed markdown and placeholder mapping
 */
export const processMarkdownImages = (
  markdown: string,
  baseUrl: string
): {
  processedMarkdown: string;
  imagePlaceholders: Map<string, string>;
} => {
  const imagePlaceholders = new Map<string, string>();

  if (!baseUrl) {
    return {processedMarkdown: markdown, imagePlaceholders};
  }

  let placeholderIndex = Date.now(); // Use timestamp for unique IDs

  // Replace image markdown with placeholders
  // Matches: ![alt text](path/to/image.png)
  // But NOT: ![alt text](http://...)
  const processedMarkdown = markdown.replace(
    /!\[([^\]]*)\]\((?!http)([^)]+)\)/g,
    (match, alt, imagePath) => {
      const cleanPath = imagePath.trim().replace(/^\.?\//, '');
      const placeholderId = `img-placeholder-${placeholderIndex++}`;
      imagePlaceholders.set(cleanPath, placeholderId);
      return `![${alt}](#${placeholderId})`;
    }
  );

  return {processedMarkdown, imagePlaceholders};
};
