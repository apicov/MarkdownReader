# Heading-Based Position Restoration

## Problem

Position restoration using pixel offsets was unreliable:
- Pixel offset is relative to the current chunk window
- When reopening a document, different chunks might be loaded
- Pixel offset doesn't correspond to the same content position
- Result: Users don't return to where they were reading

## Solution

Use the TOC heading system to track reading position instead of pixel offsets.

### How It Works

**Saving Position:**
1. When saving reading position, get both:
   - Pixel scroll position (for backwards compatibility)
   - Current visible heading ID (e.g., "heading-42")
2. Store both values in AsyncStorage

**Restoring Position:**
1. When loading document, check if `headingId` is saved
2. If yes:
   - Calculate which chunk contains that heading
   - Load chunks starting from that chunk
   - After WebView loads, scroll to that specific heading
3. If no (old saved position):
   - Fall back to pixel + chunk index restoration

## Benefits

✅ **Accurate**: Heading-based navigation is content-aware, not pixel-dependent
✅ **Reliable**: Works regardless of chunk window changes
✅ **Backwards compatible**: Falls back to pixel offset for old saved positions
✅ **Leverages existing system**: Reuses TOC heading ID infrastructure

## Implementation

### Type Changes

**[src/types/index.ts](src/types/index.ts)**

```typescript
export interface ReadingPosition {
  documentId: string;
  scrollOffset: number;  // Deprecated, kept for backwards compatibility
  chunkIndex?: number;
  headingId?: string;    // NEW: Heading-based position
  timestamp: number;
}
```

### WebView Changes

**[src/components/WebViewMarkdownReader.tsx](src/components/WebViewMarkdownReader.tsx)**

Added `getCurrentHeading()` method to get the heading visible at top 30% of viewport:

```typescript
const getCurrentHeading = (): Promise<string | null> => {
  return new Promise((resolve) => {
    // Inject JavaScript to find closest heading to viewport center (30%)
    webView.injectJavaScript(`
      const headings = document.querySelectorAll('#content h1, h2, h3, h4, h5, h6');
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const viewportCenter = scrollTop + (windowHeight * 0.3);

      let closestHeading = null;
      let closestDistance = Infinity;

      headings.forEach(heading => {
        const rect = heading.getBoundingClientRect();
        const headingTop = scrollTop + rect.top;
        const distance = Math.abs(headingTop - viewportCenter);

        if (headingTop <= viewportCenter && distance < closestDistance) {
          closestDistance = distance;
          closestHeading = heading.id;
        }
      });

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'currentHeading',
        headingId: closestHeading
      }));
    `);
  });
};
```

Added message handler for `currentHeading` type.

### Service Changes

**[src/utils/readingPositionService.ts](src/utils/readingPositionService.ts)**

Updated signature to accept optional `headingId`:

```typescript
export const saveReadingPosition = async (
  documentId: string,
  scrollOffset: number,
  chunkIndex?: number,
  headingId?: string,  // NEW
): Promise<void> => {
  positions[documentId] = {
    documentId,
    scrollOffset,
    chunkIndex,
    headingId,  // NEW
    timestamp: Date.now(),
  };
  // ... save to AsyncStorage
};
```

### MarkdownReader Changes

**[src/components/MarkdownReader.tsx](src/components/MarkdownReader.tsx)**

**Save position with heading:**

```typescript
const saveCurrentPosition = async () => {
  const scrollPosition = await webViewRef.current?.getScrollPosition();
  const currentHeading = await webViewRef.current?.getCurrentHeading();

  if (scrollPosition !== undefined && scrollPosition >= 0) {
    await saveReadingPosition(
      document.id,
      scrollPosition,
      firstLoadedChunk,
      currentHeading || undefined  // Save heading ID
    );
  }
};
```

**Restore position using heading:**

```typescript
const loadDocument = async () => {
  // ... load markdown, extract TOC

  const savedPosition = await getReadingPosition(document.id);
  const savedHeadingId = savedPosition?.headingId;

  if (savedHeadingId) {
    // Heading-based restoration
    headingToRestore.current = savedHeadingId;

    // Calculate which chunk contains this heading
    const headingPos = positions.get(savedHeadingId);
    if (headingPos !== undefined) {
      const headingChunk = Math.floor(headingPos / CHUNK_SIZE);
      savedChunkIndexRef.current = headingChunk;
    }
  } else {
    // Fallback: pixel-based restoration
    scrollPositionToRestore.current = savedPosition?.scrollOffset ?? 0;
    savedChunkIndexRef.current = savedPosition?.chunkIndex ?? 0;
  }

  // ... continue loading
};
```

**Restore scroll position:**

```typescript
const restoreScrollPosition = () => {
  if (hasRestoredPosition.current) return;
  hasRestoredPosition.current = true;

  setTimeout(() => {
    if (headingToRestore.current) {
      // Prefer heading-based restoration
      console.log(`Restoring position to heading: ${headingToRestore.current}`);
      webViewRef.current?.scrollToHeading(headingToRestore.current);
      headingToRestore.current = null;
    } else if (scrollPositionToRestore.current !== null) {
      // Fallback to pixel-based restoration
      console.log(`Restoring position to pixel: ${scrollPositionToRestore.current}`);
      webViewRef.current?.scrollToPosition(scrollPositionToRestore.current);
    }
  }, SCROLL_RESTORE_DELAY_MS);
};
```

## Testing

To verify the fix:

1. Open a document and scroll to a specific section
2. Close the document (position is saved)
3. Reopen the document
4. **Expected**: Document opens at the same heading you were reading
5. Console should show: `Restoring position to heading: heading-XXX`

## Backwards Compatibility

Old saved positions (without `headingId`) will:
- Still work using pixel offset restoration
- Gradually be replaced with heading-based positions as users navigate
- Eventually all positions will use the more reliable heading system
