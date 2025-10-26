/**
 * Font Size Utilities
 *
 * Provides validation and manipulation functions for font size settings.
 * Ensures font sizes stay within acceptable bounds.
 */

import {
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  FONT_SIZE_STEP,
  DEFAULT_FONT_SIZE,
} from '../constants';

/**
 * Validate and clamp font size to acceptable range
 *
 * @param size - Font size to validate
 * @returns Clamped size between MIN_FONT_SIZE and MAX_FONT_SIZE
 *
 * @example
 * validateFontSize(8)  // Returns 10 (minimum)
 * validateFontSize(40) // Returns 32 (maximum)
 * validateFontSize(16) // Returns 16 (valid)
 */
export const validateFontSize = (size: number): number => {
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
};

/**
 * Increase font size by one step
 *
 * @param currentSize - Current font size
 * @returns New size, clamped to maximum
 *
 * @example
 * incrementFontSize(16) // Returns 18 (16 + 2)
 * incrementFontSize(32) // Returns 32 (already at max)
 */
export const incrementFontSize = (currentSize: number): number => {
  return validateFontSize(currentSize + FONT_SIZE_STEP);
};

/**
 * Decrease font size by one step
 *
 * @param currentSize - Current font size
 * @returns New size, clamped to minimum
 *
 * @example
 * decrementFontSize(16) // Returns 14 (16 - 2)
 * decrementFontSize(10) // Returns 10 (already at min)
 */
export const decrementFontSize = (currentSize: number): number => {
  return validateFontSize(currentSize - FONT_SIZE_STEP);
};

/**
 * Parse font size from string input (for text fields)
 *
 * @param input - String representation of font size
 * @returns Validated number, or null if invalid
 *
 * @example
 * parseFontSize('16')   // Returns 16
 * parseFontSize('abc')  // Returns null
 * parseFontSize('40')   // Returns 32 (clamped to max)
 */
export const parseFontSize = (input: string): number | null => {
  const parsed = parseInt(input, 10);

  if (isNaN(parsed)) {
    return null;
  }

  return validateFontSize(parsed);
};

/**
 * Check if font size is valid
 *
 * @param size - Font size to check
 * @returns True if within valid range
 *
 * @example
 * isValidFontSize(16)  // Returns true
 * isValidFontSize(5)   // Returns false
 * isValidFontSize(50)  // Returns false
 */
export const isValidFontSize = (size: number): boolean => {
  return !isNaN(size) && size >= MIN_FONT_SIZE && size <= MAX_FONT_SIZE;
};

/**
 * Get error message for invalid font size
 *
 * @param size - Invalid font size
 * @returns User-friendly error message
 *
 * @example
 * getFontSizeErrorMessage(5)
 * // Returns 'Font size must be between 10 and 32'
 */
export const getFontSizeErrorMessage = (size: number): string => {
  if (isNaN(size)) {
    return `Please enter a valid number between ${MIN_FONT_SIZE} and ${MAX_FONT_SIZE}`;
  }

  if (size < MIN_FONT_SIZE) {
    return `Font size must be at least ${MIN_FONT_SIZE}`;
  }

  if (size > MAX_FONT_SIZE) {
    return `Font size must be at most ${MAX_FONT_SIZE}`;
  }

  return `Font size must be between ${MIN_FONT_SIZE} and ${MAX_FONT_SIZE}`;
};

/**
 * Reset font size to default
 *
 * @returns Default font size
 */
export const resetFontSize = (): number => {
  return DEFAULT_FONT_SIZE;
};
