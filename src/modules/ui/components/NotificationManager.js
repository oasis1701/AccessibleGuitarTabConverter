/**
 * @fileoverview Manages notifications and screen reader announcements
 * @module ui/components/NotificationManager
 */

import { NOTIFICATION_TYPES, CSS_CLASSES, ANIMATION_DURATIONS } from '../../../utils/constants.js';

/**
 * Class to manage user notifications and screen reader announcements
 */
export class NotificationManager {
  /**
   * Create a NotificationManager instance
   */
  constructor() {
    this.announcer = null;
    this.notificationContainer = null;
    this.init();
  }

  /**
   * Initialize the notification manager
   * @private
   */
  init() {
    this.createAnnouncer();
    this.createNotificationContainer();
  }

  /**
   * Create the screen reader announcer element
   * @private
   */
  createAnnouncer() {
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.className = 'sr-only';
    this.announcer.style.position = 'absolute';
    this.announcer.style.left = '-10000px';
    this.announcer.style.width = '1px';
    this.announcer.style.height = '1px';
    this.announcer.style.overflow = 'hidden';
    document.body.appendChild(this.announcer);
  }

  /**
   * Create the notification container
   * @private
   */
  createNotificationContainer() {
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.className = 'notification-container';
    this.notificationContainer.style.position = 'fixed';
    this.notificationContainer.style.top = '20px';
    this.notificationContainer.style.right = '20px';
    this.notificationContainer.style.zIndex = '9999';
    this.notificationContainer.style.pointerEvents = 'none';
    document.body.appendChild(this.notificationContainer);
  }

  /**
   * Show a notification
   * @param {string} message - Message to display
   * @param {string} type - Type of notification (success, error, info, warning)
   * @param {number} duration - Duration in milliseconds
   * @returns {HTMLElement} The notification element
   */
  show(message, type = NOTIFICATION_TYPES.INFO, duration = ANIMATION_DURATIONS.NOTIFICATION) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `${CSS_CLASSES.NOTIFICATION} ${type}`;
    notification.textContent = message;
    notification.style.pointerEvents = 'auto';
    
    // Add to container
    this.notificationContainer.appendChild(notification);
    
    // Announce to screen readers
    this.announce(message);
    
    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(notification);
      }, duration);
    }
    
    return notification;
  }

  /**
   * Show a success notification
   * @param {string} message - Success message
   * @param {number} duration - Duration in milliseconds
   * @returns {HTMLElement} The notification element
   */
  success(message, duration) {
    return this.show(message, NOTIFICATION_TYPES.SUCCESS, duration);
  }

  /**
   * Show an error notification
   * @param {string} message - Error message
   * @param {number} duration - Duration in milliseconds
   * @returns {HTMLElement} The notification element
   */
  error(message, duration) {
    return this.show(message, NOTIFICATION_TYPES.ERROR, duration);
  }

  /**
   * Show an info notification
   * @param {string} message - Info message
   * @param {number} duration - Duration in milliseconds
   * @returns {HTMLElement} The notification element
   */
  info(message, duration) {
    return this.show(message, NOTIFICATION_TYPES.INFO, duration);
  }

  /**
   * Show a warning notification
   * @param {string} message - Warning message
   * @param {number} duration - Duration in milliseconds
   * @returns {HTMLElement} The notification element
   */
  warning(message, duration) {
    return this.show(message, NOTIFICATION_TYPES.WARNING, duration);
  }

  /**
   * Remove a notification
   * @param {HTMLElement} notification - Notification element to remove
   */
  remove(notification) {
    if (notification && notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    while (this.notificationContainer.firstChild) {
      this.notificationContainer.removeChild(this.notificationContainer.firstChild);
    }
  }

  /**
   * Make an announcement to screen readers
   * @param {string} message - Message to announce
   */
  announce(message) {
    if (this.announcer) {
      this.announcer.textContent = message;
      // Force the screen reader to announce by clearing and resetting
      setTimeout(() => {
        this.announcer.textContent = '';
      }, 100);
    }
  }

  /**
   * Show a confirmation dialog
   * @param {string} message - Confirmation message
   * @param {Object} options - Options for the confirmation
   * @returns {Promise<boolean>} Promise that resolves to true if confirmed
   */
  async confirm(message, options = {}) {
    const {
      title = 'Confirm',
      confirmText = 'OK',
      cancelText = 'Cancel',
      type = NOTIFICATION_TYPES.INFO
    } = options;

    return new Promise((resolve) => {
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.className = 'notification-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      overlay.style.zIndex = '10000';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';

      // Create dialog
      const dialog = document.createElement('div');
      dialog.className = `notification-dialog ${type}`;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-labelledby', 'dialog-title');
      dialog.setAttribute('aria-describedby', 'dialog-message');
      dialog.innerHTML = `
        <h3 id="dialog-title">${title}</h3>
        <p id="dialog-message">${message}</p>
        <div class="dialog-buttons">
          <button class="btn btn-cancel">${cancelText}</button>
          <button class="btn btn-confirm">${confirmText}</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // Focus on cancel button
      const cancelBtn = dialog.querySelector('.btn-cancel');
      const confirmBtn = dialog.querySelector('.btn-confirm');
      cancelBtn.focus();

      // Handle button clicks
      const cleanup = () => {
        document.body.removeChild(overlay);
      };

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });

      confirmBtn.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });

      // Handle escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve(false);
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    });
  }

  /**
   * Show a progress notification
   * @param {string} message - Progress message
   * @param {number} progress - Progress percentage (0-100)
   * @returns {Object} Progress notification controller
   */
  showProgress(message, progress = 0) {
    const notification = document.createElement('div');
    notification.className = `${CSS_CLASSES.NOTIFICATION} progress`;
    notification.innerHTML = `
      <div class="progress-message">${message}</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="progress-text">${progress}%</div>
    `;
    
    this.notificationContainer.appendChild(notification);
    
    const controller = {
      update: (newProgress, newMessage) => {
        const fill = notification.querySelector('.progress-fill');
        const text = notification.querySelector('.progress-text');
        const msgEl = notification.querySelector('.progress-message');
        
        if (fill) fill.style.width = `${newProgress}%`;
        if (text) text.textContent = `${newProgress}%`;
        if (newMessage && msgEl) msgEl.textContent = newMessage;
        
        this.announce(`${newMessage || message}: ${newProgress}%`);
      },
      close: () => {
        this.remove(notification);
      }
    };
    
    return controller;
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();
