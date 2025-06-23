// src/utils/jwt.js
import { jwtDecode } from "jwt-decode";

export function isTokenExpired(token) {
  try {
    const decoded = jwtDecode(token);
    if (!decoded.exp) return true;
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  } catch {
    return true;
  }
}

// # FOR TESTING
// export function isTokenExpired(token) {
//   return true; // ⛔ TEST: Force every token to be treated as expired
// }
