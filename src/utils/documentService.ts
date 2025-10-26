/**
 * Document Service
 *
 * Handles file system operations for document management.
 * Provides functions to:
 * - List document folders from a directory
 * - Find markdown files within folders
 * - Read markdown file content
 *
 * Uses Expo File System for cross-platform file access.
 */

import {File, Directory} from 'expo-file-system';
import {Document} from '../types';

/**
 * Retrieve list of document folders from a directory
 *
 * Scans the specified directory and returns all subdirectories as potential documents.
 * Does NOT check for markdown files at this stage (lazy loading for performance).
 *
 * @param docsPath - Path to the documents directory (can be relative or absolute)
 * @returns Array of Document objects representing folders, empty array on error
 */
export const getDocuments = async (
  docsPath: string,
): Promise<Document[]> => {
  try {
    // Validate input path
    if (!docsPath || docsPath.trim() === '') {
      return [];
    }

    // Ensure path has proper file:// prefix for File System API
    let fullPath = docsPath;
    if (docsPath.startsWith('/')) {
      fullPath = `file://${docsPath}`;
    }

    // Check if directory exists
    const dir = new Directory(fullPath);
    if (!dir.exists) {
      return [];
    }

    // Collect all subdirectories as potential documents
    const documents: Document[] = [];
    const items = dir.list();

    for (const item of items) {
      if (item instanceof Directory) {
        documents.push({
          id: item.name,
          title: item.name,
          folderPath: item.uri,
          markdownFile: '', // Lazy-loaded when user selects document
        });
      }
    }

    return documents;
  } catch (error) {
    console.error('Failed to get documents:', error);
    return [];
  }
};

/**
 * Find the first markdown file in a folder
 *
 * Searches for files with .md extension in the specified folder.
 * Returns the URI of the first markdown file found.
 *
 * @param folderUri - URI of the folder to search
 * @returns URI of the markdown file, or null if none found or on error
 */
export const findMarkdownInFolder = async (
  folderUri: string,
): Promise<string | null> => {
  try {
    const dir = new Directory(folderUri);
    if (!dir.exists) {
      return null;
    }

    // Scan folder for .md files
    const items = dir.list();
    for (const item of items) {
      if (item instanceof File && item.name.toLowerCase().endsWith('.md')) {
        return item.uri;
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to find markdown in folder:', error);
    return null;
  }
};

/**
 * Read the content of a markdown file
 *
 * Loads the entire file content as text. For large files, consider chunked reading
 * (handled in the MarkdownReader component).
 *
 * @param fileUri - URI of the markdown file to read
 * @returns File content as string, empty string on error
 */
export const readMarkdownFile = async (fileUri: string): Promise<string> => {
  try {
    const file = new File(fileUri);
    const content = await file.text();
    return content || '';
  } catch (error) {
    console.error('Failed to read markdown file:', error);
    return '';
  }
};
