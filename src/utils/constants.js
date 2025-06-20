/**
 * @fileoverview Constants used throughout the application
 * @module utils/constants
 */

/**
 * Guitar string names from high to low
 * @type {string[]}
 */
export const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'];

/**
 * 7-string guitar string names from high to low
 * @type {string[]}
 */
export const STRING_NAMES_7 = ['E', 'B', 'G', 'D', 'A', 'E', 'B'];

/**
 * 8-string guitar string names from high to low
 * @type {string[]}
 */
export const STRING_NAMES_8 = ['E', 'B', 'G', 'D', 'A', 'E', 'B', 'F#'];

/**
 * Guitar string numbers with ordinal suffixes
 * @type {string[]}
 */
export const STRING_NUMBERS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

/**
 * 7-string guitar string numbers with ordinal suffixes
 * @type {string[]}
 */
export const STRING_NUMBERS_7 = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

/**
 * 8-string guitar string numbers with ordinal suffixes
 * @type {string[]}
 */
export const STRING_NUMBERS_8 = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/**
 * Mapping of technique symbols to their descriptions
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
  'v': 'whammy down and up'
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
  CHORD_LINE: /^([A-G][#b]?[\w\*]*)[\s]*:[\s]*([\dX\-]+)$/i,
  TAB_LINE: /[E|A|D|G|B|e][\s]*[:|\|].*[-|\d]/,
  STANDARD_TAB_LINE: /^\|[-\d\/\\~\^vhp\s|]+\|?$/,
  TECHNIQUE_LINE: /^[~\/\\\^vhp]\s+/,
  LEGEND_LINE: /^\|\s*[a-zA-Z]\s+(Bend|Hammer|Pull|Slide|Vibrato|Trill|Release)/i
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
