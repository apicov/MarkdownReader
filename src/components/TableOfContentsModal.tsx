/**
 * Table of Contents Modal Component
 *
 * Displays a collapsible, hierarchical table of contents for navigation.
 * Supports expand/collapse of nested headings.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { TocItem, shouldShowTocItem } from '../utils/tocService';

interface TableOfContentsModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Array of TOC items to display */
  items: TocItem[];
  /** Callback when a heading is selected */
  onItemPress: (headingId: string) => void;
  /** Callback when modal should close */
  onClose: () => void;
}

/**
 * Modal displaying table of contents with collapsible navigation
 *
 * Features:
 * - Hierarchical display based on heading levels
 * - Expand/collapse for headings with children
 * - Indentation to show nesting
 * - Different font sizes/weights for heading levels
 *
 * @example
 * <TableOfContentsModal
 *   visible={showToc}
 *   items={tocItems}
 *   onItemPress={(id) => scrollToHeading(id)}
 *   onClose={() => setShowToc(false)}
 * />
 */
export const TableOfContentsModal: React.FC<TableOfContentsModalProps> = ({
  visible,
  items,
  onItemPress,
  onClose,
}) => {
  const { theme } = useTheme();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  /**
   * Toggle expand/collapse state of an item
   */
  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  /**
   * Handle item press - close modal and navigate
   */
  const handleItemPress = (headingId: string) => {
    onClose();
    onItemPress(headingId);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.container,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>
              Table of Contents
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeButton, { color: theme.text }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* TOC List */}
          <ScrollView style={styles.scrollView}>
            {items.map((item, index) => {
              // Check if item should be visible based on parent expansion
              if (!shouldShowTocItem(index, items, expandedItems)) {
                return null;
              }

              const isExpanded = expandedItems.has(index);

              return (
                <View
                  key={index}
                  style={[
                    styles.item,
                    {
                      paddingLeft: (item.level - 1) * 16 + 16,
                      borderBottomColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.itemRow}>
                    {/* Expand/Collapse Button (if has children) */}
                    {item.hasChildren && (
                      <TouchableOpacity
                        onPress={() => toggleItem(index)}
                        style={styles.expandButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={[styles.expandIcon, { color: theme.accent }]}>
                          {isExpanded ? '−' : '+'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Heading Text */}
                    <TouchableOpacity
                      style={[
                        styles.textContainer,
                        !item.hasChildren && styles.textContainerNoIcon,
                      ]}
                      onPress={() => handleItemPress(item.id)}
                    >
                      <Text
                        style={[
                          styles.text,
                          {
                            color: theme.text,
                            fontSize: Math.max(14, 18 - item.level),
                            fontWeight: item.level === 1
                              ? 'bold'
                              : item.level === 2
                              ? '600'
                              : 'normal',
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {item.text}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </TouchableOpacity>
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
    width: '85%',
    maxHeight: '70%',
    marginTop: 'auto',
    marginBottom: 'auto',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: 'bold',
    opacity: 0.7,
  },
  scrollView: {
    maxHeight: '100%',
  },
  item: {
    paddingVertical: 8,
    paddingRight: 16,
    borderBottomWidth: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  expandIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
    paddingVertical: 4,
  },
  textContainerNoIcon: {
    marginLeft: 32, // Indent when no expand button
  },
  text: {
    lineHeight: 20,
  },
});
