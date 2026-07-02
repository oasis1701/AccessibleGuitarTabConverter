/**
 * @fileoverview Firebase authentication and cloud sync management.
 *
 * Cloud sync is strictly optional: the app is fully usable signed out, and
 * nothing here announces errors on ordinary page loads. Errors are only
 * announced inside flows the user started (signing in, signing out,
 * pressing Sync Now, opening an email sign-in link).
 *
 * Sync never overwrites local tabs wholesale. Lists are reconciled with
 * mergeTabs(): newer copies win, tabs the cloud never had are pushed up,
 * and only tabs known to have been synced before are removed when they
 * disappear from the cloud (a deletion made on another device).
 *
 * @module auth/FirebaseAuth
 */

import { firebaseConfig } from '../../config.js';
import { LocalStorage } from '../storage/LocalStorage.js';
import { mergeTabs } from '../storage/mergeTabs.js';
import { notificationManager } from '../ui/components/NotificationManager.js';
import { STORAGE_KEYS, FIREBASE_COLLECTIONS } from '../../utils/constants.js';
import { firebaseReady } from '../../firebase-loader.js';

/**
 * Class to manage Firebase authentication and cloud sync
 */
export class FirebaseAuth {
  constructor() {
    this.auth = null;
    this.db = null;
    this.user = null;
    this.unsubscribe = null;
    this.available = false;
    this.isOnline = navigator.onLine;

    this.initializeWhenReady();
  }

  /**
   * Initialize once the Firebase SDK is ready. If the SDK never loads
   * (offline, CDN blocked), the app silently stays local-only.
   */
  async initializeWhenReady() {
    await firebaseReady;

    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded; running with local storage only.');
      return;
    }

