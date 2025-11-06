# Debugging Guide for Android 10 Loading Issue

## How to View Logs on Android Tablet

### Option 1: Using ADB (Recommended)

1. **Enable USB Debugging on your tablet:**
   - Go to Settings → About tablet
   - Tap "Build number" 7 times to enable Developer options
   - Go to Settings → Developer options
   - Enable "USB debugging"

2. **Connect tablet to computer via USB**

3. **View logs in real-time:**
   ```bash
   adb logcat | grep -E "WebView|ReactNative|chromium"
   ```

4. **Filter for specific errors:**
   ```bash
   adb logcat *:E | grep -E "WebView|chromium"
   ```

### Option 2: Using React Native Debugger

1. **While app is running, shake the device**
2. **Select "Debug" from the menu**
3. **View console logs in Chrome DevTools**

### Option 3: Using Expo Dev Client

If you're using Expo:
```bash
npx expo start --android
```

Then check the Metro bundler console output.

## What to Look For

The enhanced logging will show:

### WebView Load Progress
```
[WebView] Load started
[WebView] Load progress: 0.5
[WebView] Load progress: 1.0
[WebView] Load ended
[WebView] Loaded successfully
```

### Errors
```
[WebView Error] { message: "...", lineNo: ..., columnNo: ... }
[WebView] onError: { ... }
```

### Timeout Warning
```
[WebView] Load timeout - forcing ready state after 10 seconds
```

## Common Issues on Android 10

1. **File access permissions** - Check if `allowFileAccessFromFileURLs` is working
2. **Large bundle size** - The bundled libraries are ~340KB, might timeout on slow devices
3. **JavaScript engine incompatibility** - Some ES6 features might not work on older WebView
4. **Memory issues** - Large markdown files + bundled libs might exceed memory

## Next Steps Based on Logs

### If you see "Load timeout"
The WebView is stuck. This could mean:
- JavaScript isn't executing
- The bundled libraries have syntax errors on Android 10's WebView

### If you see JavaScript errors
Share the exact error message - it will tell us which library is failing.

### If you see nothing
The HTML file might not be getting created or loaded properly.
