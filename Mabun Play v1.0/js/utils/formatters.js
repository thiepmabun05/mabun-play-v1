/**
 * Formatters – consistent formatting for dates, currency, numbers
 */

/**
 * Format amount as South Sudanese Pound (SSP)
 * @param {number} amount - Amount to format
 * @param {boolean} compact - If true, use K for thousands
 * @returns {string}
 */
export function formatCurrency(amount, compact = false) {
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  if (compact && amount >= 1000) {
    const thousands = (amount / 1000).toFixed(1);
    return `${thousands}K SSP`;
  }
  return amount.toLocaleString() + ' SSP';
}

/**
 * Compact number with K suffix
 * @param {number} num
 * @returns {string}
 */
export function compactNumber(num) {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Relative time (e.g., "2h ago", "Just now")
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function timeAgo(dateInput) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatShortDate(date);
}

/**
 * Short date (e.g., "Mar 5, 2026")
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function formatShortDate(dateInput) {
  const date = new Date(dateInput);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Date with time (e.g., "Mar 5, 2026, 14:30")
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function formatDateTime(dateInput) {
  const date = new Date(dateInput);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Pad number with leading zeros
 * @param {number} num
 * @param {number} length
 * @returns {string}
 */
export function padZero(num, length = 2) {
  return num.toString().padStart(length, '0');
}