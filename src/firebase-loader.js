/**
 * @fileoverview Firebase SDK loader - ensures Firebase is loaded before app initialization
 * @module firebase-loader
 */

// This file ensures Firebase SDK is loaded before the app starts
// It's imported directly in the HTML files before app.js

// Check if Firebase is already loaded
if (typeof firebase === 'undefined') {
  console.warn('Firebase SDK not loaded. Make sure Firebase scripts are included before this module.');
}

// Export a promise that resolves when Firebase is ready
export const firebaseReady = window.firebaseLoaded || new Promise((resolve) => {
  if (typeof firebase !== 'undefined') {
    resolve();
  } else {
    // Wait for Firebase to load
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      if (typeof firebase !== 'undefined') {
        clearInterval(checkInterval);
        resolve();
      } else if (checkCount > 50) { // 5 seconds timeout
        clearInterval(checkInterval);
        console.error('Firebase SDK failed to load');
        resolve(); // Resolve anyway to not block the app
      }
    }, 100);
  }
});
