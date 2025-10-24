import {StorageAccessFramework, File, Directory} from 'expo-file-system';
import {Document} from '../types';

const scanForMarkdownFolders = (
  dir: Directory,
  documents: Document[],
): void => {
  try {
    const items = dir.list();

    for (const item of items) {
      if (item instanceof Directory) {
        try {
          // It's a directory - check for .md files
          const subItems = item.list();

          // Find first .md file
          for (const subItem of subItems) {
            if (subItem instanceof File && subItem.name.toLowerCase().endsWith('.md')) {
              documents.push({
                id: item.name,
                title: item.name,
                folderPath: item.uri,
                markdownFile: subItem.uri,
              });
              break; // Stop as soon as we find one
            }
          }
        } catch (error) {
          // Skip directories we can't read
        }
      }
    }
  } catch (error) {
    // Can't read directory
  }
};

export const getDocuments = (docsPath: string): Document[] => {
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
    scanForMarkdownFolders(dir, documents);

    return documents;
  } catch (error) {
    return [];
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
