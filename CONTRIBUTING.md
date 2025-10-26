# Contributing to Markdown Reader

First off, thank you for considering contributing to Markdown Reader! 🎉

## Code of Conduct

This project welcomes contributions from everyone. Please be respectful and constructive in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title** - Describe the issue concisely
- **Steps to reproduce** - Detailed steps to trigger the bug
- **Expected vs actual behavior** - What should happen vs what actually happens
- **Screenshots** - If applicable, add screenshots
- **Environment** - Device, OS version, app version

### Suggesting Enhancements

Enhancement suggestions are welcome! Please include:

- **Clear use case** - Why is this feature needed?
- **Detailed description** - How should it work?
- **Alternatives considered** - Other approaches you've thought about

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** following our code style
3. **Test thoroughly** on Android and iOS if possible
4. **Update documentation** if you changed APIs
5. **Write clear commit messages**
6. **Submit the PR** with a comprehensive description

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio or Xcode (optional, for testing)

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/MarkdownReader.git
cd MarkdownReader

# Install dependencies
npm install

# Start development server
npm start
```

### Running on Devices

```bash
# Android emulator
npm run android

# iOS simulator (macOS only)
npm run ios

# Physical device with Expo Go
# Scan the QR code from `npm start`
```

## Code Style Guide

### General Principles

1. **Keep it simple** - Prefer clarity over cleverness
2. **Single responsibility** - Each function/component does one thing well
3. **DRY** - Don't repeat yourself
4. **Type safety** - Use TypeScript strictly

### File Organization

```
src/
├── components/     # Reusable UI components (< 300 lines each)
├── screens/        # Screen-level components
├── contexts/       # React Context providers
├── hooks/          # Custom React hooks
├── utils/          # Pure utility functions
├── constants/      # App-wide constants
└── types/          # TypeScript interfaces
```

### Naming Conventions

- **Components**: PascalCase - `MarkdownReader.tsx`
- **Hooks**: camelCase with "use" prefix - `useTranslation.ts`
- **Utils**: camelCase - `fontSizeUtils.ts`
- **Constants**: UPPER_SNAKE_CASE - `CHUNK_SIZE`
- **Interfaces**: PascalCase - `interface AppSettings {}`

### TypeScript Guidelines

```typescript
// ✅ GOOD: Explicit return types
export const calculateChunk = (index: number): string => {
  return fullContent.substring(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
};

// ❌ BAD: Using 'any'
const data: any = response.json();

// ✅ GOOD: Proper typing
interface ApiResponse {
  choices: Array<{ message: { content: string } }>;
}
const data: ApiResponse = await response.json();
```

### Documentation

All exported functions must have JSDoc comments:

```typescript
/**
 * Translate text using configured LLM API
 *
 * Makes a request to the LLM service to translate selected text
 * to the target language specified in settings.
 *
 * @param text - Text to translate
 * @returns Promise resolving to translated text, or null on error
 *
 * @example
 * const result = await translate('Hello world');
 * // Returns: 'Hola mundo'
 */
export const translate = async (text: string): Promise<string | null> => {
  // Implementation
};
```

### Component Structure

Organize components in this order:

```typescript
// 1. Imports
import React, { useState } from 'react';
import { View, Text } from 'react-native';

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
  onPress: () => void;
}

// 3. Component
export const MyComponent: React.FC<MyComponentProps> = ({ title, onPress }) => {
  // 3a. Hooks
  const [state, setState] = useState(false);
  const { theme } = useTheme();

  // 3b. Event handlers
  const handlePress = () => {
    setState(true);
    onPress();
  };

  // 3c. Render
  return (
    <View>
      <Text>{title}</Text>
    </View>
  );
};

// 4. Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

### Component Size Limits

- **Components**: Keep under 300 lines
- **Hooks**: Keep under 200 lines
- **Utils**: Keep under 150 lines per function

If a file grows too large, split it into multiple files.

### Testing

While we don't have comprehensive tests yet, when adding new utilities:

