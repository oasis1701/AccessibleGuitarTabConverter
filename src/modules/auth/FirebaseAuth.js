/**
 * @fileoverview Firebase authentication and cloud sync management
 * @module auth/FirebaseAuth
 */

import { firebaseConfig } from '../../config.js';
import { LocalStorage } from '../storage/LocalStorage.js';
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
    this.isOnline = navigator.onLine;
    
    // Initialize after Firebase is ready
    this.initializeWhenReady();
  }

  /**
   * Initialize when Firebase SDK is ready
   */
  async initializeWhenReady() {
    await firebaseReady;
    
    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK not loaded');
      return;
    }
    
    this.init();
  }

  /**
   * Initialize Firebase
   */
  async init() {
    try {
      // Initialize Firebase
      firebase.initializeApp(firebaseConfig);
      this.auth = firebase.auth();
      this.db = firebase.firestore();

      // Enable offline persistence
      try {
        await this.db.enablePersistence();
      } catch (err) {
        console.log('Offline persistence not available:', err.code);
      }

      // Listen for auth state changes
      this.auth.onAuthStateChanged((user) => {
        this.handleAuthStateChange(user);
      });

      // Listen for online/offline status
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.updateConnectionStatus();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.updateConnectionStatus();
      });

      this.setupUI();
      
    } catch (error) {
      console.error('Firebase initialization error:', error);
      notificationManager.error('Failed to initialize cloud sync. Using local storage only.');
    }
  }

  /**
   * Set up authentication UI
   */
  setupUI() {
    this.createAuthUI();
    this.updateAuthUI();
  }

  /**
   * Create authentication UI elements
   */
  createAuthUI() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createAuthUI());
      return;
    }

    // Always add auth section on any page with a header
    // This is simpler and more reliable than path checking
    setTimeout(() => {
      if (!document.getElementById('auth-section') && document.querySelector('header')) {
        this.addAuthSection();
      }
    }, 100); // Small delay to ensure DOM is fully ready
  }

  /**
   * Add authentication section to the page
   */
  addAuthSection() {
    // Check if auth section already exists
    if (document.getElementById('auth-section')) {
      return;
    }

    // Create auth section
    const authSection = document.createElement('div');
    authSection.id = 'auth-section';
    authSection.className = 'auth-section';
    authSection.innerHTML = `
      <div id="auth-signed-out" class="auth-state" style="display: none;">
        <h3>Sign In for Cloud Sync</h3>
        <p>Save your tabs across all devices</p>
        <div class="auth-buttons">
          <button id="email-link-btn" class="auth-button">Sign In with Email</button>
          <button id="google-auth-btn" class="auth-button google">Sign In with Google</button>
        </div>
        <div id="email-link-form" class="email-auth-form" style="display: none;">
          <h4>Email Sign In</h4>
          <p>Enter your email address and we'll send you a secure sign-in link.</p>
          <input type="email" id="email-link-email" placeholder="Email" required>
          <div class="auth-form-buttons">
            <button id="send-link-btn" class="auth-button">Send Sign-In Link</button>
            <button id="link-cancel" class="auth-link">Cancel</button>
          </div>
        </div>
      </div>
      
      <div id="auth-signed-in" class="auth-state" style="display: none;">
        <div class="user-info">
          <span id="user-display-name">Welcome!</span>
          <span id="connection-status" class="connection-status"></span>
        </div>
        <div class="auth-buttons">
          <button id="sync-now-btn" class="auth-button small">Sync Now</button>
          <button id="sign-out-btn" class="auth-button small">Sign Out</button>
        </div>
      </div>
    `;

    // Insert after header on all pages
    const header = document.querySelector('header');
    if (header) {
      header.insertAdjacentElement('afterend', authSection);
    } else {
      // If no header, insert at body start
      document.body.insertBefore(authSection, document.body.firstChild);
    }

    this.bindAuthEvents();
  }

  /**
   * Bind authentication event handlers
   */
  bindAuthEvents() {
    // Email link button
    document.getElementById('email-link-btn')?.addEventListener('click', () => {
      this.hideAllForms();
      document.getElementById('email-link-form').style.display = 'block';
      document.getElementById('email-link-email').focus();
    });

    // Google auth button
    document.getElementById('google-auth-btn')?.addEventListener('click', () => {
      this.signInWithGoogle();
    });

    // Send sign-in link
    document.getElementById('send-link-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.sendSignInLink();
    });

    // Cancel email link form
    document.getElementById('link-cancel')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hideAllForms();
    });

    // Sign out
    document.getElementById('sign-out-btn')?.addEventListener('click', () => {
      this.signOut();
    });

    // Manual sync
    document.getElementById('sync-now-btn')?.addEventListener('click', () => {
      this.syncTabs();
    });

    // Enter key on email link form
    document.getElementById('email-link-email')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendSignInLink();
      }
    });
  }

  /**
   * Hide all authentication forms
   */
  hideAllForms() {
    const emailForm = document.getElementById('email-link-form');
    if (emailForm) {
      emailForm.style.display = 'none';
    }
  }

  /**
   * Send sign-in link to email
   */
  async sendSignInLink() {
    const emailInput = document.getElementById('email-link-email');
    const email = emailInput?.value.trim();
    
    if (!email) {
      notificationManager.error('Please enter your email address');
      return;
    }

    if (!this.isValidEmail(email)) {
      notificationManager.error('Please enter a valid email address');
      return;
    }

    try {
      const sendBtn = document.getElementById('send-link-btn');
      sendBtn.textContent = 'Sending...';
      sendBtn.disabled = true;

      // Action code settings for email link
      const actionCodeSettings = {
        url: window.location.origin + '/converter.html?emailLink=true',
        handleCodeInApp: true
      };

      await this.auth.sendSignInLinkToEmail(email, actionCodeSettings);
      
      // Save email to localStorage for verification
      localStorage.setItem(STORAGE_KEYS.EMAIL_FOR_SIGNIN, email);
      
      notificationManager.success(`Sign-in link sent to ${email}! Check your email and click the link to access your account.`);
      this.hideAllForms();
      
    } catch (error) {
      console.error('Sign-in link error:', error);
      notificationManager.error('Failed to send sign-in link: ' + this.getAuthErrorMessage(error.code));
    } finally {
      const sendBtn = document.getElementById('send-link-btn');
      if (sendBtn) {
        sendBtn.textContent = 'Send Sign-In Link';
        sendBtn.disabled = false;
      }
    }
  }

  /**
   * Handle email link sign-in
   */
  async handleEmailLinkSignIn() {
    // Check if the URL contains an email link
    if (this.auth.isSignInWithEmailLink(window.location.href)) {
      let email = localStorage.getItem(STORAGE_KEYS.EMAIL_FOR_SIGNIN);
      
      // If email is not available, prompt user
      if (!email) {
        email = prompt('Please provide your email for confirmation:');
      }
      
      if (email) {
        try {
          await this.auth.signInWithEmailLink(email, window.location.href);
          localStorage.removeItem(STORAGE_KEYS.EMAIL_FOR_SIGNIN);
          
          // Clean up URL
          const url = new URL(window.location);
          url.search = '';
          window.history.replaceState({}, document.title, url.toString());
          
          notificationManager.success('Successfully signed in! Welcome to your account.');
        } catch (error) {
          console.error('Email link sign-in error:', error);
          notificationManager.error('Failed to sign in with email link: ' + error.message);
        }
      }
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
      notificationManager.success('Signed out successfully');
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
      this.setupTabSync();
      this.migrateLocalTabs();
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
      signedOut.style.display = 'none';
      signedIn.style.display = 'block';
      
      const displayName = this.user.displayName || this.user.email || 'User';
      userDisplayName.textContent = `Welcome, ${displayName}!`;
      
      this.updateConnectionStatus();
    } else {
      signedOut.style.display = 'block';
      signedIn.style.display = 'none';
      
      // Hide email form when signed out
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
      statusEl.textContent = '(Offline)';
      statusEl.className = 'connection-status offline';
    } else {
      statusEl.textContent = '(Synced)';
      statusEl.className = 'connection-status online';
    }
  }

  /**
   * Set up tab synchronization
   */
  setupTabSync() {
    if (!this.user) return;

    // Listen for real-time tab updates
    this.unsubscribe = this.db
      .collection(FIREBASE_COLLECTIONS.USERS)
      .doc(this.user.uid)
      .collection(FIREBASE_COLLECTIONS.TABS)
      .onSnapshot((snapshot) => {
        this.handleTabsSnapshot(snapshot);
      }, (error) => {
        console.error('Tab sync error:', error);
      });
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
   * Handle tabs snapshot from Firestore
   * @param {Object} snapshot - Firestore snapshot
   */
  handleTabsSnapshot(snapshot) {
    if (!snapshot.metadata.fromCache) {
      // Update came from server, update local storage
      const cloudTabs = [];
      snapshot.forEach(doc => {
        cloudTabs.push({ id: doc.id, ...doc.data() });
      });
      
      // Update local storage with cloud tabs
      localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(cloudTabs));
      
      // Refresh UI if on my-tabs page
      if (window.location.pathname.includes('my-tabs.html')) {
        // Dispatch event to refresh tabs display
        window.dispatchEvent(new CustomEvent('tabsUpdated'));
      }
    }
  }

  /**
   * Migrate local tabs to cloud
   */
  async migrateLocalTabs() {
    if (!this.user) return;

    try {
      const localTabs = LocalStorage.getAllTabs();
      if (localTabs.length === 0) return;

      // Check if cloud has any tabs
      const cloudSnapshot = await this.db
        .collection(FIREBASE_COLLECTIONS.USERS)
        .doc(this.user.uid)
        .collection(FIREBASE_COLLECTIONS.TABS)
        .get();

      if (cloudSnapshot.empty) {
        // No cloud tabs, migrate local tabs to cloud
        const batch = this.db.batch();
        
        localTabs.forEach(tab => {
          const docRef = this.db
            .collection(FIREBASE_COLLECTIONS.USERS)
            .doc(this.user.uid)
            .collection(FIREBASE_COLLECTIONS.TABS)
            .doc(tab.id);
          
          batch.set(docRef, {
            name: tab.name,
            originalTab: tab.originalTab,
            convertedTab: tab.convertedTab,
            settings: tab.settings || {},
            dateCreated: tab.dateCreated,
            dateModified: tab.dateModified || tab.dateCreated
          });
        });

        await batch.commit();
        notificationManager.success('Local tabs migrated to cloud!');
      }
    } catch (error) {
      console.error('Migration error:', error);
    }
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
      const docRef = this.db
        .collection(FIREBASE_COLLECTIONS.USERS)
        .doc(this.user.uid)
        .collection(FIREBASE_COLLECTIONS.TABS)
        .doc(tabData.id);

      await docRef.set({
        name: tabData.name,
        originalTab: tabData.originalTab,
        convertedTab: tabData.convertedTab,
        settings: tabData.settings || {},
        dateCreated: tabData.dateCreated,
        dateModified: new Date().toISOString()
      });

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
      await this.db
        .collection(FIREBASE_COLLECTIONS.USERS)
        .doc(this.user.uid)
        .collection(FIREBASE_COLLECTIONS.TABS)
        .doc(tabId)
        .delete();
    } catch (error) {
      console.error('Cloud delete error:', error);
      throw new Error('Failed to delete from cloud');
    }
  }

  /**
   * Sync tabs manually
   */
  async syncTabs() {
    if (!this.user) {
      notificationManager.error('Please sign in to sync tabs');
      return;
    }

    try {
      const syncBtn = document.getElementById('sync-now-btn');
      if (syncBtn) {
        syncBtn.textContent = 'Syncing...';
        syncBtn.disabled = true;
      }

      // Force refresh from cloud
      const snapshot = await this.db
        .collection(FIREBASE_COLLECTIONS.USERS)
        .doc(this.user.uid)
        .collection(FIREBASE_COLLECTIONS.TABS)
        .get();

      const cloudTabs = [];
      snapshot.forEach(doc => {
        cloudTabs.push({ id: doc.id, ...doc.data() });
      });

      localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(cloudTabs));
      
      // Dispatch event to refresh tabs display
      window.dispatchEvent(new CustomEvent('tabsUpdated'));

      notificationManager.success('Tabs synced successfully!');

    } catch (error) {
      notificationManager.error('Sync failed: ' + error.message);
    } finally {
      const syncBtn = document.getElementById('sync-now-btn');
      if (syncBtn) {
        syncBtn.textContent = 'Sync Now';
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

// Also export to window for debugging
if (typeof window !== 'undefined') {
  window.debugFirebaseAuth = firebaseAuth;
}
