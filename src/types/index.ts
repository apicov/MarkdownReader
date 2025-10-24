export interface Document {
  id: string;
  title: string;
  folderPath: string;
  markdownFile: string;
}

export interface ReadingPosition {
  documentId: string;
  scrollOffset: number;
  chunkIndex?: number;
  timestamp: number;
}

export interface Theme {
  background: string;
  text: string;
  accent: string;
  border: string;
}

export interface AppSettings {
  fontSize: number;
  isDarkMode: boolean;
  docsPath: string;
  llmApiUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
  targetLanguage?: string;
}
