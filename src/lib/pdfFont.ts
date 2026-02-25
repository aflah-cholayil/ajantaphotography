import type { jsPDF } from 'jspdf';

let fontBase64Cache: string | null = null;

/**
 * Fetches the Noto Sans font, converts to base64, and registers it with jsPDF.
 * This enables the ₹ (Indian Rupee) symbol to render correctly in PDFs.
 */
export async function registerPDFFont(doc: jsPDF): Promise<void> {
  try {
    if (!fontBase64Cache) {
      const response = await fetch('/fonts/NotoSans-Regular.ttf');
      if (!response.ok) throw new Error('Font fetch failed');
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fontBase64Cache = btoa(binary);
    }

    doc.addFileToVFS('NotoSans-Regular.ttf', fontBase64Cache);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.setFont('NotoSans');
  } catch (e) {
    console.warn('Failed to load NotoSans font for PDF, falling back to default:', e);
    // Falls back to default Helvetica - ₹ won't render but PDF still works
  }
}
