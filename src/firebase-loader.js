/**
 * @fileoverview Firebase SDK loader - resolves once the compat SDK global
 * exists, or gives up quietly after five seconds so the app can run
 * local-only when the CDN is unreachable.
 * @module firebase-loader
 */

export const firebaseReady = new Promise(resolve => {
  if (typeof firebase !== 'undefined') {
    resolve();
    return;
  }

  let checkCount = 0;
  const checkInterval = setInterval(() => {
    checkCount++;
    if (typeof firebase !== 'undefined') {
      clearInterval(checkInterval);
      resolve();
    } else if (checkCount > 50) {
      // 5 seconds
      clearInterval(checkInterval);
      console.warn('Firebase SDK did not load; continuing with local storage only.');
      resolve();
    }
  }, 100);
});
