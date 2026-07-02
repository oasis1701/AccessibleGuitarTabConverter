/**
 * @fileoverview Application configuration management
 * @module config
 */

/**
 * Firebase web app configuration.
 * These values identify the Firebase project; they are not secrets.
 * Access control comes from Firebase Security Rules and authorized domains.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCqvmEZDGYmNXeUKVOuiSUCZZqchh2r5lA",
  authDomain: "guitar-tabs-a3880.firebaseapp.com",
  projectId: "guitar-tabs-a3880",
  storageBucket: "guitar-tabs-a3880.firebasestorage.app",
  messagingSenderId: "474698758806",
  appId: "1:474698758806:web:ee35517a868b93bb8960b7"
};

/**
 * Application configuration
 */
export const appConfig = {
  appName: 'Accessible Guitar Tabs',
  version: '2.1.0',
  description: 'Convert guitar tablature into screen reader-friendly sequential note descriptions',

  // Feature flags
  features: {
    cloudSync: true,
    autoSave: true
  },

  // Storage limits
  storage: {
    maxTabSize: 1024 * 1024, // 1MB per tab
    maxTotalSize: 5 * 1024 * 1024, // 5MB total
    maxTabs: 100
  },

  // UI configuration
  ui: {
    animationsEnabled: true,
    notificationDuration: 5000,
    debounceDelay: 300,
    maxRecentTabs: 5
  }
};

/**
 * Get configuration value by path
 * @param {string} path - Dot-notation path (e.g., 'features.cloudSync')
 * @param {*} defaultValue - Default value if path not found
 * @returns {*} Configuration value
 */
export function getConfig(path, defaultValue = undefined) {
  const keys = path.split('.');
  let result = appConfig;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return defaultValue;
    }
  }

  return result;
}

/**
 * Check if a feature is enabled
 * @param {string} featureName - Name of the feature
 * @returns {boolean} True if feature is enabled
 */
export function isFeatureEnabled(featureName) {
  return appConfig.features[featureName] === true;
}

/**
 * Validate configuration
 * @returns {Object} Validation result
 */
export function validateConfig() {
  const errors = [];
  const warnings = [];

  if (!firebaseConfig.apiKey) {
    errors.push('Firebase API key is missing');
  }

  if (!firebaseConfig.projectId) {
    errors.push('Firebase project ID is missing');
  }

  if (appConfig.storage.maxTabSize > appConfig.storage.maxTotalSize) {
    warnings.push('Max tab size exceeds total storage limit');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
