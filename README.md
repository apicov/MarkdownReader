# Markdown Reader (Expo)

A clean and simple Expo/React Native app for reading markdown documents converted from PDFs using the marker library.

## Features

✅ **Document Listing** - Browse markdown folders from bundled assets
✅ **Markdown Rendering** - Beautiful rendering with support for images, code blocks, and formatting
✅ **Dual Navigation** - Scroll with finger or tap left/right sides for page-like navigation
✅ **Image Zoom** - Tap any image to view full-screen with pinch-to-zoom
✅ **Font Resize** - Pinch with two fingers anywhere to adjust font size
✅ **Reading Position** - Automatically saves and restores your reading position
✅ **Night Mode** - Black background with red text for comfortable night reading
✅ **Word Translation** - Long-press any word for LLM-powered translation and explanation

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

## Configuration

### Adding Documents

Documents are loaded from the `assets/docs` folder. Each document should be in its own folder containing:
- A `.md` markdown file
- Associated image files (referenced in the markdown)

Example structure:
```
assets/docs/
├── Book 1/
│   ├── book.md
│   ├── image1.jpg
│   └── image2.png
└── Book 2/
    ├── book.md
    └── images...
```

**Your 3 sample documents are already included!**

### LLM Translation Setup

To enable word translation, edit [src/contexts/SettingsContext.tsx](src/contexts/SettingsContext.tsx#L16):

```typescript
const defaultSettings: AppSettings = {
  fontSize: 16,
  isDarkMode: false,
  docsPath: 'docs',
  llmApiUrl: 'https://api.openai.com/v1/chat/completions',
  llmApiKey: 'your-api-key-here',
};
```

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

## Project Structure

```
assets/docs/               # Your markdown documents (bundled with app)
src/
├── components/
│   ├── ImageZoom.tsx          # Full-screen image viewer
│   └── MarkdownReader.tsx     # Main markdown rendering component
├── contexts/
│   ├── SettingsContext.tsx    # App settings and persistence
│   └── ThemeContext.tsx       # Theme management (light/dark)
├── screens/
│   └── DocumentListScreen.tsx # Document browsing screen
├── types/
│   └── index.ts              # TypeScript interfaces
└── utils/
    ├── documentService.ts     # Expo file system operations
    ├── llmService.ts         # LLM API integration
    └── readingPositionService.ts # Reading position persistence
```

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

## License

MIT
