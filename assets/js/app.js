/**
 * ClaudeChat Application Core
 * 
 * A sophisticated AI chat application with advanced features, including:
 * - Modular architecture using the Observer pattern
 * - Streaming responses with incremental UI updates
 * - Context-aware conversation handling with state persistence
 * - Advanced file handling with multiple upload methods
 * - Comprehensive error recovery and network resilience
 * - Performance optimizations with virtualized rendering
 * - Keyboard shortcuts and accessibility features
 * - Analytics and telemetry integration
 * - Developer tools and debugging support
 */

// Application namespace to avoid global pollution
const ClaudeApp = (() => {
    // Private app state store with Proxy-based reactive system
    const createStore = (initialState) => {
      const listeners = new Map();
      
      // Create observable state with proxy
      const state = new Proxy({ ...initialState }, {
        set(target, property, value) {
          const oldValue = target[property];
          target[property] = value;
          
          // Only notify if value actually changed
          if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
            // Notify listeners for specific property
            if (listeners.has(property)) {
              listeners.get(property).forEach(listener => 
                listener(value, oldValue, property)
              );
            }
            
            // Notify global state listeners
            if (listeners.has('*')) {
              listeners.get('*').forEach(listener => 
                listener({ [property]: value }, { [property]: oldValue }, 'update')
              );
            }
          }
          return true;
        },
        
        deleteProperty(target, property) {
          if (property in target) {
            const oldValue = target[property];
            delete target[property];
            
            // Notify property listeners
            if (listeners.has(property)) {
              listeners.get(property).forEach(listener => 
                listener(undefined, oldValue, property)
              );
            }
            
            // Notify global listeners
            if (listeners.has('*')) {
              listeners.get('*').forEach(listener => 
                listener({}, { [property]: oldValue }, 'delete')
              );
            }
          }
          return true;
        }
      });
      
      return {
        // Get current state (use sparingly, prefer subscribing)
        getState: () => ({ ...state }),
        
        // Update state (immutable style for predictability)
        setState: (updater) => {
          const newState = typeof updater === 'function' 
            ? updater(state) 
            : updater;
            
          Object.entries(newState).forEach(([key, value]) => {
            state[key] = value;
          });
        },
        
        // Subscribe to state changes for specific property or all ('*')
        subscribe: (property, callback) => {
          if (!listeners.has(property)) {
            listeners.set(property, new Set());
          }
          
          listeners.get(property).add(callback);
          
          // Return unsubscribe function
          return () => listeners.get(property).delete(callback);
        }
      };
    };
  
    // Core application components encapsulated in modules
    const app = {
      // System-wide constants and configuration
      config: {
        API_VERSION: '2023-06-01',
        DEFAULT_MODEL: 'claude-3-7-sonnet-20250219',
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        DEBOUNCE_DELAY: 300,
        AUTO_SAVE_INTERVAL: 5000,
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000,
        CONNECTION_CHECK_URL: 'https://www.anthropic.com/favicon.ico',
        ANALYTICS_ENABLED: false,
        DEBUG_MODE: false
      },
      
      // Session-specific data
      session: {
        startTime: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        connectionStatus: 'online',
        deviceInfo: {
          isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          pixelRatio: window.devicePixelRatio || 1,
          platform: navigator.platform,
          darkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        }
      },
      
      // Initialize all application components
      init: async function() {
        console.log(`ClaudeChat initializing | ${new Date().toISOString()}`);
        console.time('App Initialization');
  
        try {
          // Create reactive state store with initial values
          this.store = createStore({
            isProcessing: false,
            attachedFiles: [],
            conversationId: this.utils.generateUniqueId(),
            currentChat: null,
            chats: [],
            messages: [],
            preferences: {},
            networkStatus: 'online',
            streamingResponse: null,
            unreadCount: 0,
            messageQueue: [],
            selectedMessages: new Set(),
            lastError: null,
            lastSaved: null
          });
  
          // Initialize core modules in dependency order
          await this.storage.init();
          await this.preferences.init();
          await this.services.init();
          
          // Initialize rendering components
          this.ui.init();
          this.handlers.init();
          
          // Load chats after UI is ready
          await this.conversations.init();
          
          // Set up system-wide event handlers
          this.setupSystemHandlers();
          
          // Check API key and show welcome or continue chat
          await this.checkApiKey();
  
          // Emit initialization complete event
          this.events.emit('app:initialized');
          console.timeEnd('App Initialization');
        } catch (error) {
          console.error('Initialization failed:', error);
          this.handleFatalError(error);
        }
      },
      
      // Set up system handlers for app-wide events
      setupSystemHandlers: function() {
        // Online/offline detection
        window.addEventListener('online', () => {
          this.store.setState({ networkStatus: 'online' });
          this.events.emit('network:online');
          this.ui.showToast({
            title: 'Connection Restored',
            message: 'You are back online.',
            type: 'success',
            duration: 3000
          });
          
          // Process any pending messages in queue
          this.processPendingMessages();
        });
        
        window.addEventListener('offline', () => {
          this.store.setState({ networkStatus: 'offline' });
          this.events.emit('network:offline');
          this.ui.showToast({
            title: 'Connection Lost',
            message: 'Working offline. Messages will be sent when connection is restored.',
            type: 'warning',
            duration: 0
          });
        });
        
        // Visibility change to update seen status
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.store.setState({ unreadCount: 0 });
            this.events.emit('chat:seen');
          }
        });
        
        // Auto-save chats periodically
        this.autoSaveInterval = setInterval(() => {
          if (this.store.getState().currentChat && 
              this.store.getState().lastSaved < Date.now() - this.config.AUTO_SAVE_INTERVAL) {
            this.conversations.saveCurrentChat();
          }
        }, this.config.AUTO_SAVE_INTERVAL);
        
        // Prevent accidental navigation away during processing
        window.addEventListener('beforeunload', (event) => {
          if (this.store.getState().isProcessing) {
            event.preventDefault();
            event.returnValue = 'Changes you made may not be saved. Are you sure you want to leave?';
          }
        });
        
        // Resize handler for responsive adjustments
        const debouncedResize = this.utils.debounce(() => {
          this.session.deviceInfo.screenWidth = window.innerWidth;
          this.session.deviceInfo.screenHeight = window.innerHeight;
          this.events.emit('window:resize', { 
            width: window.innerWidth, 
            height: window.innerHeight 
          });
        }, 200);
        
        window.addEventListener('resize', debouncedResize);
        
        // Error monitoring subscription
        this.store.subscribe('lastError', (error) => {
          if (error) {
            if (this.config.DEBUG_MODE) {
              console.group('Error Detected');
              console.error(error);
              console.groupEnd();
            }
            
            // Only show toast for user-facing errors
            if (error.userFacing) {
              this.ui.showToast({
                title: error.title || 'Error',
                message: error.message || 'Something went wrong.',
                type: 'error',
                duration: error.duration || 5000
              });
            }
          }
        });
        
        // Activity tracking for session analytics
        const trackActivity = this.utils.debounce(() => {
          this.session.lastActivity = Date.now();
          this.events.emit('user:activity');
        }, 1000);
        
        ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
          document.addEventListener(event, trackActivity, { passive: true });
        });
      },
      
      // Check for API key and determine next steps
      checkApiKey: async function() {
        const settings = await this.preferences.getAll();
        
        if (!settings.apiKey) {
          // No API key found, show welcome screen with settings
          this.ui.showWelcomeScreen();
          
          setTimeout(() => {
            this.ui.openSettings();
            this.ui.showToast({
              title: 'API Key Required',
              message: 'Please set your Anthropic API key to start using the app.',
              type: 'warning',
              duration: 0
            });
          }, 500);
        } else {
          // API key exists, check if we're continuing a chat or showing welcome
          const { currentChat } = this.store.getState();
          
          if (currentChat) {
            this.ui.hideWelcomeScreen();
            this.ui.renderChatMessages(currentChat.messages);
          } else {
            this.ui.showWelcomeScreen();
          }
        }
      },
      
      // Handle unrecoverable errors
      handleFatalError: function(error) {
        console.error('Fatal error:', error);
        
        // Show error screen with recovery options
        const errorHTML = `
          <div class="error-screen">
            <h2>Something went wrong</h2>
            <p>We encountered a problem while starting the application.</p>
            <div class="error-details">
              <code>${error.message || 'Unknown error'}</code>
            </div>
            <div class="error-actions">
              <button id="reloadApp" class="btn-primary">Reload Application</button>
              <button id="resetData" class="btn-secondary">Reset App Data</button>
            </div>
          </div>
        `;
        
        document.body.innerHTML = errorHTML;
        
        // Set up recovery buttons
        document.getElementById('reloadApp').addEventListener('click', () => {
          window.location.reload();
        });
        
        document.getElementById('resetData').addEventListener('click', () => {
          if (confirm('This will delete all your chats and settings. Continue?')) {
            this.storage.clearAll().then(() => {
              window.location.reload();
            }).catch(e => {
              alert('Failed to clear data. Try clearing browser data manually.');
            });
          }
        });
      },
      
      // Process any queued messages after reconnecting
      processPendingMessages: function() {
        const { messageQueue } = this.store.getState();
        
        if (messageQueue.length > 0) {
          this.ui.showToast({
            title: 'Sending Messages',
            message: `Sending ${messageQueue.length} pending message(s)...`,
            type: 'info',
            duration: 3000
          });
          
          // Process each message in order
          messageQueue.forEach(msg => {
            this.conversations.sendMessage(msg.content, msg.options);
          });
          
          // Clear the queue
          this.store.setState({ messageQueue: [] });
        }
      }
    };
  
    // ================================================================
    // UI Module - Handles all user interface interactions and rendering
    // ================================================================
    app.ui = {
      // Cached DOM references
      elements: {},
      
      // UI State
      state: {
        darkMode: false,
        sidebarVisible: false,
        settingsOpen: false,
        streamingMessage: null,
        lastScrollPosition: 0,
        resizeObserver: null,
        intersectionObserver: null,
        contentEditable: false
      },
      
      // Initialize UI components
      init: function() {
        console.log('UI initializing...');
        
        // Cache DOM references
        this.cacheElements();
        
        // Initialize observers
        this.initObservers();
        
        // Set initial theme based on system preference
        this.initTheme();
        
        // Initialize keyboard shortcuts
        this.initKeyboardShortcuts();
        
        // Set up message observers for lazy loading
        this.setupMessageObservers();
        
        console.log('UI initialization complete');
      },
      
      // Cache all DOM elements for performance
      cacheElements: function() {
        // Main containers
        ['chatContainer', 'welcomeScreen', 'settingsPanel', 'sidebar', 'overlay', 
         'userInput', 'sendButton', 'attachButton', 'fileUpload', 'toastContainer',
         'newChatBtn', 'menuBtn', 'closeSidebarBtn', 'chatHistory'].forEach(id => {
          this.elements[id] = document.getElementById(id);
        });
        
        // Example prompts
        this.elements.examplePrompts = document.querySelectorAll('.example-prompt');
        
        // Create toast container if it doesn't exist
        if (!this.elements.toastContainer) {
          const toastContainer = document.createElement('div');
          toastContainer.id = 'toastContainer';
          toastContainer.className = 'toast-container';
          document.body.appendChild(toastContainer);
          this.elements.toastContainer = toastContainer;
        }
      },
      
      // Initialize observers for responsive design
      initObservers: function() {
        // Resize observer for responsive adjustments
        if ('ResizeObserver' in window) {
          this.state.resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
              if (entry.target === this.elements.chatContainer) {
                // Update scroll position after resize
                this.maintainScrollPosition();
              }
            }
          });
          
          if (this.elements.chatContainer) {
            this.state.resizeObserver.observe(this.elements.chatContainer);
          }
        }
        
        // Mutation observer to detect theme changes
        this.themeMutationObserver = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            if (mutation.attributeName === 'class' && 
                mutation.target === document.body &&
                mutation.target.classList.contains('dark-theme') !== this.state.darkMode) {
              this.state.darkMode = mutation.target.classList.contains('dark-theme');
              app.events.emit('theme:changed', { darkMode: this.state.darkMode });
            }
          });
        });
        
        this.themeMutationObserver.observe(document.body, { attributes: true });
      },
      
      // Set up message visibility observer for lazy loading
      setupMessageObservers: function() {
        // Create intersection observer for messages
        if ('IntersectionObserver' in window) {
          this.state.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const messageEl = entry.target;
                
                // Load lazy content like images
                this.loadLazyContent(messageEl);
                
                // Apply visible class for animations
                messageEl.classList.add('visible');
                
                // Mark as read if it's an assistant message
                if (messageEl.classList.contains('assistant') && 
                    messageEl.dataset.read !== 'true') {
                  messageEl.dataset.read = 'true';
                  app.events.emit('message:read', { id: messageEl.dataset.id });
                }
              }
            });
          }, { 
            root: this.elements.chatContainer,
            threshold: 0.1,
            rootMargin: '100px'
          });
        }
      },
      
      // Initialize theme based on preference or system default
      initTheme: function() {
        // Check for saved preference
        const savedTheme = localStorage.getItem('theme');
        
        if (savedTheme === 'dark' || 
           (savedTheme !== 'light' && 
            window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.body.classList.add('dark-theme');
          this.state.darkMode = true;
        } else {
          document.body.classList.remove('dark-theme');
          this.state.darkMode = false;
        }
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          if (localStorage.getItem('theme') !== 'light' && 
              localStorage.getItem('theme') !== 'dark') {
            // Only auto-switch if user hasn't set a preference
            if (e.matches) {
              document.body.classList.add('dark-theme');
              this.state.darkMode = true;
            } else {
              document.body.classList.remove('dark-theme');
              this.state.darkMode = false;
            }
            app.events.emit('theme:changed', { darkMode: this.state.darkMode });
          }
        });
      },
      
      // Initialize keyboard shortcuts
      initKeyboardShortcuts: function() {
        document.addEventListener('keydown', (e) => {
          // Don't trigger shortcuts when typing in input fields
          if (e.target.tagName === 'INPUT' || 
              e.target.tagName === 'TEXTAREA' || 
              e.target.contentEditable === 'true') {
            return;
          }
          
          switch (e.key) {
            case '/':
              // Focus search/input
              e.preventDefault();
              this.focusInput();
              break;
            case 'Escape':
              // Close panels
              if (this.state.settingsOpen) {
                this.closeSettings();
                e.preventDefault();
              } else if (this.state.sidebarVisible && window.innerWidth <= 768) {
                this.closeSidebar();
                e.preventDefault();
              }
              break;
            case 'n':
              // New chat (Ctrl+n or Cmd+n)
              if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                app.events.emit('chat:new');
              }
              break;
            case ',':
              // Open settings (Ctrl+, or Cmd+,)
              if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                this.openSettings();
              }
              break;
            case '?':
              // Show keyboard shortcuts help
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                this.showKeyboardShortcuts();
              }
              break;
          }
        });
      },
      
      // Show keyboard shortcuts help dialog
      showKeyboardShortcuts: function() {
        const shortcuts = [
          { key: '/', description: 'Focus the message input' },
          { key: 'Esc', description: 'Close panels or dialogs' },
          { key: 'Ctrl+N', description: 'Create a new chat' },
          { key: 'Ctrl+,', description: 'Open settings panel' },
          { key: '?', description: 'Show this help dialog' },
          { key: '↑/↓', description: 'Navigate through message history (when input is focused)' }
        ];
        
        let shortcutsHTML = '<div class="shortcuts-dialog">';
        shortcutsHTML += '<h3>Keyboard Shortcuts</h3>';
        shortcutsHTML += '<table><tbody>';
        
        shortcuts.forEach(shortcut => {
          shortcutsHTML += `
            <tr>
              <td><kbd>${shortcut.key}</kbd></td>
              <td>${shortcut.description}</td>
            </tr>
          `;
        });
        
        shortcutsHTML += '</tbody></table></div>';
        
        this.showModal({
          title: 'Keyboard Shortcuts',
          content: shortcutsHTML,
          cancelText: null,
          confirmText: 'Close'
        });
      },
      
      // Show welcome screen
      showWelcomeScreen: function() {
        if (this.elements.welcomeScreen) {
          this.elements.welcomeScreen.classList.add('active');
          
          // Set up example prompt handlers if not already done
          this.elements.examplePrompts.forEach(button => {
            button.onclick = () => {
              if (this.elements.userInput) {
                this.elements.userInput.value = button.textContent;
                this.elements.userInput.dispatchEvent(new Event('input'));
                this.elements.welcomeScreen.classList.remove('active');
                this.focusInput();
              }
            };
          });
        }
      },
      
      // Hide welcome screen
      hideWelcomeScreen: function() {
        if (this.elements.welcomeScreen) {
          this.elements.welcomeScreen.classList.remove('active');
        }
      },
      
      // Open settings panel
      openSettings: function() {
        if (this.elements.settingsPanel && this.elements.overlay) {
          this.elements.settingsPanel.classList.add('open');
          this.elements.overlay.classList.add('open');
          this.state.settingsOpen = true;
          
          app.events.emit('settings:opened');
        }
      },
      
      // Close settings panel
      closeSettings: function() {
        if (this.elements.settingsPanel && this.elements.overlay) {
          this.elements.settingsPanel.classList.remove('open');
          if (!this.state.sidebarVisible) {
            this.elements.overlay.classList.remove('open');
          }
          this.state.settingsOpen = false;
          
          app.events.emit('settings:closed');
        }
      },
      
      // Open sidebar on mobile
      openSidebar: function() {
        if (this.elements.sidebar && this.elements.overlay) {
          this.elements.sidebar.classList.add('open');
          this.elements.overlay.classList.add('open');
          this.state.sidebarVisible = true;
          
          app.events.emit('sidebar:opened');
        }
      },
      
      // Close sidebar on mobile
      closeSidebar: function() {
        if (this.elements.sidebar && this.elements.overlay) {
          this.elements.sidebar.classList.remove('open');
          if (!this.state.settingsOpen) {
            this.elements.overlay.classList.remove('open');
          }
          this.state.sidebarVisible = false;
          
          app.events.emit('sidebar:closed');
        }
      },
      
      // Focus the input field
      focusInput: function() {
        if (this.elements.userInput) {
          this.elements.userInput.focus();
          
          // If mobile, make sure the message input is in view
          if (app.session.deviceInfo.isMobile) {
            setTimeout(() => {
              this.elements.userInput.scrollIntoView({ behavior: 'smooth' });
            }, 300);
          }
        }
      },
      
      // Maintain scroll position when chat container changes
      maintainScrollPosition: function() {
        if (!this.elements.chatContainer) return;
        
        const { scrollHeight, clientHeight, scrollTop } = this.elements.chatContainer;
        const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 30;
        
        if (isScrolledToBottom) {
          requestAnimationFrame(() => {
            this.scrollToBottom();
          });
        }
      },
      
      // Scroll chat to bottom with smooth animation
      scrollToBottom: function(smooth = true) {
        if (!this.elements.chatContainer) return;
        
        requestAnimationFrame(() => {
          this.elements.chatContainer.scrollTo({
            top: this.elements.chatContainer.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
          });
        });
      },
      
      // Lazy load content in visible messages
      loadLazyContent: function(messageEl) {
        if (!messageEl) return;
        
        // Lazy load images
        messageEl.querySelectorAll('img[data-src]').forEach(img => {
          if (!img.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            
            // Add loaded class when image loads
            img.onload = () => img.classList.add('loaded');
          }
        });
        
        // Apply syntax highlighting to code blocks
        messageEl.querySelectorAll('pre code').forEach(codeBlock => {
          if (!codeBlock.classList.contains('highlighted') && 
              typeof window.hljs !== 'undefined') {
            window.hljs.highlightElement(codeBlock);
            codeBlock.classList.add('highlighted');
          }
        });
      },
      
      // Show a toast notification
      showToast: function({ title, message, type = 'info', duration = 3000, actions = [] }) {
        if (!this.elements.toastContainer) return;
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        
        // Build toast content
        let toastHTML = `
          <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
          </div>
        `;
        
        // Add action buttons if provided
        if (actions.length > 0) {
          toastHTML += `<div class="toast-actions">`;
          actions.forEach(action => {
            toastHTML += `<button class="toast-action" data-action="${action.id}">${action.text}</button>`;
          });
          toastHTML += `</div>`;
        }
        
        // Add close button
        toastHTML += `
          <button class="toast-close" aria-label="Close notification">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;
        
        toast.innerHTML = toastHTML;
        
        // Set up close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
          this.dismissToast(toast);
        });
        
        // Set up action buttons
        actions.forEach(action => {
          const actionBtn = toast.querySelector(`[data-action="${action.id}"]`);
          if (actionBtn) {
            actionBtn.addEventListener('click', () => {
              action.handler();
              this.dismissToast(toast);
            });
          }
        });
        
        // Add to container with animation
        this.elements.toastContainer.appendChild(toast);
        
        // Use RAF to trigger entrance animation
        requestAnimationFrame(() => {
          toast.classList.add('visible');
        });
        
        // Auto-dismiss after duration (if not 0)
        if (duration > 0) {
          setTimeout(() => {
            this.dismissToast(toast);
          }, duration);
        }
        
        // Return the toast element for potential manipulation
        return toast;
      },
      
      // Dismiss toast notification with animation
      dismissToast: function(toast) {
        if (!toast) return;
        
        // Add exit animation
        toast.classList.add('closing');
        
        // Remove after animation completes
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      },
      
      // Show a modal dialog
      showModal: function({ title, content, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, size = 'medium' }) {
        // Create modal element
        const modal = document.createElement('div');
        modal.className = `modal-container ${size}`;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'modal-title');
        
        // Create modal HTML
        modal.innerHTML = `
          <div class="modal-overlay"></div>
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="modal-title">${title}</h3>
              <button class="modal-close" aria-label="Close modal">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="modal-body">${content}</div>
            <div class="modal-footer">
              ${cancelText ? `<button class="modal-button cancel">${cancelText}</button>` : ''}
              ${confirmText ? `<button class="modal-button confirm">${confirmText}</button>` : ''}
            </div>
          </div>
        `;
        
        // Add to document
        document.body.appendChild(modal);
        
        // Prevent body scrolling
        document.body.classList.add('modal-open');
        
        // Set up event handlers
        const closeModal = () => {
          // Add exit animation
          modal.classList.add('closing');
          
          // Remove modal after animation
          setTimeout(() => {
            document.body.removeChild(modal);
            document.body.classList.remove('modal-open');
          }, 300);
        };
        
        // Close button
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
          if (onCancel) onCancel();
          closeModal();
        });
        
        // Confirm button
        const confirmBtn = modal.querySelector('.modal-button.confirm');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            closeModal();
          });
        }
        
        // Cancel button
        const cancelBtn = modal.querySelector('.modal-button.cancel');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            if (onCancel) onCancel();
            closeModal();
          });
        }
        
        // Close on overlay click
        const overlay = modal.querySelector('.modal-overlay');
        overlay.addEventListener('click', () => {
          if (onCancel) onCancel();
          closeModal();
        });
        
        // Close on Escape key
        const escHandler = (e) => {
          if (e.key === 'Escape') {
            if (onCancel) onCancel();
            closeModal();
            document.removeEventListener('keydown', escHandler);
          }
        };
        
        document.addEventListener('keydown', escHandler);
        
        // Focus the first button
        if (confirmBtn) {
          requestAnimationFrame(() => {
            confirmBtn.focus();
          });
        } else if (cancelBtn) {
          requestAnimationFrame(() => {
            cancelBtn.focus();
          });
        }
        
        // Use RAF to trigger entrance animation
        requestAnimationFrame(() => {
          modal.classList.add('visible');
        });
        
        // Return modal control object
        return {
          close: closeModal,
          element: modal
        };
      },
      
      // Render chat messages from array
      renderChatMessages: function(messages) {
        if (!this.elements.chatContainer || !messages?.length) return;
        
        // Clear existing messages
        this.elements.chatContainer.innerHTML = '';
        
        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();
        let lastDate = null;
        let lastRole = null;
        
        // Add messages to fragment
        messages.forEach((message, index) => {
          // Check if we need a date header
          const messageDate = new Date(message.timestamp || Date.now()).toDateString();
          if (lastDate !== messageDate) {
            const dateHeader = this.createDateHeader(message.timestamp || Date.now());
            fragment.appendChild(dateHeader);
            lastDate = messageDate;
            lastRole = null; // Reset role grouping when date changes
          }
          
          // Determine if this message should be grouped with previous
          const shouldGroup = lastRole === message.role;
          
          // Create message element
          const messageEl = this.createMessageElement(message, { 
            groupWithPrevious: shouldGroup 
          });
          
          fragment.appendChild(messageEl);
          lastRole = message.role;
        });
        
        // Add fragment to container
        this.elements.chatContainer.appendChild(fragment);
        
        // Scroll to bottom by default
        this.scrollToBottom(false);
        
        // Observe messages for intersection
        if (this.state.intersectionObserver) {
          this.elements.chatContainer.querySelectorAll('.message').forEach(msg => {
            this.state.intersectionObserver.observe(msg);
          });
        }
        
        app.events.emit('chat:rendered');
      },
      
      // Add a single message to the chat
      addMessage: function(message, options = {}) {
        if (!this.elements.chatContainer) return null;
        
        const {
          animate = true,
          groupWithPrevious = false,
          scrollIntoView = true,
          prepend = false,
          isStreaming = false
        } = options;
        
        // Hide welcome screen if visible
        this.hideWelcomeScreen();
        
        const messageDate = new Date(message.timestamp || Date.now()).toDateString();
        let lastDate = null;
        
        // Check if we need a date header
        if (!groupWithPrevious) {
          const lastDateHeader = this.elements.chatContainer.querySelector('.date-header:last-child');
          if (lastDateHeader) {
            lastDate = new Date(parseInt(lastDateHeader.dataset.timestamp)).toDateString();
          }
          
          if (lastDate !== messageDate) {
            const dateHeader = this.createDateHeader(message.timestamp || Date.now());
            
            if (prepend) {
              this.elements.chatContainer.prepend(dateHeader);
            } else {
              this.elements.chatContainer.appendChild(dateHeader);
            }
          }
        }
        
        // Determine if this should be grouped with previous message
        let shouldGroup = groupWithPrevious;
        if (!shouldGroup) {
          const lastMessage = this.elements.chatContainer.querySelector('.message:last-child');
          if (lastMessage && lastMessage.dataset.role === message.role) {
            shouldGroup = true;
          }
        }
        
        // Create message element
        const messageEl = this.createMessageElement(message, {
          groupWithPrevious: shouldGroup,
          animate,
          isStreaming
        });
        
        // Add to container
        if (prepend) {
          this.elements.chatContainer.prepend(messageEl);
        } else {
          this.elements.chatContainer.appendChild(messageEl);
        }
        
        // Observe for intersection
        if (this.state.intersectionObserver) {
          this.state.intersectionObserver.observe(messageEl);
        }
        
        // Scroll into view if requested
        if (scrollIntoView) {
          this.scrollToBottom();
        }
        
        // If streaming, track it
        if (isStreaming) {
          this.state.streamingMessage = messageEl;
        }
        
        // Emit message added event
        app.events.emit('message:added', { message, element: messageEl });
        
        return messageEl;
      },
      
      // Update streaming message content
      updateStreamingMessage: function(content, finished = false) {
        if (!this.state.streamingMessage) return;
        
        const contentEl = this.state.streamingMessage.querySelector('.message-content');
        if (contentEl) {
          contentEl.innerHTML = this.processMessageContent(content);
          
          // Apply syntax highlighting to code blocks
          contentEl.querySelectorAll('pre code').forEach(block => {
            if (!block.classList.contains('highlighted') && 
                typeof window.hljs !== 'undefined') {
              window.hljs.highlightElement(block);
              block.classList.add('highlighted');
            }
          });
          
          // Add action buttons to code blocks
          this.enhanceCodeBlocks(contentEl);
        }
        
        // If finished, add finishing touches
        if (finished) {
          this.state.streamingMessage.classList.remove('streaming');
          
          // Add message actions
          this.addMessageActions(this.state.streamingMessage);
          
          // Clean up state
          this.state.streamingMessage = null;
        }
      },
      
      // Create a new message element
      createMessageElement: function(message, options = {}) {
        const {
          groupWithPrevious = false,
          animate = true,
          isStreaming = false
        } = options;
        
        // Generate message ID if not provided
        const messageId = message.id || app.utils.generateUniqueId('msg');
        
        // Create message container
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role} ${animate ? 'animate' : ''} ${isStreaming ? 'streaming' : ''}`;
        messageDiv.dataset.messageId = messageId;
        messageDiv.dataset.role = message.role;
        messageDiv.dataset.timestamp = message.timestamp || Date.now();
        
        // Add unique ID for references
        messageDiv.id = `message-${messageId}`;
        
        // Add accessibility attributes
        messageDiv.setAttribute('role', 'article');
        messageDiv.setAttribute('tabindex', '0');
        messageDiv.setAttribute('aria-label', `${message.role === 'human' ? 'You' : 'Claude'}: ${message.content?.substring(0, 50)}${message.content?.length > 50 ? '...' : ''}`);
        
        // Create message header if not grouped
        if (!groupWithPrevious) {
          const headerDiv = document.createElement('div');
          headerDiv.className = 'message-header';
          
          // Add avatar
          const avatarDiv = document.createElement('div');
          avatarDiv.className = 'message-avatar';
          
          // Different avatar for human vs assistant
          if (message.role === 'human') {
            avatarDiv.innerHTML = `<div class="user-avatar"></div>`;
          } else {
            avatarDiv.innerHTML = `<div class="assistant-avatar"></div>`;
          }
          
          // Role name and timestamp
          const roleAndTime = document.createElement('div');
          roleAndTime.className = 'role-and-time';
          
          const roleName = document.createElement('span');
          roleName.className = 'role-name';
          roleName.textContent = message.role === 'human' ? 'You' : 'Claude';
          
          const timestamp = document.createElement('span');
          timestamp.className = 'message-timestamp';
          timestamp.dataset.timestamp = message.timestamp || Date.now();
          timestamp.textContent = app.utils.formatTimestamp(message.timestamp || Date.now());
          timestamp.title = new Date(message.timestamp || Date.now()).toLocaleString();
          
          roleAndTime.appendChild(roleName);
          roleAndTime.appendChild(timestamp);
          
          // Assemble header
          headerDiv.appendChild(avatarDiv);
          headerDiv.appendChild(roleAndTime);
          messageDiv.appendChild(headerDiv);
        } else {
          // If grouped, add the grouped class
          messageDiv.classList.add('grouped');
        }
        
        // Create message content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Process message content
        contentDiv.innerHTML = this.processMessageContent(message.content);
        
        // Add file attachments if any
        if (message.files?.length > 0) {
          const attachmentsDiv = document.createElement('div');
          attachmentsDiv.className = 'message-attachments';
          
          // Add each attachment
          message.files.forEach((file, index) => {
            const attachmentDiv = document.createElement('div');
            attachmentDiv.className = 'attachment';
            
            // Create attachment title
            const attachmentTitle = document.createElement('div');
            attachmentTitle.className = 'attachment-title';
            attachmentTitle.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>${file.name}</span>
            `;
            
            attachmentDiv.appendChild(attachmentTitle);
            
            // Add file content based on type
            if (file.type === 'image') {
              const imgContainer = document.createElement('div');
              imgContainer.className = 'image-attachment';
              imgContainer.appendChild(file.element);
              attachmentDiv.appendChild(imgContainer);
            } else {
              const fileContent = document.createElement('div');
              fileContent.className = 'file-content';
              fileContent.textContent = file.content;
              attachmentDiv.appendChild(fileContent);
            }
            
            attachmentsDiv.appendChild(attachmentDiv);
          });
          
          contentDiv.appendChild(attachmentsDiv);
        }
        
        messageDiv.appendChild(contentDiv);
        
        // Add message actions if not streaming
        if (!isStreaming) {
          this.addMessageActions(messageDiv);
        }
        
        // Enhance code blocks with copy/download buttons
        this.enhanceCodeBlocks(contentDiv);
        
        return messageDiv;
      },
      
      // Add action buttons to message
      addMessageActions: function(messageEl) {
        if (!messageEl) return;
        
        const role = messageEl.dataset.role;
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        // Add appropriate actions based on role
        if (role === 'human') {
          actionsDiv.innerHTML = `
            <button class="message-action" data-action="edit" aria-label="Edit message">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          `;
        } else if (role === 'assistant') {
          actionsDiv.innerHTML = `
            <button class="message-action" data-action="copy" aria-label="Copy message">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="message-action" data-action="regenerate" aria-label="Regenerate response">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
            </button>
          `;
        }
        
        // Add event listeners for action buttons
        actionsDiv.querySelectorAll('.message-action').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const action = btn.dataset.action;
            const messageId = messageEl.dataset.messageId;
            
            switch (action) {
              case 'edit':
                app.events.emit('message:edit', { messageId });
                break;
              case 'copy':
                this.copyMessageToClipboard(messageEl);
                break;
              case 'regenerate':
                app.events.emit('message:regenerate', { messageId });
                break;
            }
            
            e.stopPropagation();
          });
        });
        
        messageEl.appendChild(actionsDiv);
      },
      
      // Process message content to format it properly
      processMessageContent: function(content) {
        if (!content) return '';
        
        let processed = app.utils.escapeHtml(content);
        
        // Process code blocks with filename
        processed = processed.replace(/```([\w-]*)\s*?name=(\S+)?\n([\s\S]*?)```/g, (match, language, name, code) => {
          const escapedCode = app.utils.escapeHtml(code);
          const langClass = language ? ` class="language-${language}"` : '';
          const langLabel = language ? `<div class="code-language">${language}${name ? ` | ${name}` : ''}</div>` : '';
          
          return `<div class="code-block-wrapper">${langLabel}<pre data-filename="${name || ''}" data-language="${language || ''}"><code${langClass}>${escapedCode}</code></pre></div>`;
        });
        
        // Process code blocks without filename
        processed = processed.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, language, code) => {
          const escapedCode = app.utils.escapeHtml(code);
          const langClass = language ? ` class="language-${language}"` : '';
          const langLabel = language ? `<div class="code-language">${language}</div>` : '';
          
          return `<div class="code-block-wrapper">${langLabel}<pre data-language="${language || ''}"><code${langClass}>${escapedCode}</code></pre></div>`;
        });
        
        // Process inline code
        processed = processed.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        
        // Process bold text
        processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Process italic text
        processed = processed.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
        processed = processed.replace(/_([^_\n]+)_/g, '<em>$1</em>');
        
        // Convert URLs to links
        processed = processed.replace(
          /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
          '<a href="$1" target="_blank" rel="noopener noreferrer" class="external-link">$1</a>'
        );
        
        // Process line breaks
        processed = processed.replace(/\n/g, '<br>');
        
        return processed;
      },
      
      // Enhance code blocks with copy and download buttons
      enhanceCodeBlocks: function(container) {
        if (!container) return;
        
        // Find all code blocks that haven't been enhanced yet
        const codeBlocks = container.querySelectorAll('pre:not([data-enhanced])');
        
        codeBlocks.forEach((block, index) => {
          // Mark as enhanced
          block.setAttribute('data-enhanced', 'true');
          
          // Get code content and language
          const codeElement = block.querySelector('code');
          if (!codeElement) return;
          
          const codeContent = codeElement.textContent || '';
          const language = block.getAttribute('data-language') || '';
          const fileName = block.getAttribute('data-filename') || `code-${index + 1}.${app.utils.getFileExtension(language)}`;
          
          // Create actions container
          const actionsContainer = document.createElement('div');
          actionsContainer.className = 'code-actions';
          
          // Create copy button
          const copyButton = document.createElement('button');
          copyButton.className = 'code-action copy-btn';
          copyButton.setAttribute('aria-label', 'Copy code');
          copyButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          `;
          
          copyButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Copy code to clipboard
            navigator.clipboard.writeText(codeContent).then(() => {
              // Show success state
              const originalText = copyButton.querySelector('span').textContent;
              copyButton.classList.add('success');
              copyButton.querySelector('span').textContent = 'Copied!';
              
              // Reset after delay
              setTimeout(() => {
                copyButton.classList.remove('success');
                copyButton.querySelector('span').textContent = originalText;
              }, 2000);
            });
          });
          
          // Create download button
          const downloadButton = document.createElement('button');
          downloadButton.className = 'code-action download-btn';
          downloadButton.setAttribute('aria-label', `Download as ${fileName}`);
          downloadButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>${fileName}</span>
          `;
          
          downloadButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Create and trigger download
            const blob = new Blob([codeContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            setTimeout(() => {
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }, 100);
          });
          
          // Add buttons to actions container
          actionsContainer.appendChild(copyButton);
          actionsContainer.appendChild(downloadButton);
          
          // Add actions container to code block parent
          const wrapper = block.closest('.code-block-wrapper') || block.parentElement;
          if (wrapper) {
            wrapper.insertBefore(actionsContainer, wrapper.firstChild);
          } else {
            const newWrapper = document.createElement('div');
            newWrapper.className = 'code-block-wrapper';
            block.parentNode.insertBefore(newWrapper, block);
            newWrapper.appendChild(actionsContainer);
            newWrapper.appendChild(block);
          }
        });
      },
      
      // Create a date header element
      createDateHeader: function(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Format the date
        let dateText;
        if (date.toDateString() === now.toDateString()) {
          dateText = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
          dateText = 'Yesterday';
        } else {
          dateText = date.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
          });
        }
        
        // Create date header element
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.dataset.timestamp = timestamp;
        dateHeader.dataset.date = date.toDateString();
        dateHeader.setAttribute('role', 'separator');
        
        const dateSpan = document.createElement('span');
        dateSpan.textContent = dateText;
        dateHeader.appendChild(dateSpan);
        
        return dateHeader;
      },
      
      // Add a thinking indicator
      addThinkingIndicator: function() {
        // Remove any existing indicator first
        this.removeThinkingIndicator();
        
        if (!this.elements.chatContainer) return;
        
        // Create thinking indicator
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-indicator';
        thinkingDiv.id = 'thinkingIndicator';
        thinkingDiv.setAttribute('role', 'status');
        thinkingDiv.setAttribute('aria-live', 'polite');
        
        // Add assistant avatar
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'thinking-avatar';
        avatarDiv.innerHTML = `<div class="assistant-avatar"></div>`;
        thinkingDiv.appendChild(avatarDiv);
        
        // Add thinking text with animated dots
        const thinkingContent = document.createElement('div');
        thinkingContent.className = 'thinking-content';
        thinkingContent.innerHTML = `
          <span class="thinking-text">Claude is thinking</span>
          <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
        `;
        thinkingDiv.appendChild(thinkingContent);
        
        // Add to chat container
        this.elements.chatContainer.appendChild(thinkingDiv);
        
        // Scroll to make indicator visible
        this.scrollToBottom();
        
        // Announce to screen readers
        this.announceToScreenReaders('Claude is thinking');
        
        app.events.emit('thinking:started');
      },
      
      // Remove thinking indicator
      removeThinkingIndicator: function() {
        const thinkingDiv = document.getElementById('thinkingIndicator');
        if (!thinkingDiv) return;
        
        // Add exit animation class
        thinkingDiv.classList.add('removing');
        
        // Remove after animation completes
        setTimeout(() => {
          if (thinkingDiv.parentNode) {
            thinkingDiv.parentNode.removeChild(thinkingDiv);
            app.events.emit('thinking:stopped');
          }
        }, 300);
      },
      
      // Copy message content to clipboard
      copyMessageToClipboard: function(messageEl) {
        if (!messageEl) return;
        
        const messageContent = messageEl.querySelector('.message-content');
        if (messageContent) {
          // Strip HTML tags to get plain text
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = messageContent.innerHTML;
          
          // Get text content, preserving line breaks
          const textContent = this.getTextContentWithBreaks(tempDiv);
          
          // Copy to clipboard
          navigator.clipboard.writeText(textContent)
            .then(() => {
              this.showToast({
                title: 'Copied to clipboard',
                message: 'Message content copied successfully.',
                type: 'success',
                duration: 2000
              });
            })
            .catch(err => {
              console.error('Failed to copy text: ', err);
              this.showToast({
                title: 'Copy failed',
                message: 'Could not copy message content.',
                type: 'error',
                duration: 3000
              });
            });
        }
      },
      
      // Get text content while preserving line breaks
      getTextContentWithBreaks: function(element) {
        let text = '';
        
        for (let node of element.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.nodeName === 'BR') {
              text += '\n';
            } else if (node.nodeName === 'P' || 
                      node.nodeName === 'DIV' || 
                      node.nodeName === 'H1' || 
                      node.nodeName === 'H2' || 
                      node.nodeName === 'H3' || 
                      node.nodeName === 'H4' || 
                      node.nodeName === 'H5' || 
                      node.nodeName === 'H6' || 
                      window.getComputedStyle(node).display === 'block') {
              const childText = this.getTextContentWithBreaks(node);
              text += (text && !text.endsWith('\n') ? '\n' : '') + childText + '\n';
            } else if (node.nodeName === 'PRE') {
              const code = node.querySelector('code');
              if (code) {
                text += '\n```\n' + code.textContent + '\n```\n';
              } else {
                text += '\n' + node.textContent + '\n';
              }
            } else {
              text += this.getTextContentWithBreaks(node);
            }
          }
        }
        
        return text;
      },
      
      // Announce message to screen readers
      announceToScreenReaders: function(message) {
        // Create or update the live region
        let liveRegion = document.getElementById('sr-live-region');
        if (!liveRegion) {
          liveRegion = document.createElement('div');
          liveRegion.id = 'sr-live-region';
          liveRegion.className = 'sr-only';
          liveRegion.setAttribute('aria-live', 'polite');
          liveRegion.setAttribute('aria-atomic', 'true');
          document.body.appendChild(liveRegion);
        }
        
        // Update the content after a small delay to ensure it's announced
        setTimeout(() => {
          liveRegion.textContent = message;
        }, 100);
      },
      
      // Update chat history UI in sidebar
      updateChatHistoryUI: function(chats) {
        if (!this.elements.chatHistory) return;
        
        // Clear current list
        this.elements.chatHistory.innerHTML = '';
        
        // Show empty state if no chats
        if (!chats || chats.length === 0) {
          const emptyItem = document.createElement('li');
          emptyItem.className = 'empty-history';
          emptyItem.textContent = 'No chat history yet';
          this.elements.chatHistory.appendChild(emptyItem);
          return;
        }
        
        // Add chats to list
        chats.forEach(chat => {
          const listItem = this.createChatHistoryItem(chat);
          this.elements.chatHistory.appendChild(listItem);
        });
      },
      
      // Create a chat history item for the sidebar
      createChatHistoryItem: function(chat) {
        const currentChatId = app.store.getState().currentChat?.id;
        const isActive = chat.id === currentChatId;
        
        const listItem = document.createElement('li');
        listItem.dataset.chatId = chat.id;
        
        // Create button for the list item
        const chatButton = document.createElement('button');
        chatButton.className = isActive ? 'active' : '';
        chatButton.setAttribute('aria-current', isActive ? 'true' : 'false');
        
              // Add chat icon
      const chatIcon = document.createElement('span');
      chatIcon.className = 'chat-history-icon';
      chatIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      
      // Add chat text
      const chatText = document.createElement('span');
      chatText.className = 'chat-history-text';
      
      // Format title - use first message content or default name
      let title = chat.title || 'New Chat';
      if (!chat.title && chat.messages && chat.messages.length > 0) {
        const firstMessage = chat.messages.find(m => m.role === 'human');
        if (firstMessage) {
          title = firstMessage.content.substring(0, 30);
          if (firstMessage.content.length > 30) title += '...';
        }
      }
      
      chatText.textContent = title;
      chatText.setAttribute('title', title);
      
      // Add timestamp
      const timestampEl = document.createElement('span');
      timestampEl.className = 'chat-history-time';
      const timestamp = new Date(chat.updatedAt || chat.createdAt);
      timestampEl.textContent = app.utils.formatRelativeTime(timestamp);
      timestampEl.title = timestamp.toLocaleString();
      
      // Add actions container
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'chat-history-actions';
      
      // Add delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'chat-history-action';
      deleteBtn.setAttribute('aria-label', 'Delete chat');
      deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      
      // Handle delete click
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        this.showModal({
          title: 'Delete Chat',
          content: `<p>Are you sure you want to delete "${title}"? This action cannot be undone.</p>`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          onConfirm: () => {
            // Add exit animation
            listItem.classList.add('removing');
            
            setTimeout(() => {
              app.events.emit('chat:delete', { chatId: chat.id });
            }, 300);
          }
        });
      });
      
      // Assemble elements
      actionsContainer.appendChild(deleteBtn);
      chatButton.appendChild(chatIcon);
      chatButton.appendChild(chatText);
      chatButton.appendChild(timestampEl);
      chatButton.appendChild(actionsContainer);
      
      // Handle click to load chat
      chatButton.addEventListener('click', () => {
        app.events.emit('chat:load', { chatId: chat.id });
      });
      
      listItem.appendChild(chatButton);
      return listItem;
    }
  };

  // ===============================================================
  // Events System - Centralized event bus for application components
  // ===============================================================
  app.events = {
    listeners: new Map(),
    
    // Initialize events system
    init: function() {
      console.log('Events system initializing...');
      
      // Set up default listeners
      this.setupDefaultListeners();
      
      console.log('Events system initialized');
    },
    
    // Set up default event handlers
    setupDefaultListeners: function() {
      // App lifecycle events
      this.on('app:initialized', () => {
        console.log('Application initialized');
      });
      
      // Error handling
      this.on('error', ({ error, context }) => {
        console.error(`Error in ${context || 'unknown context'}:`, error);
        
        // Update application state with error details
        app.store.setState({ 
          lastError: {
            message: error.message,
            context,
            timestamp: Date.now(),
            userFacing: true
          }
        });
      });
      
      // Network status changes
      this.on('network:online', () => {
        app.services.checkConnectivity();
      });
    },
    
    // Subscribe to an event
    on: function(eventName, callback) {
      if (!this.listeners.has(eventName)) {
        this.listeners.set(eventName, new Set());
      }
      
      this.listeners.get(eventName).add(callback);
      
      // Return unsubscribe function
      return () => {
        if (this.listeners.has(eventName)) {
          this.listeners.get(eventName).delete(callback);
        }
      };
    },
    
    // Subscribe to an event once
    once: function(eventName, callback) {
      const onceWrapper = (...args) => {
        this.off(eventName, onceWrapper);
        callback(...args);
      };
      
      return this.on(eventName, onceWrapper);
    },
    
    // Unsubscribe from an event
    off: function(eventName, callback) {
      if (this.listeners.has(eventName)) {
        if (callback) {
          this.listeners.get(eventName).delete(callback);
        } else {
          // Remove all listeners for this event
          this.listeners.delete(eventName);
        }
      }
    },
    
    // Emit an event
    emit: function(eventName, data = {}) {
      if (app.config.DEBUG_MODE) {
        console.log(`Event: ${eventName}`, data);
      }
      
      // Call all listeners for this event
      if (this.listeners.has(eventName)) {
        this.listeners.get(eventName).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in event listener for ${eventName}:`, error);
          }
        });
      }
      
      // Also emit to wildcard listeners
      if (this.listeners.has('*')) {
        this.listeners.get('*').forEach(callback => {
          try {
            callback({ event: eventName, data });
          } catch (error) {
            console.error(`Error in wildcard event listener for ${eventName}:`, error);
          }
        });
      }
    }
  };

  // ===============================================================
  // Storage Module - Handles persistent storage and data management
  // ===============================================================
  app.storage = {
    // Initialize storage system
    init: async function() {
      console.log('Storage system initializing...');
      
      // Test storage availability
      this.available = await this.testStorage();
      
      if (!this.available) {
        console.warn('LocalStorage not available, using in-memory storage');
        this.memoryStore = new Map();
      }
      
      console.log('Storage system initialized');
      return true;
    },
    
    // Test if storage is available
    testStorage: async function() {
      try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, testKey);
        const result = localStorage.getItem(testKey) === testKey;
        localStorage.removeItem(testKey);
        return result;
      } catch (e) {
        return false;
      }
    },
    
    // Get item from storage with fallbacks
    getItem: function(key, defaultValue = null) {
      try {
        if (!this.available) {
          return this.memoryStore.has(key) ? JSON.parse(this.memoryStore.get(key)) : defaultValue;
        }
        
        const value = localStorage.getItem(key);
        return value !== null ? JSON.parse(value) : defaultValue;
      } catch (error) {
        console.error(`Error retrieving ${key} from storage:`, error);
        return defaultValue;
      }
    },
    
    // Set item in storage with error handling
    setItem: function(key, value) {
      try {
        const serialized = JSON.stringify(value);
        
        if (!this.available) {
          this.memoryStore.set(key, serialized);
          return true;
        }
        
        localStorage.setItem(key, serialized);
        return true;
      } catch (error) {
        console.error(`Error saving ${key} to storage:`, error);
        
        // Try to store with reduced data if quota exceeded
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          return this.handleStorageQuotaError(key, value);
        }
        
        return false;
      }
    },
    
    // Remove item from storage
    removeItem: function(key) {
      try {
        if (!this.available) {
          return this.memoryStore.delete(key);
        }
        
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error(`Error removing ${key} from storage:`, error);
        return false;
      }
    },
    
    // Clear all storage
    clearAll: async function() {
      try {
        if (!this.available) {
          this.memoryStore.clear();
          return true;
        }
        
        localStorage.clear();
        return true;
      } catch (error) {
        console.error('Error clearing storage:', error);
        return false;
      }
    },
    
    // Handle storage quota exceeded errors
    handleStorageQuotaError: function(key, value) {
      // For chat history, try removing oldest chats
      if (key === 'aiAssistantChats') {
        try {
          const chats = Array.isArray(value) ? value : [];
          
          if (chats.length > 10) {
            // Keep only the 10 most recent chats
            const recentChats = chats
              .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
              .slice(0, 10);
            
            return this.setItem(key, recentChats);
          }
        } catch (e) {
          console.error('Failed to handle storage quota for chats:', e);
        }
      }
      
      return false;
    }
  };

  // ===============================================================
  // Preferences Module - Manages user preferences and settings
  // ===============================================================
  app.preferences = {
    // Default user preferences
    defaults: {
      apiKey: '',
      model: 'claude-3-7-sonnet-20250219',
      temperature: 0.7,
      thinkingBudget: 10240,
      maxTokens: 4096,
      messagesToKeep: 20,
      autoScroll: true,
      soundEffects: false,
      theme: 'system',
      codeHighlighting: true,
      promptHistory: true,
      markdownRendering: true,
      useMockResponses: false
    },
    
    // Currently loaded preferences
    current: {},
    
    // Initialize preferences module
    init: async function() {
      console.log('Preferences module initializing...');
      
      // Load user preferences
      await this.load();
      
      // Apply loaded preferences
      this.apply();
      
      // Set up event subscriptions
      app.events.on('settings:saved', () => this.save());
      
      console.log('Preferences module initialized');
      return true;
    },
    
    // Load preferences from storage
    load: async function() {
      // Get saved preferences
      const saved = app.storage.getItem('aiAssistantSettings', {});
      
      // Merge with defaults, ensuring all properties exist
      this.current = Object.fromEntries(
        Object.entries(this.defaults).map(([key, defaultValue]) => [
          key, 
          key in saved && typeof saved[key] === typeof defaultValue 
            ? saved[key] 
            : defaultValue
        ])
      );
      
      return this.current;
    },
    
    // Save preferences to storage
    save: function() {
      return app.storage.setItem('aiAssistantSettings', this.current);
    },
    
    // Apply preferences to the application
    apply: function() {
      // Apply theme preference
      if (this.current.theme === 'dark') {
        document.body.classList.add('dark-theme');
      } else if (this.current.theme === 'light') {
        document.body.classList.remove('dark-theme');
      } // Otherwise leave as system preference
      
      // Apply other appropriate preferences to UI
      // (code highlighting, markdown rendering, etc.)
      document.body.classList.toggle('code-highlight-disabled', !this.current.codeHighlighting);
      document.body.classList.toggle('markdown-disabled', !this.current.markdownRendering);
      
      // Update store with current preferences
      app.store.setState({ preferences: { ...this.current } });
      
      app.events.emit('preferences:applied', this.current);
    },
    
    // Get a specific preference
    get: function(key) {
      return key in this.current ? this.current[key] : this.defaults[key];
    },
    
    // Get all preferences
    getAll: function() {
      return { ...this.current };
    },
    
    // Update a specific preference
    set: function(key, value) {
      if (!(key in this.defaults)) {
        console.warn(`Attempting to set unknown preference: ${key}`);
      }
      
      // Update preference
      this.current[key] = value;
      
      // Save to storage
      this.save();
      
      // Apply changes
      this.apply();
      
      // Emit change event
      app.events.emit('preferences:changed', { 
        key, 
        value, 
        preferences: this.current 
      });
      
      return true;
    },
    
    // Update multiple preferences at once
    setMultiple: function(updates) {
      // Update preferences
      Object.entries(updates).forEach(([key, value]) => {
        if (key in this.defaults) {
          this.current[key] = value;
        } else {
          console.warn(`Attempting to set unknown preference: ${key}`);
        }
      });
      
      // Save to storage
      this.save();
      
      // Apply changes
      this.apply();
      
      // Emit change event
      app.events.emit('preferences:changed', { 
        updates, 
        preferences: this.current 
      });
      
      return true;
    },
    
    // Reset all preferences to defaults
    reset: function() {
      this.current = { ...this.defaults };
      this.save();
      this.apply();
      
      app.events.emit('preferences:reset', this.current);
      
      return true;
    }
  };

  // ===============================================================
  // Services Module - External service integrations
  // ===============================================================
  app.services = {
    // Service status tracking
    status: {
      api: 'unknown',
      connectivity: navigator.onLine ? 'online' : 'offline'
    },
    
    // Initialize services module
    init: async function() {
      console.log('Services module initializing...');
      
      // Check API connectivity if online
      if (navigator.onLine) {
        this.checkConnectivity();
      }
      
      console.log('Services module initialized');
      return true;
    },
    
    // Check internet connectivity
    checkConnectivity: async function() {
      try {
        // Attempt to fetch a small resource to test connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(app.config.CONNECTION_CHECK_URL, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        this.status.connectivity = 'online';
        
        app.events.emit('connectivity:online');
        return true;
      } catch (error) {
        if (error.name === 'AbortError') {
          this.status.connectivity = 'timeout';
        } else {
          this.status.connectivity = 'offline';
        }
        
        app.events.emit('connectivity:offline');
        return false;
      }
    },
    
    // Call Claude API
    callClaude: async function(messages, options = {}) {
      const settings = app.preferences.getAll();
      const {
        streaming = false,
        onProgress = null,
        retryCount = 0
      } = options;
      
      // Enable mock responses for testing or when offline
      if (settings.useMockResponses || this.status.connectivity === 'offline') {
        return this.generateMockResponse(messages);
      }
      
      try {
        // Prepare API payload
        const payload = {
          model: options.model || settings.model,
          messages,
          temperature: options.temperature || settings.temperature,
          max_tokens: options.maxTokens || settings.maxTokens
        };
        
        // Add thinking mode settings if enabled
        if (options.thinkingMode !== false) {
          payload.thinking = {
            type: "extended",
            budget_tokens: options.thinkingBudget || settings.thinkingBudget
          };
        }
        
        // Set up streaming if requested
        if (streaming) {
          payload.stream = true;
        }
        
        // Set up request options with API key
        const requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.apiKey,
            'anthropic-version': app.config.API_VERSION
          },
          body: JSON.stringify(payload)
        };
        
        // Make API request
        const response = await fetch('https://api.anthropic.com/v1/messages', requestOptions);
        
        // Handle unsuccessful response
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || response.statusText || 'API request failed');
        }
        
        // Update API status
        this.status.api = 'ok';
        
        // Handle streaming response
        if (streaming && response.body) {
          return this.handleStreamingResponse(response.body, onProgress);
        }
        
        // Return standard JSON response
        const data = await response.json();
        return data;
        
      } catch (error) {
        console.error('API request error:', error);
        
        // Update API status
        this.status.api = 'error';
        
        // Handle rate limiting and retries
        if (error.message?.includes('rate_limit') && retryCount < app.config.MAX_RETRIES) {
          console.log(`Rate limited, retrying in ${app.config.RETRY_DELAY}ms (attempt ${retryCount + 1})`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, app.config.RETRY_DELAY * (retryCount + 1)));
          
          // Retry the request with increased retry count
          return this.callClaude(messages, {
            ...options,
            retryCount: retryCount + 1
          });
        }
        
        // Rethrow for proper handling
        throw error;
      }
    },
    
    // Handle streaming response
    handleStreamingResponse: async function(stream, onProgress) {
      const reader = stream.getReader();
      let fullContent = '';
      let messageId = null;
      
      try {
        while (true) {
          const { value, done } = await reader.read();
          
          if (done) {
            break;
          }
          
          // Decode chunk
          const chunk = new TextDecoder().decode(value);
          
          // Process events in chunk
          const events = chunk
            .split('\n')
            .filter(line => line.trim().startsWith('data: '))
            .map(line => {
              try {
                const jsonStr = line.substring(6); // Remove "data: " prefix
                if (jsonStr === '[DONE]') return { type: 'done' };
                return JSON.parse(jsonStr);
              } catch (e) {
                return null;
              }
            })
            .filter(Boolean);
          
          // Process each event
          for (const event of events) {
            // Store message ID when available
            if (event.message_id && !messageId) {
              messageId = event.message_id;
            }
            
            // Handle content block delta (new content)
            if (event.type === 'content_block_delta') {
              if (event.delta?.text) {
                fullContent += event.delta.text;
                if (onProgress) {
                  onProgress({
                    type: 'content',
                    content: fullContent,
                    delta: event.delta.text
                  });
                }
              }
            }
            
            // Handle message start
            if (event.type === 'message_start') {
              if (onProgress) {
                onProgress({
                  type: 'start',
                  message_id: event.message.id
                });
              }
            }
            
            // Handle message stop
            if (event.type === 'message_stop') {
              if (onProgress) {
                onProgress({
                  type: 'stop',
                  message_id: event.message_id
                });
              }
            }
          }
        }
        
        // Return final assembled response
        return {
          id: messageId || `gen_${Date.now()}`,
          content: fullContent,
          role: 'assistant',
          type: 'message'
        };
        
      } catch (error) {
        console.error('Error processing stream:', error);
        throw new Error('Failed to process streaming response: ' + error.message);
      } finally {
        reader.releaseLock();
      }
    },
    
    // Generate mock response (for testing or offline mode)
    generateMockResponse: function(messages) {
      // Get user message content
      const userContent = typeof messages[0].content === 'string' 
        ? messages[0].content 
        : messages[0].content?.find(c => c.type === 'text')?.text || 'No text content found';
      
      const mockResponses = [
        `I understand you're asking about "${userContent.substring(0, 50)}${userContent.length > 50 ? '...' : ''}". This is a simulated response because the app is currently in mock mode or offline. In a live environment, Claude would provide a helpful and detailed answer here.`,
        
        `Thanks for your message. I'm currently running in mock/offline mode, so I can't provide a real response to "${userContent.substring(0, 50)}${userContent.length > 50 ? '...' : ''}". Please check your internet connection or API settings to use the actual Claude API.`,
        
        `I notice you're asking about "${userContent.substring(0, 50)}${userContent.length > 50 ? '...' : ''}". I'm currently providing mock responses since the app is offline or in test mode. To get a real response, please ensure you're online and have configured your API key correctly.`
      ];
      
      // Add simulated delay
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            id: `mock_${Date.now()}`,
            content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
            role: 'assistant',
            model: app.preferences.get('model'),
            stop_reason: 'end_turn',
            type: 'message'
          });
        }, 1000);
      });
    }
  };

  // ===============================================================
  // Conversations Module - Manages chat conversations
  // ===============================================================
  app.conversations = {
    // Initialize conversations module
    init: async function() {
      console.log('Conversations module initializing...');
      
      // Load chat history
      const chats = await this.loadChats();
      
      // Update store with loaded chats
      app.store.setState({ chats });
      
      // Load last active chat if available
      await this.loadLastActiveChat();
      
      // Set up event subscriptions
      this.setupEventListeners();
      
      console.log('Conversations module initialized');
      return true;
    },
    
    // Set up event listeners for conversation events
    setupEventListeners: function() {
      // Listen for chat operations
      app.events.on('chat:new', () => this.createNewChat());
      app.events.on('chat:load', ({ chatId }) => this.loadChat(chatId));
      app.events.on('chat:delete', ({ chatId }) => this.deleteChat(chatId));
      
      // Message operations
      app.events.on('message:edit', ({ messageId }) => this.editMessage(messageId));
      app.events.on('message:regenerate', ({ messageId }) => this.regenerateMessage(messageId));
      
      // Auto-save changes periodically
      this.autoSaveInterval = setInterval(() => {
        const { currentChat } = app.store.getState();
        if (currentChat && currentChat.dirty) {
          this.saveCurrentChat();
        }
      }, 30000); // Save every 30 seconds if dirty
    },
    
    // Load saved chats from storage
    loadChats: async function() {
      const chats = app.storage.getItem('aiAssistantChats', []);
      return Array.isArray(chats) ? chats : [];
    },
    
    // Load the last active chat
    loadLastActiveChat: async function() {
      const { chats } = app.store.getState();
      const lastChatId = app.storage.getItem('lastActiveChatId');
      
      // If there's a last active chat ID and it exists in our chats, load it
      if (lastChatId && chats.find(chat => chat.id === lastChatId)) {
        await this.loadChat(lastChatId);
      } else if (chats.length > 0) {
        // Otherwise load the most recent chat
        await this.loadChat(chats[0].id);
      } else {
        // Or create a new chat if none exist
        await this.createNewChat();
      }
    },
    
    // Create a new chat
    createNewChat: function() {
      // Generate new chat object
      const newChat = {
        id: app.utils.generateUniqueId(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Update application state
      const { chats } = app.store.getState();
      app.store.setState({ 
        currentChat: newChat,
        conversationId: newChat.id,
        chats: [newChat, ...chats] 
      });
      
      // Set as last active
      app.storage.setItem('lastActiveChatId', newChat.id);
      
      // Save chats
      this.saveChats();
      
      // Update UI
      app.ui.updateChatHistoryUI(app.store.getState().chats);
      app.ui.renderChatMessages([]);
      
      // Show welcome screen
      app.ui.showWelcomeScreen();
      
      app.events.emit('chat:created', newChat);
      return newChat;
    },
    
    // Load a chat by ID
    loadChat: function(chatId) {
      const { chats } = app.store.getState();
      const chat = chats.find(c => c.id === chatId);
      
      if (!chat) {
        console.error(`Chat with ID ${chatId} not found`);
        return false;
      }
      
      // Update application state
      app.store.setState({ 
        currentChat: chat,
        conversationId: chat.id
      });
      
      // Set as last active
      app.storage.setItem('lastActiveChatId', chatId);
      
      // Update UI
      app.ui.hideWelcomeScreen();
      app.ui.renderChatMessages(chat.messages || []);
      app.ui.updateChatHistoryUI(chats);
      
      // On mobile, close sidebar after selection
      if (app.session.deviceInfo.isMobile) {
        app.ui.closeSidebar();
      }
      
      app.events.emit('chat:loaded', chat);
      return true;
    },
    
    // Delete a chat by ID
    deleteChat: function(chatId) {
      const { chats, currentChat } = app.store.getState();
      const updatedChats = chats.filter(chat => chat.id !== chatId);
      
      // Update storage
      app.storage.setItem('aiAssistantChats', updatedChats);
      
      // Update application state
      app.store.setState({ chats: updatedChats });
      
      // If deleting current chat, load another or create new one
      if (currentChat && currentChat.id === chatId) {
        if (updatedChats.length > 0) {
          this.loadChat(updatedChats[0].id);
        } else {
          this.createNewChat();
        }
      } else {
        // Just update UI
        app.ui.updateChatHistoryUI(updatedChats);
      }
      
      app.events.emit('chat:deleted', { chatId });
      return true;
    },
    
    // Save all chats to storage
    saveChats: function() {
      const { chats } = app.store.getState();
      return app.storage.setItem('aiAssistantChats', chats);
    },
    
    // Save current chat to storage and update chats array
    saveCurrentChat: function() {
      const { currentChat, chats } = app.store.getState();
      if (!currentChat) return false;
      
      // Update timestamp
      currentChat.updatedAt = new Date().toISOString();
      currentChat.dirty = false;
      
      // Find and update in chats array
      const updatedChats = chats.map(chat => 
        chat.id === currentChat.id ? currentChat : chat
      );
      
      // Update application state
      app.store.setState({ 
        currentChat,
        chats: updatedChats,
        lastSaved: Date.now()
      });
      
      // Save to storage
      return this.saveChats();
    },
    
    // Send a message and get AI response
    sendMessage: async function(content, options = {}) {
      const { currentChat } = app.store.getState();
      if (!currentChat) {
        console.error('No active chat to send message to');
        return false;
      }
      
      // Get preferences
      const preferences = app.preferences.getAll();
      
      // Prepare user message
      const userMessage = {
        id: app.utils.generateUniqueId('msg'),
        role: 'human',
        content: content,
        timestamp: Date.now()
      };
      
      // Add files if provided
      if (options.files && options.files.length > 0) {
        userMessage.files = options.files;
      }
      
      // Update UI with user message
      app.ui.addMessage(userMessage);
      
      // Add to chat history
      currentChat.messages = [...(currentChat.messages || []), userMessage];
      currentChat.dirty = true;
      
      // If this is a new chat, update the title
      if (currentChat.messages.length === 1) {
        currentChat.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        
        // Update chat list UI
        app.ui.updateChatHistoryUI(app.store.getState().chats);
      }
      
      // Save current chat state
      this.saveCurrentChat();
      
      // Clear input field and attachments
      if (options.clearInput && app.ui.elements.userInput) {
        app.ui.elements.userInput.value = '';
        app.ui.elements.userInput.style.height = 'auto';
      }
      
      // Update processing state
      app.store.setState({ isProcessing: true });
      
      // Show thinking indicator
      app.ui.addThinkingIndicator();
      
      try {
        // Prepare messages for API
        const apiMessages = this.prepareMessagesForAPI(currentChat.messages);
        
        // Make API call with streaming if enabled
        const response = await app.services.callClaude(apiMessages, {
          streaming: true,
          onProgress: (progressData) => {
            if (progressData.type === 'content') {
              app.ui.updateStreamingMessage(progressData.content, false);
            }
          }
        });
        
        // Remove thinking indicator
        app.ui.removeThinkingIndicator();
        
        // Create assistant message
        const assistantMessage = {
          id: response.id || app.utils.generateUniqueId('msg'),
          role: 'assistant',
          content: response.content,
          timestamp: Date.now()
        };
        
        // Add to chat history
        currentChat.messages = [...currentChat.messages, assistantMessage];
        currentChat.dirty = true;
        
        // Update UI with complete message and finished streaming
        app.ui.updateStreamingMessage(assistantMessage.content, true);
        
        // Save current chat state
        this.saveCurrentChat();
        
        // Emit event
        app.events.emit('message:received', { message: assistantMessage });
        
        return assistantMessage;
      } catch (error) {
        console.error('Failed to get response:', error);
        
        // Remove thinking indicator
        app.ui.removeThinkingIndicator();
        
        // Add error message
        const errorMessage = {
          id: app.utils.generateUniqueId('err'),
          role: 'assistant',
          content: `Error: ${error.message}. Please try again or check your settings.`,
          timestamp: Date.now(),
          isError: true
        };
        
        // Add to chat and UI
        app.ui.addMessage(errorMessage);
        currentChat.messages = [...currentChat.messages, errorMessage];
        currentChat.dirty = true;
        
        // Save current state
        this.saveCurrentChat();
        
        // Show error toast
        app.ui.showToast({
          title: 'API Error',
          message: error.message,
          type: 'error',
          duration: 5000
        });
        
        // Emit error event
        app.events.emit('message:error', { error });
        
        return false;
      } finally {
        // Clean up regardless of outcome
        app.store.setState({ isProcessing: false });
      }
    },
    
    // Prepare messages for the Claude API
    prepareMessagesForAPI: function(chatMessages) {
      // Filter system messages and ensure the right format for the API
      const messages = chatMessages
        .filter(msg => msg.role === 'human' || msg.role === 'assistant')
        .map(msg => {
          // Get the basic message structure
          const apiMsg = {
            role: msg.role === 'human' ? 'user' : 'assistant',
            content: msg.content
          };
          
          // Handle file attachments for user messages
          if (msg.role === 'human' && msg.files && msg.files.length > 0) {
            // Convert to API content array format
            apiMsg.content = [
              { type: 'text', text: msg.content || 'Please analyze these files.' }
            ];
            
            // Add each file to content array
            msg.files.forEach(file => {
              if (file.type === 'image') {
                // For images, extract base64 data
                const imageData = file.content.split(',')[1];
                apiMsg.content.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: file.type,
                    data: imageData
                  }
                });
              } else {
                // For other files, add as text
                apiMsg.content.push({
                  type: 'text',
                  text: `\n\nFile: ${file.name}\n\n${file.content}`
                });
              }
            });
          }
          
          return apiMsg;
        });
      
      return messages;
    },
    
    // Edit an existing message
    editMessage: function(messageId) {
      const { currentChat } = app.store.getState();
      if (!currentChat) return false;
      
      // Find message in current chat
      const messageIndex = currentChat.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return false;
      
      const message = currentChat.messages[messageIndex];
      if (message.role !== 'human') return false; // Only edit human messages
      
      // Find message element in DOM
      const messageElement = document.getElementById(`message-${messageId}`);
      if (!messageElement) return false;
      
      // Make content editable
      const contentElement = messageElement.querySelector('.message-content');
      if (!contentElement) return false;
      
      // Save original content
      const originalContent = message.content;
      
      // Make content editable
      contentElement.setAttribute('contenteditable', 'true');
      contentElement.focus();
      
      // Place cursor at end of content
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(contentElement);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Add editing class for styling
      messageElement.classList.add('editing');
      
      // Add edit controls
      const editControls = document.createElement('div');
      editControls.className = 'message-edit-controls';
      editControls.innerHTML = `
        <button class="edit-save">Save</button>
        <button class="edit-cancel">Cancel</button>
      `;
      
      messageElement.appendChild(editControls);
      
      // Set up save button
      const saveButton = editControls.querySelector('.edit-save');
      saveButton.addEventListener('click', () => {
        // Get edited content
        const newContent = contentElement.innerText.trim();
        
        // If content changed, update message and regenerate responses
        if (newContent !== originalContent && newContent !== '') {
          // Update message
          message.content = newContent;
          message.edited = true;
          message.editedAt = Date.now();
          
          // Remove all messages after this one
          currentChat.messages = currentChat.messages.slice(0, messageIndex + 1);
          
          // Update UI - remove subsequent messages
          const subsequentMessages = [];
          let nextElement = messageElement.nextElementSibling;
          
          while (nextElement && nextElement.classList.contains('message')) {
            subsequentMessages.push(nextElement);
            nextElement = nextElement.nextElementSibling;
          }
          
          // Remove with animation
          subsequentMessages.forEach(el => {
            el.classList.add('removing');
            setTimeout(() => {
              if (el.parentNode) {
                el.parentNode.removeChild(el);
              }
            }, 300);
          });
          
          // Get AI response for the edited message
          setTimeout(() => {
            this.sendMessage(newContent, { clearInput: false });
          }, 350);
        }
        
        // Clean up
        finishEditing();
      });
      
      // Set up cancel button
      const cancelButton = editControls.querySelector('.edit-cancel');
      cancelButton.addEventListener('click', () => {
        // Restore original content
        contentElement.innerHTML = this.processMessageContentForDisplay(originalContent);
        
        // Clean up
        finishEditing();
      });
      
      // Set up key handlers
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          // Cancel on escape
          cancelButton.click();
          e.preventDefault();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          // Save on Ctrl+Enter or Cmd+Enter
          saveButton.click();
          e.preventDefault();
        }
      };
      
      contentElement.addEventListener('keydown', keyHandler);
      
      // Function to finish editing
      const finishEditing = () => {
        // Remove contenteditable
        contentElement.removeAttribute('contenteditable');
        
        // Remove editing class
        messageElement.classList.remove('editing');
        
        // Remove edit controls
        if (editControls.parentNode) {
          editControls.parentNode.removeChild(editControls);
        }
        
        // Remove key handler
        contentElement.removeEventListener('keydown', keyHandler);
      };
      
      return true;
    },
    
    // Process message content for display in editable field
    processMessageContentForDisplay: function(content) {
      if (!content) return '';
      
      // Convert HTML entities to symbols
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      return tempDiv.innerText;
    },
    
    // Regenerate an AI message
    regenerateMessage: function(messageId) {
      const { currentChat } = app.store.getState();
      if (!currentChat) return false;
      
      // Find the message in current chat
      const messageIndex = currentChat.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return false;
      
      // Get the message to regenerate
      const message = currentChat.messages[messageIndex];
      if (message.role !== 'assistant') return false; // Only regenerate AI messages
      
      // Find the preceding user message
      let userMessageIndex = messageIndex - 1;
      while (userMessageIndex >= 0) {
        if (currentChat.messages[userMessageIndex].role === 'human') {
          break;
        }
        userMessageIndex--;
      }
      
      if (userMessageIndex < 0) return false;
      
      // Get the user message content
      const userMessage = currentChat.messages[userMessageIndex];
      
      // Remove the AI message and all subsequent messages
      currentChat.messages = currentChat.messages.slice(0, messageIndex);
      
      // Update the UI
      const messagesToRemove = [];
      const targetMessageEl = document.getElementById(`message-${messageId}`);
      
      if (targetMessageEl) {
        let currentEl = targetMessageEl;
        while (currentEl) {
          if (currentEl.classList.contains('message')) {
            messagesToRemove.push(currentEl);
          }
          currentEl = currentEl.nextElementSibling;
        }
        
        // Animate removal
        messagesToRemove.forEach(el => {
          el.classList.add('removing');
          setTimeout(() => {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          }, 300);
        });
      }
      
      // Regenerate the response
      setTimeout(() => {
        this.sendMessage(userMessage.content, {
          files: userMessage.files,
          clearInput: false
        });
      }, 350);
      
      return true;
    }
  };

  // ===============================================================
  // Event Handlers - Manages UI event handlers and interactions
  // ===============================================================
  app.handlers = {
    // Store for event handler references
    refs: {},
    
    // Initialize event handlers
    init: function() {
      console.log('Event handlers initializing...');
      
      // Set up all event handlers
      this.setupInputHandlers();
      this.setupButtonHandlers();
      this.setupFileHandlers();
      this.setupExamplePrompts();
      
      console.log('Event handlers initialized');
    },
    
    // Set up input field handlers
    setupInputHandlers: function() {
      const { userInput, sendButton } = app.ui.elements;
      if (!userInput) return;
      
      // Input handler for auto-resize and button state
      const inputHandler = () => {
        const hasContent = userInput.value.trim() !== '';
        const hasFiles = app.store.getState().attachedFiles.length > 0;
        
        // Update send button state
        if (sendButton) {
          sendButton.disabled = !hasContent && !hasFiles;
        }
        
        // Auto-resize textarea
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
      };
      
      // Key handler for keyboard shortcuts
      const keyHandler = (e) => {
        // Send on Enter (but not with Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          
          const hasContent = userInput.value.trim() !== '';
          const hasFiles = app.store.getState().attachedFiles.length > 0;
          const isProcessing = app.store.getState().isProcessing;
          
          if ((hasContent || hasFiles) && !isProcessing) {
            this.handleSendMessage();
          }
        }
        
        // Handle up/down arrows for history
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && userInput.value === '') {
          // TODO: Implement message history navigation
        }
      };
      
      // Add event listeners
      userInput.addEventListener('input', inputHandler);
      userInput.addEventListener('keydown', keyHandler);
      
      // Store references for potential cleanup
      this.refs.inputHandler = inputHandler;
      this.refs.keyHandler = keyHandler;
    },
    
    // Set up button click handlers
    setupButtonHandlers: function() {
      const {
        sendButton,
        newChatBtn,
        menuBtn,
        closeSidebarBtn,
        settingsButton,
        closeSettings
      } = app.ui.elements;
      
      // Send button handler
      if (sendButton) {
        sendButton.addEventListener('click', () => {
          if (!sendButton.disabled && !app.store.getState().isProcessing) {
            this.handleSendMessage();
          }
        });
      }
      
      // New chat button
      if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
          app.events.emit('chat:new');
        });
      }
      
      // Mobile menu button (show sidebar)
      if (menuBtn) {
        menuBtn.addEventListener('click', () => {
          app.ui.openSidebar();
        });
      }
      
      // Close sidebar button
      if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
          app.ui.closeSidebar();
        });
      }
      
      // Settings button
      if (settingsButton) {
        settingsButton.addEventListener('click', () => {
          app.ui.openSettings();
        });
      }
      
      // Close settings button
      if (closeSettings) {
        closeSettings.addEventListener('click', () => {
          app.ui.closeSettings();
        });
      }
      
      // Overlay click handler
      if (app.ui.elements.overlay) {
        app.ui.elements.overlay.addEventListener('click', () => {
          app.ui.closeSidebar();
          app.ui.closeSettings();
        });
      }
    },
    
    // Set up file upload handlers
    setupFileHandlers: function() {
      const { attachButton, fileUpload } = app.ui.elements;
      
      // Attach button click
      if (attachButton) {
        attachButton.addEventListener('click', () => {
          if (fileUpload) {
            fileUpload.click();
          }
        });
      }
      
      // File upload change handler
      if (fileUpload) {
        fileUpload.addEventListener('change', () => {
          this.handleFileUpload();
        });
      }
      
      // Set up drag and drop for entire chat container
      if (app.ui.elements.chatContainer) {
        const container = app.ui.elements.chatContainer;
        
        container.addEventListener('dragover', (e) => {
          e.preventDefault();
          container.classList.add('drag-over');
        });
        
        container.addEventListener('dragleave', () => {
          container.classList.remove('drag-over');
        });
        
        container.addEventListener('drop', (e) => {
          e.preventDefault();
          container.classList.remove('drag-over');
          
          if (e.dataTransfer.files.length > 0) {
            this.handleFileDrop(e.dataTransfer.files);
          }
        });
      }
      
      // Paste handler for images
      document.addEventListener('paste', (e) => {
        if (e.clipboardData.files.length > 0) {
          this.handleFilePaste(e.clipboardData.files);
        }
      });
    },
    
    // Set up example prompts
    setupExamplePrompts: function() {
      if (!app.ui.elements.examplePrompts) return;
      
      app.ui.elements.examplePrompts.forEach(button => {
        button.addEventListener('click', () => {
          if (app.ui.elements.userInput) {
            app.ui.elements.userInput.value = button.textContent;
            app.ui.elements.userInput.dispatchEvent(new Event('input'));
            app.ui.hideWelcomeScreen();
            app.ui.focusInput();
          }
        });
      });
    },
    
    // Handle send message action
    handleSendMessage: function() {
      const userInput = app.ui.elements.userInput;
      if (!userInput) return;
      
      const userMessage = userInput.value.trim();
      const attachedFiles = app.store.getState().attachedFiles || [];
      
      // Don't send if nothing to send
      if (userMessage === '' && attachedFiles.length === 0) {
        return;
      }
      
      // Send the message
      app.conversations.sendMessage(userMessage, {
        files: attachedFiles,
        clearInput: true
      });
      
      // Clear input field and reset height
      userInput.value = '';
      userInput.style.height = 'auto';
      
      // Clear attached files
      this.clearAttachedFiles();
      
      // Disable send button
      if (app.ui.elements.sendButton) {
        app.ui.elements.sendButton.disabled = true;
      }
    },
    
    // Handle file upload from input
    handleFileUpload: function() {
      const fileInput = app.ui.elements.fileUpload;
      if (!fileInput || fileInput.files.length === 0) return;
      
      this.processFiles(fileInput.files);
      
      // Clear the input for future uploads
      fileInput.value = null;
    },
    
    // Handle files dropped via drag and drop
    handleFileDrop: function(files) {
      if (!files || files.length === 0) return;
      this.processFiles(files);
    },
    
    // Handle files pasted from clipboard
    handleFilePaste: function(files) {
      if (!files || files.length === 0) return;
      this.processFiles(files);
    },
    
    // Process selected files
    processFiles: function(files) {
      // Clear any existing file UI
      this.clearAttachedFilesUI();
      
      // Create new files array in state
      const attachedFiles = [];
      app.store.setState({ attachedFiles });
      
      // Create UI container for file badges
      const filesContainer = document.createElement('div');
      filesContainer.className = 'badges';
      
      // Process each file
      Array.from(files).forEach(file => {
        // Check file size (10MB limit)
        if (file.size > app.config.MAX_FILE_SIZE) {
          app.ui.showToast({
            title: 'File Too Large',
            message: `${file.name} exceeds the 10MB limit.`,
            type: 'error'
          });
          return;
        }
        
        // Create file badge UI
        const badge = this.createFileBadge(file);
        filesContainer.appendChild(badge);
        
        // Read file content
        this.readFileContent(file)
          .then(result => {
            // Add to state
            attachedFiles.push({
              name: file.name,
              type: file.type,
              content: result.content
            });
            
            // Enable send button
            if (app.ui.elements.sendButton) {
              app.ui.elements.sendButton.disabled = false;
            }
          })
          .catch(error => {
            console.error('Error reading file:', error);
            
            // Remove badge
            if (badge.parentNode) {
              badge.parentNode.removeChild(badge);
            }
            
            // Show error
            app.ui.showToast({
              title: 'File Error',
              message: `Could not read file ${file.name}: ${error.message}`,
              type: 'error'
            });
          });
      });
      
      // Add badges container to UI
      if (app.ui.elements.userInput && filesContainer.children.length > 0) {
        app.ui.elements.userInput.parentElement.appendChild(filesContainer);
      }
    },
    
    // Create a file badge for UI
    createFileBadge: function(file) {
      const badge = document.createElement('div');
      badge.className = 'file-badge';
      
      // Add file icon based on type
      const fileIcon = this.getFileTypeIcon(file.type);
      
      badge.innerHTML = `
        ${fileIcon}
        <span class="file-name">${file.name}</span>
        <button class="remove-file" aria-label="Remove file">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      
      // Set up remove button
      const removeButton = badge.querySelector('.remove-file');
      removeButton.addEventListener('click', () => {
        // Get current files from state
        const { attachedFiles } = app.store.getState();
        
        // Filter out this file
        const updatedFiles = attachedFiles.filter(f => f.name !== file.name);
        
        // Update state
        app.store.setState({ attachedFiles: updatedFiles });
        
        // Update UI
        badge.classList.add('removing');
        setTimeout(() => {
          if (badge.parentNode) {
            badge.parentNode.removeChild(badge);
            
            // If no files left, remove container
            const container = document.querySelector('.badges');
            if (container && container.children.length === 0) {
              container.remove();
            }
            
            // Update send button state
            const hasContent = app.ui.elements.userInput?.value.trim() !== '';
            if (app.ui.elements.sendButton) {
              app.ui.elements.sendButton.disabled = !hasContent && updatedFiles.length === 0;
            }
          }
        }, 300);
      });
      
      return badge;
    },
    
    // Get icon for file type
    getFileTypeIcon: function(fileType) {
      if (fileType.startsWith('image/')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>`;
      }
      
      if (fileType === 'application/pdf') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>`;
      }
      
      if (fileType.startsWith('text/') || fileType === 'application/json') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>`;
      }
      
      // Default file icon
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
      </svg>`;
    },
    
    // Read file content as text or data URL
    readFileContent: function(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function() {
          resolve({
            content: reader.result
          });
        };
        
        reader.onerror = function() {
          reject(new Error("Could not read file"));
        };
        
        if (file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    },
    
    // Clear attached files
    clearAttachedFiles: function() {
      app.store.setState({ attachedFiles: [] });
      this.clearAttachedFilesUI();
    },
    
    // Clear attached files UI
    clearAttachedFilesUI: function() {
      const badgesContainer = document.querySelector('.badges');
      if (badgesContainer) {
        badgesContainer.remove();
      }
    }
  };

  // ===============================================================
  // Utilities Module - Helper functions and common utilities
  // ===============================================================
  app.utils = {
    // Generate a unique ID with optional prefix
    generateUniqueId: function(prefix = '') {
      return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    },
    
    // Format a timestamp
    formatTimestamp: function(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    
    // Format a relative time (e.g., "2 min ago")
    formatRelativeTime: function(timestamp) {
      const now = Date.now();
      const diff = now - timestamp;
      
      // Just now (within last minute)
      if (diff < 60000) {
        return 'Just now';
      }
      
      // Minutes
      if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
      }
      
      // Hours
      if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
      }
      
      // Days
      if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;
      }
      
      // More than a week, show date
      const options = { month: 'short', day: 'numeric' };
      return new Date(timestamp).toLocaleDateString(undefined, options);
    },
    
    // Debounce function to limit execution frequency
    debounce: function(func, wait) {
      let timeout;
      
      return function(...args) {
        const context = this;
        clearTimeout(timeout);
        
        timeout = setTimeout(() => {
          func.apply(context, args);
        }, wait);
      };
    },
    
    // Throttle function to limit execution rate
    throttle: function(func, limit) {
      let inThrottle;
      
      return function(...args) {
        const context = this;
        
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          
          setTimeout(() => {
            inThrottle = false;
          }, limit);
        }
      };
    },
    
    // Escape HTML to prevent XSS
    escapeHtml: function(text) {
      if (!text) return '';
      
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
    
    // Deep clone an object
    deepClone: function(obj) {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      
      if (obj instanceof Date) {
        return new Date(obj);
      }
      
      if (obj instanceof Array) {
        return obj.map(item => this.deepClone(item));
      }
      
      if (obj instanceof Object) {
        const copy = {};
        Object.keys(obj).forEach(key => {
          copy[key] = this.deepClone(obj[key]);
        });
        return copy;
      }
      
      // If we reached here, the object is of an unexpected type
      console.warn('Unable to copy obj! Type not supported:', obj);
      return obj;
    },
    
    // Get file extension based on mime type
    getFileExtension: function(mimeType) {
      const extensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'application/pdf': 'pdf',
        'text/plain': 'txt',
        'text/html': 'html',
        'text/css': 'css',
        'text/javascript': 'js',
        'application/json': 'json',
        'application/xml': 'xml',
        'application/zip': 'zip'
      };
      
      return extensions[mimeType] || 'txt';
    },
    
    // Get file extension based on programming language
    getFileExtensionFromLang: function(lang) {
      const extensions = {
        'javascript': 'js',
        'typescript': 'ts',
        'python': 'py',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'csharp': 'cs',
        'php': 'php',
        'ruby': 'rb',
        'go': 'go',
        'rust': 'rs',
        'swift': 'swift',
        'kotlin': 'kt',
        'scala': 'scala',
        'html': 'html',
        'css': 'css',
        'xml': 'xml',
        'json': 'json',
        'yaml': 'yml',
        'markdown': 'md',
        'bash': 'sh',
        'powershell': 'ps1',
        'sql': 'sql'
      };
      
      return extensions[lang?.toLowerCase()] || 'txt';
    },
    
    // Truncate text with ellipsis
    truncateText: function(text, maxLength) {
      if (!text || text.length <= maxLength) {
        return text;
      }
      
      return text.substring(0, maxLength) + '...';
    },
    
    // Convert bytes to human-readable file size
    formatFileSize: function(bytes) {
      if (bytes === 0) return '0 B';
      
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      
      return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Simple obfuscation for API key (not secure, just to prevent accidental exposure)
    obfuscateApiKey: function(key) {
      if (!key) return '';
      if (key.length <= 8) return '•'.repeat(key.length);
      
      const firstChars = key.substring(0, 4);
      const lastChars = key.substring(key.length - 4);
      const middleLength = key.length - 8;
      
      return `${firstChars}${'•'.repeat(middleLength)}${lastChars}`;
    },
    
    // Get device and browser info
    getDeviceInfo: function() {
      const ua = navigator.userAgent;
      let browserName = "Unknown";
      let osName = "Unknown";
      
      // Detect browser
      if (ua.indexOf("Firefox") > -1) {
        browserName = "Firefox";
      } else if (ua.indexOf("SamsungBrowser") > -1) {
        browserName = "Samsung Browser";
      } else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) {
        browserName = "Opera";
      } else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) {
        browserName = "Edge";
      } else if (ua.indexOf("Chrome") > -1) {
        browserName = "Chrome";
      } else if (ua.indexOf("Safari") > -1) {
        browserName = "Safari";
      }
      
      // Detect OS
      if (ua.indexOf("Windows") > -1) {
        osName = "Windows";
      } else if (ua.indexOf("Android") > -1) {
        osName = "Android";
      } else if (ua.indexOf("iPhone") > -1 || ua.indexOf("iPad") > -1 || ua.indexOf("iPod") > -1) {
        osName = "iOS";
      } else if (ua.indexOf("Mac") > -1) {
        osName = "macOS";
      } else if (ua.indexOf("Linux") > -1) {
        osName = "Linux";
      }
      
      return {
        browser: browserName,
        os: osName,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        darkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
        touchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        language: navigator.language || navigator.userLanguage || 'en-US'
      };
    },
    
    // Parse URLs in text and convert to anchor tags
    linkify: function(text) {
      if (!text) return '';
      
      // URLs starting with http(s)://, ftp://, mailto:
      const urlPattern = /(\b(https?|ftp|mailto):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gim;
      
      // URLs starting with "www." (without // before it)
      const pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
      
      // Email addresses
      const emailAddressPattern = /[\w.]+@[a-zA-Z_-]+?(?:\.[a-zA-Z]{2,})+/gim;
      
      return text
        .replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer" class="external-link">$1</a>')
        .replace(pseudoUrlPattern, '$1<a href="http://$2" target="_blank" rel="noopener noreferrer" class="external-link">$2</a>')
        .replace(emailAddressPattern, '<a href="mailto:$&" class="email-link">$&</a>');
    }
  };
  
  // ===============================================================
  // Analytics Module - Optional usage analytics (privacy-focused)
  // ===============================================================
  app.analytics = {
    enabled: false,
    anonymousId: null,
    
    // Initialize analytics
    init: function() {
      // Only initialize if enabled in config
      if (!app.config.ANALYTICS_ENABLED) return;
      
      console.log('Analytics module initializing...');
      
      // Generate or retrieve anonymous ID
      this.anonymousId = this.getAnonymousId();
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.enabled = true;
      console.log('Analytics module initialized');
    },
    
    // Get or create anonymous ID
    getAnonymousId: function() {
      let id = app.storage.getItem('anonymousId');
      
      if (!id) {
        // Generate a random ID that doesn't contain personally identifiable information
        id = 'anon_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        app.storage.setItem('anonymousId', id);
      }
      
      return id;
    },
    
    // Set up listeners for events to track
    setupEventListeners: function() {
      // App lifecycle events
      app.events.on('app:initialized', () => this.track('app_initialized'));
      
      // Chat events
      app.events.on('chat:created', () => this.track('chat_created'));
      app.events.on('message:sent', () => this.track('message_sent'));
      app.events.on('message:received', () => this.track('message_received'));
      
      // Error tracking
      app.events.on('error', ({ error, context }) => {
        this.track('error', {
          type: error.name,
          context,
          message: error.message.substring(0, 100) // Don't send full error messages
        });
      });
      
      // Feature usage
      app.events.on('feature:streaming', () => this.track('feature_streaming_used'));
      app.events.on('feature:file_upload', () => this.track('feature_file_upload_used'));
    },
    
    // Track an event
    track: function(eventName, properties = {}) {
      if (!this.enabled) return;
      
      // Don't include PII or API keys
      const safeProperties = { ...properties };
      delete safeProperties.apiKey;
      delete safeProperties.content;
      delete safeProperties.userMessage;
      delete safeProperties.responseContent;
      
      // Add common properties
      const eventData = {
        event: eventName,
        anonymousId: this.anonymousId,
        properties: safeProperties,
        timestamp: new Date().toISOString(),
        device: {
          type: app.session.deviceInfo.isMobile ? 'mobile' : 'desktop',
          browser: app.utils.getDeviceInfo().browser
        }
      };
      
      // In a production app, you would send this data to your analytics service
      // For this implementation, we just log to console in debug mode
      if (app.config.DEBUG_MODE) {
        console.log('Analytics event:', eventName, eventData);
      }
      
      // In a real implementation, you would send the data to your analytics service
      // Example: sendToAnalyticsService(eventData);
    }
  };
  
  // ===============================================================
  // Developer Tools - Debugging utilities for development
  // ===============================================================
  app.devTools = {
    // Initialize developer tools
    init: function() {
      // Only initialize in debug mode
      if (!app.config.DEBUG_MODE) return;
      
      console.log('Developer tools initializing...');
      
      // Expose app to window for debugging
      window._claudeApp = app;
      
      // Add developer menu
      this.addDevMenu();
      
      // Set up keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Shift+Ctrl+D to toggle dev menu
        if (e.key === 'D' && e.ctrlKey && e.shiftKey) {
          e.preventDefault();
          this.toggleDevMenu();
        }
      });
      
      console.log('Developer tools initialized');
      console.log('Press Shift+Ctrl+D to toggle developer menu');
    },
    
    // Add developer menu to the page
    addDevMenu: function() {
      const devMenu = document.createElement('div');
      devMenu.id = 'dev-menu';
      devMenu.className = 'dev-tools-menu';
      devMenu.style.display = 'none';
      
      devMenu.innerHTML = `
        <div class="dev-menu-header">
          <h3>Developer Tools</h3>
          <button id="close-dev-menu">×</button>
        </div>
        <div class="dev-menu-content">
          <div class="dev-menu-section">
            <h4>Actions</h4>
            <button id="dev-reset-storage">Reset Storage</button>
            <button id="dev-toggle-mock">Toggle Mock Mode</button>
            <button id="dev-export-state">Export State</button>
          </div>
          <div class="dev-menu-section">
            <h4>Status</h4>
            <div id="dev-status"></div>
          </div>
          <div class="dev-menu-section">
            <h4>Console</h4>
            <div id="dev-console"></div>
          </div>
        </div>
      `;
      
      document.body.appendChild(devMenu);
      
      // Set up event handlers
      document.getElementById('close-dev-menu').addEventListener('click', () => {
        this.toggleDevMenu(false);
      });
      
      document.getElementById('dev-reset-storage').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all storage? This will delete all chats and settings.')) {
          app.storage.clearAll().then(() => {
            alert('Storage cleared. Reloading page...');
            window.location.reload();
          });
        }
      });
      
      document.getElementById('dev-toggle-mock').addEventListener('click', () => {
        const currentState = app.preferences.get('useMockResponses');
        app.preferences.set('useMockResponses', !currentState);
        this.updateStatus();
      });
      
      document.getElementById('dev-export-state').addEventListener('click', () => {
        this.exportState();
      });
      
      // Initialize status display
      this.updateStatus();
    },
    
    // Toggle developer menu visibility
    toggleDevMenu: function(show) {
      const devMenu = document.getElementById('dev-menu');
      if (!devMenu) return;
      
      if (show === undefined) {
        show = devMenu.style.display === 'none';
      }
      
      devMenu.style.display = show ? 'block' : 'none';
      
      // Update status when showing
      if (show) {
        this.updateStatus();
      }
    },
    
    // Update status display
    updateStatus: function() {
      const statusEl = document.getElementById('dev-status');
      if (!statusEl) return;
      
      const status = {
        version: '1.0.0',
        storage: app.storage.available ? 'Available' : 'Using Memory Fallback',
        mockMode: app.preferences.get('useMockResponses') ? 'Enabled' : 'Disabled',
        apiStatus: app.services.status.api,
        connectionStatus: app.services.status.connectivity,
        currentChatId: app.store.getState().currentChat?.id || 'None',
        totalChats: app.store.getState().chats.length,
        deviceInfo: app.utils.getDeviceInfo()
      };
      
      let html = '<table class="dev-status-table">';
      
      for (const [key, value] of Object.entries(status)) {
        if (key === 'deviceInfo') {
          html += `<tr><td colspan="2"><strong>${key}:</strong></td></tr>`;
          for (const [infoKey, infoValue] of Object.entries(value)) {
            html += `<tr><td style="padding-left: 1rem;">${infoKey}</td><td>${infoValue}</td></tr>`;
          }
        } else {
          html += `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`;
        }
      }
      
      html += '</table>';
      statusEl.innerHTML = html;
    },
    
    // Export application state for debugging
    exportState: function() {
      const state = app.store.getState();
      
      // Remove sensitive data
      const safeState = this.sanitizeState(state);
      
      // Create file and download
      const dataStr = JSON.stringify(safeState, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claude-chat-state-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    
    // Remove sensitive data from state export
    sanitizeState: function(state) {
      const safeState = { ...state };
      
      // Remove API key
      if (safeState.preferences && safeState.preferences.apiKey) {
        safeState.preferences = { 
          ...safeState.preferences,
          apiKey: 'API_KEY_REDACTED'
        };
      }
      
      return safeState;
    },
    
    // Log to the in-app console
    log: function(message, type = 'info') {
      const consoleEl = document.getElementById('dev-console');
      if (!consoleEl) return;
      
      const timestamp = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.className = `dev-log dev-log-${type}`;
      entry.textContent = `[${timestamp}] ${message}`;
      
      consoleEl.appendChild(entry);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }
  };

  // ===============================================================
  // PWA Features - Progressive Web App capabilities
  // ===============================================================
  app.pwa = {
    // Initialize PWA features
    init: function() {
      console.log('PWA features initializing...');
      
      // Register service worker if supported
      this.registerServiceWorker();
      
      // Set up install prompt
      this.setupInstallPrompt();
      
      console.log('PWA features initialized');
    },
    
    // Register service worker
    registerServiceWorker: function() {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
          try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('ServiceWorker registered with scope:', registration.scope);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              
              // Show update notification when new service worker is installed
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New content is available, show update notification
                    this.showUpdateNotification();
                  }
                }
              });
            });
          } catch (error) {
            console.error('ServiceWorker registration failed:', error);
          }
        });
        
        // Listen for controller change to reload the page when update is accepted
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      }
    },
    
    // Set up install prompt
    setupInstallPrompt: function() {
      // Don't show install prompt if already installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone === true;
      
      if (isStandalone) {
        return;
      }
      
      // Capture install prompt event
      window.addEventListener('beforeinstallprompt', (event) => {
        // Prevent Chrome 76+ from showing automatic prompt
        event.preventDefault();
        
        // Store event for later use
        this.deferredPrompt = event;
        
        // Show install button after a delay
        setTimeout(() => {
          this.showInstallButton();
        }, 30000); // Show after 30 seconds of app usage
      });
    },
    
    // Show app install button
    showInstallButton: function() {
      if (!this.deferredPrompt) return;
      
      // Create install prompt UI
      const promptEl = document.createElement('div');
      promptEl.className = 'pwa-install-prompt';
      promptEl.innerHTML = `
        <div class="pwa-install-content">
          <h3>Install Claude Chat</h3>
          <p>Install this app on your device for quick access and offline capabilities.</p>
          <div class="pwa-buttons">
            <button id="pwa-install-btn" class="btn-primary">Install</button>
            <button id="pwa-later-btn" class="btn-secondary">Later</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(promptEl);
      
      // Animate in
      setTimeout(() => {
        promptEl.classList.add('show');
      }, 100);
      
      // Set up button handlers
      document.getElementById('pwa-install-btn').addEventListener('click', async () => {
        // Hide prompt
        promptEl.classList.remove('show');
        
        // Show install prompt
        this.deferredPrompt.prompt();
        
        // Wait for user response
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`Install prompt response: ${outcome}`);
        
        // Clear deferredPrompt
        this.deferredPrompt = null;
        
        // Remove prompt after delay
        setTimeout(() => {
          if (promptEl.parentNode) {
            promptEl.parentNode.removeChild(promptEl);
          }
        }, 300);
      });
      
      document.getElementById('pwa-later-btn').addEventListener('click', () => {
        // Hide prompt
        promptEl.classList.remove('show');
        
        // Remove after animation
        setTimeout(() => {
          if (promptEl.parentNode) {
            promptEl.parentNode.removeChild(promptEl);
          }
        }, 300);
      });
    },
    
    // Show update available notification
    showUpdateNotification: function() {
      app.ui.showToast({
        title: 'Update Available',
        message: 'A new version of Claude Chat is available.',
        type: 'info',
        duration: 0, // Don't auto-dismiss
        actions: [{
          id: 'update-now',
          text: 'Update Now',
          handler: () => {
            // Skip waiting to activate the waiting service worker
            navigator.serviceWorker.ready.then(registration => {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            });
          }
        }]
      });
    }
  };
  
  // ===============================================================
  // Initialization - Set up and start the application
  // ===============================================================
  
  // Initialize the application when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    // First initialize events system
    app.events.init();
    
    // Initialize and start the application
    app.init().catch(error => {
      console.error('Failed to initialize application:', error);
      
      // Show error screen
      document.body.innerHTML = `
        <div class="startup-error">
          <h2>Error Starting Application</h2>
          <p>There was a problem starting Claude Chat.</p>
          <div class="error-details">
            <code>${error.message || 'Unknown error'}</code>
          </div>
          <button onclick="location.reload()">Reload Application</button>
        </div>
      `;
    });
    
    // Initialize analytics if enabled
    app.analytics.init();
    
    // Initialize developer tools if in debug mode
    if (app.config.DEBUG_MODE) {
      app.devTools.init();
    }
    
    // Initialize PWA features
    app.pwa.init();
  });
  
  // Return public API (empty object) to avoid exposing internals
  return {};
})();