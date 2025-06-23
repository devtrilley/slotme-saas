// src/utils/tokenChannel.js

// Create a single BroadcastChannel instance across app
export const tokenChannel = new BroadcastChannel("slotme-token-sync");

// Optionally: export message types for consistency
export const MESSAGE_TYPES = {
  LOGOUT: "logout",
  TOKEN_REFRESH: "token-refresh",
  SESSION_EXPIRED: "session-expired",
};

export function closeTokenChannel() {
  tokenChannel.close();
}