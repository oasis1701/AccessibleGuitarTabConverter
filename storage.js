// Tab Storage Management using localStorage
// Handles saving, loading, and managing guitar tabs

class TabStorage {
    static STORAGE_KEY = 'guitar_tabs_accessible';

    // Generate a unique ID for tabs
    static generateId() {
        return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Get all saved tabs
    static getAllTabs() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading tabs from localStorage:', error);
            return [];
        }
    }

    // Get a specific tab by ID
    static getTab(id) {
        const tabs = this.getAllTabs();
        return tabs.find(tab => tab.id === id);
    }

    // Save a new tab or update existing one
    static saveTab(tabData) {
        try {
            const tabs = this.getAllTabs();
            const existingIndex = tabs.findIndex(tab => tab.id === tabData.id);
            
            const tabToSave = {
                id: tabData.id || this.generateId(),
                name: tabData.name,
                originalTab: tabData.originalTab,
                convertedTab: tabData.convertedTab,
                settings: tabData.settings || {},
                dateCreated: tabData.dateCreated || new Date().toISOString(),
                dateModified: new Date().toISOString()
            };

            if (existingIndex >= 0) {
                // Update existing tab
                tabs[existingIndex] = { ...tabs[existingIndex], ...tabToSave };
            } else {
                // Add new tab
                tabs.push(tabToSave);
            }

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tabs));
            
            // Also save to Firebase if user is signed in
            if (window.firebaseManager && window.firebaseManager.isSignedIn()) {
                window.firebaseManager.saveTabToCloud(tabToSave).catch(error => {
                    console.error('Firebase save failed:', error);
                });
            }
            
            return tabToSave;
        } catch (error) {
            console.error('Error saving tab to localStorage:', error);
            throw new Error('Failed to save tab. Storage might be full.');
        }
    }

    // Delete a tab by ID
    static deleteTab(id) {
        try {
            const tabs = this.getAllTabs();
            const filteredTabs = tabs.filter(tab => tab.id !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredTabs));
            
            // Also delete from Firebase if user is signed in
            if (window.firebaseManager && window.firebaseManager.isSignedIn()) {
                window.firebaseManager.deleteTabFromCloud(id).catch(error => {
                    console.error('Firebase delete failed:', error);
                });
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting tab from localStorage:', error);
            return false;
        }
    }

    // Clear all tabs
    static clearAllTabs() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Error clearing tabs from localStorage:', error);
            return false;
        }
    }

    // Check if a tab name already exists
    static nameExists(name, excludeId = null) {
        const tabs = this.getAllTabs();
        return tabs.some(tab => tab.name.toLowerCase() === name.toLowerCase() && tab.id !== excludeId);
    }

    // Get storage usage info
    static getStorageInfo() {
        try {
            const tabs = this.getAllTabs();
            const dataSize = JSON.stringify(tabs).length;
            return {
                tabCount: tabs.length,
                sizeBytes: dataSize,
                sizeKB: Math.round(dataSize / 1024 * 100) / 100
            };
        } catch (error) {
            return { tabCount: 0, sizeBytes: 0, sizeKB: 0 };
        }
    }

    // Export all tabs as JSON
    static exportTabs() {
        const tabs = this.getAllTabs();
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            tabs: tabs
        };
        return JSON.stringify(exportData, null, 2);
    }

    // Import tabs from JSON
    static importTabs(jsonData, mergeMode = true) {
        try {
            const importData = JSON.parse(jsonData);
            if (!importData.tabs || !Array.isArray(importData.tabs)) {
                throw new Error('Invalid import data format');
            }

            const existingTabs = mergeMode ? this.getAllTabs() : [];
            const importedTabs = importData.tabs.map(tab => ({
                ...tab,
                id: this.generateId(), // Generate new IDs to avoid conflicts
                dateModified: new Date().toISOString()
            }));

            const allTabs = [...existingTabs, ...importedTabs];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allTabs));
            
            return {
                success: true,
                imported: importedTabs.length,
                total: allTabs.length
            };
        } catch (error) {
            console.error('Error importing tabs:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Make TabStorage available globally
window.TabStorage = TabStorage;