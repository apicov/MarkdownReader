import {StorageAccessFramework, File, Directory} from 'expo-file-system';
import {Document} from '../types';

// Just list folders without checking for markdown files
export const getDocuments = async (
  docsPath: string,
): Promise<Document[]> => {
  try {
    if (!docsPath || docsPath.trim() === '') {
      return [];
    }

    let fullPath = docsPath;
    if (docsPath.startsWith('/')) {
      fullPath = `file://${docsPath}`;
    }

    const dir = new Directory(fullPath);
    if (!dir.exists) {
      return [];
    }

    const documents: Document[] = [];
    const items = dir.list();

    for (const item of items) {
      if (item instanceof Directory) {
        documents.push({
          id: item.name,
          title: item.name,
          folderPath: item.uri,
          markdownFile: '', // Will be populated when user opens the folder
        });
      }
    }

    return documents;
  } catch (error) {
    return [];
  }
};

// Check if a folder contains a markdown file and return it
export const findMarkdownInFolder = async (
  folderUri: string,
): Promise<string | null> => {
  try {
    const dir = new Directory(folderUri);
    if (!dir.exists) {
      return null;
    }

    const items = dir.list();
    for (const item of items) {
      if (item instanceof File && item.name.toLowerCase().endsWith('.md')) {
        return item.uri;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
};

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
