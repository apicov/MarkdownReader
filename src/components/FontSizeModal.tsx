/**
 * Font Size Modal Component
 *
 * Provides a simple UI for adjusting font size with +/- buttons.
 * Displays current size and enforces min/max limits.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { incrementFontSize, decrementFontSize } from '../utils/fontSizeUtils';

interface FontSizeModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Current font size */
  fontSize: number;
  /** Callback when font size changes */
  onFontSizeChange: (newSize: number) => void;
  /** Callback when modal should close */
  onClose: () => void;
}

/**
 * Modal for font size adjustment
 *
 * Shows current size and provides increment/decrement buttons.
 * Automatically saves changes via callback.
 *
 * @example
 * <FontSizeModal
 *   visible={showModal}
 *   fontSize={16}
 *   onFontSizeChange={(size) => updateSettings({ fontSize: size })}
 *   onClose={() => setShowModal(false)}
 * />
 */
export const FontSizeModal: React.FC<FontSizeModalProps> = ({
  visible,
  fontSize,
  onFontSizeChange,
  onClose,
}) => {
  const { theme } = useTheme();

  const handleIncrement = () => {
    const newSize = incrementFontSize(fontSize);
    onFontSizeChange(newSize);
  };

  const handleDecrement = () => {
    const newSize = decrementFontSize(fontSize);
    onFontSizeChange(newSize);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Current Size Display */}
          <Text style={[styles.label, { color: theme.text }]}>
            Font Size: {fontSize}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.accent }]}
              onPress={handleDecrement}
            >
              <Text style={styles.buttonText}>−</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.accent }]}
              onPress={handleIncrement}
            >
              <Text style={styles.buttonText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <Text style={[styles.hint, { color: theme.text }]}>
            Range: 10-32
          </Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    opacity: 0.7,
  },
});
