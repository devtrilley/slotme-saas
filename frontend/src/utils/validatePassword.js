export function validatePassword(password) {
  const minLength = /.{8,}/;
  const upper = /[A-Z]/;
  const lower = /[a-z]/;
  const number = /[0-9]/;
  const special = /[^A-Za-z0-9]/;

  const errors = [];
  if (!minLength.test(password)) errors.push("At least 8 characters");
  if (!upper.test(password)) errors.push("At least one uppercase letter");
  if (!lower.test(password)) errors.push("At least one lowercase letter");
  if (!number.test(password)) errors.push("At least one number");
  if (!special.test(password)) errors.push("At least one special character");

  return { valid: errors.length === 0, errors };
}