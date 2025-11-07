# Building and Installing Android APK

## Project Structure

The Android-specific code and build files are located in the `android/` folder:

```
MarkdownReader/
├── android/
│   ├── app/
│   │   ├── build.gradle          # App-level build configuration
│   │   ├── src/                  # Android source code
│   │   └── build/
│   │       └── outputs/
│   │           └── apk/
│   │               └── release/
│   │                   └── app-release.apk  # Generated APK location
│   ├── build.gradle              # Project-level build configuration
│   ├── gradle.properties         # Gradle properties
│   └── settings.gradle           # Gradle settings
```

## Building the Release APK

From the project root directory, run:

```bash
./gradlew assembleRelease --no-daemon
```

- `assembleRelease`: Builds the release variant of the APK
- `--no-daemon`: Runs without Gradle daemon (useful for CI/CD or one-off builds)

### Output Location

After a successful build, the APK will be located at:

```
android/app/build/outputs/apk/release/app-release.apk
```

## Installing on Android Device

### Prerequisites

1. **Android SDK with ADB installed**
2. **USB debugging enabled** on your Android device:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times to enable Developer Options
   - Go to Settings → Developer Options
   - Enable "USB Debugging"
3. **Device connected** via USB or over network

### Verify Device Connection

Check that your device is connected:

```bash
adb devices
```

You should see output like:
```
List of devices attached
ABC123456789    device
```

### Install the APK

To install the APK on the connected device:

```bash
adb install -r app-release.apk
```

Or with the full path:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

**Flags:**
- `-r`: Reinstall the app while keeping its data and cache directories

### Troubleshooting

**Multiple devices connected:**
```bash
adb -s <device-id> install -r app-release.apk
```

**Uninstall first:**
```bash
adb uninstall com.markdownreader  # Replace with your package name
adb install app-release.apk
```

**Permission denied:**
- Check USB debugging is enabled
- Try revoking and re-authorizing USB debugging permissions on the device

## Clean Build

If you encounter build issues, clean the build:

```bash
./gradlew clean
./gradlew assembleRelease --no-daemon
```
