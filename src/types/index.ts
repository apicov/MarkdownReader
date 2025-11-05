/**
 * Type Definitions
 *
 * Central type definitions for the application.
 * Defines interfaces for documents, settings, themes, and reading state.
 */

/**
 * Represents a document in the file system
 */
export interface Document {
  /** Unique identifier for the document (typically folder name) */
  id: string;
  /** Display title for the document */
  title: string;
  /** URI path to the folder containing the document */
  folderPath: string;
  /** URI path to the markdown file (lazy-loaded, may be empty initially) */
  markdownFile: string;
}

/**
 * Stores a user's reading position within a document
 */
export interface ReadingPosition {
  /** ID of the document this position belongs to */
  documentId: string;
  /** Vertical scroll offset in pixels */
  scrollOffset: number;
  /** Timestamp when this position was last saved */
  timestamp: number;
}

/**
 * Theme color scheme definition
 */
export interface Theme {
  /** Background color (hex or rgb) */
  background: string;
  /** Primary text color */
  text: string;
  /** Accent color for interactive elements */
  accent: string;
  /** Border and separator color */
  border: string;
}

/**
 * Application settings persisted across sessions
 */
export interface AppSettings {
  /** Font size in pixels for markdown content */
  fontSize: number;
  /** Whether dark mode is enabled (deprecated - use ThemeContext) */
  isDarkMode: boolean;
  /** Path to the documents directory on device */
  docsPath: string;
  /** LLM API endpoint URL for translation feature */
  llmApiUrl?: string;
  /** API key for LLM service authentication */
  llmApiKey?: string;
  /** Model name to use for LLM requests */
  llmModel?: string;
  /** Target language for translations */
  targetLanguage?: string;
  /** Whether translation feature is enabled */
  translationEnabled?: boolean;
}
