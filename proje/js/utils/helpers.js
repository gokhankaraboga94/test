// ========================================
// HELPER FUNCTIONS
// ========================================

export function getTimestamp() {
  const now = new Date();
  return now.toLocaleString('tr-TR');
}

export function getTodayDateString() {
  const now = new Date();
  const turkeyTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3 * 60 * 60 * 1000));
  
  const year = turkeyTime.getFullYear();
  const month = String(turkeyTime.getMonth() + 1).padStart(2, '0');
  const day = String(turkeyTime.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

export function convertToTimestamp(dateString) {
  if (!dateString || dateString === "Tarih yok") return 0;
  
  try {
    const dateParts = dateString.split(' ');
    if (dateParts.length >= 2) {
      const [day, month, year] = dateParts[0].split('.');
      const [hours, minutes, seconds] = dateParts[1].split(':');
      
      const date = new Date(
        parseInt(year), 
        parseInt(month) - 1, 
        parseInt(day),
        parseInt(hours || 0),
        parseInt(minutes || 0),
        parseInt(seconds || 0)
      );
      
      return date.getTime();
    }
  } catch (error) {
    console.warn(`Date conversion error: ${dateString}`, error);
  }
  
  return Date.now();
}

export function validateBarcode(barcode) {
  return barcode && barcode.length === 15 && /^\d+$/.test(barcode);
}

export function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function sanitizeInput(input) {
  return input.trim().replace(/[<>]/g, '');
}

export function parseBarcode(text) {
  const match = text.match(/(\d{15})/);
  return match ? match[1] : null;
}

export function extractBarcodes(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
  return lines.map(line => parseBarcode(line)).filter(Boolean);
}