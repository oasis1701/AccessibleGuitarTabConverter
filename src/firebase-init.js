/**
 * @fileoverview Direct Firebase initialization for production
 * @module firebase-init
 */

// Wait for Firebase SDK to be available
function initializeFirebaseWhenReady() {
  if (typeof firebase === 'undefined') {
    // Try again in 100ms
    setTimeout(initializeFirebaseWhenReady, 100);
    return;
  }

  // Firebase is ready, create auth UI directly
  createAuthUI();
}

function createAuthUI() {
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

  // Insert after header
  const header = document.querySelector('header');
  if (header) {
    header.insertAdjacentElement('afterend', authSection);
  } else {
    document.body.insertBefore(authSection, document.body.firstChild);
  }

  // Initialize Firebase if not already done
  if (!window.firebaseInitialized) {
    initializeFirebase();
  }
}

function initializeFirebase() {
  window.firebaseInitialized = true;

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
  const auth = firebase.auth();
  
  // Set up auth state listener
  auth.onAuthStateChanged((user) => {
    updateAuthUI(user);
  });

  // Bind button events
  bindAuthEvents(auth);
  
  // Check for email link sign-in
  if (auth.isSignInWithEmailLink(window.location.href)) {
    handleEmailLinkSignIn(auth);
  }
}

function updateAuthUI(user) {
  const signedOut = document.getElementById('auth-signed-out');
  const signedIn = document.getElementById('auth-signed-in');
  const userDisplayName = document.getElementById('user-display-name');

  if (!signedOut || !signedIn) return;

  if (user) {
    signedOut.style.display = 'none';
    signedIn.style.display = 'block';
    
    const displayName = user.displayName || user.email || 'User';
    userDisplayName.textContent = `Welcome, ${displayName}!`;
  } else {
    signedOut.style.display = 'block';
    signedIn.style.display = 'none';
  }
}

function bindAuthEvents(auth) {
  // Email link button
  document.getElementById('email-link-btn')?.addEventListener('click', () => {
    document.getElementById('email-link-form').style.display = 'block';
    document.getElementById('email-link-email').focus();
  });

  // Google auth button
  document.getElementById('google-auth-btn')?.addEventListener('click', async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (error) {
      console.error('Google sign-in failed:', error);
      alert('Google sign-in failed: ' + error.message);
    }
  });

  // Send sign-in link
  document.getElementById('send-link-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('email-link-email')?.value.trim();
    if (!email) {
      alert('Please enter your email address');
      return;
    }

    try {
      const actionCodeSettings = {
        url: window.location.origin + '/converter.html?emailLink=true',
        handleCodeInApp: true
      };

      await auth.sendSignInLinkToEmail(email, actionCodeSettings);
      localStorage.setItem('emailForSignIn', email);
      alert(`Sign-in link sent to ${email}! Check your email.`);
      document.getElementById('email-link-form').style.display = 'none';
    } catch (error) {
      console.error('Failed to send email link:', error);
      alert('Failed to send sign-in link: ' + error.message);
    }
  });

  // Cancel email form
  document.getElementById('link-cancel')?.addEventListener('click', () => {
    document.getElementById('email-link-form').style.display = 'none';
  });

  // Sign out
  document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  });
}

async function handleEmailLinkSignIn(auth) {
  let email = localStorage.getItem('emailForSignIn');
  if (!email) {
    email = prompt('Please provide your email for confirmation:');
  }
  
  if (email) {
    try {
      await auth.signInWithEmailLink(email, window.location.href);
      localStorage.removeItem('emailForSignIn');
      
      // Clean up URL
      const url = new URL(window.location);
      url.search = '';
      window.history.replaceState({}, document.title, url.toString());
    } catch (error) {
      console.error('Email link sign-in error:', error);
    }
  }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFirebaseWhenReady);
} else {
  initializeFirebaseWhenReady();
}

// Export for manual initialization
window.createFirebaseAuth = createAuthUI;
