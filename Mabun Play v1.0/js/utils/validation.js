/**
 * Shared validation utilities
 */

/**
 * Validate South Sudan phone number (9 digits starting with 92 or 98)
 * @param {string} phone - Raw phone digits (without +211)
 * @returns {boolean}
 */
export function validatePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return /^(9[28]\d{7})$/.test(digits);
}

/**
 * Format phone number with +211 prefix
 * @param {string} phone - Raw digits
 * @returns {string}
 */
export function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return '+211' + digits;
}

/**
 * Detect mobile provider from phone number
 * @param {string} phone - Raw digits
 * @returns {string|null} 'mtn' or 'digitel' or null
 */
export function detectProvider(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('92')) return 'mtn';
  if (digits.startsWith('98')) return 'digitel';
  return null;
}

/**
 * Validate password (minimum 6 characters)
 * @param {string} password
 * @returns {boolean}
 */
export function validatePassword(password) {
  return password && password.length >= 6;
}

/**
 * Validate email (optional, but must be valid if provided)
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  if (!email) return true;
  return /^\S+@\S+\.\S+$/.test(email);
}

/**
 * Validate username (minimum 3 characters)
 * @param {string} username
 * @returns {boolean}
 */
export function validateUsername(username) {
  return username && username.trim().length >= 3;
}

/**
 * Validate OTP code (exactly 6 digits)
 * @param {string} code
 * @returns {boolean}
 */
export function validateOTP(code) {
  return /^\d{6}$/.test(code);
}