```typescript
// Example: src/utils/__tests__/fontSizeUtils.test.ts
import { validateFontSize, incrementFontSize } from '../fontSizeUtils';

describe('fontSizeUtils', () => {
  describe('validateFontSize', () => {
    it('should clamp to minimum', () => {
      expect(validateFontSize(5)).toBe(10);
    });

    it('should clamp to maximum', () => {
      expect(validateFontSize(50)).toBe(32);
    });

    it('should accept valid sizes', () => {
      expect(validateFontSize(16)).toBe(16);
    });
  });
});
```

## Project Architecture

### Key Principles

1. **Separation of Concerns**
   - UI components focus on presentation
   - Hooks contain business logic
   - Utils are pure functions
   - Services handle external APIs

2. **Data Flow**
   ```
   User Action → Component → Hook → Service → API/Storage
                     ↓
                  State Update → Re-render
   ```

3. **State Management**
   - React Context for global state (theme, settings)
   - Local useState for component state
   - Refs for mutable values that don't trigger re-renders

### Adding New Features

**Example: Adding a bookmark feature**

1. **Add types** in `src/types/index.ts`:
   ```typescript
   export interface Bookmark {
     id: string;
     documentId: string;
     position: number;
     timestamp: number;
   }
   ```

2. **Create service** in `src/utils/bookmarkService.ts`:
   ```typescript
   export const saveBookmark = async (bookmark: Bookmark) => {
     // Implementation
   };
   ```

3. **Create hook** in `src/hooks/useBookmarks.ts`:
   ```typescript
   export const useBookmarks = (documentId: string) => {
     const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
     // Hook logic
     return { bookmarks, addBookmark, removeBookmark };
   };
   ```

4. **Create UI component** in `src/components/BookmarkButton.tsx`:
   ```typescript
   export const BookmarkButton: React.FC<Props> = ({ ... }) => {
     const { addBookmark } = useBookmarks(documentId);
     // Component implementation
   };
   ```

5. **Integrate** into existing components

## Performance Considerations

- Use `React.memo()` for components that receive same props frequently
- Use `useCallback()` for event handlers passed to child components
- Use `useMemo()` for expensive calculations
- Avoid inline function definitions in render methods
- Debounce scroll handlers and other high-frequency events

## Common Pitfalls

### 1. Forgetting to Clean Up Effects

```typescript
// ❌ BAD
useEffect(() => {
  const interval = setInterval(() => { /* ... */ }, 1000);
}, []);

// ✅ GOOD
useEffect(() => {
  const interval = setInterval(() => { /* ... */ }, 1000);
  return () => clearInterval(interval);
}, []);
```

### 2. Mutating State Directly

```typescript
// ❌ BAD
state.items.push(newItem);
setState(state);

// ✅ GOOD
setState({ ...state, items: [...state.items, newItem] });
```

### 3. Missing Dependencies in useEffect

```typescript
// ❌ BAD
useEffect(() => {
  loadDocument(documentId);
}, []); // Missing documentId dependency!

// ✅ GOOD
useEffect(() => {
  loadDocument(documentId);
}, [documentId]);
```

## Git Workflow

### Branch Naming

- Feature: `feature/add-bookmarks`
- Bug fix: `fix/translation-crash`
- Refactor: `refactor/split-markdown-reader`
- Docs: `docs/update-contributing`

### Commit Messages

Follow conventional commits format:

```
feat: add bookmark functionality
fix: prevent crash when translating empty text
refactor: extract TOC logic to separate service
docs: update README with new features
chore: update dependencies
```

### Before Submitting PR

- [ ] Code follows style guidelines
- [ ] All new functions have JSDoc comments
- [ ] No TypeScript errors (`npm run tsc`)
- [ ] No console.log statements (use proper logging)
- [ ] Tested on Android and/or iOS
- [ ] Updated README if adding features
- [ ] Commits are clean and well-described

## Questions?

Feel free to open an issue with the `question` label, or reach out to the maintainers.

Thank you for contributing! 🙏
