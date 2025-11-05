/**
 * Document Cache Service
 *
 * Manages persistent caching of document metadata in a .mdreader folder
 * within each document's directory. This speeds up loading by pre-computing
 * expensive operations like file maps, TOC extraction, and heading positions.
 *
 * Cache structure:
 * <document-folder>/.mdreader/
 *   ├── file-map.json       - Map of all image files in the folder
 *   ├── toc.json            - Pre-extracted table of contents
 *   ├── headings.json       - Heading positions in the document
 *   ├── last-position.json  - Last reading position (heading ID)
 *   └── metadata.json       - Cache validation (file hash, timestamp)
 */

import {Directory, File} from 'expo-file-system';
import {TocItem} from './tocService';

const CACHE_FOLDER_NAME = '.mdreader';

interface CacheMetadata {
  markdownFileSize: number;
  markdownLastModified: number;
  version: number; // Cache format version
}

interface FileMapCache {
  files: {[filename: string]: string}; // filename -> full path
}

interface HeadingsCache {
  positions: {[headingId: string]: number}; // heading-N -> character position
}

interface LastPositionCache {
  headingId: string;
  timestamp: number;
}

/**
 * Get the cache directory path for a document
 */
const getCacheDirPath = (documentFolderPath: string): string => {
  // Ensure documentFolderPath ends with /
  const basePath = documentFolderPath.endsWith('/')
    ? documentFolderPath
    : documentFolderPath + '/';
  return basePath + CACHE_FOLDER_NAME;
};

/**
 * Ensure cache directory exists, creating it if necessary
 */
const ensureCacheDir = async (documentFolderPath: string): Promise<Directory> => {
  console.log('[CACHE] ensureCacheDir - documentFolderPath:', documentFolderPath);
  console.log('[CACHE] CACHE_FOLDER_NAME:', CACHE_FOLDER_NAME);

  const cacheDirPath = getCacheDirPath(documentFolderPath);
  console.log('[CACHE] cacheDirPath:', cacheDirPath);

  const cacheDir = new Directory(cacheDirPath);
  console.log('[CACHE] cacheDir.uri:', cacheDir.uri);
  console.log('[CACHE] cacheDir.exists:', cacheDir.exists);

  if (!cacheDir.exists) {
    try {
      const parentDir = new Directory(documentFolderPath);
      console.log('[CACHE] Creating directory:', CACHE_FOLDER_NAME, 'in parent:', parentDir.uri);
      await parentDir.createDirectory(CACHE_FOLDER_NAME);
      console.log('[CACHE] Successfully created cache directory');
    } catch (err) {
      console.error('[CACHE] Error creating directory:', err);
      // Ignore if directory was just created by another call
      if (!cacheDir.exists) {
        throw err;
      }
    }
  }

  return cacheDir;
};

/**
 * Delete a path if it exists as a directory (cleanup for wrongly created dirs)
 */
const deleteIfDirectory = async (path: string): Promise<void> => {
  try {
    console.log('[CACHE] deleteIfDirectory called with path:', path);

    // SAFETY CHECK: Only delete if path contains .mdreader and ends with .json
    if (!path.includes('.mdreader') || !path.endsWith('.json')) {
      console.error('[CACHE] SAFETY: Refusing to delete suspicious path:', path);
      return;
    }

    const asDir = new Directory(path);
    console.log('[CACHE] Checking if directory exists:', asDir.uri, 'exists:', asDir.exists);

    if (asDir.exists) {
      console.log('[CACHE] DELETING wrongly-created directory:', path);
      await asDir.delete();
      console.log('[CACHE] Successfully deleted directory');
    }
  } catch (err) {
    console.error('[CACHE] Error in deleteIfDirectory:', err);
  }
};

/**
 * Check if cache is valid for a markdown file
 */
export const isCacheValid = async (
  documentFolderPath: string,
  markdownFilePath: string,
): Promise<boolean> => {
  // Temporarily disabled - always return false (no cache)
  return false;
};

/**
 * Save cache metadata
 */
const saveCacheMetadata = async (
  documentFolderPath: string,
  markdownFilePath: string,
): Promise<void> => {
  try {
    const cacheDir = await ensureCacheDir(documentFolderPath);

    const markdownFile = new File(markdownFilePath);
    const metadata: CacheMetadata = {
      markdownFileSize: markdownFile.size,
      markdownLastModified: markdownFile.modificationTime || 0,
      version: 1,
    };

    // Clean up if metadata.json exists as a directory
    const metadataPath = cacheDir.uri.endsWith('/')
      ? cacheDir.uri + 'metadata.json'
      : cacheDir.uri + '/metadata.json';
    await deleteIfDirectory(metadataPath);

    const metadataContent = JSON.stringify(metadata, null, 2);
    await cacheDir.createFile('metadata.json', metadataContent);
  } catch (error) {
    console.error('Error saving cache metadata:', error);
  }
};

/**
 * Get cached file map
 */
export const getCachedFileMap = async (
  documentFolderPath: string,
): Promise<Map<string, string> | null> => {
  // Temporarily disabled - always return null (no cache)
  return null;
};

/**
 * Save file map to cache
 */
export const saveCachedFileMap = async (
  documentFolderPath: string,
  markdownFilePath: string,
  fileMap: Map<string, File>,
): Promise<void> => {
  // Temporarily disabled - do nothing
  return;
};

/**
 * Get cached TOC
 */
export const getCachedToc = async (
  documentFolderPath: string,
): Promise<TocItem[] | null> => {
  // Temporarily disabled - always return null (no cache)
  return null;
};

/**
 * Save TOC to cache
 */
export const saveCachedToc = async (
  documentFolderPath: string,
  markdownFilePath: string,
  toc: TocItem[],
): Promise<void> => {
  // Temporarily disabled - do nothing
  return;
};

/**
 * Get cached heading positions
 */
export const getCachedHeadingPositions = async (
  documentFolderPath: string,
): Promise<Map<string, number> | null> => {
  // Temporarily disabled - always return null (no cache)
  return null;
};

/**
 * Save heading positions to cache
 */
export const saveCachedHeadingPositions = async (
  documentFolderPath: string,
  markdownFilePath: string,
  positions: Map<string, number>,
): Promise<void> => {
  // Temporarily disabled - do nothing
  return;
};

/**
 * Get last reading position from cache
 */
export const getCachedLastPosition = async (
  documentFolderPath: string,
): Promise<string | null> => {
  // Temporarily disabled - always return null (no cache)
  return null;
};

/**
 * Save last reading position to cache
 */
export const saveCachedLastPosition = async (
  documentFolderPath: string,
  headingId: string,
): Promise<void> => {
  // Temporarily disabled - do nothing
  return;
};

/**
 * Clear all cache for a document
 */
export const clearDocumentCache = async (
  documentFolderPath: string,
): Promise<void> => {
  try {
    const cacheDirPath = getCacheDirPath(documentFolderPath);
    const cacheDir = new Directory(cacheDirPath);
    if (cacheDir.exists) {
      await cacheDir.delete();
    }
  } catch (error) {
    console.error('Error clearing document cache:', error);
  }
};
