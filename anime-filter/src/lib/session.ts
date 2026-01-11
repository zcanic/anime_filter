/**
 * Session Management for Recommendation System
 *
 * Manages user session ID for personalized recommendations.
 * Session ID is stored in localStorage and persists across page reloads.
 */

const SESSION_STORAGE_KEY = 'animepick_session_id';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get or create session ID
 *
 * @returns Session ID (UUID v4)
 */
export function getOrCreateSessionId(): string {
  // Try to get existing session ID from localStorage
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!sessionId) {
    // Generate new session ID
    sessionId = generateUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Clear session ID (for testing or reset)
 */
export function clearSessionId(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/**
 * Get current session ID without creating a new one
 *
 * @returns Session ID or null if not exists
 */
export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}
