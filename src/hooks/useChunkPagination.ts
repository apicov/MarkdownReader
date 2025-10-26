/**
 * Chunk Pagination Hook
 *
 * Manages chunked loading of large markdown documents for memory efficiency.
 * Implements a sliding window of 3 chunks with dynamic loading as user scrolls.
 */

import { useState, useRef, useCallback } from 'react';
import { CHUNK_SIZE, CHUNK_LOAD_DEBOUNCE_MS } from '../constants';

/**
 * Hook for managing chunked document pagination
 *
 * Divides large documents into fixed-size chunks and maintains a sliding window
 * of visible content. Automatically loads previous/next chunks as user scrolls.
 *
 * @param fullContent - Complete document content
 * @returns Pagination state and control functions
 *
 * @example
 * const {
 *   currentContent,
 *   loadMoreContent,
 *   loadPreviousContent,
 *   jumpToChunk,
 *   isLoading
 * } = useChunkPagination(fullMarkdown);
 */
export const useChunkPagination = (fullContent: string) => {
  // Track which chunks are currently loaded
  const firstLoadedChunkRef = useRef<number>(0);
  const lastLoadedChunkRef = useRef<number>(0);
  const totalChunksRef = useRef<number>(0);

  // Prevent concurrent loading operations
  const isLoadingMoreRef = useRef<boolean>(false);
  const lastScrollEventTime = useRef<number>(0);

  // Current visible content
  const [currentContent, setCurrentContent] = useState<string>('');

  // Calculate total chunks
  const getTotalChunks = useCallback(() => {
    return Math.ceil(fullContent.length / CHUNK_SIZE);
  }, [fullContent]);

  /**
   * Get content for a specific chunk by index
   */
  const getChunkContent = useCallback((chunkIndex: number): string => {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fullContent.length);
    return fullContent.substring(start, end);
  }, [fullContent]);

  /**
   * Load initial chunks starting from a specific position
   *
   * @param startChunkIndex - Chunk to start from (e.g., saved reading position)
   * @param numChunks - Number of chunks to load (default 3)
   * @returns Content for the loaded chunks
   */
  const loadInitialChunks = useCallback((
    startChunkIndex: number = 0,
    numChunks: number = 3
  ): string => {
    const totalChunks = getTotalChunks();
    totalChunksRef.current = totalChunks;

    const firstChunk = Math.max(0, Math.min(startChunkIndex, totalChunks - 1));
    const lastChunk = Math.min(firstChunk + numChunks - 1, totalChunks - 1);

    firstLoadedChunkRef.current = firstChunk;
    lastLoadedChunkRef.current = lastChunk;

    let content = '';
    for (let i = firstChunk; i <= lastChunk; i++) {
      content += getChunkContent(i);
    }

    setCurrentContent(content);
    console.log(`Loaded initial chunks [${firstChunk}, ${lastChunk}] of ${totalChunks}`);

    return content;
  }, [fullContent, getChunkContent, getTotalChunks]);

  /**
   * Load the next chunk (when scrolling down)
   *
   * Implements debouncing to prevent excessive loading.
   *
   * @returns Newly loaded chunk content, or null if already at end
   */
  const loadMoreContent = useCallback((): string | null => {
    if (isLoadingMoreRef.current) {
      console.log('loadMoreContent: Already loading, skipping');
      return null;
    }

    const lastChunk = lastLoadedChunkRef.current;
    const totalChunks = totalChunksRef.current;

    // Check if there's a next chunk to load
    const nextChunk = lastChunk + 1;
    if (nextChunk >= totalChunks) {
      console.log(`loadMoreContent: Already at last chunk ${lastChunk}`);
      return null;
    }

    // Debounce to prevent loading same content multiple times
    const now = Date.now();
    if (now - lastScrollEventTime.current < CHUNK_LOAD_DEBOUNCE_MS) {
      console.log('loadMoreContent: Debouncing, too soon');
      return null;
    }
    lastScrollEventTime.current = now;

    isLoadingMoreRef.current = true;

    // Load the next chunk
    const chunkContent = getChunkContent(nextChunk);
    console.log(`✓ Loaded chunk ${nextChunk} (${chunkContent.length} chars)`);

    lastLoadedChunkRef.current = nextChunk;

    // Reset loading flag after a short delay
    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, 500);

    return chunkContent;
  }, [getChunkContent]);

  /**
   * Load the previous chunk (when scrolling up)
   *
   * @returns Newly loaded chunk content, or null if already at start
   */
  const loadPreviousContent = useCallback((): string | null => {
    if (isLoadingMoreRef.current) {
      console.log('loadPreviousContent: Already loading, skipping');
      return null;
    }

    const firstChunk = firstLoadedChunkRef.current;

    // Check if there's a previous chunk to load
    const prevChunk = firstChunk - 1;
    if (prevChunk < 0) {
      console.log(`loadPreviousContent: Already at first chunk 0`);
      return null;
    }

    // Debounce
    const now = Date.now();
    if (now - lastScrollEventTime.current < CHUNK_LOAD_DEBOUNCE_MS) {
      console.log('loadPreviousContent: Debouncing, too soon');
      return null;
    }
    lastScrollEventTime.current = now;

    isLoadingMoreRef.current = true;

    // Load the previous chunk
    const chunkContent = getChunkContent(prevChunk);
    console.log(`✓ Loaded chunk ${prevChunk} (${chunkContent.length} chars)`);

    firstLoadedChunkRef.current = prevChunk;

    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, 500);

    return chunkContent;
  }, [getChunkContent]);

  /**
   * Jump to a specific chunk (for TOC navigation)
   *
   * Loads a 3-chunk window centered on the target chunk.
   *
   * @param targetChunkIndex - Chunk to jump to
   * @returns New content for the loaded window
   */
  const jumpToChunk = useCallback((targetChunkIndex: number): string => {
    const totalChunks = totalChunksRef.current;

    const newFirst = Math.max(0, targetChunkIndex);
    const newLast = Math.min(targetChunkIndex + 2, totalChunks - 1);

    let newContent = '';
    for (let i = newFirst; i <= newLast; i++) {
      newContent += getChunkContent(i);
    }

    firstLoadedChunkRef.current = newFirst;
    lastLoadedChunkRef.current = newLast;
    setCurrentContent(newContent);

    console.log(`Jumped to chunk ${targetChunkIndex}, loaded [${newFirst}, ${newLast}]`);

    return newContent;
  }, [getChunkContent]);

  /**
   * Calculate which chunk contains a specific character position
   */
  const getChunkForPosition = useCallback((position: number): number => {
    return Math.floor(position / CHUNK_SIZE);
  }, []);

  /**
   * Check if a chunk is currently loaded
   */
  const isChunkLoaded = useCallback((chunkIndex: number): boolean => {
    return chunkIndex >= firstLoadedChunkRef.current &&
           chunkIndex <= lastLoadedChunkRef.current;
  }, []);

  return {
    // State
    currentContent,
    firstLoadedChunk: firstLoadedChunkRef.current,
    lastLoadedChunk: lastLoadedChunkRef.current,
    totalChunks: totalChunksRef.current,
    isLoading: isLoadingMoreRef.current,

    // Actions
    loadInitialChunks,
    loadMoreContent,
    loadPreviousContent,
    jumpToChunk,

    // Utilities
    getChunkForPosition,
    isChunkLoaded,
    getChunkContent,
  };
};
