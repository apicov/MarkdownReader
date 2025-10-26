# TOC Navigation Fix - Technical Summary

## Problem

Table of Contents navigation was failing when jumping to sub-headings that required loading new chunks. The symptoms were:

- Main headings (h1) in already-loaded chunks worked ✅
- Sub-headings (h2-h6) in new chunks failed ❌
- Error: `scrollToHeading: WebView not ready for heading-XXX`

## Root Cause

The issue was in the interaction between chunk pagination state management and WebView updates:

1. **State Update Chain:**
   ```typescript
   jumpToChunk()
   → setCurrentContent(newContent)  // Hook updates state
   → MarkdownReader re-renders
   → WebView receives new markdown prop
   → useEffect([markdown]) triggers
   → createHtmlFile() executes
   → setWebViewReady(false)  // ← PROBLEM!
   ```

2. **Race Condition:**
   - `replaceContent()` injects JavaScript to update DOM (fast, keeps webViewReady=true)
   - But changing `markdown` prop triggers full HTML recreation (slow, sets webViewReady=false)
   - `scrollToHeading()` called after 800ms timeout, but WebView still recreating HTML
   - Result: "WebView not ready" error

## Solution

Changed the architecture to prevent WebView recreation during chunk navigation:

### Before (Broken)
```typescript
// WebView received live state that changed on every chunk load
<WebViewMarkdownReader
  markdown={currentContent}  // ← Changes trigger full recreation
  // ...
/>
```

### After (Fixed)
```typescript
// 1. Added ref to store initial content
const initialContentRef = useRef<string>('');

// 2. Set ref when loading initial chunks
useEffect(() => {
  if (fullMarkdown && fullMarkdown.length > 0 && !isReady) {
    const initialContent = loadInitialChunks(savedChunkIndexRef.current, 3);
    initialContentRef.current = initialContent;  // ← Store in ref
    setIsReady(true);
  }
}, [fullMarkdown]);

// 3. WebView receives stable ref that never changes
<WebViewMarkdownReader
  markdown={initialContentRef.current}  // ← Stable, no recreation
  // ...
/>
```

## How It Works Now

1. **Initial Load:**
   - Document loaded → `loadInitialChunks()` called
   - Result stored in `initialContentRef.current`
   - WebView receives initial content, creates HTML once

2. **Scroll-Based Navigation:**
   - User scrolls near top/bottom
   - `handleScrollNearStart/End()` calls hook's `loadMoreContent/loadPreviousContent()`
   - Hook updates `currentContent` state (for internal tracking)
   - WebView receives content via `appendContent()` or `prependContent()` methods
   - **No prop change** → No HTML recreation → webViewReady stays true

3. **TOC Navigation:**
   - User clicks TOC item
   - `handleTocItemPress()` calls hook's `jumpToChunk()`
   - Hook updates `currentContent` state (for internal tracking)
   - WebView receives content via `replaceContent()` method
   - **No prop change** → No HTML recreation → webViewReady stays true
   - `scrollToHeading()` works because webViewReady is still true

## Files Modified

### [src/components/MarkdownReader.tsx](src/components/MarkdownReader.tsx)

**Added ref declaration (line 89):**
```typescript
const initialContentRef = useRef<string>('');
```

**Updated initial load effect (line 387):**
```typescript
initialContentRef.current = initialContent;
```

**Changed WebView prop (line 473):**
```typescript
markdown={initialContentRef.current}  // Was: markdown={currentContent}
```

## Testing Checklist

After this fix, verify:

- [x] Documents load correctly on first open
- [x] Scroll position is restored when reopening document
- [x] Page-up/down (tap left/right edges) works
- [x] Scrolling to bottom loads next chunk
- [x] Scrolling to top loads previous chunk
- [x] TOC navigation to h1 headings works
- [x] TOC navigation to h2-h6 headings works (was broken)
- [x] TOC navigation across chunks works (was broken)
- [x] Font size changes work
- [x] Theme switching works

## Technical Notes

### Why currentContent Still Exists in Hook

The `currentContent` state in `useChunkPagination` hook is still useful for:
- Internal tracking of what chunks are loaded
- Returning content from functions for components that might want it
- Future flexibility if other components use the hook differently

It's just not used to drive WebView updates in MarkdownReader anymore.

### Alternative Solutions Considered

1. **Make WebView not recreate HTML on markdown change**
   - Would break legitimate use cases (theme change, font size change)
   - More invasive change to WebView component

2. **Add flag to control recreation**
   - More complex API
   - Easy to misuse

3. **Current solution: Stable ref + imperative methods**
   - Clean separation: props for initial state, methods for updates
   - Follows React best practices (stable props, imperative handles)
   - Minimal changes required

### Performance Benefits

This fix also improves performance:
- No full HTML recreation on chunk navigation
- DOM updates via JavaScript injection (faster)
- Fewer WebView reloads = smoother navigation
- Lower memory usage (no duplicate HTML in memory during transition)
