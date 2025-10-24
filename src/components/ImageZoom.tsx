import React from 'react';
import {Modal, TouchableOpacity, StyleSheet, View, Text} from 'react-native';
import ImageViewer from 'react-native-image-zoom-viewer';
import {useTheme} from '../contexts/ThemeContext';

interface ImageZoomProps {
  imageUrl: string;
  visible: boolean;
  onClose: () => void;
}

export const ImageZoom: React.FC<ImageZoomProps> = ({
  imageUrl,
  visible,
  onClose,
}) => {
  const {theme} = useTheme();

  const images = [
    {
      url: imageUrl,
    },
  ];

  return (
    <Modal visible={visible} transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <ImageViewer
          imageUrls={images}
          enableSwipeDown
          onSwipeDown={onClose}
          backgroundColor={theme.background}
          renderIndicator={() => null}
        />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={[styles.closeButtonText, {color: theme.accent}]}>
            ✕ Close
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
