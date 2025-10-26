import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import {Directory} from 'expo-file-system';
import {useTheme} from '../contexts/ThemeContext';
import {useSettings} from '../contexts/SettingsContext';
import {
  parseFontSize,
  isValidFontSize,
  getFontSizeErrorMessage,
  resetFontSize,
} from '../utils/fontSizeUtils';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({onBack}) => {
  const {theme, isDarkMode} = useTheme();
  const {settings, updateSettings} = useSettings();

  const [docsPath, setDocsPath] = useState(settings.docsPath);
  const [fontSize, setFontSize] = useState(settings.fontSize.toString());
  const [llmApiUrl, setLlmApiUrl] = useState(settings.llmApiUrl || '');
  const [llmApiKey, setLlmApiKey] = useState(settings.llmApiKey || '');
  const [llmModel, setLlmModel] = useState(settings.llmModel || '');
  const [targetLanguage, setTargetLanguage] = useState(settings.targetLanguage || '');
  const [translationEnabled, setTranslationEnabled] = useState(settings.translationEnabled ?? true);

  const handlePickFolder = async () => {
    try {
      const result = await Directory.pickDirectoryAsync();
      if (result) {
        setDocsPath(result.uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick directory');
    }
  };

  const handleSave = async () => {
    const fontSizeNum = parseFontSize(fontSize);

    if (fontSizeNum === null || !isValidFontSize(fontSizeNum)) {
      const errorMessage = fontSizeNum === null
        ? 'Please enter a valid number'
        : getFontSizeErrorMessage(fontSizeNum);
      Alert.alert('Invalid Font Size', errorMessage);
      return;
    }

    await updateSettings({
      docsPath,
      fontSize: fontSizeNum,
      llmApiUrl,
      llmApiKey,
      llmModel,
      targetLanguage,
      translationEnabled,
    });

    Alert.alert('Settings Saved', 'Your settings have been updated successfully');
  };


  const handleReset = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to defaults?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const defaultFontSize = resetFontSize();
            setDocsPath('');
            setFontSize(defaultFontSize.toString());
            setLlmApiUrl('');
            setLlmApiKey('');
            setLlmModel('');
            setTargetLanguage('');
            setTranslationEnabled(true);
            await updateSettings({
              docsPath: '',
              fontSize: defaultFontSize,
              llmApiUrl: '',
              llmApiKey: '',
              llmModel: '',
              targetLanguage: '',
              translationEnabled: true,
            });
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, {backgroundColor: theme.background}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, {color: theme.accent}]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: theme.text}]}>Settings</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: theme.text}]}>
            Documents
          </Text>
          <Text style={[styles.label, {color: theme.text}]}>
            Documents Folder Path
          </Text>
          <TouchableOpacity
            style={[styles.pickerButton, {backgroundColor: theme.accent}]}
            onPress={handlePickFolder}>
            <Text style={styles.pickerButtonText}>Pick Folder</Text>
          </TouchableOpacity>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: isDarkMode ? '#1a0000' : '#f5f5f5',
              },
            ]}
            value={docsPath}
            onChangeText={setDocsPath}
            placeholder="/storage/emulated/0/Download"
            placeholderTextColor={isDarkMode ? '#660000' : '#999'}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: theme.text}]}>
            Appearance
          </Text>
          <Text style={[styles.label, {color: theme.text}]}>
            Default Font Size
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: isDarkMode ? '#1a0000' : '#f5f5f5',
              },
            ]}
            value={fontSize}
            onChangeText={setFontSize}
            keyboardType="numeric"
            placeholder="16"
            placeholderTextColor={isDarkMode ? '#660000' : '#999'}
          />
          <Text style={[styles.hint, {color: theme.text}]}>
            Range: 10-32. You can also pinch to resize while reading.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: theme.text}]}>
            Translation (LLM)
          </Text>

          <View style={styles.switchContainer}>
            <Text style={[styles.label, {color: theme.text}]}>Enable Translation</Text>
            <Switch
              value={translationEnabled}
              onValueChange={setTranslationEnabled}
              trackColor={{false: theme.border, true: theme.accent}}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={[styles.hint, {color: theme.text, marginBottom: 16}]}>
            When disabled, text selection will not trigger translation
          </Text>

          <Text style={[styles.label, {color: theme.text}]}>API URL</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: isDarkMode ? '#1a0000' : '#f5f5f5',
              },
            ]}
            value={llmApiUrl}
            onChangeText={setLlmApiUrl}
            placeholder="https://api.openai.com/v1/chat/completions"
            placeholderTextColor={isDarkMode ? '#660000' : '#999'}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, {color: theme.text, marginTop: 16}]}>
            API Key
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: isDarkMode ? '#1a0000' : '#f5f5f5',
              },
            ]}
            value={llmApiKey}
            onChangeText={setLlmApiKey}
            placeholder="sk-..."
            placeholderTextColor={isDarkMode ? '#660000' : '#999'}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.hint, {color: theme.text}]}>
            Required for long-press word translation feature
          </Text>

          <Text style={[styles.label, {color: theme.text, marginTop: 16}]}>
            Model
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: isDarkMode ? '#1a0000' : '#f5f5f5',
              },
            ]}
            value={llmModel}
            onChangeText={setLlmModel}
            placeholder="Model name"
            placeholderTextColor={isDarkMode ? '#660000' : '#999'}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.hint, {color: theme.text}]}>
            e.g., llama-3.3-70b-versatile (Groq) or gpt-4 (OpenAI)
          </Text>

          <Text style={[styles.label, {color: theme.text, marginTop: 16}]}>
            Target Language
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: isDarkMode ? '#1a0000' : '#f5f5f5',
              },
            ]}
            value={targetLanguage}
            onChangeText={setTargetLanguage}
            placeholder="e.g., Italian, Spanish, French"
            placeholderTextColor={isDarkMode ? '#660000' : '#999'}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.hint, {color: theme.text}]}>
            Language to translate words into
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.saveButton, {backgroundColor: theme.accent}]}
            onPress={handleSave}>
            <Text style={styles.buttonText}>Save Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.resetButton,
              {borderColor: theme.border},
            ]}
            onPress={handleReset}>
            <Text style={[styles.resetButtonText, {color: theme.text}]}>
              Reset to Defaults
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 16,
    marginBottom: 32,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  pickerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
});
