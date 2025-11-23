/**
 * Format a date string to French locale
 * Handles invalid/null dates gracefully
 */
export function formatDate(date: string | number | Date | null | undefined): string {
  if (!date) return 'N/A';

  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    return dateObj.toLocaleDateString('fr-FR');
  } catch {
    return 'N/A';
  }
}

/**
 * Format a date string to French locale with time
 */
export function formatDateTime(date: string | number | Date | null | undefined): string {
  if (!date) return 'N/A';

  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    return dateObj.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Format a date for chart display (short format)
 */
export function formatDateShort(date: string | number | Date | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    return dateObj.toLocaleDateString('fr-FR', {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}
