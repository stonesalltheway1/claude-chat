/**
 * Enhanced Theme Management System
 * 
 * Features:
 * - Multiple theme support (light, dark, system, high-contrast)
 * - CSS variable-based theming with smooth transitions
 * - System preference detection and synchronization
 * - Theme event notifications
 * - Custom accent color support
 * - Accessibility considerations
 * - Persistence with fallbacks
 * - View Transitions API integration
 * - Custom theme support
 */

// Use IIFE pattern to avoid global scope pollution
const ThemeManager = (() => {
  // Private variables
  let initialized = false;
  let currentTheme = 'system';
  let currentAccentColor = 'purple';
  let transitionsEnabled = true;
  let viewTransitionsSupported = false;
  
  // Configuration options
  const config = {
    themeStorageKey: 'claude_chat_theme',
    accentColorStorageKey: 'claude_chat_accent_color',
    customThemeStorageKey: 'claude_chat_custom_theme',
    darkModeClass: 'dark-theme',
    highContrastClass: 'high-contrast',
    defaultTheme: 'system',
    defaultAccentColor: 'purple',
    transitionDuration: 300,
    themes: ['light', 'dark', 'system', 'high-contrast', 'custom'],
    accentColors: ['purple', 'blue', 'green', 'red', 'orange', 'pink', 'custom'],
    themeDataAttribute: 'data-theme',
    colorSchemeMetaTag: 'color-scheme-meta',
    rootElement: document.documentElement,
    customThemePrefix: '--custom-theme-'
  };
  
  // Default CSS variables for custom themes
  const defaultCustomTheme = {
    'bg-primary': '#ffffff',
    'bg-secondary': '#f5f5f7',
    'text-primary': '#1d1d1f',
    'text-secondary': '#6e6e73',
    'accent-primary': '#5E5CEA',
    'accent-secondary': '#7A78FF',
    'border-color': '#d2d2d7',
    'shadow-color': 'rgba(0, 0, 0, 0.1)',
    'surface-color': '#ffffff',
    'error-color': '#ff3b30',
    'success-color': '#34c759'
  };
  
  // Dark mode defaults for custom theme
  const defaultCustomDarkTheme = {
    'bg-primary': '#1a1a1a',
    'bg-secondary': '#2c2c2e',
    'text-primary': '#f5f5f7',
    'text-secondary': '#aeaeb2',
    'accent-primary': '#7A78FF',
    'accent-secondary': '#9d9bff',
    'border-color': '#3a3a3c',
    'shadow-color': 'rgba(0, 0, 0, 0.3)',
    'surface-color': '#2c2c2e',
    'error-color': '#ff453a',
    'success-color': '#30d158'
  };
  
  // Custom theme data
  let customTheme = {
    light: { ...defaultCustomTheme },
    dark: { ...defaultCustomDarkTheme }
  };
  
  // DOM elements cache
  const elements = {
    toggleBtn: null,
    toggleText: null,
    accentColorPicker: null,
    themeSelect: null,
    customThemeControls: null
  };
  
  // Event listeners
  const eventListeners = new Map();
  
  /**
   * Initialize the theme system
   * @param {Object} options - Configuration options
   * @returns {Object} - Public API
   */
  function init(options = {}) {
    if (initialized) return publicAPI;
    
    // Merge options with defaults
    Object.assign(config, options);
    
    // Check for View Transitions API support
    viewTransitionsSupported = 'startViewTransition' in document;
    
    // Cache DOM elements
    cacheElements();
    
    // Load custom theme if present
    loadCustomTheme();
    
    // Load saved theme or use system preference
    loadSavedTheme();
    
    // Load saved accent color
    loadSavedAccentColor();
    
    // Set up event listeners
    setupEventListeners();
    
    // Apply initial theme without transition
    disableTransitions();
    applyTheme(currentTheme);
    applyAccentColor(currentAccentColor);
    
    // Re-enable transitions after brief delay to prevent initial transition
    setTimeout(enableTransitions, 50);
    
    // Set initialization flag
    initialized = true;
    
    // Notify state management that theme is ready
    if (window.AppStore?.dispatch) {
      window.AppStore.dispatch({
        type: 'THEME_INITIALIZED',
        payload: {
          theme: currentTheme,
          accentColor: currentAccentColor,
          isDark: isDarkMode(),
          isHighContrast: isHighContrast()
        }
      });
    }
    
    // Log initialization in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('Theme system initialized:', {
        theme: currentTheme,
        accentColor: currentAccentColor,
        isDark: isDarkMode(),
        isHighContrast: isHighContrast(),
        viewTransitionsSupported
      });
    }
    
    return publicAPI;
  }
  
  /**
   * Cache DOM elements for better performance
   */
  function cacheElements() {
    // Try to get elements from the DOM using more specific selectors
    elements.toggleBtn = document.querySelector('[data-theme-toggle]') || document.getElementById('toggleThemeBtn');
    elements.toggleText = document.querySelector('[data-theme-toggle-text]') || document.getElementById('themeButtonText');
    elements.accentColorPicker = document.querySelector('[data-accent-color]') || document.getElementById('accentColorPicker');
    elements.themeSelect = document.querySelector('[data-theme-select]') || document.getElementById('themeSelect');
    elements.customThemeControls = document.querySelector('[data-custom-theme-section]');
    
    // Create or update color scheme meta tag for browsers/PWA
    let metaTag = document.querySelector(`meta[name="color-scheme"]`);
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'color-scheme';
      metaTag.content = 'light dark';
      metaTag.id = config.colorSchemeMetaTag;
      document.head.appendChild(metaTag);
    }
  }
  
  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Theme toggle button with event delegation for dynamic elements
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-theme-toggle]') || 
                       (e.target.id === 'toggleThemeBtn' ? e.target : null);
      if (toggleBtn) {
        toggleTheme();
      }
    });
    
    // Theme select using event delegation
    document.addEventListener('change', (e) => {
      // Handle theme selection
      if (e.target.matches('[data-theme-select]') || e.target.id === 'themeSelect') {
        setTheme(e.target.value);
      }
      
      // Handle accent color selection
      if (e.target.matches('[data-accent-color]') || e.target.id === 'accentColorPicker') {
        setAccentColor(e.target.value);
      }
      
      // Handle custom theme controls
      if (e.target.matches('[data-custom-theme-control]')) {
        const mode = e.target.dataset.mode || 'light';
        const property = e.target.dataset.property;
        if (property && mode) {
          updateCustomThemeProperty(property, e.target.value, mode);
        }
      }
    });
    
    // System preference change listeners
    const prefersColorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    try {
      // Try modern event listener first
      prefersColorScheme.addEventListener('change', handleSystemPreferenceChange);
    } catch (e) {
      // Fallback for older browsers
      prefersColorScheme.addListener(handleSystemPreferenceChange);
    }
    
    // High contrast preference change
    if ('matchMedia' in window) {
      const prefersContrast = window.matchMedia('(prefers-contrast: more)');
      try {
        prefersContrast.addEventListener('change', handleContrastPreferenceChange);
      } catch (e) {
        // Some browsers don't support this media query yet
        if (process.env.NODE_ENV !== 'production') {
          console.log('Contrast preference detection not fully supported');
        }
        // Try legacy version if available
        try {
          prefersContrast.addListener?.(handleContrastPreferenceChange);
        } catch (err) {
          // Not supported at all
        }
      }
    }
    
    // Listen for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) {
      disableTransitions();
    }
    
    try {
      prefersReducedMotion.addEventListener('change', (e) => {
        if (e.matches) {
          disableTransitions();
        } else {
          enableTransitions();
        }
      });
    } catch (e) {
      // Fallback for older browsers
      prefersReducedMotion.addListener?.(e => {
        if (e.matches) {
          disableTransitions();
        } else {
          enableTransitions();
        }
      });
    }
    
    // Handle visibility change to recheck system themes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && currentTheme === 'system') {
        applyTheme('system');
      }
    });
    
    // Listen for theme reset requests
    window.addEventListener('theme:reset', () => {
      resetTheme();
    });
    
    // Listen for store-related events if using Flux architecture
    if (window.AppEventBus) {
      window.AppEventBus.on('APP_INITIALIZED', () => {
        // Re-emit current theme to ensure all components are in sync
        emitEvent('themeChanged', { 
          theme: currentTheme,
          effectiveTheme: getEffectiveTheme(),
          isDark: isDarkMode(),
          isHighContrast: isHighContrast()
        });
      });
    }
  }
  
  /**
   * Load theme from storage or use system preference
   */
  function loadSavedTheme() {
    try {
      const savedTheme = localStorage.getItem(config.themeStorageKey);
      
      if (savedTheme && config.themes.includes(savedTheme)) {
        currentTheme = savedTheme;
      } else {
        // Default to system theme if no saved preference
        currentTheme = config.defaultTheme;
      }
      
      // Update UI elements
      updateToggleButtonText(currentTheme);
      
      if (elements.themeSelect) {
        elements.themeSelect.value = currentTheme;
      }
      
    } catch (error) {
      console.error('Error loading theme preference:', error);
      // Fall back to system theme
      currentTheme = config.defaultTheme;
    }
  }
  
  /**
   * Load accent color from storage
   */
  function loadSavedAccentColor() {
    try {
      const savedAccentColor = localStorage.getItem(config.accentColorStorageKey);
      
      if (savedAccentColor && config.accentColors.includes(savedAccentColor)) {
        currentAccentColor = savedAccentColor;
      } else {
        currentAccentColor = config.defaultAccentColor;
      }
      
      // Update color picker if it exists
      if (elements.accentColorPicker) {
        elements.accentColorPicker.value = currentAccentColor;
      }
      
    } catch (error) {
      console.error('Error loading accent color preference:', error);
      currentAccentColor = config.defaultAccentColor;
    }
  }
  
  /**
   * Load custom theme from storage
   */
  function loadCustomTheme() {
    try {
      const savedCustomTheme = localStorage.getItem(config.customThemeStorageKey);
      
      if (savedCustomTheme) {
        const parsed = JSON.parse(savedCustomTheme);
        customTheme = {
          light: { ...defaultCustomTheme, ...parsed.light },
          dark: { ...defaultCustomDarkTheme, ...parsed.dark }
        };
      }
    } catch (error) {
      console.error('Error loading custom theme:', error);
      // Reset to defaults
      customTheme = {
        light: { ...defaultCustomTheme },
        dark: { ...defaultCustomDarkTheme }
      };
    }
  }
  
  /**
   * Apply theme to document
   * @param {string} theme - Theme to apply
   */
  function applyTheme(theme) {
    // Use View Transitions API if supported
    if (viewTransitionsSupported && transitionsEnabled) {
      document.startViewTransition(() => performThemeChange(theme));
    } else {
      performThemeChange(theme);
    }
  }
  
  /**
   * Perform theme change (internal method)
   * @param {string} theme - Theme to apply
   */
  function performThemeChange(theme) {
    // Special handling for system theme
    if (theme === 'system') {
      const systemTheme = detectSystemTheme();
      applySystemTheme(systemTheme);
    } 
    // High contrast theme
    else if (theme === 'high-contrast') {
      document.body.classList.add(config.darkModeClass);
      document.body.classList.add(config.highContrastClass);
    }
    // Dark theme
    else if (theme === 'dark') {
      document.body.classList.add(config.darkModeClass);
      document.body.classList.remove(config.highContrastClass);
    }
    // Custom theme
    else if (theme === 'custom') {
      document.body.classList.add('custom-theme');
      // Apply custom theme variables
      applyCustomTheme(isDarkMode() ? 'dark' : 'light');
    }
    // Light theme (default)
    else {
      document.body.classList.remove(config.darkModeClass);
      document.body.classList.remove(config.highContrastClass);
      document.body.classList.remove('custom-theme');
    }
    
    // Set data attribute for CSS selectors
    config.rootElement.setAttribute(config.themeDataAttribute, theme);
    
    // Update color scheme meta tag for PWA
    const metaTag = document.getElementById(config.colorSchemeMetaTag);
    if (metaTag) {
      metaTag.content = isDarkMode() ? 'dark' : 'light';
    }
    
    // Emit theme change event
    emitEvent('themeChanged', { 
      theme,
      effectiveTheme: getEffectiveTheme(),
      isDark: isDarkMode(),
      isHighContrast: isHighContrast()
    });
  }
  
  /**
   * Apply system theme based on user preference
   * @param {string} systemTheme - Detected system theme ('dark' or 'light')
   */
  function applySystemTheme(systemTheme) {
    // Apply appropriate theme
    if (systemTheme === 'dark') {
      document.body.classList.add(config.darkModeClass);
    } else {
      document.body.classList.remove(config.darkModeClass);
    }
    
    // Check for high contrast mode
    if (detectHighContrastPreference()) {
      document.body.classList.add(config.highContrastClass);
    } else {
      document.body.classList.remove(config.highContrastClass);
    }
    
    // Remove custom theme when using system theme
    document.body.classList.remove('custom-theme');
    
    // Update toggle button text
    updateToggleButtonText('system');
  }
  
  /**
   * Apply custom theme variables
   * @param {string} mode - 'light' or 'dark'
   */
  function applyCustomTheme(mode) {
    const variables = customTheme[mode] || (mode === 'dark' ? defaultCustomDarkTheme : defaultCustomTheme);
    
    // Apply CSS variables to root
    Object.entries(variables).forEach(([key, value]) => {
      config.rootElement.style.setProperty(`${config.customThemePrefix}${key}`, value);
    });
  }
  
  /**
   * Apply accent color theme
   * @param {string} color - Color name
   */
  function applyAccentColor(color) {
    // Remove existing color classes
    config.accentColors.forEach(c => {
      config.rootElement.classList.remove(`accent-${c}`);
    });
    
    // Add new color class
    config.rootElement.classList.add(`accent-${color}`);
    
    // Emit color change event
    emitEvent('accentColorChanged', { color });
  }
  
  /**
   * Set theme and save preference
   * @param {string} theme - Theme to set
   */
  function setTheme(theme) {
    if (!config.themes.includes(theme)) {
      console.error(`Invalid theme: ${theme}. Allowed values: ${config.themes.join(', ')}`);
      return;
    }
    
    // Update current theme
    currentTheme = theme;
    
    // Save preference
    try {
      localStorage.setItem(config.themeStorageKey, theme);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
    
    // Apply theme
    applyTheme(theme);
    
    // Update UI
    updateToggleButtonText(theme);
    
    if (elements.themeSelect) {
      elements.themeSelect.value = theme;
    }
    
    // Update visibility of custom theme controls
    if (elements.customThemeControls) {
      elements.customThemeControls.style.display = 
        theme === 'custom' ? 'block' : 'none';
    }
    
    // Notify state management if using Flux/Redux
    if (window.AppStore?.dispatch) {
      window.AppStore.dispatch({
        type: 'THEME_CHANGED',
        payload: {
          theme,
          effectiveTheme: getEffectiveTheme(),
          isDark: isDarkMode(),
          isHighContrast: isHighContrast()
        }
      });
    }
    
    return publicAPI;
  }
  
  /**
   * Set accent color and save preference
   * @param {string} color - Color to set
   */
  function setAccentColor(color) {
    if (!config.accentColors.includes(color)) {
      console.error(`Invalid accent color: ${color}. Allowed values: ${config.accentColors.join(', ')}`);
      return;
    }
    
    // Update current accent color
    currentAccentColor = color;
    
    // Save preference
    try {
      localStorage.setItem(config.accentColorStorageKey, color);
    } catch (error) {
      console.error('Error saving accent color preference:', error);
    }
    
    // Apply accent color
    applyAccentColor(color);
    
    // Update UI
    if (elements.accentColorPicker) {
      elements.accentColorPicker.value = color;
    }
    
    // Notify state management if using Flux/Redux
    if (window.AppStore?.dispatch) {
      window.AppStore.dispatch({
        type: 'ACCENT_COLOR_CHANGED',
        payload: { accentColor: color }
      });
    }
    
    return publicAPI;
  }
  
  /**
   * Update a custom theme property
   * @param {string} property - The CSS property name
   * @param {string} value - The value to set
   * @param {string} mode - 'light' or 'dark'
   */
  function updateCustomThemeProperty(property, value, mode = 'light') {
    if (!customTheme[mode]) {
      customTheme[mode] = mode === 'dark' ? { ...defaultCustomDarkTheme } : { ...defaultCustomTheme };
    }
    
    // Update the property
    customTheme[mode][property] = value;
    
    // If we're currently using custom theme, apply the change immediately
    if (currentTheme === 'custom') {
      const isCurrentModeDark = isDarkMode();
      if ((isCurrentModeDark && mode === 'dark') || (!isCurrentModeDark && mode === 'light')) {
        config.rootElement.style.setProperty(`${config.customThemePrefix}${property}`, value);
      }
    }
    
    // Save to localStorage
    try {
      localStorage.setItem(config.customThemeStorageKey, JSON.stringify(customTheme));
    } catch (error) {
      console.error('Error saving custom theme:', error);
    }
    
    // Emit event
    emitEvent('customThemeChanged', { property, value, mode, customTheme });
    
    return publicAPI;
  }
  
  /**
   * Reset theme settings to defaults
   */
  function resetTheme() {
    // Reset to defaults
    currentTheme = config.defaultTheme;
    currentAccentColor = config.defaultAccentColor;
    customTheme = {
      light: { ...defaultCustomTheme },
      dark: { ...defaultCustomDarkTheme }
    };
    
    // Remove saved preferences
    try {
      localStorage.removeItem(config.themeStorageKey);
      localStorage.removeItem(config.accentColorStorageKey);
      localStorage.removeItem(config.customThemeStorageKey);
    } catch (error) {
      console.error('Error removing theme preferences:', error);
    }
    
    // Apply default theme and accent color
    applyTheme(currentTheme);
    applyAccentColor(currentAccentColor);
    
    // Update UI
    updateToggleButtonText(currentTheme);
    
    if (elements.themeSelect) {
      elements.themeSelect.value = currentTheme;
    }
    
    if (elements.accentColorPicker) {
      elements.accentColorPicker.value = currentAccentColor;
    }
    
    // Emit reset event
    emitEvent('themeReset', {});
    
    return publicAPI;
  }
  
  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    // For system theme, toggle based on current state
    if (currentTheme === 'system') {
      setTheme(document.body.classList.contains(config.darkModeClass) ? 'light' : 'dark');
      return;
    }
    
    // For custom theme, toggle between light and dark variant
    if (currentTheme === 'custom') {
      document.body.classList.toggle(config.darkModeClass);
      applyCustomTheme(isDarkMode() ? 'dark' : 'light');
      updateToggleButtonText('custom');
      
      // Emit event for the toggle
      emitEvent('themeToggled', { 
        theme: 'custom',
        isDark: isDarkMode()
      });
      return;
    }
    
    // For dark theme, switch to light
    if (currentTheme === 'dark' || currentTheme === 'high-contrast') {
      setTheme('light');
      return;
    }
    
    // For light theme, switch to dark
    setTheme('dark');
  }
  
  /**
   * Detect system theme preference
   * @returns {string} - 'dark' or 'light'
   */
  function detectSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  /**
   * Detect high contrast preference
   * @returns {boolean} - Whether high contrast is preferred
   */
  function detectHighContrastPreference() {
    if ('matchMedia' in window) {
      // Check for specific high contrast modes
      return window.matchMedia('(prefers-contrast: more)').matches || 
             window.matchMedia('(-ms-high-contrast: active)').matches;
    }
    return false;
  }
  
  /**
   * Handle system theme preference change
   * @param {MediaQueryListEvent} event - Media query change event
   */
  function handleSystemPreferenceChange(event) {
    // Only update if using system theme
    if (currentTheme === 'system') {
      applySystemTheme(event.matches ? 'dark' : 'light');
    }
  }
  
  /**
   * Handle contrast preference change
   * @param {MediaQueryListEvent} event - Media query change event
   */
  function handleContrastPreferenceChange(event) {
    // Only update if using system theme
    if (currentTheme === 'system') {
      if (event.matches) {
        document.body.classList.add(config.highContrastClass);
      } else {
        document.body.classList.remove(config.highContrastClass);
      }
    }
  }
  
  /**
   * Update theme toggle button text
   * @param {string} theme - Current theme
   */
  function updateToggleButtonText(theme) {
    if (!elements.toggleText) return;
    
    // Special handling for system theme
    if (theme === 'system') {
      const systemTheme = detectSystemTheme();
      elements.toggleText.textContent = systemTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }
    // For custom theme
    else if (theme === 'custom') {
      elements.toggleText.textContent = isDarkMode() ? 'Light Mode' : 'Dark Mode';
    }
    // For explicit themes
    else {
      elements.toggleText.textContent = (theme === 'dark' || theme === 'high-contrast') 
        ? 'Light Mode' 
        : 'Dark Mode';
    }
  }
  
  /**
   * Disable theme transitions temporarily
   */
  function disableTransitions() {
    if (!transitionsEnabled) return;
    
    config.rootElement.classList.add('disable-transitions');
    transitionsEnabled = false;
  }
  
  /**
   * Re-enable theme transitions
   */
  function enableTransitions() {
    if (transitionsEnabled) return;
    
    config.rootElement.classList.remove('disable-transitions');
    transitionsEnabled = true;
  }
  
  /**
   * Subscribe to theme events
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} - Unsubscribe function
   */
  function on(event, callback) {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    
    eventListeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      if (eventListeners.has(event)) {
        eventListeners.get(event).delete(callback);
      }
    };
  }
  
  /**
   * Emit theme event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  function emitEvent(event, data) {
    if (eventListeners.has(event)) {
      eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in theme ${event} event handler:`, error);
        }
      });
    }
    
    // Dispatch DOM event for broader integration
    document.dispatchEvent(new CustomEvent(`theme:${event}`, { 
      detail: data,
      bubbles: true 
    }));
    
    // Integrate with EventBus if available (for Flux architecture)
    if (window.AppEventBus?.emit) {
      window.AppEventBus.emit(`THEME_${event.toUpperCase()}`, data);
    }
  }
  
  /**
   * Get current theme
   * @returns {string} - Current theme
   */
  function getTheme() {
    return currentTheme;
  }
  
  /**
   * Get effective theme (resolved system preference)
   * @returns {string} - Effective theme ('light', 'dark', 'high-contrast', 'custom')
   */
  function getEffectiveTheme() {
    if (currentTheme === 'system') {
      const systemTheme = detectSystemTheme();
      if (systemTheme === 'dark' && detectHighContrastPreference()) {
        return 'high-contrast';
      }
      return systemTheme;
    }
    return currentTheme;
  }
  
  /**
   * Get current accent color
   * @returns {string} - Current accent color
   */
  function getAccentColor() {
    return currentAccentColor;
  }
  
  /**
   * Check if dark mode is active
   * @returns {boolean} - Whether dark mode is active
   */
  function isDarkMode() {
    return document.body.classList.contains(config.darkModeClass);
  }
  
  /**
   * Check if high contrast mode is active
   * @returns {boolean} - Whether high contrast mode is active
   */
  function isHighContrast() {
    return document.body.classList.contains(config.highContrastClass);
  }
  
  /**
   * Get custom theme data
   * @returns {Object} - Custom theme data
   */
  function getCustomTheme() {
    return { ...customTheme };
  }
  
  /**
   * Set entire custom theme
   * @param {Object} theme - Custom theme object with light and dark variants
   */
  function setCustomTheme(theme) {
    if (!theme || typeof theme !== 'object') return;
    
    // Merge with defaults for safety
    customTheme = {
      light: { ...defaultCustomTheme, ...(theme.light || {}) },
      dark: { ...defaultCustomDarkTheme, ...(theme.dark || {}) }
    };
    
    // Save to localStorage
    try {
      localStorage.setItem(config.customThemeStorageKey, JSON.stringify(customTheme));
    } catch (error) {
      console.error('Error saving custom theme:', error);
    }
    
    // Apply if we're currently using custom theme
    if (currentTheme === 'custom') {
      applyCustomTheme(isDarkMode() ? 'dark' : 'light');
    }
    
    // Emit event
    emitEvent('customThemeChanged', { customTheme });
    
    return publicAPI;
  }
  
  // Public API
  const publicAPI = {
    init,
    setTheme,
    getTheme,
    getEffectiveTheme,
    toggleTheme,
    setAccentColor,
    getAccentColor,
    isDarkMode,
    isHighContrast,
    resetTheme,
    on,
    // Custom theme functionality
    getCustomTheme,
    setCustomTheme,
    updateCustomThemeProperty
  };
  
  return publicAPI;
})();

/**
* Legacy function for backward compatibility
* @deprecated Use ThemeManager.init() instead
*/
function initTheme() {
console.warn('initTheme() is deprecated, use ThemeManager.init() instead');
return ThemeManager.init();
}

// Safely handle process.env in browser context
if (typeof process === 'undefined' || !process.env) {
window.process = { env: { NODE_ENV: 'production' } };
}

// Auto-initialize if document is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
ThemeManager.init();
} else {
// Otherwise wait for DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
});
}

// Export for module usage if supported
if (typeof module !== 'undefined' && module.exports) {
module.exports = ThemeManager;
}

// Make globally available
window.ThemeManager = ThemeManager;

// Export as ES module
export default ThemeManager;