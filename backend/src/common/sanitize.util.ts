import sanitizeHtml from 'sanitize-html';

// Chỉ cho phép các tag an toàn không thể dùng để XSS
const SAFE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li'],
  allowedAttributes: {},
};

export function sanitize(input: string | undefined | null): string {
  if (!input) return '';
  return sanitizeHtml(input, SAFE_OPTS);
}

export function sanitizePlain(input: string | undefined | null): string {
  if (!input) return '';
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
}
