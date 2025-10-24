/**
 * Splits markdown content into manageable chunks for pagination
 * Strategy: Split by headings to keep sections together
 */

const TARGET_CHUNK_SIZE = 50000; // ~50KB per chunk

export interface MarkdownChunk {
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Splits markdown content into chunks by headings while respecting size limits
 */
export const splitMarkdownIntoChunks = (markdown: string): MarkdownChunk[] => {
  if (!markdown || markdown.length === 0) {
    return [{content: '', startLine: 0, endLine: 0}];
  }

  // If content is small enough, return as single chunk
  if (markdown.length <= TARGET_CHUNK_SIZE) {
    return [{content: markdown, startLine: 0, endLine: markdown.split('\n').length}];
  }

  const lines = markdown.split('\n');
  const chunks: MarkdownChunk[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;
  let chunkStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineSize = line.length + 1; // +1 for newline

    // Check if this is a heading (# or ##)
    const isHeading = /^#{1,2}\s+/.test(line);

    // If we're at a heading and current chunk is large enough, start new chunk
    if (isHeading && currentSize > TARGET_CHUNK_SIZE * 0.8 && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.join('\n'),
        startLine: chunkStartLine,
        endLine: i,
      });

      // Start new chunk
      currentChunk = [line];
      currentSize = lineSize;
      chunkStartLine = i;
    } else {
      currentChunk.push(line);
      currentSize += lineSize;

      // If chunk is too large and not at a heading, force split
      if (currentSize > TARGET_CHUNK_SIZE * 1.5) {
        chunks.push({
          content: currentChunk.join('\n'),
          startLine: chunkStartLine,
          endLine: i + 1,
        });

        currentChunk = [];
        currentSize = 0;
        chunkStartLine = i + 1;
      }
    }
  }

  // Add remaining content
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      startLine: chunkStartLine,
      endLine: lines.length,
    });
  }

  return chunks.length > 0 ? chunks : [{content: markdown, startLine: 0, endLine: lines.length}];
};

/**
 * Gets the chunk index for a given scroll offset (for position restoration)
 */
export const getChunkIndexForScrollOffset = (
  scrollOffset: number,
  totalHeight: number,
  totalChunks: number,
): number => {
  if (totalChunks <= 1 || totalHeight === 0) return 0;

  const progress = scrollOffset / totalHeight;
  const chunkIndex = Math.floor(progress * totalChunks);

  return Math.max(0, Math.min(chunkIndex, totalChunks - 1));
};
