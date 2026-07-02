/**
 * @fileoverview Constants used throughout the application
 * @module utils/constants
 */

/**
 * Default string names per string count, listed high (index 0) to low.
 * Used for unlabeled tabs where names must be inferred from line position.
 * @type {Object<number, string[]>}
 */
export const TUNING_TEMPLATES = {
  4: ['G', 'D', 'A', 'low E'],
  5: ['G', 'D', 'A', 'low E', 'low B'],
  6: ['high E', 'B', 'G', 'D', 'A', 'low E'],
  7: ['high E', 'B', 'G', 'D', 'A', 'low E', 'low B'],
  8: ['high E', 'B', 'G', 'D', 'A', 'low E', 'low B', 'F#']
};

/**
 * Mapping of technique symbols to their display names
 * @type {Object<string, string>}
 */
export const TECHNIQUES = {
  'h': 'hammer-on',
  'p': 'pull-off',
  'b': 'bend',
  'r': 'release',
  's': 'slide',
  '/': 'slide up',
  '\\': 'slide down',
  '~': 'vibrato',
  't': 'tap',
  'x': 'mute',
  '^': 'bend',
  'v': 'vibrato',
  '.': 'staccato',
  '>': 'accent'
};

/**
 * Local storage keys
 * @type {Object<string, string>}
 */
export const STORAGE_KEYS = {
  TABS: 'guitar_tabs_accessible',
  EMAIL_FOR_SIGNIN: 'emailForSignIn',
  SETTINGS: 'guitar_tabs_settings'
};

/**
 * Firebase collection names
 * @type {Object<string, string>}
 */
export const FIREBASE_COLLECTIONS = {
  USERS: 'users',
  TABS: 'tabs'
};

/**
 * Supported tab formats
 * @enum {string}
 */
export const TAB_FORMATS = {
  CHORD_CHART: 'chord_chart',
  LABELED_TAB: 'labeled_tab',
  STANDARD_TAB: 'standard_tab'
};

/**
 * Regular expression patterns for tab parsing
 * @type {Object<string, RegExp>}
 */
export const PATTERNS = {
  // Chord definition like "F: 1-3-3-2-1-1" or "Am: X-0-2-2-1-0" —
  // 6 to 8 dash-separated tokens of 1-2 digits or X, nothing else.
  CHORD_LINE: /^([A-G][#b]?[\w*]*)\s*:\s*((?:\d{1,2}|[xX])(?:-(?:\d{1,2}|[xX])){5,7})\s*$/,
  // String label at the start of a tab line: any-case note letter with an
  // optional accidental, then ':' or '|' (at most two spaces in between).
  STRING_LABEL: /^\s*([A-Ga-g][#b]?)\s{0,2}([:|]{1,2})/,
  TECHNIQUE_LINE: /^[~/\\^vhp]\s+/,
  LEGEND_LINE: /^\|?\s*[a-zA-Z]\s+(Bend|Hammer|Pull|Slide|Vibrato|Trill|Release|Tap|Harmonic)/i
};

/**
 * CSS class names used in the application
 * @type {Object<string, string>}
 */
export const CSS_CLASSES = {
  NOTIFICATION: 'notification',
  AUTH_SIGNED_IN: 'auth-signed-in',
  AUTH_SIGNED_OUT: 'auth-signed-out',
  CONNECTION_ONLINE: 'connection-status online',
  CONNECTION_OFFLINE: 'connection-status offline',
  BUTTON_DISABLED: 'disabled'
};

/**
 * Notification types
 * @enum {string}
 */
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
};

/**
 * Default conversion settings
 * @type {Object<string, boolean>}
 */
export const DEFAULT_SETTINGS = {
  includeTiming: true,
  verboseMode: true,
  useStringNames: true,
  includeTechniqueDetails: true
};

/**
 * Animation durations in milliseconds
 * @type {Object<string, number>}
 */
export const ANIMATION_DURATIONS = {
  NOTIFICATION: 5000,
  BUTTON_FEEDBACK: 2000,
  TRANSITION: 200
};

/**
 * Highest fret number accepted as a real note
 * @type {number}
 */
export const MAX_FRET = 24;