    this.init();
  }

  /**
   * Initialize Firebase quietly. Never announces on failure — cloud sync
   * is an optional extra, not something to alarm the user about on load.
   */
  async init() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      this.available = true;

      try {
        await this.db.enablePersistence();
      } catch (err) {
        console.warn('Offline persistence not available:', err.code);
      }

      this.auth.onAuthStateChanged(user => {
        this.handleAuthStateChange(user);
      });

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.updateConnectionStatus();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.updateConnectionStatus();
      });

      this.renderAuthSection();
      this.updateAuthUI();
    } catch (error) {
      console.warn('Cloud sync unavailable, using local storage only:', error);
      this.available = false;
    }
  }

  /**
   * Fill the static #auth-section placeholder with the sign-in UI.
   * The section lives inside <main>, so it is part of the landmark
   * structure, and its heading is an h2 to keep heading order intact.
   */
  renderAuthSection() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.renderAuthSection());
      return;
    }

    let section = document.getElementById('auth-section');
    if (!section) {
      const main = document.querySelector('main');
      if (!main) return;
      section = document.createElement('section');
      section.id = 'auth-section';
      section.className = 'auth-section';
      section.setAttribute('aria-labelledby', 'auth-heading');
      main.appendChild(section);
    }

    if (section.dataset.rendered) return;
    section.dataset.rendered = 'true';

    section.innerHTML = `
      <h2 id="auth-heading">Cloud Sync</h2>
      <div id="auth-signed-out" class="auth-state" hidden>
        <p>Optional: sign in to back up your saved tabs and use them on other devices. Everything also works without signing in.</p>
        <div class="auth-buttons">
          <button id="email-link-btn" class="auth-button" type="button">Sign in with email</button>
          <button id="google-auth-btn" class="auth-button google" type="button">Sign in with Google</button>
        </div>
        <div id="email-link-form" class="email-auth-form" hidden>
          <p>We'll email you a secure sign-in link. No password needed.</p>
          <label for="email-link-email">Email address</label>
          <input type="email" id="email-link-email" autocomplete="email" required>
          <div class="auth-form-buttons">
            <button id="send-link-btn" class="auth-button" type="button">Send sign-in link</button>
            <button id="link-cancel" class="auth-link" type="button">Cancel</button>
          </div>
        </div>
      </div>

      <div id="auth-signed-in" class="auth-state" hidden>
        <div class="user-info">
          <span id="user-display-name">Signed in</span>
          <span id="connection-status" class="connection-status"></span>
        </div>
        <div class="auth-buttons">
          <button id="sync-now-btn" class="auth-button small" type="button">Sync now</button>
          <button id="sign-out-btn" class="auth-button small" type="button">Sign out</button>
        </div>
      </div>
    `;

    section.hidden = false;
    this.bindAuthEvents();
  }

  /**
   * Bind authentication event handlers
   */
  bindAuthEvents() {
    document.getElementById('email-link-btn')?.addEventListener('click', () => {
      const form = document.getElementById('email-link-form');
      form.hidden = false;
      document.getElementById('email-link-email').focus();
    });

    document.getElementById('google-auth-btn')?.addEventListener('click', () => {
      this.signInWithGoogle();
    });

    document.getElementById('send-link-btn')?.addEventListener('click', () => {
      this.sendSignInLink();
    });

    document.getElementById('link-cancel')?.addEventListener('click', () => {
      this.hideAllForms();
      document.getElementById('email-link-btn')?.focus();
    });

    document.getElementById('sign-out-btn')?.addEventListener('click', () => {
      this.signOut();
    });

    document.getElementById('sync-now-btn')?.addEventListener('click', () => {
      this.syncTabs();
    });

    document.getElementById('email-link-email')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sendSignInLink();
      }
    });
  }

  /**
   * Hide the email sign-in form
   */
  hideAllForms() {
    const emailForm = document.getElementById('email-link-form');
    if (emailForm) emailForm.hidden = true;
  }

  /**
   * Send a passwordless sign-in link to the entered email address
   */
  async sendSignInLink() {
    const emailInput = document.getElementById('email-link-email');
    const email = emailInput?.value.trim();

    if (!email) {
      notificationManager.error('Please enter your email address');
      emailInput?.focus();
      return;
    }

    if (!this.isValidEmail(email)) {
      notificationManager.error('Please enter a valid email address');
      emailInput?.focus();
      return;
    }

    const sendBtn = document.getElementById('send-link-btn');
    try {
      sendBtn.textContent = 'Sending...';
      sendBtn.disabled = true;

      // Redirect back to the converter page next to the current page, so
      // the link works on localhost and on GitHub Pages alike.
      const directory = window.location.pathname.replace(/[^/]*$/, '');
      const actionCodeSettings = {
        url: `${window.location.origin}${directory}converter.html?emailLink=true`,
        handleCodeInApp: true
      };

      await this.auth.sendSignInLinkToEmail(email, actionCodeSettings);

      // Save email to localStorage for verification when the link opens
      localStorage.setItem(STORAGE_KEYS.EMAIL_FOR_SIGNIN, email);

      notificationManager.success(
        `Sign-in link sent to ${email}. Check your email and open the link to finish signing in.`
      );
      this.hideAllForms();
    } catch (error) {
      console.error('Sign-in link error:', error);
      notificationManager.error(
        'Failed to send sign-in link: ' + this.getAuthErrorMessage(error.code)
      );
    } finally {
      if (sendBtn) {
        sendBtn.textContent = 'Send sign-in link';
        sendBtn.disabled = false;
      }
    }
  }

  /**
   * Complete sign-in when the page was opened from an email link
   */
  async handleEmailLinkSignIn() {
    if (!this.auth.isSignInWithEmailLink(window.location.href)) return;

    let email = localStorage.getItem(STORAGE_KEYS.EMAIL_FOR_SIGNIN);

    // If email is not available (link opened on another device), ask for it
    if (!email) {
      email = prompt('Please confirm your email address to finish signing in:');
    }

    if (!email) return;

    try {
      await this.auth.signInWithEmailLink(email, window.location.href);
      localStorage.removeItem(STORAGE_KEYS.EMAIL_FOR_SIGNIN);

      // Clean up URL
      const url = new URL(window.location);
      url.search = '';
      window.history.replaceState({}, document.title, url.toString());

      notificationManager.success('Signed in successfully.');
    } catch (error) {
      console.error('Email link sign-in error:', error);
      notificationManager.error('Failed to sign in with email link: ' + error.message);
    }
  }

  /**
   * Validate email address
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await this.auth.signInWithPopup(provider);
    } catch (error) {
      notificationManager.error('Google sign-in failed: ' + error.message);
    }
  }

  /**
   * Sign out
   */
  async signOut() {
    try {
      await this.auth.signOut();
      notificationManager.success('Signed out. Your tabs stay saved on this device.');
    } catch (error) {
      notificationManager.error('Sign out failed: ' + error.message);
    }
  }

  /**
   * Handle authentication state changes
   * @param {Object} user - Firebase user object
   */
  handleAuthStateChange(user) {
    this.user = user;
    this.updateAuthUI();

    if (user) {
      this.initialSync().then(() => this.setupTabSync());
    } else {
      this.stopTabSync();
      // Check for email link sign-in when not authenticated
      this.handleEmailLinkSignIn();
    }
  }

  /**
   * Update authentication UI based on state
   */
  updateAuthUI() {
    const signedOut = document.getElementById('auth-signed-out');
    const signedIn = document.getElementById('auth-signed-in');
    const userDisplayName = document.getElementById('user-display-name');

    if (!signedOut || !signedIn) return;

    if (this.user) {
      signedOut.hidden = true;
      signedIn.hidden = false;

      const displayName = this.user.displayName || this.user.email || 'your account';
      userDisplayName.textContent = `Signed in as ${displayName}`;

      this.updateConnectionStatus();
    } else {
      signedOut.hidden = false;
      signedIn.hidden = true;
      this.hideAllForms();
    }
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    if (!statusEl) return;

    if (!this.isOnline) {
      statusEl.textContent = '(offline — changes sync when back online)';
      statusEl.className = 'connection-status offline';
    } else {
      statusEl.textContent = '(synced)';
      statusEl.className = 'connection-status online';
    }
  }

  /**
   * Firestore collection holding the current user's tabs
   * @returns {Object} Firestore collection reference
   */
  tabsCollection() {
    return this.db
      .collection(FIREBASE_COLLECTIONS.USERS)
      .doc(this.user.uid)
      .collection(FIREBASE_COLLECTIONS.TABS);
  }

  /**
   * Firestore document payload for a tab (no undefined values)
   * @param {Object} tab - Tab data
   * @returns {Object} Cloud document data
   */
  toCloudDoc(tab) {
    const now = new Date().toISOString();
    return {
      name: tab.name,
      originalTab: tab.originalTab,
      convertedTab: tab.convertedTab,
      settings: tab.settings || {},
      dateCreated: tab.dateCreated || now,
      dateModified: tab.dateModified || tab.dateCreated || now
    };
  }

  /** localStorage key remembering which tab ids this account has synced. */
  syncedIdsKey() {
    return `guitar_tabs_synced_ids_${this.user.uid}`;
  }

  /** Ids known to have been in this account's cloud collection before. */
  getSyncedIds() {
    try {
      const stored = localStorage.getItem(this.syncedIdsKey());
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /** Persist the synced-ids ledger. */
  setSyncedIds(ids) {
    localStorage.setItem(this.syncedIdsKey(), JSON.stringify(ids));
  }

  /**
   * Reconcile local and cloud tabs and push anything the cloud is missing.
   * Runs on sign-in and when Sync Now is pressed.
   * @returns {Promise<number>} Total number of tabs after the merge
   */
  async reconcile() {
    const snapshot = await this.tabsCollection().get();
    const cloudTabs = [];
    snapshot.forEach(doc => {
      cloudTabs.push({ id: doc.id, ...doc.data() });
    });

    const localTabs = LocalStorage.getAllTabs();
    const { merged, toPush, syncedIds } = mergeTabs(
      localTabs,
      cloudTabs,
      this.getSyncedIds()
    );

    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('tabsUpdated'));

    if (toPush.length > 0) {
      const batch = this.db.batch();
      for (const tab of toPush) {
        batch.set(this.tabsCollection().doc(tab.id), this.toCloudDoc(tab));
      }
      await batch.commit();
    }

    this.setSyncedIds(syncedIds);
    return merged.length;
  }

  /**
   * First sync after signing in. Quiet on success; a failure is worth a
   * gentle warning because the user just asked to sync by signing in.
   */
  async initialSync() {
    try {
      await this.reconcile();
    } catch (error) {
      console.error('Initial sync failed:', error);
      notificationManager.warning(
        'Cloud sync is not available right now. Your tabs are safe on this device.'
      );
    }
  }

  /**
   * Listen for real-time tab updates from other devices
   */
  setupTabSync() {
    if (!this.user) return;

    this.unsubscribe = this.tabsCollection().onSnapshot(
      snapshot => this.handleTabsSnapshot(snapshot),
      error => console.error('Tab sync error:', error)
    );
  }

  /**
   * Stop tab synchronization
   */
  stopTabSync() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Merge a server snapshot into local storage. Never pushes from here,
   * so snapshot handling can't loop.
   * @param {Object} snapshot - Firestore snapshot
   */
  handleTabsSnapshot(snapshot) {
    if (snapshot.metadata.fromCache || !this.user) return;

    const cloudTabs = [];
    snapshot.forEach(doc => {
      cloudTabs.push({ id: doc.id, ...doc.data() });
    });

    const { merged, syncedIds } = mergeTabs(
      LocalStorage.getAllTabs(),
      cloudTabs,
      this.getSyncedIds()
    );

    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(merged));
    // Only ids actually in the cloud count as synced here (no push occurs).
    this.setSyncedIds(syncedIds.filter(id => cloudTabs.some(tab => tab.id === id)));
    window.dispatchEvent(new CustomEvent('tabsUpdated'));
  }

  /**
   * Save tab to cloud
   * @param {Object} tabData - Tab data to save
   * @returns {Promise<Object>} Saved tab
   */
  async saveTabToCloud(tabData) {
    if (!this.user) {
      throw new Error('User not signed in');
    }

    try {
      await this.tabsCollection().doc(tabData.id).set(this.toCloudDoc(tabData));
      const syncedIds = this.getSyncedIds();
      if (!syncedIds.includes(tabData.id)) {
        this.setSyncedIds([...syncedIds, tabData.id]);
      }
      return tabData;
    } catch (error) {
      console.error('Cloud save error:', error);
      throw new Error('Failed to save to cloud');
    }
  }

  /**
   * Delete tab from cloud
   * @param {string} tabId - Tab ID to delete
   */
  async deleteTabFromCloud(tabId) {
    if (!this.user) return;

    try {
      await this.tabsCollection().doc(tabId).delete();
      this.setSyncedIds(this.getSyncedIds().filter(id => id !== tabId));
    } catch (error) {
      console.error('Cloud delete error:', error);
      throw new Error('Failed to delete from cloud');
    }
  }

  /**
   * Sync tabs manually (Sync Now button)
   */
  async syncTabs() {
    if (!this.user) {
      notificationManager.error('Please sign in to sync tabs');
      return;
    }

    const syncBtn = document.getElementById('sync-now-btn');
    try {
      if (syncBtn) {
        syncBtn.textContent = 'Syncing...';
        syncBtn.disabled = true;
      }

      const total = await this.reconcile();
      notificationManager.success(
        `Tabs synced. ${total} ${total === 1 ? 'tab' : 'tabs'} total.`
      );
    } catch (error) {
      notificationManager.error('Sync failed: ' + error.message);
    } finally {
      if (syncBtn) {
        syncBtn.textContent = 'Sync now';
        syncBtn.disabled = false;
      }
    }
  }

  /**
   * Get authentication error message
   * @param {string} errorCode - Firebase error code
   * @returns {string} User-friendly error message
   */
  getAuthErrorMessage(errorCode) {
    switch (errorCode) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Invalid email or password';
      case 'auth/email-already-in-use':
        return 'Email already in use';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/popup-closed-by-user':
        return 'Sign-in cancelled';
      default:
        return 'Authentication failed: ' + errorCode;
    }
  }

  /**
   * Check if user is signed in
   * @returns {boolean} True if signed in
   */
  isSignedIn() {
    return !!this.user;
  }

  /**
   * Get current user
   * @returns {Object|null} Current user or null
   */
  getCurrentUser() {
    return this.user;
  }
}

// Export singleton instance
export const firebaseAuth = new FirebaseAuth();
