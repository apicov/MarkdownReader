# Markdown Reader

A powerful, performant Expo/React Native app for reading large markdown documents with advanced features like chunked loading, table of contents navigation, LaTeX rendering, and LLM-powered translation.

Perfect for reading technical documentation, converted PDFs, books, and research papers on mobile devices.

## ✨ Features

### Core Reading Features
- 📱 **Cross-Platform** - Works on Android, iOS, and Web
- 📄 **Large Document Support** - Chunked loading handles multi-MB files efficiently
- 📚 **Table of Contents** - Collapsible, hierarchical navigation tree
- 🎯 **Reading Position Memory** - Always return to where you left off
- 📖 **Dual Navigation** - Scroll with finger or tap edges for page-like navigation
- 🔍 **Smart Image Handling** - Tap to zoom, pinch to pan in full-screen modal

### Content Rendering
- ✅ **Rich Markdown** - Full support for formatting, code blocks, tables
- 🧮 **LaTeX/Math** - Beautiful equation rendering with KaTeX
- 🎨 **Syntax Highlighting** - Code blocks with proper formatting
- 🖼️ **Local Images** - Async loading with batching for performance

### Customization
- 🌙 **Dark Mode** - Black background with red text for night reading
- 🔤 **Adjustable Font** - Tap "Aa" button or pinch to resize
- 🎨 **Clean UI** - Minimal interface that gets out of the way

### Advanced Features
- 🌐 **LLM Translation** - Select text for instant translation/simplification
- ⚡ **Performance Optimized** - Lazy loading, debouncing, efficient chunking
- 💾 **Document Cache** - Faster startup with cached document list
- 📁 **File Picker** - Browse folders or open individual files

## Quick Start

### Prerequisites

- Node.js >= 20
- Expo Go app on your phone (optional, for easy testing)

### Installation & Run

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

# Then:
# - Press 'a' for Android emulator
# - Press 'i' for iOS simulator (macOS only)
# - Scan QR code with Expo Go app on your phone
```

## Advantages of Expo Version

- **No Android Studio/Xcode needed** for development
- **Expo Go app** - Test on real device instantly by scanning QR code
- **Faster development** - Hot reload and easier debugging
- **Simpler file system** - Uses expo-file-system (cleaner API)
- **Cross-platform** - Works on Android, iOS, and Web

## 📖 Usage Guide

### First Time Setup

1. **Launch the app** - You'll see the document list screen
2. **Tap the ⚙️ icon** - Go to settings
3. **Select documents folder** - Use "Pick Folder" to choose where your markdown files are stored
4. **Return to list** - Tap "← Back" to return to the main screen
5. **Tap 🔄** - Refresh to load documents from your selected folder

### Reading Documents

- **Open a document** - Tap any item in the list
- **Navigate** - Scroll with finger, or tap left/right screen edges
- **Table of Contents** - Tap the ≡ button to see all headings and jump to sections
- **Adjust font** - Tap the "Aa" button and use +/- buttons
- **Toggle dark mode** - Tap the 🌙/☀️ icon
- **View images** - Tap any image for full-screen with pinch-to-zoom

### Translation Feature

1. **Configure in Settings:**
   - API URL: `https://api.openai.com/v1/chat/completions` (or Groq, etc.)
   - API Key: Your OpenAI/Groq API key
   - Model: `gpt-4` or `llama-3.3-70b-versatile`
   - Target Language: `Spanish`, `French`, etc.

2. **Use:** Select any text to translate

### Adding Your Documents

Documents can be stored anywhere on your device. Each folder should contain:
- One `.md` markdown file
- Associated image files (referenced in the markdown)

Example structure:
```
/sdcard/Download/Books/
├── MyBook1/
│   ├── chapter1.md
│   ├── image1.jpg
│   └── image2.png
└── MyBook2/
    ├── document.md
    └── diagrams/
        └── ...
```

Then point the app to `/sdcard/Download/Books/` in settings.

## Usage

### Navigation
- **Scroll**: Swipe up/down to scroll through the document
- **Page Mode**: Tap the left or right edges of the screen to jump by one screen height

