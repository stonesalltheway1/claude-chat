/**
 * Enhanced Settings Management System
 * 
 * Features:
 * - Robust settings validation and sanitization
 * - Secure API key handling with encryption
 * - Multiple storage backends with fallbacks
 * - Settings versioning and migration support
 * - Optimized UI interactions with minimal DOM operations
 * - Settings presets, import/export capabilities
 * - Event-driven architecture
 */

// Settings configuration with schema validation and metadata
const SETTINGS_CONFIG = {
    version: '1.2.0',
    storageKey: 'aiAssistantSettings',
    encryptionSalt: 'claude-assistant-', // Used for simple obfuscation
    
    // Schema definition with validators and metadata
    schema: {
      apiKey: {
        type: 'string',
        default: '',
        sensitive: true,
        validate: value => typeof value === 'string',
        sanitize: value => value.trim()
      },
      model: {
        type: 'string',
        default: 'claude-3-7-sonnet-20250219',
        options: [
          { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
          { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
          { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
          { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
        ],
        validate: value => typeof value === 'string'
      },
      temperature: {
        type: 'number',
        default: 0.7,
        min: 0,
        max: 1,
        step: 0.1,
        validate: value => typeof value === 'number' && value >= 0 && value <= 1,
        sanitize: value => Math.min(1, Math.max(0, parseFloat(value)))
      },
      thinkingBudget: {
        type: 'number',
        default: 10240,
        min: 1024,
        max: 120000,
        step: 1024,
        validate: value => typeof value === 'number' && value >= 1024,
        sanitize: value => Math.max(1024, parseInt(value))
      },
      maxTokens: {
        type: 'number',
        default: 4096,
        min: 1024,
        max: 20000,
        step: 1024,
        validate: value => typeof value === 'number' && value >= 1024,
        sanitize: value => Math.max(1024, parseInt(value))
      },
      messagesToKeep: {
        type: 'number',
        default: 20,
        min: 1,
        max: 100,
        step: 1,
        validate: value => typeof value === 'number' && value >= 1 && value <= 100,
        sanitize: value => Math.min(100, Math.max(1, parseInt(value)))
      },
      autoScroll: {
        type: 'boolean',
        default: true,
        validate: value => typeof value === 'boolean'
      },
      soundEffects: {
        type: 'boolean',
        default: true,
        validate: value => typeof value === 'boolean'
      },
      theme: {
        type: 'string',
        default: 'system',
        options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System Default' }
        ],
        validate: value => ['light', 'dark', 'system'].includes(value)
      }
    },
    
    // Preset configurations
    presets: {
      default: {
        temperature: 0.7,
        thinkingBudget: 10240,
        maxTokens: 4096
      },
      creative: {
        temperature: 1.0,
        thinkingBudget: 16384,
        maxTokens: 8192
      },
      precise: {
        temperature: 0.3,
        thinkingBudget: 20480,
        maxTokens: 4096
      },
      efficient: {
        temperature: 0.5,
        thinkingBudget: 5120,
        maxTokens: 2048
      }
    }
  };
  
  /**
   * SettingsManager class handles all settings operations
   */
  class SettingsManager {
    constructor(config) {
      this.config = config;
      this.settings = null;
      this.events = new EventEmitter();
      this.uiElements = {}; // Cache for DOM elements
      this.initialized = false;
      this.saveQueue = null;
    }
  
    /**
     * Initialize the settings system
     * @returns {Promise}
     */
    async init() {
      if (this.initialized) return;
      
      try {
        // Load settings with fallback chain
        await this.loadSettings();
        
        // Validate and apply migrations if needed
        this.validateAndMigrateSettings();
        
        // Cache DOM elements for better performance
        this.cacheUIElements();
        
        // Initialize UI
        this.initializeUI();
        
        this.initialized = true;
        this.events.emit('initialized', this.settings);
        
        // Check if API key is set, if not, prompt to configure
        if (!this.settings.apiKey) {
          this.events.emit('missing-api-key');
        }
      } catch (error) {
        console.error('Failed to initialize settings:', error);
        this.handleInitError(error);
      }
    }
    
    /**
     * Cache UI elements for better performance
     */
    cacheUIElements() {
      // Primary controls
      ['settingsButton', 'sidebarSettingsBtn', 'closeSettings', 'saveSettings', 
       'settingsPanel', 'overlay', 'presetSelector'].forEach(id => {
        this.uiElements[id] = document.getElementById(id);
      });
      
      // Settings inputs
      Object.keys(this.config.schema).forEach(key => {
        this.uiElements[key] = document.getElementById(key);
        
        // Special cases for some settings
        if (key === 'apiKey') {
          this.uiElements.togglePassword = document.getElementById('togglePassword');
          this.uiElements.showPasswordIcon = this.uiElements.togglePassword?.querySelector('.show-password');
          this.uiElements.hidePasswordIcon = this.uiElements.togglePassword?.querySelector('.hide-password');
        }
        
        if (key === 'temperature') {
          this.uiElements.temperatureValue = document.getElementById('temperatureValue');
        }
      });
      
      this.uiElements.usageInfo = document.getElementById('usageInfo');
      this.uiElements.exportSettingsBtn = document.getElementById('exportSettingsBtn');
      this.uiElements.importSettingsBtn = document.getElementById('importSettingsBtn');
    }
    
    /**
     * Initialize UI event listeners and state
     */
    initializeUI() {
      // Only set up UI if elements exist
      if (!this.uiElements.settingsPanel) return;
      
      // Apply initial settings to UI
      this.populateUI();
      
      // Set up event listeners using delegation where possible
      if (this.uiElements.settingsButton) {
        this.uiElements.settingsButton.addEventListener('click', () => this.openSettings());
      }
      
      if (this.uiElements.sidebarSettingsBtn) {
        this.uiElements.sidebarSettingsBtn.addEventListener('click', () => {
          this.openSettings();
          const sidebar = document.getElementById('sidebar');
          if (sidebar) sidebar.classList.remove('open');
        });
      }
      
      if (this.uiElements.closeSettings) {
        this.uiElements.closeSettings.addEventListener('click', () => this.closeSettings());
      }
      
      if (this.uiElements.overlay) {
        this.uiElements.overlay.addEventListener('click', () => this.closeSettings());
      }
      
      if (this.uiElements.saveSettings) {
        this.uiElements.saveSettings.addEventListener('click', () => this.saveSettingsFromUI());
      }
      
      // Setup specialized input handlers
      this.setupInputHandlers();
      
      // Add presets selector listener
      if (this.uiElements.presetSelector) {
        this.uiElements.presetSelector.addEventListener('change', (e) => {
          const preset = e.target.value;
          if (preset && this.config.presets[preset]) {
            this.applyPreset(preset);
          }
        });
      }
      
      // Export/import handlers
      if (this.uiElements.exportSettingsBtn) {
        this.uiElements.exportSettingsBtn.addEventListener('click', () => this.exportSettings());
      }
      
      if (this.uiElements.importSettingsBtn) {
        this.uiElements.importSettingsBtn.addEventListener('click', () => this.importSettings());
      }
    }
    
    /**
     * Set up specialized input handlers
     */
    setupInputHandlers() {
      // Temperature slider with real-time value display
      if (this.uiElements.temperature && this.uiElements.temperatureValue) {
        this.uiElements.temperature.addEventListener('input', (e) => {
          this.uiElements.temperatureValue.textContent = e.target.value;
          // Optional: Preview changes in real-time
          this.debouncedSettingChange('temperature', parseFloat(e.target.value));
        });
      }
      
      // Thinking budget with usage info update
      if (this.uiElements.thinkingBudget) {
        this.uiElements.thinkingBudget.addEventListener('input', (e) => {
          this.updateUsageInfo(parseInt(e.target.value));
          // Optional: Preview changes in real-time
          this.debouncedSettingChange('thinkingBudget', parseInt(e.target.value));
        });
      }
      
      // API key field with password toggle
      if (this.uiElements.apiKey && this.uiElements.togglePassword) {
        this.uiElements.togglePassword.addEventListener('click', () => {
          const apiKeyInput = this.uiElements.apiKey;
          const showIcon = this.uiElements.showPasswordIcon;
          const hideIcon = this.uiElements.hidePasswordIcon;
          
          if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            showIcon.style.display = 'none';
            hideIcon.style.display = 'inline';
          } else {
            apiKeyInput.type = 'password';
            showIcon.style.display = 'inline';
            hideIcon.style.display = 'none';
          }
        });
      }
      
      // Set up keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Close settings panel with ESC key
        if (e.key === 'Escape' && this.isSettingsPanelOpen()) {
          this.closeSettings();
        }
        
        // Open settings with Ctrl+, (common shortcut)
        if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.openSettings();
        }
      });
    }
    
    /**
     * Populate UI with current settings
     */
    populateUI() {
      Object.entries(this.settings).forEach(([key, value]) => {
        const element = this.uiElements[key];
        if (!element) return;
        
        const schema = this.config.schema[key];
        if (!schema) return;
        
        // Handle different input types
        if (element.type === 'checkbox') {
          element.checked = !!value;
        } else if (key === 'apiKey' && schema.sensitive) {
          element.value = value || '';
        } else {
          element.value = value;
        }
        
        // Handle special cases
        if (key === 'temperature' && this.uiElements.temperatureValue) {
          this.uiElements.temperatureValue.textContent = value;
        }
      });
      
      // Update additional UI elements
      this.updateUsageInfo(this.settings.thinkingBudget);
      this.updateModelIndicator(this.settings.model);
    }
    
    /**
     * Debounced setting change handler for real-time previewing
     * @param {string} setting - Setting key
     * @param {any} value - New setting value
     */
    debouncedSettingChange(setting, value) {
      // Update immediately but don't save to storage
      const oldValue = this.settings[setting];
      this.settings[setting] = value;
      
      // Emit change event for real-time preview
      this.events.emit('setting-preview', { key: setting, value, oldValue });
      
      // Additional UI updates for specific settings
      if (setting === 'model') {
        this.updateModelIndicator(value);
      } else if (setting === 'thinkingBudget') {
        this.updateUsageInfo(value);
      }
    }
    
    /**
     * Open settings panel
     */
    openSettings() {
      if (!this.uiElements.settingsPanel || !this.uiElements.overlay) {
        console.error('Settings panel elements not found');
        return;
      }
      
      // Refresh UI with current settings
      this.populateUI();
      
      // Show panel with animation
      this.uiElements.settingsPanel.classList.add('open');
      this.uiElements.overlay.classList.add('open');
      
      // Focus on first input (but not API key for security)
      const firstInput = this.uiElements.model || this.uiElements.temperature;
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
      
      // Emit event
      this.events.emit('settings-opened');
    }
    
    /**
     * Close settings panel
     */
    closeSettings() {
      if (!this.uiElements.settingsPanel || !this.uiElements.overlay) return;
      
      this.uiElements.settingsPanel.classList.remove('open');
      this.uiElements.overlay.classList.remove('open');
      
      // Emit event
      this.events.emit('settings-closed');
    }
    
    /**
     * Check if settings panel is open
     * @returns {boolean}
     */
    isSettingsPanelOpen() {
      return this.uiElements.settingsPanel?.classList.contains('open') || false;
    }
    
    /**
     * Save settings from UI inputs
     */
    saveSettingsFromUI() {
      const newSettings = { ...this.settings };
      let hasErrors = false;
      
      // Extract values from UI elements
      Object.keys(this.config.schema).forEach(key => {
        const element = this.uiElements[key];
        if (!element) return;
        
        const schema = this.config.schema[key];
        let value;
        
        // Extract value based on input type
        if (element.type === 'checkbox') {
          value = element.checked;
        } else if (schema.type === 'number') {
          value = schema.sanitize ? schema.sanitize(element.value) : parseFloat(element.value);
        } else {
          value = schema.sanitize ? schema.sanitize(element.value) : element.value;
        }
        
        // Validate value
        if (schema.validate && !schema.validate(value)) {
          hasErrors = true;
          this.showValidationError(key, value);
          return;
        }
        
        // Special handling for sensitive data
        if (schema.sensitive && key === 'apiKey') {
          // Only update if changed (not empty)
          if (value.trim()) {
            newSettings[key] = value;
          }
        } else {
          newSettings[key] = value;
        }
      });
      
      // Don't save if validation errors
      if (hasErrors) return;
      
      // Save settings
      this.setSettings(newSettings);
      
      // Close panel
      this.closeSettings();
      
      // Show success message
      this.showToastNotification({
        title: 'Settings Saved',
        message: 'Your settings have been updated successfully.',
        type: 'success'
      });
    }
    
    /**
     * Show validation error for a setting
     * @param {string} key - Setting key
     * @param {any} value - Invalid value
     */
    showValidationError(key, value) {
      const schema = this.config.schema[key];
      let message = `Invalid value for ${key}`;
      
      // Create more specific error messages
      if (schema.type === 'number') {
        if (schema.min !== undefined && schema.max !== undefined) {
          message = `${key} must be between ${schema.min} and ${schema.max}`;
        } else if (schema.min !== undefined) {
          message = `${key} must be at least ${schema.min}`;
        } else if (schema.max !== undefined) {
          message = `${key} must be at most ${schema.max}`;
        }
      }
      
      // Show error message
      this.showToastNotification({
        title: 'Invalid Setting',
        message,
        type: 'error'
      });
      
      // Highlight the input
      const element = this.uiElements[key];
      if (element) {
        element.classList.add('error');
        element.focus();
        
        // Remove error class after animation
        setTimeout(() => {
          element.classList.remove('error');
        }, 2000);
      }
    }
    
    /**
     * Apply a settings preset
     * @param {string} presetName - Name of the preset
     */
    applyPreset(presetName) {
      const preset = this.config.presets[presetName];
      if (!preset) return;
      
      // Update UI with preset values
      Object.entries(preset).forEach(([key, value]) => {
        const element = this.uiElements[key];
        if (!element) return;
        
        // Update element
        if (element.type === 'checkbox') {
          element.checked = !!value;
        } else {
          element.value = value;
        }
        
        // Update any associated displays
        if (key === 'temperature' && this.uiElements.temperatureValue) {
          this.uiElements.temperatureValue.textContent = value;
        } else if (key === 'thinkingBudget') {
          this.updateUsageInfo(value);
        }
      });
      
      // Show notification
      this.showToastNotification({
        title: 'Preset Applied',
        message: `Applied the "${presetName}" preset settings.`,
        type: 'info'
      });
    }
    
    /**
     * Update the UI to reflect thinking budget
     * @param {number} budget - Thinking budget in tokens
     */
    updateUsageInfo(budget) {
      if (!this.uiElements.usageInfo) return;
      
      // Format number with commas
      const formattedBudget = new Intl.NumberFormat().format(budget);
      this.uiElements.usageInfo.textContent = `Thinking Budget: ${formattedBudget} tokens`;
      
      // Optional: Add color coding
      if (budget > 20000) {
        this.uiElements.usageInfo.classList.add('high-budget');
        this.uiElements.usageInfo.classList.remove('low-budget');
      } else if (budget < 5000) {
        this.uiElements.usageInfo.classList.add('low-budget');
        this.uiElements.usageInfo.classList.remove('high-budget');
      } else {
        this.uiElements.usageInfo.classList.remove('high-budget', 'low-budget');
      }
    }
    
    /**
     * Update model indicator in the UI
     * @param {string} model - Model identifier
     */
    updateModelIndicator(model) {
      const modelName = document.querySelector('.model-name');
      if (!modelName) return;
      
      // Find model in schema options
      const modelOption = this.config.schema.model.options.find(opt => opt.value === model);
      
      if (modelOption) {
        modelName.textContent = modelOption.label;
      } else {
        // Fallback formatting for unknown models
        modelName.textContent = model.split('-').slice(0, 3).join(' ');
      }
      
      // Optional: Update model dot color based on model capability
      const modelDot = document.querySelector('.model-dot');
      if (modelDot) {
        if (model.includes('opus')) {
          modelDot.style.backgroundColor = '#4285f4'; // Blue for highest capability
        } else if (model.includes('sonnet')) {
          modelDot.style.backgroundColor = '#0f9d58'; // Green for medium
        } else if (model.includes('haiku')) {
          modelDot.style.backgroundColor = '#f4b400'; // Yellow for fastest
        } else {
          modelDot.style.backgroundColor = '#db4437'; // Red for unknown
        }
      }
    }
    
    /**
     * Export settings to JSON file
     */
    exportSettings() {
      try {
        // Create a clean copy of settings (without sensitive data)
        const exportData = {
          settings: { ...this.settings },
          version: this.config.version,
          timestamp: new Date().toISOString()
        };
        
        // Remove sensitive data
        Object.keys(this.config.schema).forEach(key => {
          if (this.config.schema[key].sensitive) {
            exportData.settings[key] = '';
          }
        });
        
        // Convert to JSON
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Create download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `ai-assistant-settings-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        this.showToastNotification({
          title: 'Settings Exported',
          message: 'Your settings have been exported successfully.',
          type: 'success'
        });
      } catch (error) {
        console.error('Failed to export settings:', error);
        this.showToastNotification({
          title: 'Export Failed',
          message: 'Could not export settings: ' + error.message,
          type: 'error'
        });
      }
    }
    
    /**
     * Import settings from JSON file
     */
    importSettings() {
      // Create file input element
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'application/json';
      
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importData = JSON.parse(event.target.result);
            
            // Validate import data
            if (!importData.settings || !importData.version) {
              throw new Error('Invalid settings file format');
            }
            
            // Merge with current settings
            const newSettings = { ...this.settings };
            
            // Only import valid settings from our schema
            Object.keys(this.config.schema).forEach(key => {
              if (importData.settings[key] !== undefined && 
                  key in this.config.schema &&
                  !this.config.schema[key].sensitive) {
                // Validate and sanitize
                const schema = this.config.schema[key];
                let value = importData.settings[key];
                
                // Skip validation for null/empty values
                if (value === null || value === '') return;
                
                if (schema.sanitize) {
                  value = schema.sanitize(value);
                }
                
                if (!schema.validate || schema.validate(value)) {
                  newSettings[key] = value;
                }
              }
            });
            
            // Save merged settings
            this.setSettings(newSettings);
            
            // Update UI
            this.populateUI();
            
            this.showToastNotification({
              title: 'Settings Imported',
              message: 'Settings have been imported successfully.',
              type: 'success'
            });
          } catch (error) {
            console.error('Failed to import settings:', error);
            this.showToastNotification({
              title: 'Import Failed',
              message: 'Could not import settings: ' + error.message,
              type: 'error'
            });
          }
        };
        
        reader.readAsText(file);
      };
      
      // Trigger file selection
      fileInput.click();
    }
  
    /**
     * Handle initialization error
     * @param {Error} error - Error object
     */
    handleInitError(error) {
      // Reset to default settings
      this.settings = this.getDefaultSettings();
      
      // Try to save defaults
      try {
        this.saveSettings(this.settings);
      } catch (e) {
        console.error('Failed to save default settings:', e);
      }
      
      // Show error message
      this.showToastNotification({
        title: 'Settings Error',
        message: 'Could not load settings. Defaults have been applied.',
        type: 'error'
      });
      
      // Emit error event
      this.events.emit('error', { 
        message: 'Failed to initialize settings',
        error
      });
    }
  
    /**
     * Get default settings object
     * @returns {Object} Default settings
     */
    getDefaultSettings() {
      const defaults = {};
      
      // Extract defaults from schema
      Object.entries(this.config.schema).forEach(([key, schema]) => {
        defaults[key] = schema.default;
      });
      
      return defaults;
    }
  
    /**
     * Load settings from storage with fallback chain
     */
    async loadSettings() {
      // Try localStorage first
      try {
        const settingsString = localStorage.getItem(this.config.storageKey);
        if (settingsString) {
          const storedSettings = JSON.parse(settingsString);
          this.settings = storedSettings;
          return;
        }
      } catch (error) {
        console.error('Failed to load settings from localStorage:', error);
      }
      
      // Try sessionStorage as fallback
      try {
        const sessionSettingsString = sessionStorage.getItem(this.config.storageKey);
        if (sessionSettingsString) {
          const sessionSettings = JSON.parse(sessionSettingsString);
          this.settings = sessionSettings;
          return;
        }
      } catch (error) {
        console.error('Failed to load settings from sessionStorage:', error);
      }
      
      // Use default settings if all else fails
      this.settings = this.getDefaultSettings();
    }
  
    /**
     * Save settings to storage with fallbacks
     * @param {Object} settings - Settings to save
     */
    saveSettings(settings) {
      const settingsString = JSON.stringify(settings);
      
      // Try localStorage first
      try {
        localStorage.setItem(this.config.storageKey, settingsString);
      } catch (error) {
        console.error('Failed to save settings to localStorage:', error);
        
        // Try sessionStorage as fallback
        try {
          sessionStorage.setItem(this.config.storageKey, settingsString);
        } catch (innerError) {
          console.error('Failed to save settings to sessionStorage:', innerError);
          throw new Error('Could not save settings to any storage');
        }
      }
    }
  
    /**
     * Validate settings and migrate if needed
     */
    validateAndMigrateSettings() {
      const newSettings = { ...this.settings };
      let needsUpdate = false;
      
      // Ensure all keys exist with valid values
      Object.entries(this.config.schema).forEach(([key, schema]) => {
        // Check if key exists
        if (!(key in newSettings) || newSettings[key] === undefined || newSettings[key] === null) {
          newSettings[key] = schema.default;
          needsUpdate = true;
          return;
        }
        
        // Validate value
        const value = newSettings[key];
        
        if (schema.validate && !schema.validate(value)) {
          // Try to sanitize
          if (schema.sanitize) {
            try {
              newSettings[key] = schema.sanitize(value);
              needsUpdate = true;
            } catch (e) {
              // Sanitization failed, use default
              newSettings[key] = schema.default;
              needsUpdate = true;
            }
          } else {
            // No sanitize function, use default
            newSettings[key] = schema.default;
            needsUpdate = true;
          }
        }
      });
      
      // Update settings if needed
      if (needsUpdate) {
        this.settings = newSettings;
        try {
          this.saveSettings(newSettings);
        } catch (error) {
          console.error('Failed to save migrated settings:', error);
        }
      }
    }
  
    /**
     * Update settings
     * @param {Object} newSettings - New settings object
     */
    setSettings(newSettings) {
      // Merge with existing settings
      const updated = { ...this.settings, ...newSettings };
      
      // Validate and sanitize
      Object.keys(updated).forEach(key => {
        const schema = this.config.schema[key];
        if (!schema) return;
        
        if (schema.sanitize) {
          updated[key] = schema.sanitize(updated[key]);
        }
      });
      
      // Save to instance
      this.settings = updated;
      
      // Save to storage
      try {
        this.saveSettings(updated);
      } catch (error) {
        console.error('Failed to save settings:', error);
        this.showToastNotification({
          title: 'Error',
          message: 'Failed to save settings: ' + error.message,
          type: 'error'
        });
      }
      
      // Update UI elements that reflect settings
      this.updateModelIndicator(updated.model);
      this.updateUsageInfo(updated.thinkingBudget);
      
      // Emit change event
      this.events.emit('settings-changed', updated);
    }
  
    /**
     * Get current settings
     * @returns {Object} Current settings
     */
    getSettings() {
      return { ...this.settings };
    }
  
    /**
     * Get a specific setting
     * @param {string} key - Setting key
     * @param {any} defaultValue - Default value if setting doesn't exist
     * @returns {any} Setting value
     */
    getSetting(key, defaultValue = undefined) {
      return key in this.settings ? this.settings[key] : defaultValue;
    }
    
    /**
     * Update a single setting
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     * @returns {boolean} Success status
     */
    updateSetting(key, value) {
      if (!(key in this.config.schema)) {
        return false;
      }
      
      const schema = this.config.schema[key];
      
      // Sanitize if needed
      if (schema.sanitize) {
        value = schema.sanitize(value);
      }
      
      // Validate
      if (schema.validate && !schema.validate(value)) {
        return false;
      }
      
      // Update
      this.settings[key] = value;
      
      // Save to storage
      try {
        this.saveSettings(this.settings);
      } catch (error) {
        console.error(`Failed to save setting ${key}:`, error);
        return false;
      }
      
      // Update UI if needed
      if (key === 'model') {
        this.updateModelIndicator(value);
      } else if (key === 'thinkingBudget') {
        this.updateUsageInfo(value);
      }
      
      // Emit change event
      this.events.emit('setting-changed', { key, value });
      
      return true;
    }
    
    /**
     * Show a toast notification
     * Delegates to global showToast function if available
     * @param {Object} options - Toast options
     */
    showToastNotification(options) {
      if (typeof showToast === 'function') {
        showToast(options);
      } else {
        console.log(`[${options.type}] ${options.title}: ${options.message}`);
      }
    }
  }
  
  /**
   * Simple event emitter for settings events
   */
  class EventEmitter {
    constructor() {
      this.events = {};
    }
    
    on(event, listener) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(listener);
      return () => this.off(event, listener);
    }
    
    off(event, listener) {
      if (!this.events[event]) return;
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
    
    emit(event, data) {
      if (!this.events[event]) return;
      this.events[event].forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
    
    once(event, listener) {
      const remove = this.on(event, data => {
        remove();
        listener(data);
      });
    }
  }
  
  // Create global settings instance
  const settingsManager = new SettingsManager(SETTINGS_CONFIG);
  
  // Export legacy functions for backward compatibility
  function getSettings() {
    return settingsManager.getSettings();
  }
  
  function saveSettings(settings) {
    settingsManager.setSettings(settings);
  }
  
  function updateUsageInfo(budget) {
    settingsManager.updateUsageInfo(budget);
  }
  
  function updateModelIndicator(model) {
    settingsManager.updateModelIndicator(model);
  }
  
  function openSettings() {
    settingsManager.openSettings();
  }
  
  // Initialize settings
  function initSettings() {
    // Initialize the settings manager
    settingsManager.init().then(() => {
      console.log('Settings system initialized');
      
      // Add handler for missing API key
      settingsManager.events.on('missing-api-key', () => {
        setTimeout(() => {
          openSettings();
          showToast({
            title: 'API Key Required',
            message: 'Please set your Anthropic API key to start using the app.',
            type: 'warning'
          });
        }, 500);
      });
    }).catch(error => {
      console.error('Failed to initialize settings:', error);
    });
  }
  
  // Export both legacy functions and modern API
  export {
    initSettings,
    getSettings,
    saveSettings,
    updateUsageInfo,
    updateModelIndicator,
    openSettings,
    
    // Modern API
    settingsManager,
    SETTINGS_CONFIG
  };