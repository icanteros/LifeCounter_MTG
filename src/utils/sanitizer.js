/**
 * @file Utilidades de sanitización para prevenir XSS
 * @module utils/sanitizer
 */

/**
 * Sanitiza un string para prevenir inyección XSS
 * @param {string} str - String a sanitizar
 * @param {number} maxLength - Longitud máxima permitida
 * @returns {string} String sanitizado
 */
function sanitizeString(str, maxLength) {
  if (typeof str !== 'string') return '';
  return str
    .slice(0, maxLength)
    .replace(/[<>"'&]/g, (char) => {
      const entities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[char] || char;
    })
    .trim();
}

/**
 * Valida y sanitiza input de usuario
 * @param {any} value - Valor a validar
 * @param {Object} options - Opciones de validación
 * @returns {{ valid: boolean, value: string|null, error: string|null }}
 */
function validateInput(value, options = {}) {
  const { maxLength = 50, required = false, pattern = null } = options;
  
  if (typeof value !== 'string') {
    return required 
      ? { valid: false, value: null, error: 'Valor requerido' }
      : { valid: true, value: null, error: null };
  }
  
  const trimmed = value.trim();
  
  if (required && !trimmed) {
    return { valid: false, value: null, error: 'Valor requerido' };
  }
  
  if (pattern && !pattern.test(trimmed)) {
    return { valid: false, value: null, error: 'Formato inválido' };
  }
  
  return {
    valid: true,
    value: sanitizeString(trimmed, maxLength),
    error: null
  };
}

module.exports = { sanitizeString, validateInput };
