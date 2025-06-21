/**
 * @fileoverview Main application entry point
 * @module app
 */

import { TabConverter } from './modules/converter/TabConverter.js';
import { LocalStorage } from './modules/storage/LocalStorage.js';
import { notificationManager } from './modules/ui/components/NotificationManager.js';
import { firebaseAuth } from './modules/auth/FirebaseAuth.js';
import { getQueryParams, updateQueryParams, debounce } from './utils/helpers.js';
import { validateConfig, isFeatureEnabled } from './config.js';
import { ANIMATION_DURATIONS } from './utils/constants.js';

/**
 * Main application class
 */
class AccessibleGuitarTabsApp {
  constructor() {
    this.converter = new TabConverter();
    this.currentTab = null;
    this.settingsElements = {};
    this.isConverting = false;
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    // Validate configuration
    const configValidation = validateConfig();
    if (!configValidation.isValid) {
      console.error('Configuration errors:', configValidation.errors);
    }
    if (configValidation.warnings.length > 0) {
      console.warn('Configuration warnings:', configValidation.warnings);
    }

    // Initialize UI based on current page
    const currentPage = this.getCurrentPage();
    
    switch (currentPage) {
      case 'converter':
        await this.initConverterPage();
        break;
      case 'my-tabs':
        await this.initMyTabsPage();
        break;
      case 'index':
        await this.initHomePage();
        break;
    }

    // Initialize keyboard shortcuts
    this.initKeyboardShortcuts();
    
    // Make firebaseAuth available globally for other modules
    window.firebaseAuth = firebaseAuth;
    
    // Add manual trigger for auth UI (useful for debugging)
    window.showAuthUI = () => {
      if (!document.getElementById('auth-section')) {
        firebaseAuth.addAuthSection();
      }
    };
    
    // Ensure auth UI is created
    setTimeout(() => {
      if (!document.getElementById('auth-section') && document.querySelector('header')) {
        firebaseAuth.addAuthSection();
      }
    }, 500);
    
    // Additional fallback for production environment
    setTimeout(() => {
      if (!document.getElementById('auth-section') && document.querySelector('header')) {
        // Force create the auth section
        const authCheck = setInterval(() => {
          if (window.firebaseAuth && !document.getElementById('auth-section')) {
            window.firebaseAuth.addAuthSection();
            clearInterval(authCheck);
          }
        }, 1000);
        
        // Stop checking after 10 seconds
        setTimeout(() => clearInterval(authCheck), 10000);
      }
    }, 2000);
    
    // Initialize service worker for offline support
    if (isFeatureEnabled('offlineMode')) {
      this.initServiceWorker();
    }
  }

