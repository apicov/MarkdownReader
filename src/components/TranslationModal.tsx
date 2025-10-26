/**
 * Translation Modal Component
 *
 * Displays translation results in a floating bottom sheet.
 * Shows loading state while translating, then displays the result.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

interface TranslationModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Translated text to display (null while loading) */
  translation: string | null;
  /** Whether translation is in progress */
  loading: boolean;
  /** Callback when close button is pressed */
  onClose: () => void;
}

/**
 * Floating modal that displays translation results
 *
 * Appears at the bottom of the screen, overlaying the reader.
 * Shows a spinner while loading, then displays the translated text.
 *
 * @example
 * <TranslationModal
 *   visible={showModal}
 *   translation="Texto traducido"
 *   loading={false}
 *   onClose={() => setShowModal(false)}
 * />
 */
export const TranslationModal: React.FC<TranslationModalProps> = ({
  visible,
  translation,
  loading,
  onClose,
}) => {
  const { theme } = useTheme();

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlayAbsolute} pointerEvents="box-none">
      <SafeAreaView edges={['bottom']} style={styles.safeArea} pointerEvents="box-none">
        <View
          pointerEvents="auto"
          style={[
            styles.container,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeButtonText, { color: theme.text }]}>
              ✕
            </Text>
          </TouchableOpacity>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.accent} />
              <Text style={[styles.loadingText, { color: theme.text }]}>
                Translating...
              </Text>
            </View>
          ) : (
            <Text style={[styles.translationText, { color: theme.text }]}>
              {translation || 'No translation available'}
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayAbsolute: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  safeArea: {
    width: '100%',
  },
  container: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    minHeight: 80,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  translationText: {
    fontSize: 16,
    lineHeight: 24,
    paddingRight: 40, // Space for close button
  },
});
