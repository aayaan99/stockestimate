/**
 * Export utilities — PDF and JPEG using html2canvas + jsPDF
 */

export async function exportToImage(elementId, filename = 'stockestimate') {
  const { default: html2canvas } = await import('html2canvas');
  const element = document.getElementById(elementId);
  if (!element) {
    alert('Nothing to export. Make sure the dashboard is visible.');
    return;
  }

  const canvas = await html2canvas(element, {
    backgroundColor: '#f1f5f9',
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const link = document.createElement('a');
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.jpeg`;
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
}

export async function exportToPdf(elementId, filename = 'stockestimate') {
  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF } = await import('jspdf');

  const element = document.getElementById(elementId);
  if (!element) {
    alert('Nothing to export. Make sure the dashboard is visible.');
    return;
  }

  const canvas = await html2canvas(element, {
    backgroundColor: '#f1f5f9',
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // A4 landscape for wider tables
  const pdfWidth = 297;
  const pdfHeight = 210;
  const margin = 10;

  const contentWidth = pdfWidth - margin * 2;
  const ratio = contentWidth / imgWidth;
  const scaledHeight = imgHeight * ratio;

  const pdf = new jsPDF({
    orientation: scaledHeight > pdfHeight ? 'portrait' : 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
  let yOffset = 0;

  // Multi-page support
  while (yOffset < scaledHeight) {
    if (yOffset > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, margin - yOffset, contentWidth, scaledHeight);
    yOffset += pageHeight;
  }

  pdf.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`);
}