### Font Size
- Pinch with two fingers anywhere on the screen to adjust font size
- Settings are automatically saved

### Images
- Images are displayed at a smaller size by default
- Tap any image to view full-screen with zoom capability
- Swipe down or tap the close button to exit full-screen

### Night Mode
- Tap the moon/sun icon (🌙/☀️) in the document list to toggle night mode
- Night mode uses black background with red text

### Word Translation
- Long-press any word to translate it to Spanish
- Requires LLM API configuration (see above)
- Results show both translation and explanation

## Building for Production

```bash
# Build for Android
npx expo build:android

# Build for iOS
npx expo build:ios

# Or use EAS Build (recommended)
npm install -g eas-cli
eas build --platform android
eas build --platform ios
```

## 📁 Project Structure

```
src/
├── components/                       # React Components
│   ├── MarkdownReader.tsx            # Main reader orchestrator
│   ├── WebViewMarkdownReader.tsx     # WebView-based markdown rendering
│   ├── TranslationModal.tsx          # Translation results display
│   ├── TableOfContentsModal.tsx      # TOC navigation modal
│   └── FontSizeModal.tsx             # Font size adjustment UI
├── screens/                          # Screen-level components
│   ├── DocumentListScreen.tsx        # Document browser
│   └── SettingsScreen.tsx            # Settings configuration
├── contexts/                         # React Context providers
│   ├── SettingsContext.tsx           # App settings + persistence
│   └── ThemeContext.tsx              # Theme (light/dark) management
├── hooks/                            # Custom React hooks
│   ├── useChunkPagination.ts         # Document chunking logic
│   └── useTranslation.ts             # Translation API integration
├── utils/                            # Business logic utilities
│   ├── documentService.ts            # File system operations
│   ├── llmService.ts                 # LLM API calls
│   ├── readingPositionService.ts     # Position persistence
│   ├── tocService.ts                 # TOC extraction
│   ├── webViewHelpers.ts             # WebView JavaScript utilities
│   └── fontSizeUtils.ts              # Font size validation
├── constants/
│   └── index.ts                      # App-wide constants
└── types/
    └── index.ts                      # TypeScript interfaces
```

### Architecture Highlights

- **Modular Design** - Each file has a single, clear responsibility
- **Custom Hooks** - Business logic separated from UI components
- **Service Layer** - Pure functions for file operations, API calls, etc.
- **Type Safety** - Comprehensive TypeScript interfaces throughout
- **Well Documented** - JSDoc comments on every exported function

## Technologies

- **Expo SDK** - Managed React Native workflow
- **TypeScript** - Type-safe development
- **expo-file-system** - File system access
- **expo-asset** - Asset bundling
- **react-native-markdown-display** - Markdown rendering
- **react-native-gesture-handler** - Touch gestures
- **react-native-reanimated** - Smooth animations
- **AsyncStorage** - Local data persistence
- **Axios** - HTTP client for LLM API

## Troubleshooting

### Documents not loading?
- Make sure docs are in `assets/docs/` folder
- Each document must be in its own subfolder
- Check that the markdown file has `.md` extension

### App crashes on startup?
```bash
# Clear cache and restart
npm start -- --clear
```

### Images not showing?
- Verify image paths in markdown match actual file names
- Images must be in the same folder as the markdown file

## 🤝 Contributing

Contributions are welcome! This project is designed to be contributor-friendly with:

- **Clean, modular code** - Each file has a single responsibility
- **Comprehensive comments** - JSDoc documentation on all functions
- **TypeScript** - Full type safety throughout
- **Clear structure** - Easy to find and modify features

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with clear commit messages
4. Add tests if applicable
5. Submit a pull request

### Development Guidelines

- Follow existing code style and patterns
- Add JSDoc comments to new functions
- Keep components under 300 lines
- Use TypeScript strictly (no `any` types)
- Test on both Android and iOS if possible

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev/)
- Markdown rendering with [marked.js](https://marked.js.org/)
- Math rendering with [KaTeX](https://katex.org/)
- Translation powered by LLM APIs (OpenAI, Groq, etc.)

## 📧 Support

Found a bug or have a feature request? Please [open an issue](../../issues)!
