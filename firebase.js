// Firebase Configuration and Authentication
// Handles user authentication and cloud sync

class FirebaseManager {
    constructor() {
        this.auth = null;
        this.db = null;
        this.user = null;
        this.unsubscribe = null;
        this.isOnline = navigator.onLine;
        
        this.init();
    }

    async init() {
        try {
            // Firebase configuration
            const firebaseConfig = {
                apiKey: "AIzaSyCqvmEZDGYmNXeUKVOuiSUCZZqchh2r5lA",
                authDomain: "guitar-tabs-a3880.firebaseapp.com",
                projectId: "guitar-tabs-a3880",
                storageBucket: "guitar-tabs-a3880.firebasestorage.app",
                messagingSenderId: "474698758806",
                appId: "1:474698758806:web:ee35517a868b93bb8960b7"
            };

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
            this.showError('Failed to initialize cloud sync. Using local storage only.');
        }
    }

    setupUI() {
        // Add auth UI elements to pages
        this.createAuthUI();
        this.updateAuthUI();
    }

    createAuthUI() {
        // Add auth section to pages that need it
        const pages = ['index.html', 'converter.html', 'my-tabs.html'];
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        if (pages.includes(currentPage)) {
            this.addAuthSection();
        }
    }

    addAuthSection() {
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
        }

        this.bindAuthEvents();
    }

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

    hideAllForms() {
        document.getElementById('email-link-form').style.display = 'none';
    }

    async sendSignInLink() {
        const email = document.getElementById('email-link-email').value.trim();
        
        if (!email) {
            this.showError('Please enter your email address');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
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
            localStorage.setItem('emailForSignIn', email);
            
            this.showSuccess(`Sign-in link sent to ${email}! Check your email and click the link to access your account.`);
            this.hideAllForms();
            
        } catch (error) {
            console.error('Sign-in link error:', error);
            this.showError('Failed to send sign-in link: ' + this.getAuthErrorMessage(error.code));
        } finally {
            const sendBtn = document.getElementById('send-link-btn');
            if (sendBtn) {
                sendBtn.textContent = 'Send Sign-In Link';
                sendBtn.disabled = false;
            }
        }
    }

    async handleEmailLinkSignIn() {
        // Check if the URL contains an email link
        if (this.auth.isSignInWithEmailLink(window.location.href)) {
            let email = localStorage.getItem('emailForSignIn');
            
            // If email is not available, prompt user
            if (!email) {
                email = prompt('Please provide your email for confirmation:');
            }
            
            if (email) {
                try {
                    await this.auth.signInWithEmailLink(email, window.location.href);
                    localStorage.removeItem('emailForSignIn');
                    
                    // Clean up URL
                    const url = new URL(window.location);
                    url.search = '';
                    window.history.replaceState({}, document.title, url.toString());
                    
                    this.showSuccess('Successfully signed in! Welcome to your account.');
                } catch (error) {
                    console.error('Email link sign-in error:', error);
                    this.showError('Failed to sign in with email link: ' + error.message);
                }
            }
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await this.auth.signInWithPopup(provider);
        } catch (error) {
            this.showError('Google sign-in failed: ' + error.message);
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();
        } catch (error) {
            this.showError('Sign out failed: ' + error.message);
        }
    }

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
            const emailForm = document.getElementById('email-auth-form');
            if (emailForm) emailForm.style.display = 'none';
        }
    }

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

    setupTabSync() {
        if (!this.user) return;

        // Listen for real-time tab updates
        this.unsubscribe = this.db
            .collection('users')
            .doc(this.user.uid)
            .collection('tabs')
            .onSnapshot((snapshot) => {
                this.handleTabsSnapshot(snapshot);
            }, (error) => {
                console.error('Tab sync error:', error);
            });
    }

    stopTabSync() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    handleTabsSnapshot(snapshot) {
        if (!snapshot.metadata.fromCache) {
            // Update came from server, update local storage
            const cloudTabs = [];
            snapshot.forEach(doc => {
                cloudTabs.push({ id: doc.id, ...doc.data() });
            });
            
            // Update local storage with cloud tabs
            localStorage.setItem(TabStorage.STORAGE_KEY, JSON.stringify(cloudTabs));
            
            // Refresh UI if on my-tabs page
            if (window.location.pathname.includes('my-tabs.html') && typeof displaySavedTabs === 'function') {
                displaySavedTabs();
            }
        }
    }

    async migrateLocalTabs() {
        if (!this.user) return;

        try {
            const localTabs = TabStorage.getAllTabs();
            if (localTabs.length === 0) return;

            // Check if cloud has any tabs
            const cloudSnapshot = await this.db
                .collection('users')
                .doc(this.user.uid)
                .collection('tabs')
                .get();

            if (cloudSnapshot.empty) {
                // No cloud tabs, migrate local tabs to cloud
                const batch = this.db.batch();
                
                localTabs.forEach(tab => {
                    const docRef = this.db
                        .collection('users')
                        .doc(this.user.uid)
                        .collection('tabs')
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
                this.showSuccess('Local tabs migrated to cloud!');
            }
        } catch (error) {
            console.error('Migration error:', error);
        }
    }

    async saveTabToCloud(tabData) {
        if (!this.user) {
            throw new Error('User not signed in');
        }

        try {
            const docRef = this.db
                .collection('users')
                .doc(this.user.uid)
                .collection('tabs')
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

    async deleteTabFromCloud(tabId) {
        if (!this.user) return;

        try {
            await this.db
                .collection('users')
                .doc(this.user.uid)
                .collection('tabs')
                .doc(tabId)
                .delete();
        } catch (error) {
            console.error('Cloud delete error:', error);
            throw new Error('Failed to delete from cloud');
        }
    }

    async syncTabs() {
        if (!this.user) {
            this.showError('Please sign in to sync tabs');
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
                .collection('users')
                .doc(this.user.uid)
                .collection('tabs')
                .get();

            const cloudTabs = [];
            snapshot.forEach(doc => {
                cloudTabs.push({ id: doc.id, ...doc.data() });
            });

            localStorage.setItem(TabStorage.STORAGE_KEY, JSON.stringify(cloudTabs));
            
            if (typeof displaySavedTabs === 'function') {
                displaySavedTabs();
            }

            this.showSuccess('Tabs synced successfully!');

        } catch (error) {
            this.showError('Sync failed: ' + error.message);
        } finally {
            const syncBtn = document.getElementById('sync-now-btn');
            if (syncBtn) {
                syncBtn.textContent = 'Sync Now';
                syncBtn.disabled = false;
            }
        }
    }

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

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    // Check if user is signed in
    isSignedIn() {
        return !!this.user;
    }

    // Get current user
    getCurrentUser() {
        return this.user;
    }
}

// Initialize Firebase Manager
window.firebaseManager = new FirebaseManager();