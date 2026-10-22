import { toPng } from 'html-to-image';

/**
 * Export a chart element as a PNG image (base64 encoded)
 */
export async function exportChartAsImage(
  chartElement: HTMLElement,
  width: number = 800,
  height: number = 600
): Promise<string> {
  try {
    const dataUrl = await toPng(chartElement, {
      width,
      height,
      quality: 1.0,
      pixelRatio: 2, // Higher quality for retina displays
      backgroundColor: document.documentElement.classList.contains('dark') ? '#0b0f0d' : '#ffffff',
    });

    // Remove the data URL prefix to get just the base64 data
    const base64Data = dataUrl.split(',')[1];
    return base64Data;
  } catch (error) {
    console.error('Error exporting chart as image:', error);
    throw new Error('Failed to export chart image');
  }
}

/**
 * Convert base64 string to Uint8Array for Rust backend
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
