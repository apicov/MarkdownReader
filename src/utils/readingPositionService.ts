import AsyncStorage from '@react-native-async-storage/async-storage';
import {ReadingPosition} from '../types';

const POSITION_KEY = 'readingPositions';

export const saveReadingPosition = async (
  documentId: string,
  scrollOffset: number,
  chunkIndex?: number,
): Promise<void> => {
  try {
    const positions = await getAllReadingPositions();
    positions[documentId] = {
      documentId,
      scrollOffset,
      chunkIndex,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(POSITION_KEY, JSON.stringify(positions));
  } catch (error) {
    console.error('Failed to save reading position:', error);
  }
};

export const getReadingPosition = async (
  documentId: string,
): Promise<ReadingPosition | null> => {
  try {
    const positions = await getAllReadingPositions();
    return positions[documentId] || null;
  } catch (error) {
    console.error('Failed to get reading position:', error);
    return null;
  }
};

const getAllReadingPositions = async (): Promise<{
  [key: string]: ReadingPosition;
}> => {
  try {
    const stored = await AsyncStorage.getItem(POSITION_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to get all reading positions:', error);
    return {};
  }
};
