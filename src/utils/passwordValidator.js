export const PASSWORD_RULES = {
  minLength: 8,
  regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  description: 'Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số',
};

export function validatePassword(password) {
  if (!password || password.length < PASSWORD_RULES.minLength) {
    return { valid: false, message: `Mật khẩu phải có ít nhất ${PASSWORD_RULES.minLength} ký tự.` };
  }
  if (!PASSWORD_RULES.regex.test(password)) {
    return { valid: false, message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.' };
  }
  return { valid: true, message: '' };
}