  /**
   * Get current page name
   * @returns {string} Page name
   */
  getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('converter.html')) return 'converter';
    if (path.includes('my-tabs.html')) return 'my-tabs';
    return 'index';
  }

  /**
   * Initialize converter page
   */
  async initConverterPage() {
    // Get DOM elements
    this.tabInput = document.getElementById('tab-input');
    this.tabOutput = document.getElementById('tab-output');
    this.convertBtn = document.getElementById('convert-btn');
    this.copyBtn = document.getElementById('copy-btn');
    this.saveBtn = document.getElementById('save-btn');
    
    // Get settings elements
    this.settingsElements = {
      includeTiming: document.getElementById('include-timing'),
      verboseMode: document.getElementById('verbose-mode'),
      useStringNames: document.getElementById('string-names'),
      includeTechniqueDetails: document.getElementById('technique-details')
    };
    
    // Bind events
    this.bindConverterEvents();
    
    // Load tab from URL if specified
    await this.loadTabFromUrl();
    
    // Set up auto-save if enabled
    if (isFeatureEnabled('autoSave')) {
      this.setupAutoSave();
    }
  }

  /**
   * Bind converter page events
   */
  bindConverterEvents() {
    // Convert button
    this.convertBtn.addEventListener('click', () => this.convertTab());
    
    // Copy button
    this.copyBtn.addEventListener('click', () => this.copyToClipboard());
    
    // Save button
    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.saveTab());
    }
    
    // Enable/disable convert button based on input
    this.tabInput.addEventListener('input', debounce(() => {
      this.convertBtn.disabled = this.tabInput.value.trim().length === 0;
    }, 100));
    
    // Settings change handlers
    Object.values(this.settingsElements).forEach(element => {
      if (element) {
        element.addEventListener('change', () => {
          if (this.tabOutput.value) {
            // Re-convert with new settings
            this.convertTab();
          }
        });
      }
    });
  }

  /**
   * Convert tab to accessible format
   */
  async convertTab() {
    if (this.isConverting) return;
    
    const input = this.tabInput.value.trim();
    if (!input) {
      notificationManager.warning('Please enter a guitar tab to convert.');
      return;
    }
    
    this.isConverting = true;
    this.convertBtn.disabled = true;
    this.convertBtn.textContent = 'Converting...';
    
    try {
      // Get current settings
      const settings = TabConverter.getSettingsFromElements(this.settingsElements);
      
      // Convert the tab
      const converted = this.converter.convert(input, settings);
      
      // Display result
      this.tabOutput.value = converted;
      this.copyBtn.disabled = false;
      if (this.saveBtn) {
        this.saveBtn.disabled = false;
      }
      
      notificationManager.success('Tab converted successfully!');
      notificationManager.announce('Tab converted successfully. Check the output area.');
      
      // Focus output for screen readers
      this.tabOutput.focus();
      
    } catch (error) {
      console.error('Conversion error:', error);
      this.tabOutput.value = `Error converting tab: ${error.message}\n\nPlease check that your tab is in the correct format.`;
      this.copyBtn.disabled = true;
      if (this.saveBtn) {
        this.saveBtn.disabled = true;
      }
      
      notificationManager.error('Error converting tab. Please check the format.');
    } finally {
      this.isConverting = false;
      this.convertBtn.disabled = false;
      this.convertBtn.textContent = 'Convert Tab to Accessible Format';
    }
  }

  /**
   * Copy converted tab to clipboard
   */
  async copyToClipboard() {
    const output = this.tabOutput.value;
    if (!output) return;
    
    try {
      await navigator.clipboard.writeText(output);
      notificationManager.success('Copied to clipboard!');
      notificationManager.announce('Converted tab copied to clipboard.');
      
      // Visual feedback
      const originalText = this.copyBtn.textContent;
      this.copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        this.copyBtn.textContent = originalText;
      }, ANIMATION_DURATIONS.BUTTON_FEEDBACK);
      
    } catch (err) {
      // Fallback for older browsers
      this.tabOutput.select();
      document.execCommand('copy');
      notificationManager.success('Copied to clipboard!');
    }
  }

  /**
   * Save tab to storage
   */
  async saveTab() {
    if (!this.tabInput.value.trim() || !this.tabOutput.value.trim()) {
      notificationManager.warning('Please convert a tab before saving.');
      return;
    }
    
    // Get tab name from user
    const currentName = this.currentTab ? this.currentTab.name : '';
    const tabName = prompt('Enter a name for this tab:', currentName);
    
    if (tabName === null) return; // User cancelled
    
    if (!tabName.trim()) {
      notificationManager.error('Please enter a valid tab name.');
      return;
    }
    
    try {
      const settings = TabConverter.getSettingsFromElements(this.settingsElements);
      
      const tabData = {
        id: this.currentTab?.id,
        name: tabName.trim(),
        originalTab: this.tabInput.value,
        convertedTab: this.tabOutput.value,
        settings: settings,
        dateCreated: this.currentTab?.dateCreated
      };
      
      const savedTab = LocalStorage.saveTab(tabData);
      this.currentTab = savedTab;
      
      notificationManager.success(`Tab "${savedTab.name}" saved successfully!`);
      
      // Visual feedback
      const originalText = this.saveBtn.textContent;
      this.saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        this.saveBtn.textContent = originalText;
      }, ANIMATION_DURATIONS.BUTTON_FEEDBACK);
      
    } catch (error) {
      console.error('Error saving tab:', error);
      notificationManager.error('Error saving tab. ' + error.message);
    }
  }

  /**
   * Load tab from URL parameter
   */
  async loadTabFromUrl() {
    const params = getQueryParams();
    const tabId = params.load;
    
    if (tabId) {
      const tab = LocalStorage.getTab(tabId);
      if (tab) {
        this.loadTab(tab);
      } else {
        notificationManager.warning('Tab not found.');
      }
    }
  }

  /**
   * Load a tab into the converter
   * @param {Object} tab - Tab data to load
   */
  loadTab(tab) {
    this.tabInput.value = tab.originalTab;
    this.tabOutput.value = tab.convertedTab;
    
    // Enable buttons
    this.convertBtn.disabled = false;
    this.copyBtn.disabled = false;
    if (this.saveBtn) {
      this.saveBtn.disabled = false;
    }
    
    // Load settings
    if (tab.settings) {
      TabConverter.applySettingsToElements(tab.settings, this.settingsElements);
    }
    
    // Set current tab reference
    this.currentTab = tab;
    
    notificationManager.info(`Loaded tab: ${tab.name}`);
  }

  /**
   * Set up auto-save functionality
   */
  setupAutoSave() {
    let autoSaveTimeout;
    
    const autoSave = () => {
      if (this.currentTab && this.tabOutput.value) {
        try {
          const settings = TabConverter.getSettingsFromElements(this.settingsElements);
          
          const tabData = {
            ...this.currentTab,
            originalTab: this.tabInput.value,
            convertedTab: this.tabOutput.value,
            settings: settings
          };
          
          LocalStorage.saveTab(tabData);
          console.log('Auto-saved tab');
        } catch (error) {
          console.error('Auto-save error:', error);
        }
      }
    };
    
    // Auto-save on input change (debounced)
    this.tabInput.addEventListener('input', () => {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(autoSave, 5000); // 5 seconds
    });
  }

  /**
   * Initialize My Tabs page
   */
  async initMyTabsPage() {
    // Implementation moved to MyTabsPage module
    const { MyTabsPage } = await import('./modules/ui/pages/MyTabsPage.js');
    new MyTabsPage();
  }

  /**
   * Initialize home page
   */
  async initHomePage() {
    // Add any home page specific initialization
    console.log('Home page initialized');
  }

  /**
   * Initialize keyboard shortcuts
   */
  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter: Convert
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (this.convertBtn && !this.convertBtn.disabled) {
          this.convertTab();
        }
      }
      
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (this.saveBtn && !this.saveBtn.disabled) {
          this.saveTab();
        }
      }
      
      // Ctrl/Cmd + Shift + C: Copy
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (this.copyBtn && !this.copyBtn.disabled) {
          this.copyToClipboard();
        }
      }
    });
  }

  /**
   * Initialize service worker for offline support
   */
  async initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AccessibleGuitarTabsApp();
  });
} else {
  new AccessibleGuitarTabsApp();
}

// Export initialization function for debugging
window.initFirebaseAuth = () => {
  if (window.firebaseAuth) {
    window.firebaseAuth.addAuthSection();
    return 'Firebase auth UI created';
  } else {
    return 'Firebase auth not loaded yet';
  }
};
