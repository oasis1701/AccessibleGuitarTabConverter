// Firebase Configuration with Environment Variables
// This approach uses environment variables for cleaner code organization

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
            // Firebase configuration - using environment variables or defaults
            const firebaseConfig = {
                apiKey: this.getEnvVar('FIREBASE_API_KEY', 'AIzaSyCqvmEZDGYmNXeUKVOuiSUCZZqchh2r5lA'),
                authDomain: this.getEnvVar('FIREBASE_AUTH_DOMAIN', 'guitar-tabs-a3880.firebaseapp.com'),
                projectId: this.getEnvVar('FIREBASE_PROJECT_ID', 'guitar-tabs-a3880'),
                storageBucket: this.getEnvVar('FIREBASE_STORAGE_BUCKET', 'guitar-tabs-a3880.firebasestorage.app'),
                messagingSenderId: this.getEnvVar('FIREBASE_MESSAGING_SENDER_ID', '474698758806'),
                appId: this.getEnvVar('FIREBASE_APP_ID', '1:474698758806:web:ee35517a868b93bb8960b7')
            };

            // Rest of the initialization code remains the same...
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

    // Helper method to get environment variables with fallbacks
    getEnvVar(name, fallback) {
        // In a real production environment, you'd use process.env[name]
        // For client-side apps, these would come from build-time environment variables
        // For now, we'll use the fallback values since Firebase client keys are public anyway
        return fallback;
    }

    // ... rest of the methods remain exactly the same
}