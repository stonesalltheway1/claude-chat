/**
 * WikiChat UI Controller
 * 
 * A comprehensive UI system for Wikipedia chat integration that provides:
 * - High-performance virtual DOM implementation
 * - Optimized message rendering with recycling
 * - Advanced animation system with IntersectionObserver
 * - WCAG AA+ accessibility compliance
 * - Markdown and code syntax highlighting
 * - Real-time message streaming
 * - Keyboard navigation and shortcut system
 * - Theme support with automatic dark mode detection
 * 
 * @version 3.0.0
 * @license MIT
 */

const UIController = (() => {
    'use strict';
  
    // ===============================================================
    // Configuration & Constants
    // ===============================================================
    
    const DEFAULT_CONFIG = {
      animations: {
        enabled: true,
        duration: 280,
        easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      },
      scrollBehavior: 'smooth',
      markdown: {
        enabled: true,
        sanitize: true,
        breaks: true,
        linkify: true,
        allowedTags: ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                     'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'strong', 
                     'em', 'a', 'code', 'pre', 'table', 'thead', 'tbody', 
                     'tr', 'th', 'td', 'img', 'sup', 'sub']
      },
      codeHighlighting: {
        enabled: true,
        theme: document.body.classList.contains('dark-theme') ? 'dark' : 'light',
        languages: ['javascript', 'python', 'java', 'html', 'css', 'bash',
                   'typescript', 'jsx', 'tsx', 'json', 'yaml', 'go', 'rust', 
                   'c', 'cpp', 'csharp', 'php', 'ruby', 'swift', 'kotlin', 'sql']
      },
      virtualScroller: {
        enabled: true,
        bufferSize: 15,
        chunkSize: 8,
        recycleThreshold: 500,
        debounceMs: 80
      },
      messageGrouping: {
        enabled: true,
        timeThreshold: 120000
      },
      timestamps: {
        format: 'relative',
        updateInterval: 60000
      },
      avatars: {
        enabled: true,
        human: chrome.runtime.getURL('assets/img/user-avatar.svg'),
        assistant: chrome.runtime.getURL('assets/img/claude-avatar.svg')
      },
      accessibility: {
        announceMessages: true,
        focusableMessages: true,
        keyboardNavigation: true,
        highContrast: window.matchMedia('(prefers-contrast: more)').matches
      },
      typewriter: {
        enabled: false,
        speed: 30,
        maxSpeed: 100
      },
      files: {
        maxSizeMB: 10,
        allowedTypes: [
          'image/*', '.pdf', '.txt', '.md', '.json', '.csv', '.docx', '.xlsx'
        ],
        imageOptimization: true,
        maxPreviewSize: 800
      },
      performance: {
        maxMessages: 1000,
        domRecycling: true,
        lazyLoadContent: true,
        concurrentRendering: navigator.hardwareConcurrency > 4 ? 4 : 2,
        batchSize: 15,
        debounceRender: 10
      },
      contextMenu: {
        enabled: true,
        items: ['copy', 'edit', 'regenerate', 'cite', 'save']
      },
      citationFormat: {
        default: 'MLA',
        formats: ['MLA', 'APA', 'Chicago', 'IEEE']
      },
      wikipedia: {
        linkPreview: true,
        autoSummarize: true,
        citationGeneration: true,
        relatedArticles: true
      }
    };
    
    // Rendering strategies registry
    const RENDERERS = {
      DEFAULT: 'default',
      STREAMING: 'streaming',
      THINKING: 'thinking',
      MARKDOWN: 'markdown',
      CODE: 'code',
      IMAGE: 'image',
      FILE: 'file',
      ERROR: 'error',
      WIKI_REFERENCE: 'wikiReference'
    };
    
    // CSS classes map for semantic clarity and easier theming
    const CSS = {
      message: {
        container: 'wikichat-message',
        human: 'human',
        assistant: 'assistant',
        error: 'error',
        thinking: 'thinking',
        selected: 'selected',
        focused: 'focused',
        streaming: 'streaming',
        visible: 'visible',
        grouped: 'grouped',
        deleting: 'deleting',
        withFiles: 'with-files',
        withCitation: 'with-citation',
        edited: 'edited'
      },
      content: {
        container: 'message-content',
        markdown: 'markdown-content',
        thinking: 'thinking-content',
        streaming: 'streaming-content',
        code: 'code-block',
        codeInline: 'code-inline',
        raw: 'raw-content',
        error: 'error-content',
        loading: 'loading-content',
        citation: 'citation-content'
      },
      animations: {
        fadeIn: 'fade-in',
        fadeOut: 'fade-out',
        slideIn: 'slide-in',
        slideOut: 'slide-out',
        pulse: 'pulse',
        typing: 'typing'
      },
      layout: {
        container: 'wikichat-container',
        chatContainer: 'chat-container',
        sidebar: 'wikichat-sidebar',
        welcome: 'welcome-screen',
        hidden: 'hidden',
        visible: 'visible',
        loading: 'loading',
        expanded: 'expanded',
        collapsed: 'collapsed'
      },
      ui: {
        button: 'wikichat-btn',
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        danger: 'btn-danger',
        icon: 'btn-icon',
        link: 'btn-link',
        input: 'wikichat-input',
        textarea: 'wikichat-textarea',
        dropdown: 'wikichat-dropdown',
        modal: 'wikichat-modal',
        toast: 'wikichat-toast',
        tooltip: 'wikichat-tooltip'
      }
    };
  
    // ===============================================================
    // DOM Utility Functions
    // ===============================================================
  
    /**
     * DOM utilities for efficient DOM operations
     */
    const DOM = {
      /**
       * Creates a DOM element with attributes, properties and children
       * @param {String} tag - Element tag name
       * @param {Object} options - Element options: attrs, props, events, children
       * @returns {HTMLElement} Created element
       */
      create(tag, options = {}) {
        const { attrs = {}, props = {}, events = {}, children = [] } = options;
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attrs).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            element.setAttribute(key, value);
          }
        });
        
        // Set properties
        Object.entries(props).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            element[key] = value;
          }
        });
        
        // Add event listeners
        Object.entries(events).forEach(([event, handler]) => {
          element.addEventListener(event, handler);
        });
        
        // Append children
        children.forEach(child => {
          if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
          } else if (child instanceof Node) {
            element.appendChild(child);
          }
        });
        
        return element;
      },
      
      /**
       * Creates element from HTML string
       * @param {String} html - HTML string
       * @returns {HTMLElement} Created element
       */
      fromHTML(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstChild;
      },
      
      /**
       * Empties an element
       * @param {HTMLElement} element - Element to empty
       */
      empty(element) {
        while (element.firstChild) {
          element.removeChild(element.firstChild);
        }
      },
      
      /**
       * Safely removes an element from DOM
       * @param {HTMLElement} element - Element to remove
       */
      remove(element) {
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
      },
      
      /**
       * Sets multiple CSS properties on an element
       * @param {HTMLElement} element - Target element
       * @param {Object} styles - CSS properties object
       */
      setStyles(element, styles) {
        Object.entries(styles).forEach(([prop, value]) => {
          element.style[prop] = value;
        });
      },
      
      /**
       * Adds multiple classes to an element
       * @param {HTMLElement} element - Target element
       * @param {...String} classes - CSS classes to add
       */
      addClass(element, ...classes) {
        classes.forEach(cls => {
          if (cls) element.classList.add(cls);
        });
      },
      
      /**
       * Removes multiple classes from an element
       * @param {HTMLElement} element - Target element
       * @param {...String} classes - CSS classes to remove
       */
      removeClass(element, ...classes) {
        classes.forEach(cls => {
          if (cls) element.classList.remove(cls);
        });
      },
      
      /**
       * Toggles multiple classes on an element
       * @param {HTMLElement} element - Target element
       * @param {Object} classMap - Map of class names to boolean values
       */
      toggleClasses(element, classMap) {
        Object.entries(classMap).forEach(([cls, value]) => {
          element.classList.toggle(cls, value);
        });
      },
      
      /**
       * Checks if element is visible in parent container
       * @param {HTMLElement} element - Element to check
       * @param {HTMLElement} container - Container element
       * @returns {Boolean} Whether element is visible
       */
      isVisible(element, container) {
        const eleRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        return (
          eleRect.top < containerRect.bottom &&
          eleRect.bottom > containerRect.top
        );
      },
  
      /**
       * Creates a debounced function
       * @param {Function} fn - Function to debounce
       * @param {Number} delay - Debounce delay in ms
       * @returns {Function} Debounced function
       */
      debounce(fn, delay) {
        let timer;
        return function(...args) {
          clearTimeout(timer);
          timer = setTimeout(() => fn.apply(this, args), delay);
        };
      },
  
      /**
       * Creates a throttled function
       * @param {Function} fn - Function to throttle
       * @param {Number} limit - Throttle limit in ms
       * @returns {Function} Throttled function
       */
      throttle(fn, limit) {
        let inThrottle;
        return function(...args) {
          if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
          }
        };
      }
    };
  
    // ===============================================================
    // Core UI Controller Class
    // ===============================================================
    
    class Controller {
      constructor() {
        // Initialize configuration with defaults
        this.config = structuredClone(DEFAULT_CONFIG);
        
        // Initialize state
        this.state = {
          initialized: false,
          elements: new Map(),
          messages: new Map(),
          visibleMessages: new Set(),
          activeMessageId: null,
          virtualScroller: {
            firstVisibleIndex: 0,
            lastVisibleIndex: 0,
            totalMessages: 0,
            scrollPosition: 0,
            scrollingDown: true,
            needsRender: false,
            recycledNodes: []
          },
          currentChatId: null,
          streaming: {
            active: false,
            messageId: null,
            content: '',
            startTime: 0,
            bytesSinceLastUpdate: 0,
            totalBytes: 0
          },
          thinking: false,
          scrollLocked: true,
          renderQueue: [],
          renderTimer: null,
          timestampUpdateTimer: null,
          observers: {
            message: null,
            resize: null,
            mutation: null,
            sentinel: null
          },
          eventHandlers: new Map(),
          registeredShortcuts: new Map(),
          messageListeners: new Map(),
          contextMenuOpen: false,
          toastQueue: [],
          wikipediaArticle: null,
          loadedPlugins: new Set(),
          undoStack: [],
          redoStack: []
        };
        
        // Renderer registry
        this.renderers = new Map();
        
        // External dependencies (initialized on demand)
        this.dependencies = {
          markdownParser: null,
          codeHighlighter: null,
          sanitizer: null
        };
        
        // Bind core methods to maintain context
        this._bindMethods();
      }
      
      /**
       * Binds class methods to preserve context
       * @private
       */
      _bindMethods() {
        // Core lifecycle methods
        this.init = this.init.bind(this);
        this.destroy = this.destroy.bind(this);
        this.render = this.render.bind(this);
        
        // Event handlers
        this.handleScroll = DOM.throttle(this.handleScroll.bind(this), 100);
        this.handleResize = DOM.debounce(this.handleResize.bind(this), 150);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleThemeChange = this.handleThemeChange.bind(this);
        
        // Message management
        this.addMessage = this.addMessage.bind(this);
        this.updateMessage = this.updateMessage.bind(this);
        this.removeMessage = this.removeMessage.bind(this);
        this.startStreaming = this.startStreaming.bind(this);
        this.appendStreamContent = this.appendStreamContent.bind(this);
        this.stopStreaming = this.stopStreaming.bind(this);
        this.showThinking = this.showThinking.bind(this);
        this.hideThinking = this.hideThinking.bind(this);
        
        // Scrolling
        this.scrollToBottom = this.scrollToBottom.bind(this);
        this.scrollToMessage = this.scrollToMessage.bind(this);
        this.isScrolledToBottom = this.isScrolledToBottom.bind(this);
        
        // History
        this.updateChatHistoryUI = this.updateChatHistoryUI.bind(this);
        this.selectChat = this.selectChat.bind(this);
        
        // Wikipedia integration
        this.loadWikipediaArticle = this.loadWikipediaArticle.bind(this);
        this.showArticleSummary = this.showArticleSummary.bind(this);
        this.generateCitation = this.generateCitation.bind(this);
      }
      
      /**
       * Initialize the UI controller
       * @param {Object} options - Configuration options
       * @returns {Promise<Controller>} - Initialized controller
       */
      async init(options = {}) {
        if (this.state.initialized) {
          console.warn('UI controller already initialized');
          return this;
        }
        
        console.time('UI Initialization');
        
        try {
          // Merge configurations
          this.config = this._mergeConfigs(this.config, options);
          
          // Detect system preferences
          this._detectSystemPreferences();
          
          // Cache DOM elements
          this._cacheElements();
          
          // Apply initial theme
          this._applyTheme();
          
          // Load dependencies concurrently
          await Promise.all([
            this._loadMarkdownParser(),
            this._loadCodeHighlighter(),
            this._loadSanitizer()
          ]);
          
          // Register renderers
          this._registerRenderers();
          
          // Set up observers
          this._setupObservers();
          
          // Set up event listeners
          this._setupEventListeners();
          
          // Initialize virtual scroller
          if (this.config.virtualScroller.enabled) {
            this._initVirtualScroller();
          }
          
          // Set up keyboard shortcuts
          this._setupKeyboardShortcuts();
          
          // Start timestamp updater
          this._startTimestampUpdater();
          
          // Initialize plugins if available
          await this._initPlugins();
          
          // Mark as initialized
          this.state.initialized = true;
          
          // Perform initial render
          this.render();
          
          console.timeEnd('UI Initialization');
          
          // Emit initialized event
          this._emitEvent('initialized', { 
            timestamp: Date.now(),
            config: this.config
          });
          
          return this;
        } catch (error) {
          console.error('Failed to initialize UI controller:', error);
          this._emitEvent('initError', { error });
          throw error;
        }
      }
      
      /**
       * Cleanly destroy the UI controller and release resources
       */
      destroy() {
        if (!this.state.initialized) return;
        
        // Clear timers
        clearInterval(this.state.timestampUpdateTimer);
        clearTimeout(this.state.renderTimer);
        
        // Disconnect observers
        Object.values(this.state.observers).forEach(observer => {
          if (observer) observer.disconnect();
        });
        
        // Remove event listeners
        this._removeEventListeners();
        
        // Release DOM references
        this.state.elements.clear();
        this.state.messages.clear();
        this.state.visibleMessages.clear();
        
        // Clean up dependencies
        this.dependencies = {
          markdownParser: null,
          codeHighlighter: null,
          sanitizer: null
        };
        
        // Reset state
        this.state.initialized = false;
        
        // Emit destroyed event
        this._emitEvent('destroyed', { timestamp: Date.now() });
      }
      
      /**
       * Performs a complete UI render
       * @param {Object} options - Render options
       */
      render(options = {}) {
        if (!this.state.initialized) return;
        
        const { force = false } = options;
        
        // Skip if there's a queued render and we're not forcing
        if (this.state.renderTimer && !force) return;
        
        // Apply pending style updates
        this._updateStyles();
        
        // Clear previous render timer
        if (this.state.renderTimer) {
          clearTimeout(this.state.renderTimer);
          this.state.renderTimer = null;
        }
        
        // Process render queue in chunks to avoid blocking the main thread
        this._processRenderQueue();
        
        // Update virtual scroller
        if (this.config.virtualScroller.enabled) {
          this._updateVirtualScroller();
        }
        
        // Update date headers
        this._updateDateHeaders();
        
        // Update message grouping
        this._updateMessageGrouping();
        
        // Update timestamps
        this._updateAllTimestamps();
        
        // Process any pending toast notifications
        this._processToastQueue();
        
        // Emit render event
        this._emitEvent('render', { timestamp: Date.now() });
      }
  
      // ===============================================================
      // Message Management Methods
      // ===============================================================
      
      /**
       * Add a new message to the chat
       * @param {Object} message - Message data
       * @param {Object} options - Message options
       * @returns {HTMLElement} - Message element
       */
      addMessage(message, options = {}) {
        const {
          animate = true,
          prepend = false,
          scrollIntoView = true,
          notify = true,
          groupWithPrevious = false
        } = options;
        
        // Get chat container
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return null;
        
        // Hide welcome screen if visible
        this._hideWelcomeScreen();
        
        // Generate message ID if not provided
        const messageId = message.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        
        // Check if message already exists
        if (this.state.messages.has(messageId)) {
          return this.updateMessage(messageId, message);
        }
        
        // Determine grouping
        let shouldGroup = groupWithPrevious;
        
        if (!shouldGroup && this.config.messageGrouping.enabled) {
          shouldGroup = this._shouldGroupWithPreviousMessage(message);
        }
        
        // Check if we need date header
        const needsDateHeader = this._shouldAddDateHeader(message.timestamp || Date.now());
        
        // Create message element
        const messageElement = this._createMessageElement(message, {
          messageId,
          animate,
          grouped: shouldGroup
        });
        
        // Store in state
        this.state.messages.set(messageId, {
          id: messageId,
          element: messageElement,
          data: { ...message },
          timestamp: message.timestamp || Date.now(),
          isVisible: false,
          contentLoaded: !this.config.performance.lazyLoadContent,
          refs: new Map()
        });
        
        // Create fragment for efficient DOM insertion
        const fragment = document.createDocumentFragment();
        
        // Add date header if needed
        if (needsDateHeader && !shouldGroup) {
          const dateHeader = this._createDateHeader(message.timestamp || Date.now());
          fragment.appendChild(dateHeader);
        }
        
        // Add message to fragment
        fragment.appendChild(messageElement);
        
        // Add to DOM in correct position
        if (prepend) {
          chatContainer.insertBefore(fragment, chatContainer.firstChild);
        } else {
          chatContainer.appendChild(fragment);
        }
        
        // Observe for visibility
        if (this.state.observers.message) {
          this.state.observers.message.observe(messageElement);
        }
        
        // Update unread count for assistant messages
        if (message.role === 'assistant') {
          this._incrementUnreadCount();
        }
        
        // Scroll into view if requested
        if (scrollIntoView) {
          this.scrollToMessage(messageId);
        }
        
        // Announce to screen readers
        if (notify && this.config.accessibility.announceMessages) {
          this._announceMessage(message);
        }
        
        // Update virtual scroller
        if (this.config.virtualScroller.enabled) {
          this._updateVirtualScroller();
        }
        
        // Emit event
        this._emitEvent('messageAdded', {
          id: messageId,
          message: { ...message },
          element: messageElement
        });
        
        // Process Wikipedia links if present
        if (message.content && typeof message.content === 'string' && 
            message.content.includes('wikipedia.org')) {
          this._processWikipediaLinks(messageElement, message.content);
        }
        
        return messageElement;
      }
      
      /**
       * Update an existing message
       * @param {string} messageId - Message ID to update
       * @param {Object} updates - Update data
       * @param {Object} options - Update options
       * @returns {HTMLElement} - Updated message element
       */
      updateMessage(messageId, updates = {}, options = {}) {
        const {
          animate = true,
          scrollIntoView = false,
          updateTimestamp = true,
          partial = false
        } = options;
        
        // Check if message exists
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return null;
        
        const { element, data } = messageData;
        
        // Save previous state for undo
        if (options.addToHistory !== false) {
          this._saveToUndoStack({
            type: 'update',
            messageId,
            previousData: { ...data },
            currentData: partial ? { ...data, ...updates } : { ...updates }
          });
        }
        
        // Merge or replace data
        const updatedData = partial 
          ? { ...data, ...updates } 
          : { id: data.id, role: data.role, ...updates };
        
        // Update timestamp if requested
        if (updateTimestamp) {
          messageData.timestamp = updates.timestamp || Date.now();
          updatedData.timestamp = messageData.timestamp;
        }
        
        // Update stored data
        messageData.data = updatedData;
        
        // Update DOM
        this._updateMessageElement(element, updatedData, { animate });
        
        // Scroll if requested
        if (scrollIntoView) {
          this.scrollToMessage(messageId);
        }
        
        // Process Wikipedia links if content changed
        if (updatedData.content && typeof updatedData.content === 'string' && 
            updatedData.content.includes('wikipedia.org')) {
          this._processWikipediaLinks(element, updatedData.content);
        }
        
        // Emit event
        this._emitEvent('messageUpdated', {
          id: messageId,
          updates: updatedData,
          element
        });
        
        return element;
      }
      
      /**
       * Remove a message from the chat
       * @param {string} messageId - Message ID to remove
       * @param {Object} options - Removal options
       * @returns {boolean} Whether removal was successful
       */
      removeMessage(messageId, options = {}) {
        const {
          animate = true,
          updateLayout = true,
          addToHistory = true
        } = options;
        
        // Check if message exists
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return false;
        
        // Save to undo stack if requested
        if (addToHistory) {
          this._saveToUndoStack({
            type: 'remove',
            messageId,
            data: { ...messageData.data }
          });
        }
        
        // Handle animation
        if (animate && !this.config.animations.reducedMotion) {
          const { element } = messageData;
          
          // Add removing class for animation
          DOM.addClass(element, CSS.message.deleting);
          
          // Remove after animation completes
          setTimeout(() => {
            this._removeMessageFromDOM(element, messageId);
            
            if (updateLayout) {
              this._updateLayout();
            }
          }, this.config.animations.duration);
        } else {
          // Remove immediately
          this._removeMessageFromDOM(messageData.element, messageId);
          
          if (updateLayout) {
            this._updateLayout();
          }
        }
        
        // Emit event
        this._emitEvent('messageRemoved', { id: messageId });
        
        return true;
      }
      
      /**
       * Start streaming a response
       * @param {string} messageId - Message ID for stream
       * @param {Object} initialData - Initial message data
       * @returns {HTMLElement} Message element
       */
      startStreaming(messageId, initialData = {}) {
        // Create or get existing message
        let messageElement;
        
        if (!this.state.messages.has(messageId)) {
          // Create new message for streaming
          const message = {
            id: messageId,
            role: initialData.role || 'assistant',
            content: initialData.content || '',
            timestamp: initialData.timestamp || Date.now(),
            ...initialData
          };
          
          // Add as streaming message
          messageElement = this.addMessage(message, {
            scrollIntoView: true,
            notify: false
          });
          
          // Add streaming class
          DOM.addClass(messageElement, CSS.message.streaming);
        } else {
          // Update existing message
          const messageData = this.state.messages.get(messageId);
          messageElement = messageData.element;
          
          // Update with streaming class
          DOM.addClass(messageElement, CSS.message.streaming);
        }
        
        // Update streaming state
        this.state.streaming = {
          active: true,
          messageId,
          content: initialData.content || '',
          startTime: Date.now(),
          bytesSinceLastUpdate: 0,
          totalBytes: 0
        };
        
        // Hide thinking indicator if visible
        this.hideThinking();
        
        // Emit event
        this._emitEvent('streamingStarted', { 
          id: messageId,
          timestamp: Date.now() 
        });
        
        return messageElement;
      }
      
      /**
       * Append content to a streaming message
       * @param {string} messageId - Message ID
       * @param {string} content - Content to append
       * @param {Object} options - Append options
       * @returns {HTMLElement} Message element
       */
      appendStreamContent(messageId, content, options = {}) {
        const {
          scrollIntoView = true,
          replace = false,
          updateDOM = true
        } = options;
        
        // Check if message exists
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return null;
        
        const { element, data } = messageData;
        
        // Update streaming state
        const contentLength = content?.length || 0;
        this.state.streaming.bytesSinceLastUpdate += contentLength;
        this.state.streaming.totalBytes += contentLength;
        
        // Update message content
        if (replace) {
          this.state.streaming.content = content;
          data.content = content;
        } else {
          this.state.streaming.content += content;
          data.content = (data.content || '') + content;
        }
        
        // Update DOM if requested and enough content accumulated
        // This batches updates for better performance
        if (updateDOM && 
            (this.state.streaming.bytesSinceLastUpdate > 50 || replace)) {
          this._updateStreamingContent(element, data.content);
          this.state.streaming.bytesSinceLastUpdate = 0;
        }
        
        // Scroll into view if requested and user is at bottom
        if (scrollIntoView && this.state.scrollLocked) {
          this.scrollToBottom({ behavior: 'auto' });
        }
        
        return element;
      }
      
      /**
       * Stop streaming and finalize message
       * @param {string} messageId - Message ID
       * @param {Object|string} finalContent - Final content
       * @returns {HTMLElement} Finalized message element
       */
      stopStreaming(messageId, finalContent = null) {
        // Check if message exists
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return null;
        
        const { element, data } = messageData;
        
        // Remove streaming class
        DOM.removeClass(element, CSS.message.streaming);
        
        // Update with final content if provided
        if (finalContent !== null) {
          // String content
          if (typeof finalContent === 'string') {
            data.content = finalContent;
          } 
          // Object with updates
          else if (finalContent && typeof finalContent === 'object') {
            Object.assign(data, finalContent);
          }
          
          // Update element
          this._updateMessageElement(element, data, { animate: false });
        }
        
        // Reset streaming state
        this.state.streaming = {
          active: false,
          messageId: null,
          content: '',
          startTime: 0,
          bytesSinceLastUpdate: 0,
          totalBytes: 0
        };
        
        // Announce to screen readers
        if (this.config.accessibility.announceMessages) {
          this._announceMessage(data, true);
        }
        
        // Scroll to bottom if locked
        if (this.state.scrollLocked) {
          this.scrollToBottom();
        }
        
        // Emit event
        this._emitEvent('streamingStopped', { 
          id: messageId,
          timestamp: Date.now(),
          totalBytes: this.state.streaming.totalBytes
        });
        
        return element;
      }
      
      /**
       * Show thinking indicator
       * @param {Object} options - Options for thinking indicator
       * @returns {HTMLElement} Thinking indicator element
       */
      showThinking(options = {}) {
        const {
          model = 'Claude',
          delay = 0,
          text = null
        } = options;
        
        // Hide existing indicator
        this.hideThinking();
        
        // Don't animate if reduced motion
        const animate = !this.config.animations.reducedMotion;
        
        // Hide welcome screen if visible
        this._hideWelcomeScreen();
        
        // Use delay if requested
        if (delay > 0) {
          setTimeout(() => {
            const indicator = this._createThinkingIndicator(model, animate, text);
            this.state.thinking = true;
            return indicator;
          }, delay);
          
          this.state.thinking = true;
          return null;
        } else {
          const indicator = this._createThinkingIndicator(model, animate, text);
          this.state.thinking = true;
          return indicator;
        }
      }
      
      /**
       * Hide thinking indicator
       * @param {Object} options - Options for hiding
       * @returns {boolean} Whether indicator was hidden
       */
      hideThinking(options = {}) {
        const thinkingIndicator = document.getElementById('thinkingIndicator');
        if (!thinkingIndicator) {
          this.state.thinking = false;
          return false;
        }
        
        const { animate = !this.config.animations.reducedMotion } = options;
        
        if (animate) {
          // Add removing class for animation
          DOM.addClass(thinkingIndicator, 'removing');
          
          // Remove after animation
          setTimeout(() => {
            DOM.remove(thinkingIndicator);
            this.state.thinking = false;
          }, this.config.animations.duration);
        } else {
          // Remove immediately
          DOM.remove(thinkingIndicator);
          this.state.thinking = false;
        }
        
        return true;
      }
      
      /**
       * Update the chat history UI in sidebar
       * @param {Object} state - Application state
       */
      updateChatHistoryUI(state) {
        const chatHistory = this.state.elements.get('chatHistory');
        if (!chatHistory || !state.chats) return;
        
        // Update current chat ID
        this.state.currentChatId = state.currentChat?.id;
        
        // Create document fragment
        const fragment = document.createDocumentFragment();
        
        // Clear with animation then rebuild
        this._clearChatHistory(chatHistory, () => {
          // Empty state
          if (state.chats.length === 0) {
            const emptyItem = DOM.create('li', {
              props: { className: 'empty-history' },
              children: ['No chats yet']
            });
            fragment.appendChild(emptyItem);
          } else {
            // Create chat history items
            state.chats.forEach(chat => {
              const listItem = this._createChatHistoryItem(chat, state.currentChat?.id);
              fragment.appendChild(listItem);
            });
          }
          
          // Add to DOM
          chatHistory.appendChild(fragment);
          
          // Apply entrance animations
          this._animateChatHistoryItems(chatHistory);
        });
      }
      
      /**
       * Select a chat from history
       * @param {string} chatId - Chat ID to select
       */
      selectChat(chatId) {
        // Get chat history element
        const chatHistory = this.state.elements.get('chatHistory');
        if (!chatHistory) return;
        
        // Find all chat items
        const chatItems = chatHistory.querySelectorAll('li[data-chat-id]');
        
        // Update selected state
        chatItems.forEach(item => {
          const isSelected = item.dataset.chatId === chatId;
          const button = item.querySelector('button');
          
          if (button) {
            button.classList.toggle('active', isSelected);
            button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
          }
        });
        
        // Update current chat ID
        this.state.currentChatId = chatId;
        
        // Emit event
        this._emitEvent('chatSelected', { chatId });
      }
  
      // ===============================================================
      // Scroll Management Methods
      // ===============================================================
      
      /**
       * Scroll to the bottom of the chat
       * @param {Object} options - Scroll options
       */
      scrollToBottom(options = {}) {
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return;
        
        const { behavior = this.config.scrollBehavior } = options;
        
        const scrollOptions = { 
          behavior: this.config.animations.reducedMotion ? 'auto' : behavior
        };
        
        // Scroll to bottom
        chatContainer.scrollTo({
          top: chatContainer.scrollHeight,
          ...scrollOptions
        });
        
        // Update scroll lock state
        this.state.scrollLocked = true;
        
        // Hide scroll button if visible
        const scrollButton = this.state.elements.get('scrollToBottomBtn');
        if (scrollButton) {
          scrollButton.classList.remove('visible');
        }
      }
      
      /**
       * Scroll to a specific message
       * @param {string} messageId - Message ID to scroll to
       * @param {Object} options - Scroll options
       */
      scrollToMessage(messageId, options = {}) {
        const {
          behavior = this.config.scrollBehavior,
          block = 'center',
          focus = false
        } = options;
        
        // Get message element
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return;
        
        const { element } = messageData;
        
        // Scroll into view
        element.scrollIntoView({
          behavior: this.config.animations.reducedMotion ? 'auto' : behavior,
          block
        });
        
        // Focus message if requested
        if (focus) {
          element.focus();
          this.state.activeMessageId = messageId;
          
          // Highlight briefly
          DOM.addClass(element, CSS.message.focused);
          setTimeout(() => {
            DOM.removeClass(element, CSS.message.focused);
          }, 2000);
        }
      }
      
      /**
       * Check if the chat is scrolled to the bottom
       * @returns {boolean} Whether chat is at bottom
       */
      isScrolledToBottom() {
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return true;
        
        const { scrollTop, scrollHeight, clientHeight } = chatContainer;
        const scrollBottom = scrollTop + clientHeight;
        
        // Consider "at bottom" if within 20px or 5% of container height
        const threshold = Math.min(20, clientHeight * 0.05);
        
        return scrollBottom >= scrollHeight - threshold;
      }
      
      // ===============================================================
      // Wikipedia Integration Methods
      // ===============================================================
      
      /**
       * Load a Wikipedia article
       * @param {string} articleTitle - Article title or URL
       * @returns {Promise<Object>} Article data
       */
      async loadWikipediaArticle(articleTitle) {
        try {
          // Extract title from URL if needed
          let title = articleTitle;
          if (articleTitle.includes('wikipedia.org')) {
            const url = new URL(articleTitle);
            const pathParts = url.pathname.split('/');
            title = pathParts[pathParts.length - 1];
          }
          
          // Decode URI component if needed
          title = decodeURIComponent(title.replace(/_/g, ' '));
          
          // Show loading state
          this.showThinking({ text: `Fetching Wikipedia article: ${title}` });
          
          // Use Wikipedia API
          const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to load article: ${response.statusText}`);
          }
          
          const article = await response.json();
          
          // Store in state
          this.state.wikipediaArticle = article;
          
          // Hide loading indicator
          this.hideThinking();
          
          // Emit event
          this._emitEvent('wikipediaArticleLoaded', { article });
          
          return article;
        } catch (error) {
          console.error('Error loading Wikipedia article:', error);
          
          // Show error toast
          this._showToast({
            type: 'error',
            title: 'Error Loading Article',
            message: error.message || 'Failed to load Wikipedia article'
          });
          
          // Hide loading indicator
          this.hideThinking();
          
          // Emit error event
          this._emitEvent('wikipediaError', { error });
          
          return null;
        }
      }
      
      /**
       * Show article summary in UI
       * @param {Object} article - Article data
       * @param {Object} options - Display options
       */
      showArticleSummary(article, options = {}) {
        const {
          addAsMessage = true,
          showImage = true
        } = options;
        
        const articleData = article || this.state.wikipediaArticle;
        if (!articleData) return;
        
        if (addAsMessage) {
          // Create message with article summary
          const message = {
            role: 'assistant',
            content: `**Wikipedia Summary: ${articleData.title}**\n\n${articleData.extract}`,
            type: 'wikiReference',
            metadata: {
              source: articleData.content_urls.desktop.page,
              title: articleData.title,
              image: showImage && articleData.thumbnail ? articleData.thumbnail.source : null,
              lastModified: articleData.timestamp
            }
          };
          
          // Add to chat
          this.addMessage(message);
        } else {
          // Show in sidebar or overlay
          const infoPanel = this.state.elements.get('infoPanel') || this._createInfoPanel();
          
          // Update panel content
          DOM.empty(infoPanel);
          
          // Add article info
          const articleInfo = DOM.create('div', {
            props: { className: 'wiki-article-info' }
          });
          
          // Add title
          const title = DOM.create('h3', {
            props: { className: 'wiki-article-title' },
            children: [articleData.title]
          });
          articleInfo.appendChild(title);
          
          // Add image if available and requested
          if (showImage && articleData.thumbnail) {
            const imageContainer = DOM.create('div', {
              props: { className: 'wiki-article-image' }
            });
            
            const image = DOM.create('img', {
              attrs: {
                src: articleData.thumbnail.source,
                alt: articleData.title,
                loading: 'lazy'
              }
            });
            
            imageContainer.appendChild(image);
            articleInfo.appendChild(imageContainer);
          }
          
          // Add description
          const description = DOM.create('div', {
            props: { className: 'wiki-article-description' },
            children: [articleData.extract]
          });
          articleInfo.appendChild(description);
          
          // Add link
          const link = DOM.create('a', {
            attrs: {
              href: articleData.content_urls.desktop.page,
              target: '_blank',
              rel: 'noopener noreferrer'
            },
            props: { className: 'wiki-article-link' },
            children: ['Read more on Wikipedia']
          });
          articleInfo.appendChild(link);
          
          // Add cite button
          const citeBtn = DOM.create('button', {
            props: { className: 'wiki-cite-btn' },
            children: ['Generate Citation'],
            events: {
              click: () => this.generateCitation(articleData)
            }
          });
          articleInfo.appendChild(citeBtn);
          
          // Add to panel
          infoPanel.appendChild(articleInfo);
          
          // Show panel
          infoPanel.classList.add('visible');
        }
      }
      
      /**
       * Generate citation for article
       * @param {Object} article - Article data
       * @param {string} format - Citation format
       * @returns {string} Formatted citation
       */
      generateCitation(article, format = this.config.citationFormat.default) {
        const articleData = article || this.state.wikipediaArticle;
        if (!articleData) return null;
        
        // Get authors (for Wikipedia, it's "contributors")
        const author = "Wikipedia contributors";
        
        // Format date
        const publicationDate = new Date(articleData.timestamp);
        const formattedDate = publicationDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        // Format citation based on style
        let citation = '';
        
        switch (format.toUpperCase()) {
          case 'MLA':
            citation = `${author}. "${articleData.title}." <i>Wikipedia</i>, ${formattedDate}, ${articleData.content_urls.desktop.page}.`;
            break;
            
          case 'APA':
            citation = `${author}. (${publicationDate.getFullYear()}, ${publicationDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}). <i>${articleData.title}</i>. In <i>Wikipedia</i>. ${articleData.content_urls.desktop.page}`;
            break;
            
          case 'CHICAGO':
            citation = `${author}, "${articleData.title}," <i>Wikipedia</i>, last modified ${formattedDate}, ${articleData.content_urls.desktop.page}.`;
            break;
            
          case 'IEEE':
            citation = `"${articleData.title}," <i>Wikipedia</i>. [Online]. Available: ${articleData.content_urls.desktop.page}. [Accessed: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}].`;
            break;
            
          default:
            citation = `${author}. "${articleData.title}." <i>Wikipedia</i>, ${formattedDate}, ${articleData.content_urls.desktop.page}.`;
        }
        
        // Show toast with copy option
        this._showToast({
          title: `${format.toUpperCase()} Citation Generated`,
          message: citation,
          type: 'info',
          duration: 8000,
          actions: [
            {
              label: 'Copy',
              callback: () => {
                navigator.clipboard.writeText(citation.replace(/<\/?i>/g, ''));
                this._showToast({
                  title: 'Citation Copied',
                  type: 'success',
                  duration: 2000
                });
              }
            }
          ]
        });
        
        return citation;
      }
  
      // ===============================================================
      // Event Handlers
      // ===============================================================
      
      /**
       * Handle scroll events
       * @param {Event} e - Scroll event
       */
      handleScroll(e) {
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return;
        
        // Get current scroll position
        const currentScroll = chatContainer.scrollTop;
        const previousScroll = this.state.virtualScroller.scrollPosition || 0;
        
        // Determine scroll direction
        const scrollingDown = currentScroll > previousScroll;
        
        // Update scroll state
        this.state.virtualScroller.scrollPosition = currentScroll;
        this.state.virtualScroller.scrollingDown = scrollingDown;
        
        // Check if at bottom
        const isAtBottom = this.isScrolledToBottom();
        
        // Update scroll lock state
        if (isAtBottom !== this.state.scrollLocked) {
          this.state.scrollLocked = isAtBottom;
          
          // Update scroll button visibility
          const scrollButton = this.state.elements.get('scrollToBottomBtn');
          if (scrollButton) {
            scrollButton.classList.toggle('visible', !isAtBottom);
          }
        }
        
        // Update sticky date headers
        this._updateStickyHeaders();
        
        // Update virtual scroller if enabled
        if (this.config.virtualScroller.enabled) {
          this._updateVirtualScroller();
        }
        
        // Load content for newly visible messages
        if (this.config.performance.lazyLoadContent) {
          this._loadVisibleContent();
        }
        
        // Emit scroll event
        this._emitEvent('scroll', {
          scrollTop: currentScroll,
          scrollingDown,
          atBottom: isAtBottom
        });
      }
      
      /**
       * Handle window resize events
       */
      handleResize() {
        // Update layout measurements
        this._updateLayoutMeasurements();
        
        // Update virtual scroller
        if (this.config.virtualScroller.enabled) {
          this._updateVirtualScroller();
        }
        
        // Update sticky headers
        this._updateStickyHeaders();
      }
      
      /**
       * Handle theme changes
       */
      handleThemeChange() {
        // Detect theme
        const isDark = document.body.classList.contains('dark-theme') ||
                       document.documentElement.classList.contains('dark');
        
        // Update code highlighter theme
        if (this.config.codeHighlighting.enabled && this.dependencies.codeHighlighter) {
          this.config.codeHighlighting.theme = isDark ? 'dark' : 'light';
          
          // Rehighlight visible code blocks
          this._rehighlightCodeBlocks();
        }
        
        // Update any theme-dependent UI
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        
        // Emit theme change event
        this._emitEvent('themeChanged', {
          theme: isDark ? 'dark' : 'light'
        });
      }
      
      /**
       * Handle keyboard events
       * @param {KeyboardEvent} e - Keyboard event
       */
      handleKeyDown(e) {
        // Process registered shortcuts
        this._processKeyboardShortcuts(e);
      }
  
      // ===============================================================
      // Private Implementation Methods
      // ===============================================================
      
      /**
       * Merge configuration objects
       * @param {Object} target - Target configuration
       * @param {Object} source - Source configuration
       * @returns {Object} Merged configuration
       * @private
       */
      _mergeConfigs(target, source) {
        const result = { ...target };
        
        for (const key in source) {
          // Skip null/undefined values
          if (source[key] === null || source[key] === undefined) continue;
          
          // Deep merge for objects (but not arrays)
          if (typeof source[key] === 'object' && !Array.isArray(source[key]) &&
              typeof target[key] === 'object' && !Array.isArray(target[key])) {
            result[key] = this._mergeConfigs(target[key], source[key]);
          } else {
            result[key] = source[key];
          }
        }
        
        return result;
      }
      
      /**
       * Detect system preferences for accessibility and animations
       * @private
       */
      _detectSystemPreferences() {
        // Check for reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
          this.config.animations.reducedMotion = true;
          this.config.accessibility.reducedMotion = true;
          this.config.animations.duration = 0;
          this.config.scrollBehavior = 'auto';
          this.config.typewriter.enabled = false;
        }
        
        // Check for high contrast
        const prefersContrast = window.matchMedia('(prefers-contrast: more)').matches;
        if (prefersContrast) {
          this.config.accessibility.highContrast = true;
        }
        
        // Check for dark mode
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDarkMode && !document.body.classList.contains('light-theme')) {
          this.config.codeHighlighting.theme = 'dark';
        }
      }
      
      /**
       * Cache common DOM elements
       * @private
       */
      _cacheElements() {
        // Main containers and elements
        const commonElements = [
          'chatContainer', 'welcomeScreen', 'userInput', 'sendButton', 
          'attachButton', 'fileUpload', 'chatHistory', 'settingsPanel',
          'overlay', 'toastContainer', 'menuBtn', 'sidebar', 'newChatBtn',
          'formatButton', 'formatMenu', 'scrollToBottomBtn', 'infoPanel'
        ];
        
        // Cache each element if available
        commonElements.forEach(id => {
          const element = document.getElementById(id);
          if (element) {
            this.state.elements.set(id, element);
          }
        });
        
        // Create essential elements if missing
        this._ensureRequiredElementsExist();
      }
      
      /**
       * Ensure required elements exist
       * @private
       */
      _ensureRequiredElementsExist() {
        // Create toast container if needed
        if (!this.state.elements.has('toastContainer')) {
          const toastContainer = DOM.create('div', {
            attrs: { id: 'toastContainer' },
            props: { className: 'wikichat-toast-container' }
          });
          document.body.appendChild(toastContainer);
          this.state.elements.set('toastContainer', toastContainer);
        }
        
        // Create accessibility live region
        if (this.config.accessibility.announceMessages) {
          const liveRegion = document.getElementById('sr-live-region') || 
            DOM.create('div', {
              attrs: {
                id: 'sr-live-region',
                'aria-live': 'polite',
                'aria-atomic': 'true'
              },
              props: { className: 'sr-only' }
            });
          
          if (!liveRegion.parentNode) {
            document.body.appendChild(liveRegion);
          }
          
          this.state.elements.set('liveRegion', liveRegion);
        }
        
        // Create scroll-to-bottom button if needed
        if (!this.state.elements.has('scrollToBottomBtn')) {
          const chatContainer = this.state.elements.get('chatContainer');
          if (chatContainer) {
            const scrollButton = DOM.create('button', {
              attrs: {
                id: 'scrollToBottomBtn',
                'aria-label': 'Scroll to bottom'
              },
              props: { 
                className: 'scroll-to-bottom-btn',
                innerHTML: `
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                `
              },
              events: {
                click: () => this.scrollToBottom()
              }
            });
            
            chatContainer.appendChild(scrollButton);
            this.state.elements.set('scrollToBottomBtn', scrollButton);
          }
        }
      }
      
      /**
       * Apply theme to the UI
       * @private
       */
      _applyTheme() {
        // Apply theme attribute
        const isDarkTheme = document.body.classList.contains('dark-theme') ||
                           document.documentElement.classList.contains('dark') ||
                           window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
        
        // Set code highlighting theme
        this.config.codeHighlighting.theme = isDarkTheme ? 'dark' : 'light';
        
        // Apply high contrast if needed
        if (this.config.accessibility.highContrast) {
          document.documentElement.setAttribute('data-high-contrast', 'true');
        }
        
        // Apply reduced motion if needed
        if (this.config.animations.reducedMotion) {
          document.documentElement.setAttribute('data-reduced-motion', 'true');
        }
      }
      
      /**
       * Load markdown parser
       * @returns {Promise} Resolved when loaded
       * @private
       */
      async _loadMarkdownParser() {
        if (!this.config.markdown.enabled) return;
        
        try {
          // Load Marked library
          const markedUrl = 'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js';
          
          // Use dynamic import with fallback
          try {
            const { marked } = await import(markedUrl);
            this.dependencies.markdownParser = marked;
          } catch (e) {
            // Fallback to loading script
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = markedUrl;
              script.onload = () => {
                this.dependencies.markdownParser = window.marked;
                resolve();
              };
              script.onerror = reject;
              document.head.appendChild(script);
            });
          }
          
          // Configure markdown parser
          if (this.dependencies.markdownParser) {
            this.dependencies.markdownParser.setOptions({
              gfm: true,
              breaks: this.config.markdown.breaks,
              sanitize: this.config.markdown.sanitize,
              smartLists: true,
              smartypants: true,
              headerIds: false,
              mangle: false
            });
          }
        } catch (error) {
          console.error('Failed to load markdown parser:', error);
          this.config.markdown.enabled = false;
        }
      }
      
      /**
       * Load code syntax highlighter
       * @returns {Promise} Resolved when loaded
       * @private
       */
      async _loadCodeHighlighter() {
        if (!this.config.codeHighlighting.enabled) return;
        
        try {
          // Load highlight.js
          const highlightUrl = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/highlight.min.js';
          
          // Use dynamic import with fallback
          try {
            const hljs = await import(highlightUrl);
            this.dependencies.codeHighlighter = hljs.default;
          } catch (e) {
            // Fallback to loading script
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = highlightUrl;
              script.onload = () => {
                this.dependencies.codeHighlighter = window.hljs;
                resolve();
              };
              script.onerror = reject;
              document.head.appendChild(script);
            });
          }
          
          // Load CSS
          const isDark = this.config.codeHighlighting.theme === 'dark';
          const cssUrl = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/styles/${
            isDark ? 'github-dark' : 'github'
          }.min.css`;
          
          if (!document.querySelector(`link[href="${cssUrl}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssUrl;
            document.head.appendChild(link);
          }
          
          // Load common languages
          if (this.dependencies.codeHighlighter) {
            // Preload common languages
            const commonLangs = this.config.codeHighlighting.languages.slice(0, 5);
            await Promise.all(commonLangs.map(async lang => {
              try {
                const langUrl = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/languages/${lang}.min.js`;
                await import(langUrl);
              } catch (err) {
                console.warn(`Failed to load language: ${lang}`, err);
              }
            }));
          }
        } catch (error) {
          console.error('Failed to load code highlighter:', error);
          this.config.codeHighlighting.enabled = false;
        }
      }
      
      /**
       * Load HTML sanitizer
       * @returns {Promise} Resolved when loaded
       * @private
       */
      async _loadSanitizer() {
        if (!this.config.markdown.sanitize) return;
        
        try {
          // Load DOMPurify
          const purifyUrl = 'https://cdn.jsdelivr.net/npm/dompurify@3.0.5/dist/purify.min.js';
          
          // Use dynamic import with fallback
          try {
            const { default: DOMPurify } = await import(purifyUrl);
            this.dependencies.sanitizer = DOMPurify;
          } catch (e) {
            // Fallback to loading script
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = purifyUrl;
              script.onload = () => {
                this.dependencies.sanitizer = window.DOMPurify;
                resolve();
              };
              script.onerror = reject;
              document.head.appendChild(script);
            });
          }
          
          // Configure sanitizer
          if (this.dependencies.sanitizer) {
            this.dependencies.sanitizer.setConfig({
              ALLOWED_TAGS: this.config.markdown.allowedTags,
              ALLOW_UNKNOWN_PROTOCOLS: false,
              ADD_ATTR: ['target']
            });
          }
        } catch (error) {
          console.error('Failed to load HTML sanitizer:', error);
        }
      }
      
      /**
       * Register message renderer strategies
       * @private
       */
      _registerRenderers() {
        // Default renderer for plain text
        this.renderers.set(RENDERERS.DEFAULT, this._renderDefaultMessage.bind(this));
        
        // Specialized renderers
        this.renderers.set(RENDERERS.STREAMING, this._renderStreamingMessage.bind(this));
        this.renderers.set(RENDERERS.THINKING, this._renderThinkingMessage.bind(this));
        this.renderers.set(RENDERERS.MARKDOWN, this._renderMarkdownMessage.bind(this));
        this.renderers.set(RENDERERS.CODE, this._renderCodeMessage.bind(this));
        this.renderers.set(RENDERERS.IMAGE, this._renderImageMessage.bind(this));
        this.renderers.set(RENDERERS.FILE, this._renderFileMessage.bind(this));
        this.renderers.set(RENDERERS.ERROR, this._renderErrorMessage.bind(this));
        this.renderers.set(RENDERERS.WIKI_REFERENCE, this._renderWikiReferenceMessage.bind(this));
      }
      
      /**
       * Set up observers for DOM changes and visibility
       * @private
       */
      _setupObservers() {
        // Set up intersection observer for message visibility
        this._setupIntersectionObserver();
        
        // Set up resize observer
        this._setupResizeObserver();
        
        // Set up mutation observer for theme changes
        this._setupMutationObserver();
      }
      
      /**
       * Set up intersection observer for message visibility
       * @private
       */
      _setupIntersectionObserver() {
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return;
        
        // Create options with rootMargin to load slightly outside viewport
        const options = {
          root: chatContainer,
          rootMargin: '150px 0px',
          threshold: [0, 0.1, 0.5, 0.9, 1.0]
        };
        
        // Create observer
        this.state.observers.message = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            const messageElement = entry.target;
            const messageId = messageElement.dataset.messageId;
            
            if (entry.isIntersecting) {
              // Message became visible
              this.state.visibleMessages.add(messageId);
              
              // Add visible class for animation
              if (!messageElement.classList.contains(CSS.message.visible)) {
                DOM.addClass(messageElement, CSS.message.visible);
              }
              
              // Update message timestamp
              this._updateMessageTimestamp(messageElement);
              
              // Load content if using lazy loading
              if (this.config.performance.lazyLoadContent) {
                const messageData = this.state.messages.get(messageId);
                if (messageData && !messageData.contentLoaded) {
                  this._loadMessageContent(messageId);
                }
              }
            } else {
              // Message is no longer visible
              this.state.visibleMessages.delete(messageId);
            }
          });
          
          // Update virtual scroller if enabled
          if (this.config.virtualScroller.enabled) {
            this._updateVirtualScroller();
          }
        }, options);
      }
      
      /**
       * Set up resize observer
       * @private
       */
      _setupResizeObserver() {
        if (!window.ResizeObserver) return;
        
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return;
        
        // Create resize observer
        this.state.observers.resize = new ResizeObserver(entries => {
          for (const entry of entries) {
            if (entry.target === chatContainer) {
              // Handle chat container resize
              this._handleContainerResize(entry.contentRect);
            }
          }
        });
        
        // Start observing
        this.state.observers.resize.observe(chatContainer);
      }
      
      /**
       * Set up mutation observer for theme changes
       * @private
       */
      _setupMutationObserver() {
        // Watch for theme class changes on body
        this.state.observers.mutation = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            if (mutation.attributeName === 'class') {
              // Check if the theme has changed
              const target = mutation.target;
              const isDarkTheme = target.classList.contains('dark-theme') || 
                                 target.classList.contains('dark');
              
              const currentTheme = document.documentElement.getAttribute('data-theme');
              if ((isDarkTheme && currentTheme !== 'dark') || 
                  (!isDarkTheme && currentTheme !== 'light')) {
                this.handleThemeChange();
              }
            }
          });
        });
        
        // Observe both body and html elements
        this.state.observers.mutation.observe(document.body, {
          attributes: true,
          attributeFilter: ['class']
        });
        
        this.state.observers.mutation.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class']
        });
      }
      
      /**
       * Set up event listeners
       * @private
       */
      _setupEventListeners() {
        // Scroll events for chat container
        const chatContainer = this.state.elements.get('chatContainer');
        if (chatContainer) {
          chatContainer.addEventListener('scroll', this.handleScroll, { passive: true });
        }
        
        // Window resize
        window.addEventListener('resize', this.handleResize, { passive: true });
        
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Theme change detection
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.handleThemeChange);
        
        // Reduced motion detection
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => {
          this.config.animations.reducedMotion = e.matches;
          this.config.accessibility.reducedMotion = e.matches;
          
          document.documentElement.setAttribute('data-reduced-motion', e.matches ? 'true' : 'false');
          
          if (e.matches) {
            this.config.animations.duration = 0;
            this.config.scrollBehavior = 'auto';
            this.config.typewriter.enabled = false;
          } else {
            this.config.animations.duration = DEFAULT_CONFIG.animations.duration;
            this.config.scrollBehavior = DEFAULT_CONFIG.scrollBehavior;
          }
        });
        
        // Input field events
        const userInput = this.state.elements.get('userInput');
        if (userInput) {
          // Auto-resize textarea
          userInput.addEventListener('input', this._handleInputChange.bind(this));
          
          // Handle special keys
          userInput.addEventListener('keydown', this._handleInputKeydown.bind(this));
        }
        
        // Send button
        const sendButton = this.state.elements.get('sendButton');
        if (sendButton) {
          sendButton.addEventListener('click', this._handleSendClick.bind(this));
        }
        
        // New chat button
        const newChatBtn = this.state.elements.get('newChatBtn');
        if (newChatBtn) {
          newChatBtn.addEventListener('click', this._handleNewChatClick.bind(this));
        }
        
        // Scroll-to-bottom button
        const scrollButton = this.state.elements.get('scrollToBottomBtn');
        if (scrollButton) {
          scrollButton.addEventListener('click', () => this.scrollToBottom());
        }
        
        // Setup click outside listener for context menus
        document.addEventListener('click', this._handleDocumentClick.bind(this));
      }
      
      /**
       * Remove event listeners
       * @private
       */
      _removeEventListeners() {
        // Scroll events
        const chatContainer = this.state.elements.get('chatContainer');
        if (chatContainer) {
          chatContainer.removeEventListener('scroll', this.handleScroll);
        }
        
        // Window resize
        window.removeEventListener('resize', this.handleResize);
        
        // Keyboard events
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // Input field events
        const userInput = this.state.elements.get('userInput');
        if (userInput) {
          userInput.removeEventListener('input', this._handleInputChange);
          userInput.removeEventListener('keydown', this._handleInputKeydown);
        }
        
        // Send button
        const sendButton = this.state.elements.get('sendButton');
        if (sendButton) {
          sendButton.removeEventListener('click', this._handleSendClick);
        }
        
        // Document click
        document.removeEventListener('click', this._handleDocumentClick);
      }
      
      /**
       * Initialize virtual scroller
       * @private
       */
      _initVirtualScroller() {
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return;
        
        // Add virtual scroller class
        chatContainer.classList.add('virtual-scroll-container');
        
        // Create sentinel elements for tracking scroll positions
        const topSentinel = DOM.create('div', {
          attrs: { 'aria-hidden': 'true' },
          props: { 
            className: 'virtual-scroll-sentinel top-sentinel',
            style: 'height: 1px; width: 100%;'
          }
        });
        
        const bottomSentinel = DOM.create('div', {
          attrs: { 'aria-hidden': 'true' },
          props: { 
            className: 'virtual-scroll-sentinel bottom-sentinel',
            style: 'height: 1px; width: 100%;'
          }
        });
        
        // Create spacer elements
        const topSpacer = DOM.create('div', {
          attrs: { 'aria-hidden': 'true' },
          props: { 
            className: 'virtual-scroll-spacer top-spacer',
            style: 'height: 0px; width: 100%;'
          }
        });
        
        const bottomSpacer = DOM.create('div', {
          attrs: { 'aria-hidden': 'true' },
          props: { 
            className: 'virtual-scroll-spacer bottom-spacer',
            style: 'height: 0px; width: 100%;'
          }
        });
        
        // Add to container
        chatContainer.prepend(topSentinel);
        chatContainer.insertBefore(topSpacer, topSentinel.nextSibling);
        chatContainer.appendChild(bottomSpacer);
        chatContainer.appendChild(bottomSentinel);
        
        // Store references
        this.state.elements.set('topSentinel', topSentinel);
        this.state.elements.set('bottomSentinel', bottomSentinel);
        this.state.elements.set('topSpacer', topSpacer);
        this.state.elements.set('bottomSpacer', bottomSpacer);
        
        // Create sentinel observer
        this._setupSentinelObserver();
        
        // Initialize virtual scroller state
        this.state.virtualScroller = {
          ...this.state.virtualScroller,
          containerHeight: chatContainer.clientHeight,
          itemHeights: new Map(),
          averageItemHeight: 0,
          totalHeight: 0,
          visibleStartIndex: 0,
          visibleEndIndex: 0,
          bufferedStartIndex: 0,
          bufferedEndIndex: 0,
          needsUpdate: true
        };
      }
      
      /**
       * Set up sentinel observer for virtual scrolling
       * @private
       */
      _setupSentinelObserver() {
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return;
        
        const options = {
          root: chatContainer,
          rootMargin: '300px 0px',
          threshold: 0
        };
        
        this.state.observers.sentinel = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              if (entry.target.classList.contains('top-sentinel')) {
                // Load more content above
                this._loadMoreAbove();
              } else if (entry.target.classList.contains('bottom-sentinel')) {
                // Load more content below
                this._loadMoreBelow();
              }
            }
          });
        }, options);
        
        // Start observing sentinels
        const topSentinel = this.state.elements.get('topSentinel');
        const bottomSentinel = this.state.elements.get('bottomSentinel');
        
        if (topSentinel) this.state.observers.sentinel.observe(topSentinel);
        if (bottomSentinel) this.state.observers.sentinel.observe(bottomSentinel);
      }
      
      /**
       * Set up keyboard shortcuts
       * @private
       */
      _setupKeyboardShortcuts() {
        // Navigation shortcuts
        this._registerShortcut({
          key: 'n',
          modifiers: { ctrlKey: true },
          description: 'New chat',
          callback: () => this._handleNewChatClick()
        });
        
        this._registerShortcut({
          key: '/',
          description: 'Focus input',
          callback: () => this._focusInput()
        });
        
        this._registerShortcut({
          key: 'Escape',
          description: 'Close popups',
          callback: () => this._handleEscapeKey()
        });
        
        this._registerShortcut({
          key: ',',
          modifiers: { ctrlKey: true },
          description: 'Settings',
          callback: () => this._openSettings()
        });
        
        // Message navigation
        this._registerShortcut({
          key: 'ArrowUp',
          modifiers: { altKey: true },
          description: 'Previous message',
          callback: () => this._navigateToPreviousMessage()
        });
        
        this._registerShortcut({
          key: 'ArrowDown',
          modifiers: { altKey: true },
          description: 'Next message',
          callback: () => this._navigateToNextMessage()
        });
        
        // Formatting shortcuts
        this._registerShortcut({
          key: 'b',
          modifiers: { ctrlKey: true },
          description: 'Bold text',
          callback: (e) => this._formatText(e, '**', '**')
        });
        
        this._registerShortcut({
          key: 'i',
          modifiers: { ctrlKey: true },
          description: 'Italic text',
          callback: (e) => this._formatText(e, '*', '*') 
        });
        
        this._registerShortcut({
          key: '`',
          modifiers: { ctrlKey: true },
          description: 'Inline code',
          callback: (e) => this._formatText(e, '`', '`')
        });
        
        // Undo/redo
        this._registerShortcut({
          key: 'z',
          modifiers: { ctrlKey: true },
          description: 'Undo',
          callback: () => this._undo()
        });
        
        this._registerShortcut({
          key: 'z',
          modifiers: { ctrlKey: true, shiftKey: true },
          description: 'Redo',
          callback: () => this._redo()
        });
        
        // Help
        this._registerShortcut({
          key: '?',
          description: 'Keyboard shortcuts',
          callback: () => this._showKeyboardShortcuts()
        });
      }
      
      /**
       * Register a keyboard shortcut
       * @param {Object} shortcut - Shortcut configuration
       * @private
       */
      _registerShortcut(shortcut) {
        const { key, modifiers = {}, description, callback } = shortcut;
        
        const id = `${key}_${Object.entries(modifiers)
          .filter(([_, value]) => value)
          .map(([modifier]) => modifier)
          .join('_')}`;
        
        this.state.registeredShortcuts.set(id, {
          key,
          modifiers,
          description,
          callback
        });
      }
      
      /**
       * Start timestamp updater
       * @private
       */
      _startTimestampUpdater() {
        // Clear existing timer
        if (this.state.timestampUpdateTimer) {
          clearInterval(this.state.timestampUpdateTimer);
        }
        
        // Only set up interval for relative timestamps
        if (this.config.timestamps.format === 'relative') {
          this.state.timestampUpdateTimer = setInterval(() => {
            this._updateAllTimestamps();
          }, this.config.timestamps.updateInterval);
        }
      }
      
      /**
       * Handle input changes for auto-growing textarea
       * @param {Event} e - Input event
       * @private
       */
      _handleInputChange(e) {
        const textarea = e.target;
        
        // Reset height to auto to get proper scrollHeight
        textarea.style.height = 'auto';
        
        // Set new height
        const newHeight = Math.min(
          Math.max(textarea.scrollHeight, 40),
          300
        );
        textarea.style.height = `${newHeight}px`;
        
        // Toggle empty state
        const hasContent = textarea.value.trim().length > 0;
        textarea.classList.toggle('has-content', hasContent);
        
        // Enable/disable send button
        const sendButton = this.state.elements.get('sendButton');
        if (sendButton) {
          sendButton.disabled = !hasContent;
          sendButton.setAttribute('aria-disabled', !hasContent);
        }
        
        // Emit input event
        this._emitEvent('inputChanged', {
          content: textarea.value,
          isEmpty: !hasContent
        });
      }
      
      /**
       * Handle input keydown events
       * @param {KeyboardEvent} e - Keyboard event
       * @private
       */
      _handleInputKeydown(e) {
        // Send message on Enter (but not with Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
          const value = e.target.value.trim();
          
          if (value) {
            e.preventDefault();
            this._sendMessage(value);
          }
        }
      }
      
      /**
       * Handle send button click
       * @private
       */
      _handleSendClick() {
        const userInput = this.state.elements.get('userInput');
        if (!userInput) return;
        
        const value = userInput.value.trim();
        if (value) {
          this._sendMessage(value);
        }
      }
      
      /**
       * Handle document click (for closing context menus, etc.)
       * @param {MouseEvent} e - Click event
       * @private
       */
      _handleDocumentClick(e) {
        // Close context menu if open and click is outside
        if (this.state.contextMenuOpen) {
          const contextMenu = document.querySelector('.context-menu');
          if (contextMenu && !contextMenu.contains(e.target) &&
              !e.target.classList.contains('context-menu-trigger')) {
            contextMenu.remove();
            this.state.contextMenuOpen = false;
          }
        }
      }
      
      /**
       * Handle Escape key
       * @returns {boolean} Whether the key was handled
       * @private
       */
      _handleEscapeKey() {
        // Check for open UI elements in priority order
        
        // Context menu
        if (this.state.contextMenuOpen) {
          const contextMenu = document.querySelector('.context-menu');
          if (contextMenu) {
            contextMenu.remove();
            this.state.contextMenuOpen = false;
            return true;
          }
        }
        
        // Format menu
        const formatMenu = this.state.elements.get('formatMenu');
        if (formatMenu && !formatMenu.hidden) {
          formatMenu.hidden = true;
          return true;
        }
        
        // Settings panel
        const settingsPanel = this.state.elements.get('settingsPanel');
        if (settingsPanel?.classList.contains('open')) {
          this._closeSettings();
          return true;
        }
        
        // Info panel
        const infoPanel = this.state.elements.get('infoPanel');
        if (infoPanel?.classList.contains('visible')) {
          infoPanel.classList.remove('visible');
          return true;
        }
        
        return false;
      }
      
      /**
       * Handle container resize
       * @param {DOMRectReadOnly} contentRect - New content rectangle
       * @private
       */
      _handleContainerResize(contentRect) {
        // Update virtual scroller container height
        if (this.config.virtualScroller.enabled) {
          this.state.virtualScroller.containerHeight = contentRect.height;
          this._updateVirtualScroller();
        }
        
        // Update sticky elements
        this._updateStickyHeaders();
      }
      
      /**
       * Handle new chat button click
       * @private
       */
      _handleNewChatClick() {
        // Emit event for app to handle
        this._emitEvent('newChatRequested');
      }
      
      /**
       * Focus the input field
       * @private
       */
      _focusInput() {
        const userInput = this.state.elements.get('userInput');
        if (userInput) {
          userInput.focus();
          return true;
        }
        return false;
      }
      
      /**
       * Open settings panel
       * @private
       */
      _openSettings() {
        const settingsPanel = this.state.elements.get('settingsPanel');
        if (settingsPanel) {
          settingsPanel.classList.add('open');
          
          // Focus first focusable element
          setTimeout(() => {
            const focusable = settingsPanel.querySelector('button, [tabindex="0"], input, select');
            if (focusable) focusable.focus();
          }, 100);
          
          return true;
        }
        return false;
      }
      
      /**
       * Close settings panel
       * @private
       */
      _closeSettings() {
        const settingsPanel = this.state.elements.get('settingsPanel');
        if (settingsPanel) {
          settingsPanel.classList.remove('open');
          return true;
        }
        return false;
      }
      
      /**
       * Navigate to previous message
       * @private
       */
      _navigateToPreviousMessage() {
        const messages = Array.from(this.state.messages.values())
          .sort((a, b) => a.timestamp - b.timestamp);
        
        if (messages.length === 0) return false;
        
        const activeIndex = this.state.activeMessageId ? 
          messages.findIndex(m => m.id === this.state.activeMessageId) : -1;
        
        const prevIndex = activeIndex > 0 ? activeIndex - 1 : messages.length - 1;
        const prevMessage = messages[prevIndex];
        
        this.scrollToMessage(prevMessage.id, { focus: true });
        this.state.activeMessageId = prevMessage.id;
        
        return true;
      }
      
      /**
       * Navigate to next message
       * @private
       */
      _navigateToNextMessage() {
        const messages = Array.from(this.state.messages.values())
          .sort((a, b) => a.timestamp - b.timestamp);
        
        if (messages.length === 0) return false;
        
        const activeIndex = this.state.activeMessageId ? 
          messages.findIndex(m => m.id === this.state.activeMessageId) : -1;
        
        const nextIndex = activeIndex < messages.length - 1 ? activeIndex + 1 : 0;
        const nextMessage = messages[nextIndex];
        
        this.scrollToMessage(nextMessage.id, { focus: true });
        this.state.activeMessageId = nextMessage.id;
        
        return true;
      }
      
      /**
       * Format selected text in input
       * @param {Event} e - Keyboard event
       * @param {string} prefix - Format prefix
       * @param {string} suffix - Format suffix
       * @private
       */
      _formatText(e, prefix, suffix) {
        const userInput = this.state.elements.get('userInput');
        if (!userInput) return false;
        
        // Don't interfere with formatting if not in textarea
        if (document.activeElement !== userInput) return false;
        
        e.preventDefault();
        
        const { selectionStart, selectionEnd, value } = userInput;
        
        // Get selected text
        const selectedText = value.substring(selectionStart, selectionEnd);
        
        // Format text
        const formattedText = prefix + selectedText + suffix;
        
        // Replace selected text with formatted text
        userInput.value = value.substring(0, selectionStart) + 
                           formattedText + 
                           value.substring(selectionEnd);
        
        // Adjust selection to be after the inserted text
        userInput.selectionStart = selectionStart + formattedText.length;
        userInput.selectionEnd = selectionStart + formattedText.length;
        
        // Trigger input event to update UI
        userInput.dispatchEvent(new Event('input'));
        
        return true;
      }
      
      /**
       * Send a message
       * @param {string} content - Message content
       * @private
       */
      _sendMessage(content) {
        // Clear input field
        const userInput = this.state.elements.get('userInput');
        if (userInput) {
          userInput.value = '';
          userInput.style.height = 'auto';
          userInput.classList.remove('has-content');
          
          // Disable send button
          const sendButton = this.state.elements.get('sendButton');
          if (sendButton) {
            sendButton.disabled = true;
            sendButton.setAttribute('aria-disabled', 'true');
          }
        }
        
        // Emit send event for application to handle
        this._emitEvent('sendMessage', { content });
      }
      
      /**
       * Emit an event
       * @param {string} eventName - Event name
       * @param {Object} data - Event data
       * @private
       */
      _emitEvent(eventName, data = {}) {
        // Create custom event
        const event = new CustomEvent(`wikichat:${eventName}`, {
          detail: { ...data, timestamp: Date.now() },
          bubbles: true
        });
        
        // Dispatch on container or document
        const container = this.state.elements.get('chatContainer') || document;
        container.dispatchEvent(event);
        
        // Call any registered handlers
        const handlers = this.state.eventHandlers.get(eventName) || [];
        handlers.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error(`Error in event handler for ${eventName}:`, error);
          }
        });
      }
      
      /**
       * Register an event handler
       * @param {string} eventName - Event name
       * @param {Function} handler - Event handler
       * @returns {Function} Unsubscribe function
       */
      on(eventName, handler) {
        if (!this.state.eventHandlers.has(eventName)) {
          this.state.eventHandlers.set(eventName, []);
        }
        
        const handlers = this.state.eventHandlers.get(eventName);
        handlers.push(handler);
        
        // Return unsubscribe function
        return () => {
          const index = handlers.indexOf(handler);
          if (index !== -1) {
            handlers.splice(index, 1);
          }
        };
      }
      
      /**
       * Create a message element
       * @param {Object} message - Message data
       * @param {Object} options - Creation options
       * @returns {HTMLElement} Created message element
       * @private
       */
      _createMessageElement(message, options) {
        const {
          messageId,
          animate = true,
          grouped = false
        } = options;
        
        // Create message container
        const messageElement = DOM.create('div', {
          attrs: {
            'data-message-id': messageId,
            'data-role': message.role,
            'data-timestamp': message.timestamp || Date.now(),
            'role': 'article',
            'tabindex': '0',
            'aria-label': `${message.role === 'human' ? 'You' : 'Claude'}: ${
              typeof message.content === 'string' ? 
                message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '') : 
                'Message with content'
            }`
          },
          props: {
            className: `${CSS.message.container} ${message.role}`
          }
        });
        
        // Add animation class if enabled
        if (animate && !this.config.animations.reducedMotion) {
          DOM.addClass(messageElement, CSS.animations.fadeIn);
        }
        
        // Add grouped class if needed
        if (grouped) {
          DOM.addClass(messageElement, CSS.message.grouped);
        }
        
        // Add classes for files if present
        if (message.files && message.files.length > 0) {
          DOM.addClass(messageElement, CSS.message.withFiles);
        }
        
        // Add classes for citations if present
        if (message.citation || (message.metadata && message.metadata.source)) {
          DOM.addClass(messageElement, CSS.message.withCitation);
        }
        
        // Add header if not grouped
        if (!grouped) {
          const header = this._createMessageHeader(message);
          messageElement.appendChild(header);
        }
        
        // Create content container
        const contentContainer = DOM.create('div', {
          props: { className: CSS.content.container }
        });
        
        // Set up content with appropriate renderer
        const renderStrategy = this._getRendererForMessage(message);
        const renderer = this.renderers.get(renderStrategy);
        
        if (renderer) {
          renderer(contentContainer, message);
        } else {
          // Fallback to default renderer
          this.renderers.get(RENDERERS.DEFAULT)(contentContainer, message);
        }
        
        messageElement.appendChild(contentContainer);
        
        // Add actions (buttons, menu)
        if (this._shouldAddMessageActions(message)) {
          const actions = this._createMessageActions(message);
          messageElement.appendChild(actions);
        }
        
        // Set up context menu
        if (this.config.contextMenu.enabled) {
          this._setupMessageContextMenu(messageElement, message);
        }
        
        return messageElement;
      }
      
      /**
       * Create message header
       * @param {Object} message - Message data
       * @returns {HTMLElement} Header element
       * @private
       */
      _createMessageHeader(message) {
        // Create header container
        const header = DOM.create('div', {
          props: { className: 'message-header' }
        });
        
        // Add avatar if enabled
        if (this.config.avatars.enabled) {
          const avatarContainer = DOM.create('div', {
            props: { className: 'message-avatar' }
          });
          
          const avatarSrc = message.role === 'human' ? 
            this.config.avatars.human : this.config.avatars.assistant;
          
          const avatarAlt = message.role === 'human' ? 
            'Your avatar' : 'Claude avatar';
          
          const avatar = DOM.create('img', {
            attrs: {
              src: avatarSrc,
              alt: avatarAlt,
              loading: 'lazy'
            }
          });
          
          avatarContainer.appendChild(avatar);
          header.appendChild(avatarContainer);
        }
        
        // Add role name
        const roleName = DOM.create('span', {
          props: { 
            className: 'role-name',
            textContent: message.role === 'human' ? 'You' : (message.name || 'Claude')
          }
        });
        header.appendChild(roleName);
        
        // Add model name if available for assistant
        if (message.role === 'assistant' && message.model) {
          const modelName = DOM.create('span', {
            props: {
              className: 'model-name',
              textContent: message.model
            }
          });
          header.appendChild(modelName);
        }
        
        // Add timestamp
        const timestamp = DOM.create('span', {
          attrs: {
            'data-timestamp': message.timestamp || Date.now()
          },
          props: {
            className: 'message-timestamp',
            textContent: this._formatTimestamp(message.timestamp || Date.now())
          }
        });
        header.appendChild(timestamp);
        
        // Add edited indicator if message was edited
        if (message.edited) {
          const editedIndicator = DOM.create('span', {
            props: {
              className: 'edited-indicator',
              textContent: '(edited)'
            },
            attrs: {
              title: message.editTimestamp ? 
                `Edited ${this._formatTimestamp(message.editTimestamp)}` : 
                'Edited'
            }
          });
          header.appendChild(editedIndicator);
        }
        
        return header;
      }
      
      /**
       * Create message actions
       * @param {Object} message - Message data
       * @returns {HTMLElement} Actions container
       * @private
       */
      _createMessageActions(message) {
        const actionsContainer = DOM.create('div', {
          props: { className: 'message-actions' }
        });
        
        // Define available actions
        const actions = [
          {
            id: 'copy',
            label: 'Copy message',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>`,
            roles: ['human', 'assistant']
          },
          {
            id: 'edit',
            label: 'Edit message',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>`,
            roles: ['human']
          },
          {
            id: 'regenerate',
            label: 'Regenerate response',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
                  </svg>`,
            roles: ['assistant']
          },
          {
            id: 'copy-code',
            label: 'Copy code',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>`,
            roles: ['assistant'],
            condition: () => message.content && message.content.includes('```')
          },
          {
            id: 'cite',
            label: 'Cite sources',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9H2v6h4v-6z"></path>
                    <path d="M14 9h-4v6h4v-6z"></path>
                    <path d="M22 9h-4v6h4v-6z"></path>
                    <path d="M18 13a2 2 0 0 1-2 2v4"></path>
                    <path d="M10 13a2 2 0 0 1-2 2v4"></path>
                    <path d="M2 3h16"></path>
                  </svg>`,
            roles: ['assistant'],
            condition: () => message.metadata?.source || message.type === 'wikiReference'
          }
        ];
        
        // Add buttons for applicable actions
        actions.forEach(action => {
          // Skip if not applicable to this role
          if (!action.roles.includes(message.role)) return;
          
          // Skip if condition is not met
          if (action.condition && !action.condition()) return;
          
          const button = DOM.create('button', {
            attrs: {
              'data-action': action.id,
              'aria-label': action.label,
              'title': action.label
            },
            props: {
              className: 'message-action',
              innerHTML: action.icon
            },
            events: {
              click: (e) => {
                e.stopPropagation();
                this._handleMessageAction(
                  action.id, 
                  message.id || e.target.closest('[data-message-id]').dataset.messageId
                );
              }
            }
          });
          
          actionsContainer.appendChild(button);
        });
        
        // Add menu button
        const menuButton = DOM.create('button', {
          attrs: {
            'data-action': 'menu',
            'aria-label': 'More actions',
            'title': 'More actions'
          },
          props: {
            className: 'message-action message-menu-trigger',
            innerHTML: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                      </svg>`
          },
          events: {
            click: (e) => {
              e.stopPropagation();
              this._showMessageMenu(
                e.target.closest('[data-message-id]').dataset.messageId,
                e.target
              );
            }
          }
        });
        
        actionsContainer.appendChild(menuButton);
        
        return actionsContainer;
      }
      
      /**
       * Check if a message should have actions
       * @param {Object} message - Message data
       * @returns {boolean} Whether to add actions
       * @private
       */
      _shouldAddMessageActions(message) {
        // Don't add actions to thinking messages
        if (message.type === 'thinking') return false;
        
        // Don't add actions to error messages
        if (message.type === 'error') return false;
        
        return true;
      }
      
      /**
       * Set up context menu for a message
       * @param {HTMLElement} element - Message element
       * @param {Object} message - Message data
       * @private
       */
      _setupMessageContextMenu(element, message) {
        element.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          
          // Show context menu
          this._showContextMenu(e.clientX, e.clientY, message.id || element.dataset.messageId);
        });
      }
      
      /**
       * Show context menu for a message
       * @param {number} x - X position
       * @param {number} y - Y position
       * @param {string} messageId - Message ID
       * @private
       */
      _showContextMenu(x, y, messageId) {
        // Close existing context menu
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
          existingMenu.remove();
        }
        
        // Get message data
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return;
        
        const { data: message } = messageData;
        
        // Create menu
        const menu = DOM.create('div', {
          props: { 
            className: 'context-menu',
            style: `top: ${y}px; left: ${x}px;` 
          }
        });
        
        // Define menu items
        const menuItems = [
          {
            id: 'copy',
            label: 'Copy message',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>`,
            roles: ['human', 'assistant']
          },
          {
            id: 'edit',
            label: 'Edit message',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>`,
            roles: ['human']
          },
          {
            id: 'regenerate',
            label: 'Regenerate response',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
                  </svg>`,
            roles: ['assistant']
          },
          {
            id: 'copy-code',
            label: 'Copy code blocks',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>`,
            roles: ['assistant'],
            condition: () => message.content && message.content.includes('```')
          },
          {
            id: 'cite',
            label: 'Cite sources',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9H2v6h4v-6z"></path>
                    <path d="M14 9h-4v6h4v-6z"></path>
                    <path d="M22 9h-4v6h4v-6z"></path>
                    <path d="M18 13a2 2 0 0 1-2 2v4"></path>
                    <path d="M10 13a2 2 0 0 1-2 2v4"></path>
                    <path d="M2 3h16"></path>
                  </svg>`,
            roles: ['assistant'],
            condition: () => message.metadata?.source || message.type === 'wikiReference'
          },
          {
            id: 'save',
            label: 'Save as note',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>`,
            roles: ['human', 'assistant']
          },
          {
            id: 'delete',
            label: 'Delete message',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>`,
            roles: ['human', 'assistant'],
            class: 'danger'
          }
        ];
        
        // Add menu items
        menuItems.forEach(item => {
          // Skip if not applicable to this role
          if (!item.roles.includes(message.role)) return;
          
          // Skip if condition is not met
          if (item.condition && !item.condition()) return;
          
          const menuItem = DOM.create('button', {
            props: {
              className: `context-menu-item ${item.class || ''}`,
              innerHTML: `
                <span class="context-menu-icon">${item.icon}</span>
                <span class="context-menu-label">${item.label}</span>
              `
            },
            events: {
              click: () => {
                this._handleMessageAction(item.id, messageId);
                menu.remove();
                this.state.contextMenuOpen = false;
              }
            }
          });
          
          menu.appendChild(menuItem);
        });
        
        // Add to document
        document.body.appendChild(menu);
        this.state.contextMenuOpen = true;
        
        // Adjust position if menu is off-screen
        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust horizontal position
        if (menuRect.right > viewportWidth) {
          const newLeft = Math.max(0, x - menuRect.width);
          menu.style.left = `${newLeft}px`;
        }
        
        // Adjust vertical position
        if (menuRect.bottom > viewportHeight) {
          const newTop = Math.max(0, y - menuRect.height);
          menu.style.top = `${newTop}px`;
        }
      }
      
      /**
       * Show message menu
       * @param {string} messageId - Message ID
       * @param {HTMLElement} triggerElement - Element that triggered the menu
       * @private
       */
      _showMessageMenu(messageId, triggerElement) {
        // Get button position
        const buttonRect = triggerElement.getBoundingClientRect();
        
        // Show context menu at appropriate position
        this._showContextMenu(
          buttonRect.left,
          buttonRect.bottom + 5,
          messageId
        );
      }
      
      /**
       * Handle message action
       * @param {string} action - Action ID
       * @param {string} messageId - Message ID
       * @private
       */
      _handleMessageAction(action, messageId) {
        // Get message data
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return;
        
        const { element, data } = messageData;
        
        switch (action) {
          case 'copy':
            this._copyMessageToClipboard(messageId);
            break;
            
          case 'edit':
            this._enableMessageEditing(messageId);
            break;
            
          case 'regenerate':
            this._requestMessageRegeneration(messageId);
            break;
            
          case 'copy-code':
            this._copyCodeFromMessage(messageId);
            break;
            
          case 'cite':
            this._citeSourcesFromMessage(messageId);
            break;
            
          case 'save':
            this._saveMessageAsNote(messageId);
            break;
            
          case 'delete':
            this._confirmMessageDeletion(messageId);
            break;
        }
        
        // Emit action event
        this._emitEvent('messageAction', {
          action,
          messageId,
          message: data
        });
      }
      
      /**
       * Copy message to clipboard
       * @param {string} messageId - Message ID
       * @private
       */
      _copyMessageToClipboard(messageId) {
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return;
        
        // Get content
        const { data } = messageData;
        let content = data.content;
        
        // Copy to clipboard
        navigator.clipboard.writeText(content)
          .then(() => {
            this._showToast({
              title: 'Copied!',
              message: 'Message copied to clipboard',
              type: 'success',
              duration: 2000
            });
          })
          .catch(err => {
            console.error('Failed to copy message:', err);
            
            this._showToast({
              title: 'Copy Failed',
              message: 'Could not copy message to clipboard',
              type: 'error',
              duration: 3000
            });
          });
      }
      
      /**
       * Enable message editing
       * @param {string} messageId - Message ID
       * @private
       */
      _enableMessageEditing(messageId) {
        const messageData = this.state.messages.get(messageId);
        if (!messageData || messageData.data.role !== 'human') return;
        
        const { element, data } = messageData;
        
        // Replace content with editable textarea
        const contentElement = element.querySelector(`.${CSS.content.container}`);
        if (!contentElement) return;
        
        // Get current content
        const currentContent = data.content;
        
        // Create editor wrapper
        const editorWrapper = DOM.create('div', {
          props: { className: 'message-editor' }
        });
        
        // Create textarea
        const textarea = DOM.create('textarea', {
          props: {
            className: 'message-editor-textarea',
            value: currentContent,
            rows: Math.min(10, currentContent.split('\n').length + 1)
          }
        });
        
        // Create actions
        const actions = DOM.create('div', {
          props: { className: 'message-editor-actions' }
        });
        
        // Cancel button
        const cancelBtn = DOM.create('button', {
          props: {
            className: 'btn-secondary',
            textContent: 'Cancel'
          },
          events: {
            click: () => this._cancelMessageEditing(messageId)
          }
        });
        
        // Save button
        const saveBtn = DOM.create('button', {
          props: {
            className: 'btn-primary',
            textContent: 'Save'
          },
          events: {
            click: () => this._saveMessageEdit(messageId, textarea.value)
          }
        });
        
        // Add buttons to actions
        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);
        
        // Add to wrapper
        editorWrapper.appendChild(textarea);
        editorWrapper.appendChild(actions);
        
        // Replace content
        DOM.empty(contentElement);
        contentElement.appendChild(editorWrapper);
        
        // Add editing class
        element.classList.add('editing');
        
        // Focus textarea
        textarea.focus();
        
        // Emit event
        this._emitEvent('messageEditingStarted', { messageId });
      }
      
      /**
       * Cancel message editing
       * @param {string} messageId - Message ID
       * @private
       */
      _cancelMessageEditing(messageId) {
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return;
        
        const { element, data } = messageData;
        
        // Update DOM with original content
        this._updateMessageElement(element, data);
        
        // Remove editing class
        element.classList.remove('editing');
        
        // Emit event
        this._emitEvent('messageEditingCanceled', { messageId });
      }
      
      /**
       * Save message edit
       * @param {string} messageId - Message ID
       * @param {string} newContent - New content
       * @private
       */
      _saveMessageEdit(messageId, newContent) {
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return;
        
        const { element, data } = messageData;
        
        // Save to undo stack
        this._saveToUndoStack({
          type: 'edit',
          messageId,
          previousContent: data.content,
          newContent
        });
        
        // Update message data
        data.content = newContent;
        data.edited = true;
        data.editTimestamp = Date.now();
        
        // Update DOM
        this._updateMessageElement(element, data);
        
        // Remove editing class
        element.classList.remove('editing');
        
        // Emit event
        this._emitEvent('messageEditingSaved', {
          messageId,
          newContent,
          message: data
        });
      }
      
      /**
       * Request message regeneration
       * @param {string} messageId - Message ID
       * @private
       */
      _requestMessageRegeneration(messageId) {
        // Emit event for app to handle
        this._emitEvent('regenerateMessage', { messageId });
      }
      
      /**
       * Copy code from message
       * @param {string} messageId - Message ID
       * @private
       */
      _copyCodeFromMessage(messageId) {
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return;
        
        const { element } = messageData;
        
        // Find code blocks
        const codeBlocks = element.querySelectorAll('pre code');
        if (!codeBlocks.length) return;
        
        // Single code block - copy directly
        if (codeBlocks.length === 1) {
          navigator.clipboard.writeText(codeBlocks[0].textContent)
            .then(() => {
              this._showToast({
                title: 'Code Copied!',
                message: 'Code block copied to clipboard',
                type: 'success',
                duration: 2000
              });
            })
            .catch(err => {
              console.error('Failed to copy code:', err);
              this._showToast({
                title: 'Copy Failed',
                message: 'Failed to copy code to clipboard',
                type: 'error',
                duration: 3000
              });
            });
          return;
        }
        
        // Multiple code blocks - show selection dialog
        this._showCodeSelectionDialog(messageId, codeBlocks);
      }
      
      /**
       * Show code selection dialog
       * @param {string} messageId - Message ID
       * @param {NodeList} codeBlocks - Code blocks
       * @private
       */
      _showCodeSelectionDialog(messageId, codeBlocks) {
        // Create modal
        const modal = DOM.create('div', {
          props: { className: 'wikichat-modal code-selection-modal' }
        });
        
        // Create modal content
        const modalContent = DOM.create('div', {
          props: { className: 'modal-content' }
        });
        
        // Add header
        const header = DOM.create('div', {
          props: { className: 'modal-header' }
        });
        
        const title = DOM.create('h3', {
          props: { textContent: 'Select Code Block to Copy' }
        });
        
        const closeBtn = DOM.create('button', {
          props: {
            className: 'modal-close-btn',
            innerHTML: '&times;'
          },
          attrs: {
            'aria-label': 'Close'
          },
          events: {
            click: () => modal.remove()
          }
        });
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        modalContent.appendChild(header);
        
        // Add code blocks
        const blocksList = DOM.create('div', {
          props: { className: 'code-blocks-list' }
        });
        
        Array.from(codeBlocks).forEach((codeBlock, index) => {
          // Get language if available
          const language = codeBlock.className.match(/language-(\w+)/)?.[1] || '';
          
          // Create code preview
          const preview = DOM.create('div', {
            props: { className: 'code-preview' }
          });
          
          // Add language label if available
          if (language) {
            const langLabel = DOM.create('div', {
              props: {
                className: 'code-lang-label',
                textContent: language
              }
            });
            preview.appendChild(langLabel);
          }
          
          // Add code snippet
          const snippet = DOM.create('pre', {
            props: { className: 'code-snippet' }
          });
          
          const code = DOM.create('code', {
            props: {
              textContent: codeBlock.textContent.slice(0, 200) + 
                          (codeBlock.textContent.length > 200 ? '...' : '')
            }
          });
          
          snippet.appendChild(code);
          preview.appendChild(snippet);
          
          // Add copy button
          const copyBtn = DOM.create('button', {
            props: {
              className: 'copy-code-btn',
              textContent: 'Copy'
            },
            events: {
              click: () => {
                navigator.clipboard.writeText(codeBlock.textContent)
                  .then(() => {
                    modal.remove();
                    this._showToast({
                      title: 'Code Copied!',
                      message: `${language ? language + ' ' : ''}Code block copied to clipboard`,
                      type: 'success',
                      duration: 2000
                    });
                  })
                  .catch(err => {
                    console.error('Failed to copy code:', err);
                    this._showToast({
                      title: 'Copy Failed',
                      message: 'Failed to copy code to clipboard',
                      type: 'error',
                      duration: 3000
                    });
                  });
              }
            }
          });
          
          preview.appendChild(copyBtn);
          blocksList.appendChild(preview);
        });
        
        modalContent.appendChild(blocksList);
        
        // Add copy all button
        const copyAllBtn = DOM.create('button', {
          props: {
            className: 'copy-all-btn',
            textContent: 'Copy All Blocks'
          },
          events: {
            click: () => {
              const allCode = Array.from(codeBlocks)
                .map(block => block.textContent)
                .join('\n\n');
                
              navigator.clipboard.writeText(allCode)
                .then(() => {
                  modal.remove();
                  this._showToast({
                    title: 'All Code Copied!',
                    message: `${codeBlocks.length} code blocks copied to clipboard`,
                    type: 'success',
                    duration: 2000
                  });
                })
                .catch(err => {
                  console.error('Failed to copy all code:', err);
                  this._showToast({
                    title: 'Copy Failed',
                    message: 'Failed to copy all code blocks',
                    type: 'error',
                    duration: 3000
                  });
                });
            }
          }
        });
        
        modalContent.appendChild(copyAllBtn);
        modal.appendChild(modalContent);
        
        // Add to body
        document.body.appendChild(modal);
        
        // Add event listener to close when clicking outside
        setTimeout(() => {
          modal.addEventListener('click', e => {
            if (e.target === modal) modal.remove();
          });
        }, 0);
      }
      
      /**
       * Cite sources from message
       * @param {string} messageId - Message ID
       * @private
       */
      _citeSourcesFromMessage(messageId) {
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return;
        
        const { data } = messageData;
        
        // If it's a Wikipedia reference
        if (data.type === 'wikiReference' || data.metadata?.source?.includes('wikipedia.org')) {
          const article = data.metadata || this.state.wikipediaArticle;
          
          if (article) {
            // Generate citation with default format
            this.generateCitation(article);
          } else if (data.metadata?.source) {
            // Try to load article first
            this.loadWikipediaArticle(data.metadata.source)
              .then(article => {
                if (article) {
                  this.generateCitation(article);
                }
              });
          }
        }
        // Regular citation
        else if (data.citation) {
          // Show citation info
          this._showToast({
            title: 'Citation',
            message: data.citation,
            type: 'info',
            duration: 8000,
            actions: [
              {
                label: 'Copy',
                callback: () => {
                  navigator.clipboard.writeText(data.citation);
                  this._showToast({
                    title: 'Citation Copied',
                    type: 'success',
                    duration: 2000
                  });
                }
              }
            ]
          });
        }
        // No citation available
        else {
          this._showToast({
            title: 'No Citation Available',
            message: 'This message does not have citation information',
            type: 'info',
            duration: 3000
          });
        }
      }
      
      /**
       * Save message as note
       * @param {string} messageId - Message ID
       * @private
       */
      _saveMessageAsNote(messageId) {
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return;
        
        const { data } = messageData;
        
        // Create download for message content
        const content = data.content;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Create filename
        const date = new Date().toISOString().split('T')[0];
        const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const role = data.role === 'human' ? 'user' : 'claude';
        const filename = `wikichat_${role}_${date}_${time}.txt`;
        
        // Create and trigger download link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up URL
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        // Show toast
        this._showToast({
          title: 'Note Saved',
          message: `Message saved as "${filename}"`,
          type: 'success',
          duration: 3000
        });
      }
      
      /**
       * Confirm message deletion
       * @param {string} messageId - Message ID
       * @private
       */
      _confirmMessageDeletion(messageId) {
        const messageData = this.state.messages.get(messageId);
        if (!messageData) return;
        
        // Create confirmation dialog
        const dialog = DOM.create('div', {
          props: { className: 'wikichat-modal confirmation-dialog' }
        });
        
        const dialogContent = DOM.create('div', {
          props: { className: 'modal-content' }
        });
        
        // Add header
        const header = DOM.create('div', {
          props: { className: 'modal-header' }
        });
        
        const title = DOM.create('h3', {
          props: { textContent: 'Delete Message?' }
        });
        
        const closeBtn = DOM.create('button', {
          props: {
            className: 'modal-close-btn',
            innerHTML: '&times;'
          },
          attrs: {
            'aria-label': 'Close'
          },
          events: {
            click: () => dialog.remove()
          }
        });
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        dialogContent.appendChild(header);
        
        // Add message
        const message = DOM.create('p', {
          props: {
            className: 'dialog-message',
            textContent: 'Are you sure you want to delete this message? This action cannot be undone.'
          }
        });
        dialogContent.appendChild(message);
        
        // Add actions
        const actions = DOM.create('div', {
          props: { className: 'dialog-actions' }
        });
        
        const cancelBtn = DOM.create('button', {
          props: {
            className: 'btn-secondary',
            textContent: 'Cancel'
          },
          events: {
            click: () => dialog.remove()
          }
        });
        
        const deleteBtn = DOM.create('button', {
          props: {
            className: 'btn-danger',
            textContent: 'Delete'
          },
          events: {
            click: () => {
              dialog.remove();
              this.removeMessage(messageId);
            }
          }
        });
        
        actions.appendChild(cancelBtn);
        actions.appendChild(deleteBtn);
        dialogContent.appendChild(actions);
        
        dialog.appendChild(dialogContent);
        document.body.appendChild(dialog);
        
        // Add event listener to close when clicking outside
        setTimeout(() => {
          dialog.addEventListener('click', e => {
            if (e.target === dialog) dialog.remove();
          });
        }, 0);
      }
  
      // ===============================================================
      // Renderer Implementations
      // ===============================================================
      
      /**
       * Get renderer strategy for message
       * @param {Object} message - Message data
       * @returns {string} Renderer strategy ID
       * @private
       */
      _getRendererForMessage(message) {
        // Check for streaming
        if (this.state.streaming.active && 
            this.state.streaming.messageId === message.id) {
          return RENDERERS.STREAMING;
        }
        
        // Check message type
        if (message.type) {
          switch (message.type) {
            case 'thinking':
              return RENDERERS.THINKING;
            case 'error':
              return RENDERERS.ERROR;
            case 'image':
              return RENDERERS.IMAGE;
            case 'code':
              return RENDERERS.CODE;
            case 'wikiReference':
              return RENDERERS.WIKI_REFERENCE;
          }
        }
        
        // Check for error
        if (message.error) {
          return RENDERERS.ERROR;
        }
        
        // Check for files
        if (message.files && message.files.length > 0) {
          return RENDERERS.FILE;
        }
        
        // Check content type
        if (message.content && typeof message.content === 'object') {
          if (message.content.type === 'image') {
            return RENDERERS.IMAGE;
          }
        }
        
        // Use markdown if enabled
        if (this.config.markdown.enabled && 
            this.dependencies.markdownParser && 
            typeof message.content === 'string') {
          return RENDERERS.MARKDOWN;
        }
        
        // Default
        return RENDERERS.DEFAULT;
      }
      
      /**
       * Default message renderer
       * @param {HTMLElement} container - Content container
       * @param {Object} message - Message data
       * @private
       */
      _renderDefaultMessage(container, message) {
        if (typeof message.content === 'string') {
          container.textContent = message.content;
        } else if (message.content && typeof message.content === 'object') {
          try {
            container.textContent = JSON.stringify(message.content, null, 2);
          } catch (e) {
            container.textContent = '[Complex content]';
          }
        } else {
          container.textContent = '';
        }
      }
      
      /**
       * Markdown message renderer
       * @param {HTMLElement} container - Content container
       * @param {Object} message - Message data
       * @private
       */
      _renderMarkdownMessage(container, message) {
        if (!this.dependencies.markdownParser || typeof message.content !== 'string') {
          return this._renderDefaultMessage(container, message);
        }
        
        // Add markdown class
        DOM.addClass(container, CSS.content.markdown);
        
        try {
          // Render markdown
          let html = this.dependencies.markdownParser(message.content);
          
          // Sanitize if enabled
          if (this.config.markdown.sanitize && this.dependencies.sanitizer) {
            html = this.dependencies.sanitizer.sanitize(html);
          }
          
          // Set HTML
          container.innerHTML = html;
          
          // Enhance code blocks
          this._enhanceCodeBlocks(container);
          
          // Process any embedded Wikipedia links
          if (message.content.includes('wikipedia.org')) {
            this._processWikipediaLinks(container, message.content);
          }
        } catch (error) {
          console.error('Error rendering markdown:', error);
          this._renderDefaultMessage(container, message);
        }
      }
      
      /**
       * Streaming message renderer
       * @param {HTMLElement} container - Content container
       * @param {Object} message - Message data
       * @private
       */
      _renderStreamingMessage(container, message) {
        // Add streaming class
        DOM.addClass(container, CSS.content.streaming);
        
        // Get streaming content
        const content = this.state.streaming.content || message.content || '';
        
        // Render with markdown if enabled
        if (this.config.markdown.enabled && this.dependencies.markdownParser) {
          try {
            let html = this.dependencies.markdownParser(content);
            
            // Sanitize if enabled
            if (this.config.markdown.sanitize && this.dependencies.sanitizer) {
              html = this.dependencies.sanitizer.sanitize(html);
            }
            
            container.innerHTML = html;
            this._enhanceCodeBlocks(container);
          } catch (e) {
            container.textContent = content;
          }
        } else {
          container.textContent = content;
        }
        
        // Add typing cursor
        const cursor = DOM.create('span', {
          props: { className: 'typing-cursor' }
        });
        container.appendChild(cursor);
      }
      
      /**
       * Thinking message renderer
       * @param {HTMLElement} container - Content container
       * @param {Object} message - Message data
       * @private
       */
      _renderThinkingMessage(container, message) {
        // Add thinking class
        DOM.addClass(container, CSS.content.thinking);
        
        // Create thinking content
        container.innerHTML = `
          <div class="thinking-content">
            <span class="thinking-text">${message.content || 'Thinking...'}</span>
            <div class="thinking-dots">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        `;
      }
      
      /**
       * Code message renderer
       * @param {HTMLElement} container - Content container
       * @param {Object} message - Message data
       * @private
       */
      _renderCodeMessage(container, message) {
        // Add code class
        DOM.addClass(container, CSS.content.code);
        
        // Extract code and language
        const code = message.content || '';
        const language = message.language || '';
        
        // Create elements
        const pre = DOM.create('pre');
        const codeElement = DOM.create('code', {
          props: { textContent: code }
        });
        
        // Add language class if specified
        if (language) {
          codeElement.className = `language-${language}`;
        }
        
        // Add to container
        pre.appendChild(codeElement);
        container.appendChild(pre);
        
        // Apply syntax highlighting
        if (this.config.codeHighlighting.enabled && 
            this.dependencies.codeHighlighter && 
            language) {
          try {
            this.dependencies.codeHighlighter.highlightElement(codeElement);
          } catch (e) {
            console.warn('Failed to highlight code:', e);
          }
        }
      }
      
      /**
       * Image message renderer
       * @param {HTMLElement} container - Content container
       * @param {Object} message - Message data
       * @private
       */
      _renderImageMessage(container, message) {
        // Add image class
        DOM.addClass(container, CSS.content.image);
        
        // Create wrapper
        const wrapper = DOM.create('div', {
          props: { className: 'image-wrapper' }
        });
        
        // Create image
        const img = DOM.create('img', {
          attrs: {
            alt: message.alt || 'Image',
            loading: 'lazy'
          },
          props: { className: 'message-image' }
        });
        
        // Set source based on available data
        if (message.url) {
          img.src = message.url;
        } else if (message.data) {
          img.src = `data:${message.mime || 'image/jpeg'};base64,${message.data}`;
        } else if (message.content?.type === 'image' && message.content?.data) {
          img.src = `data:${message.content.mime || 'image/jpeg'};base64,${message.content.data}`;
        }
        
        wrapper.appendChild(img);
        
        // Add caption if present
        if (message.caption) {
          const caption = DOM.create('div', {
            props: {
              className: 'image-caption',
              textContent: message.caption
            }
          });
          wrapper.appendChild(caption);
        }
        
        container.appendChild(wrapper);
      }
      
      /**
       * File message renderer
       * @param {HTMLElement} container - Content container
       * @param {Object} message - Message data
       * @private
       */
      _renderFileMessage(container, message) {
        // Render text content if present
        if (message.content) {
          if (this.config.markdown.enabled && 
              this.dependencies.markdownParser && 
              typeof message.content === 'string') {
            let html = this.dependencies.markdownParser(message.content);
            
            // Sanitize if enabled
            if (this.config.markdown.sanitize && this.dependencies.sanitizer) {
              html = this.dependencies.sanitizer.sanitize(html);
            }
            
            container.innerHTML = html;
            this._enhanceCodeBlocks(container);
          } else if (typeof message.content === 'string') {
            container.textContent = message.content;
          }
        }
        
        // Add files attachments
        if (message.files && message.files.length > 0) {
          const filesContainer = DOM.create('div', {
            props: { className: 'message-attachments' }
          });
          
          // Add each file
          message.files.forEach(file => {
            const fileElement = this._createFileAttachment(file);
            filesContainer.appendChild(fileElement);
          });
          
          container.appendChild(filesContainer);
        }
      }
      
      /**
       * Error message renderer
       * @param {HTMLElement} container - Content container
       * @param {Object} message - Message data
       * @private
       */
      _renderErrorMessage(container, message) {
        // Add error class
        DOM.addClass(container, CSS.content.error);
        
        // Create error container
        const errorContent = DOM.create('div', {
          props: { className: 'error-content' }
        });
        
        // Add error icon
        const errorIcon = DOM.create('div', {
          props: {
            className: 'error-icon',
            innerHTML: `
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            `
          }
        });
        errorContent.appendChild(errorIcon);
        
        // Add error message
        const errorMessage = DOM.create('div', {
          props: { className: 'error-message' }
        });
        
        // Extract error text
        let errorText = '';
        if (typeof message.content === 'string') {
          errorText = message.content;
        } else if (message.error && typeof message.error === 'string') {
          errorText = message.error;
        } else if (message.error?.message) {
          errorText = message.error.message;
        } else {
          errorText = 'An error occurred';
        }
        
        errorMessage.textContent = errorText;
        errorContent.appendChild(errorMessage);
        
        // Add retry button if allowed
        if (message.canRetry) {
          const retryBtn = DOM.create('button', {
            props: {
              className: 'error-retry-btn',
              textContent: 'Retry'
            },
            events: {
              click: () => this._requestMessageRegeneration(message.id)
            }
          });
          errorContent.appendChild(retryBtn);
        }
        
        container.appendChild(errorContent);
      }
      
      /**
       * Wikipedia reference message renderer
       * @param {HTMLElement} container - Content container
       * @param {Object} message - Message data
       * @private
       */
      _renderWikiReferenceMessage(container, message) {
        // Add wiki reference class
        DOM.addClass(container, 'wiki-reference');
        
        // Create container for reference
        const refContainer = DOM.create('div', {
          props: { className: 'wiki-reference-container' }
        });
        
        // Add image if available
        if (message.metadata?.image) {
          const imageWrapper = DOM.create('div', {
            props: { className: 'wiki-reference-image' }
          });
          
          const image = DOM.create('img', {
            attrs: {
              src: message.metadata.image,
              alt: message.metadata.title || 'Wikipedia image',
              loading: 'lazy'
            }
          });
          
          imageWrapper.appendChild(image);
          refContainer.appendChild(imageWrapper);
        }
        
        // Add content
        const contentWrapper = DOM.create('div', {
          props: { className: 'wiki-reference-content' }
        });
        
        // Render content with markdown
        if (this.config.markdown.enabled && 
            this.dependencies.markdownParser && 
            typeof message.content === 'string') {
          let html = this.dependencies.markdownParser(message.content);
          
          // Sanitize if enabled
          if (this.config.markdown.sanitize && this.dependencies.sanitizer) {
            html = this.dependencies.sanitizer.sanitize(html);
          }
          
          contentWrapper.innerHTML = html;
        } else {
          contentWrapper.textContent = message.content;
        }
        
        refContainer.appendChild(contentWrapper);
        
        // Add source attribution
        if (message.metadata?.source) {
          const source = DOM.create('div', {
            props: { className: 'wiki-reference-source' }
          });
          
          const link = DOM.create('a', {
            attrs: {
              href: message.metadata.source,
              target: '_blank',
              rel: 'noopener noreferrer'
            },
            props: {
              textContent: 'Source: Wikipedia'
            }
          });
          
          source.appendChild(link);
          refContainer.appendChild(source);
        }
        
        container.appendChild(refContainer);
      }
      
      /**
       * Create file attachment element
       * @param {Object} file - File data
       * @returns {HTMLElement} File attachment element
       * @private
       */
      _createFileAttachment(file) {
        const fileElement = DOM.create('div', {
          props: { className: 'file-attachment' }
        });
        
        // Create header with filename
        const header = DOM.create('div', {
          props: { className: 'file-header' }
        });
        
        // Add icon
        const icon = DOM.create('div', {
          props: {
            className: 'file-icon',
            innerHTML: this._getFileTypeIcon(file.type)
          }
        });
        header.appendChild(icon);
        
        // Add filename
        const filename = DOM.create('span', {
          props: {
            className: 'file-name',
            textContent: file.name
          }
        });
        header.appendChild(filename);
        
        fileElement.appendChild(header);
        
        // Add content based on type
        if (file.type === 'image' || file.type?.startsWith('image/')) {
          const imageWrapper = DOM.create('div', {
            props: { className: 'file-image-wrapper' }
          });
          
          const image = DOM.create('img', {
            attrs: {
              alt: file.name || 'Image attachment',
              loading: 'lazy'
            },
            props: { className: 'file-image' }
          });
          
          // Set source
          if (file.url) {
            image.src = file.url;
          } else if (file.data) {
            image.src = `data:${file.mime || 'image/jpeg'};base64,${file.data}`;
          } else if (file.element) {
            // Clone existing element
            imageWrapper.appendChild(file.element.cloneNode(true));
            fileElement.appendChild(imageWrapper);
            return fileElement;
          }
          
          imageWrapper.appendChild(image);
          fileElement.appendChild(imageWrapper);
        } else {
          // Text content
          const content = DOM.create('div', {
            props: { className: 'file-content' }
          });
          
          if (typeof file.content === 'string') {
            content.textContent = file.content;
          } else if (file.text) {
            content.textContent = file.text;
          } else if (file.preview) {
            content.innerHTML = file.preview;
          } else {
            content.textContent = 'File content not available for preview';
          }
          
          fileElement.appendChild(content);
        }
        
        return fileElement;
      }
      
      /**
       * Get file type icon
       * @param {string} fileType - File type or MIME type
       * @returns {string} Icon HTML
       * @private
       */
      _getFileTypeIcon(fileType) {
        if (!fileType) return this._getDefaultFileIcon();
        
        // Image
        if (fileType === 'image' || fileType.startsWith('image/')) {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>`;
        }
        
        // Document
        if (fileType === 'document' || fileType.includes('pdf') || 
            fileType.includes('text/') || fileType.includes('document')) {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>`;
        }
        
        // Code
        if (fileType === 'code' || fileType.includes('json') || 
            fileType.includes('javascript') || fileType.includes('application/')) {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>`;
        }
        
        return this._getDefaultFileIcon();
      }
      
      /**
       * Get default file icon
       * @returns {string} Icon HTML
       * @private
       */
      _getDefaultFileIcon() {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>`;
      }
      
      /**
       * Update message element with new data
       * @param {HTMLElement} element - Message element
       * @param {Object} data - Updated message data
       * @param {Object} options - Update options
       * @private
       */
      _updateMessageElement(element, data, options = {}) {
        const { animate = true } = options;
        
        // Update content
        const contentElement = element.querySelector(`.${CSS.content.container}`);
        if (contentElement) {
          // Get renderer
          const renderStrategy = this._getRendererForMessage(data);
          const renderer = this.renderers.get(renderStrategy);
          
          if (renderer) {
            // Clear existing content
            DOM.empty(contentElement);
            
            // Apply renderer
            renderer(contentElement, data);
          }
        }
        
        // Update timestamp if present
        const timestamp = element.querySelector('.message-timestamp');
        if (timestamp && data.timestamp) {
          timestamp.dataset.timestamp = data.timestamp;
          timestamp.textContent = this._formatTimestamp(data.timestamp);
        }
        
        // Update edited status
        if (data.edited) {
          const header = element.querySelector('.message-header');
          
          if (header && !header.querySelector('.edited-indicator')) {
            const editedIndicator = DOM.create('span', {
              props: {
                className: 'edited-indicator',
                textContent: '(edited)'
              },
              attrs: {
                title: data.editTimestamp ? 
                  `Edited ${this._formatTimestamp(data.editTimestamp)}` : 
                  'Edited'
              }
            });
            header.appendChild(editedIndicator);
          }
          
          element.classList.add('edited');
        }
        
        // Update file attachments
        if (data.files && data.files.length > 0) {
          element.classList.add(CSS.message.withFiles);
          
          // Check if we need to update attachments
          let filesContainer = contentElement.querySelector('.message-attachments');
          
          if (!filesContainer) {
            // Create container if it doesn't exist
            filesContainer = DOM.create('div', {
              props: { className: 'message-attachments' }
            });
            contentElement.appendChild(filesContainer);
          } else {
            // Clear existing attachments
            DOM.empty(filesContainer);
          }
          
          // Add files
          data.files.forEach(file => {
            const fileElement = this._createFileAttachment(file);
            filesContainer.appendChild(fileElement);
          });
        }
      }
      
      /**
       * Update streaming message content
       * @param {HTMLElement} element - Message element
       * @param {string} content - Content to render
       * @private
       */
      _updateStreamingContent(element, content) {
        const contentElement = element.querySelector(`.${CSS.content.container}`);
        if (!contentElement) return;
        
        // Render with markdown if enabled
        if (this.config.markdown.enabled && this.dependencies.markdownParser) {
          try {
            let html = this.dependencies.markdownParser(content);
            
            // Sanitize if enabled
            if (this.config.markdown.sanitize && this.dependencies.sanitizer) {
              html = this.dependencies.sanitizer.sanitize(html);
            }
            
            contentElement.innerHTML = html;
            
            // Add typing cursor
            const cursor = DOM.create('span', {
              props: { className: 'typing-cursor' }
            });
            contentElement.appendChild(cursor);
            
            // Enhance code blocks
            this._enhanceCodeBlocks(contentElement);
          } catch (e) {
            contentElement.textContent = content;
            
            // Add typing cursor
            const cursor = DOM.create('span', {
              props: { className: 'typing-cursor' }
            });
            contentElement.appendChild(cursor);
          }
        } else {
          contentElement.textContent = content;
          
          // Add typing cursor
          const cursor = DOM.create('span', {
            props: { className: 'typing-cursor' }
          });
          contentElement.appendChild(cursor);
        }
      }
      
      /**
       * Enhance code blocks with additional features
       * @param {HTMLElement} container - Container with code blocks
       * @private
       */
      _enhanceCodeBlocks(container) {
        // Find all code blocks
        const codeBlocks = container.querySelectorAll('pre code');
        if (!codeBlocks.length) return;
        
        // Process each code block
        codeBlocks.forEach((codeElement, index) => {
          // Skip if already enhanced
          if (codeElement.parentElement.dataset.enhanced === 'true') return;
          
          const preElement = codeElement.parentElement;
          
          // Get language
          const languageMatch = codeElement.className.match(/language-(\w+)/);
          const language = languageMatch ? languageMatch[1] : '';
          
          if (language && !preElement.dataset.language) {
            preElement.dataset.language = language;
          }
          
          // Create wrapper
          let wrapper = preElement.parentElement;
          if (!wrapper?.classList.contains('code-block-wrapper')) {
            wrapper = DOM.create('div', {
              props: { className: 'code-block-wrapper' }
            });
            
            // Move pre element into wrapper
            if (preElement.parentNode) {
              preElement.parentNode.insertBefore(wrapper, preElement);
              wrapper.appendChild(preElement);
            }
          }
          
          // Add language label
          if (language && !wrapper.querySelector('.code-language-label')) {
            const langLabel = DOM.create('div', {
              props: {
                className: 'code-language-label',
                textContent: language
              }
            });
            wrapper.insertBefore(langLabel, preElement);
          }
          
          // Add actions toolbar
          if (!wrapper.querySelector('.code-actions')) {
            const actions = DOM.create('div', {
              props: { className: 'code-actions' }
            });
            
            // Copy button
            const copyButton = DOM.create('button', {
              props: {
                className: 'code-action-btn copy-btn',
                innerHTML: `
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>Copy</span>
                `
              },
              events: {
                click: (e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(codeElement.textContent)
                    .then(() => {
                      // Show success UI feedback
                      const originalText = copyButton.querySelector('span').textContent;
                      copyButton.querySelector('span').textContent = 'Copied!';
                      copyButton.classList.add('success');
                      
                      setTimeout(() => {
                        copyButton.querySelector('span').textContent = originalText;
                        copyButton.classList.remove('success');
                      }, 2000);
                    });
                }
              }
            });
            
            // Generate filename
            const filename = preElement.dataset.filename || 
              `snippet_${index + 1}.${this._getFileExtensionFromLanguage(language)}`;
            
            // Download button
            const downloadButton = DOM.create('button', {
              props: {
                className: 'code-action-btn download-btn',
                innerHTML: `
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>${filename}</span>
                `
              },
              events: {
                click: (e) => {
                  e.stopPropagation();
                  
                  // Create download
                  const blob = new Blob([codeElement.textContent], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = DOM.create('a', {
                    attrs: {
                      href: url,
                      download: filename
                    }
                  });
                  
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
              }
            });
            
            // Add buttons
            actions.appendChild(copyButton);
            actions.appendChild(downloadButton);
            
            // Add to wrapper
            wrapper.insertBefore(actions, preElement);
          }
          
          // Apply syntax highlighting
          if (this.config.codeHighlighting.enabled && 
              this.dependencies.codeHighlighter && 
              language) {
            try {
              this.dependencies.codeHighlighter.highlightElement(codeElement);
            } catch (e) {
              console.warn('Failed to highlight code block:', e);
            }
          }
          
          // Mark as enhanced
          preElement.dataset.enhanced = 'true';
        });
      }
      
      /**
       * Get file extension from language
       * @param {string} language - Programming language
       * @returns {string} File extension
       * @private
       */
      _getFileExtensionFromLanguage(language) {
        if (!language) return 'txt';
        
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
          'sql': 'sql',
          'jsx': 'jsx',
          'tsx': 'tsx'
        };
        
        return extensions[language.toLowerCase()] || 'txt';
      }
      
      /**
       * Process Wikipedia links in content
       * @param {HTMLElement} container - Content container
       * @param {string} content - Message content
       * @private
       */
      _processWikipediaLinks(container, content) {
        // Skip if Wikipedia integration not enabled
        if (!this.config.wikipedia.linkPreview) return;
        
        // Find Wikipedia links
        const links = container.querySelectorAll('a[href*="wikipedia.org"]');
        
        // Add preview functionality to each link
        links.forEach(link => {
          // Skip if already processed
          if (link.dataset.processed) return;
          
          // Add special class
          link.classList.add('wikipedia-link');
          
          // Add data attribute
          link.dataset.processed = 'true';
          
          // Add tooltip with preview button
          const tooltip = DOM.create('div', {
            props: { className: 'link-tooltip' }
          });
          
          const previewBtn = DOM.create('button', {
            props: {
              className: 'preview-btn',
              textContent: 'Show Preview'
            },
            events: {
              click: (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Load article
                this.loadWikipediaArticle(link.href)
                  .then(article => {
                    if (article) {
                      this.showArticleSummary(article, { addAsMessage: false });
                    }
                  });
              }
            }
          });
          
          tooltip.appendChild(previewBtn);
          
          // Add cite button
          const citeBtn = DOM.create('button', {
            props: {
              className: 'cite-btn',
              textContent: 'Cite'
            },
            events: {
              click: (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Load article and generate citation
                this.loadWikipediaArticle(link.href)
                  .then(article => {
                    if (article) {
                      this.generateCitation(article);
                    }
                  });
              }
            }
          });
          
          tooltip.appendChild(citeBtn);
          
          // Position tooltip and show on hover
          link.addEventListener('mouseover', () => {
            const linkRect = link.getBoundingClientRect();
            tooltip.style.top = `${linkRect.bottom + 5}px`;
            tooltip.style.left = `${linkRect.left}px`;
            document.body.appendChild(tooltip);
          });
          
          link.addEventListener('mouseout', e => {
            // Check if we're moving to the tooltip
            if (e.relatedTarget === tooltip || tooltip.contains(e.relatedTarget)) {
              return;
            }
            
            // Remove tooltip
            if (tooltip.parentNode) {
              tooltip.parentNode.removeChild(tooltip);
            }
          });
          
          // Remove tooltip when clicking outside
          tooltip.addEventListener('mouseout', e => {
            // Check if we're moving to the link
            if (e.relatedTarget === link || link.contains(e.relatedTarget)) {
              return;
            }
            
            // Remove tooltip
            if (tooltip.parentNode) {
              tooltip.parentNode.removeChild(tooltip);
            }
          });
        });
      }
      
      /**
       * Create a thinking indicator
       * @param {string} model - Model name
       * @param {boolean} animate - Whether to animate
       * @param {string} text - Custom thinking text
       * @returns {HTMLElement} Thinking indicator
       * @private
       */
      _createThinkingIndicator(model, animate, text = null) {
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return null;
        
        // Create thinking indicator
        const indicator = DOM.create('div', {
          attrs: { id: 'thinkingIndicator' },
          props: { className: 'thinking-indicator' }
        });
        
        // Add avatar if enabled
        if (this.config.avatars.enabled) {
          const avatar = DOM.create('div', {
            props: { className: 'thinking-avatar' }
          });
          
          const img = DOM.create('img', {
            attrs: {
              src: this.config.avatars.assistant,
              alt: 'Claude thinking',
              loading: 'lazy'
            }
          });
          
          avatar.appendChild(img);
          indicator.appendChild(avatar);
        }
        
        // Add thinking text
        const thinkingText = DOM.create('div', {
          props: {
            className: 'thinking-text',
            textContent: text || `${model} is thinking`
          }
        });
        indicator.appendChild(thinkingText);
        
        // Add animated dots
        const dots = DOM.create('div', {
          props: { className: 'thinking-dots' }
        });
        
        for (let i = 0; i < 3; i++) {
          const dot = DOM.create('span', {
            props: { className: 'dot' }
          });
          dots.appendChild(dot);
        }
        
        indicator.appendChild(dots);
        
        // Add to chat container
        chatContainer.appendChild(indicator);
        
        // Animate entrance
        if (animate) {
          requestAnimationFrame(() => {
            indicator.classList.add('visible');
          });
        } else {
          indicator.classList.add('visible');
        }
        
        // Scroll to bottom
        this.scrollToBottom({ behavior: 'auto' });
        
        // Announce to screen readers
        if (this.config.accessibility.announceMessages) {
          this._announceToScreenReader(text || `${model} is thinking...`);
        }
        
        return indicator;
      }
      
      /**
       * Create a chat history item
       * @param {Object} chat - Chat data
       * @param {string} currentChatId - Current chat ID
       * @returns {HTMLElement} Chat history item
       * @private
       */
      _createChatHistoryItem(chat, currentChatId) {
        const isActive = chat.id === currentChatId;
        
        const listItem = DOM.create('li', {
          attrs: { 'data-chat-id': chat.id }
        });
        
        const button = DOM.create('button', {
          attrs: {
            'aria-selected': isActive ? 'true' : 'false',
            'role': 'tab'
          },
          props: {
            className: isActive ? 'active' : ''
          },
          events: {
            click: () => this._selectChatFromHistory(chat.id)
          }
        });
        
        // Add icon
        const icon = DOM.create('span', {
          props: {
            className: 'chat-history-icon',
            innerHTML: `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            `
          }
        });
        
        // Add text
        const text = DOM.create('span', {
          props: {
            className: 'chat-history-text',
            textContent: this._formatChatTitle(chat.title)
          }
        });
        
        // Add timestamp
        const timestamp = DOM.create('span', {
          attrs: {
            title: new Date(chat.updatedAt || chat.createdAt).toLocaleString()
          },
          props: {
            className: 'chat-history-time',
            textContent: this._formatRelativeTime(new Date(chat.updatedAt || chat.createdAt).getTime())
          }
        });
        
        // Add actions
        const actions = DOM.create('div', {
          props: { className: 'chat-history-actions' }
        });
        
        // Delete button
        const deleteBtn = DOM.create('button', {
          attrs: {
            'aria-label': 'Delete chat',
            title: 'Delete chat'
          },
          props: {
            className: 'chat-history-action-btn',
            innerHTML: `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            `
          },
          events: {
            click: (e) => {
              e.stopPropagation();
              this._confirmDeleteChat(chat.id);
            }
          }
        });
        
        actions.appendChild(deleteBtn);
        
        // Add elements to button
        button.appendChild(icon);
        button.appendChild(text);
        button.appendChild(timestamp);
        button.appendChild(actions);
        
        // Add button to list item
        listItem.appendChild(button);
        
        return listItem;
      }
      
      /**
       * Format chat title
       * @param {string} title - Raw title
       * @returns {string} Formatted title
       * @private
       */
      _formatChatTitle(title) {
        // Use default title if none provided
        let formattedTitle = title || 'New Chat';
        
        // Truncate long titles
        if (formattedTitle.length > 30) {
          formattedTitle = formattedTitle.substring(0, 27) + '...';
        }
        
        return formattedTitle;
      }
      
      /**
       * Select chat from history
       * @param {string} chatId - Chat ID
       * @private
       */
      _selectChatFromHistory(chatId) {
        // Emit event for app to handle
        this._emitEvent('selectChat', { chatId });
      }
      
      /**
       * Confirm chat deletion
       * @param {string} chatId - Chat ID
       * @private
       */
      _confirmDeleteChat(chatId) {
        // Create confirmation dialog
        const dialog = DOM.create('div', {
          props: { className: 'wikichat-modal confirmation-dialog' }
        });
        
        const dialogContent = DOM.create('div', {
          props: { className: 'modal-content' }
        });
        
        // Add header
        const header = DOM.create('div', {
          props: { className: 'modal-header' }
        });
        
        const title = DOM.create('h3', {
          props: { textContent: 'Delete Chat?' }
        });
        
        const closeBtn = DOM.create('button', {
          props: {
            className: 'modal-close-btn',
            innerHTML: '&times;'
          },
          attrs: {
            'aria-label': 'Close'
          },
          events: {
            click: () => dialog.remove()
          }
        });
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        dialogContent.appendChild(header);
        
        // Add message
        const message = DOM.create('p', {
          props: {
            className: 'dialog-message',
            textContent: 'Are you sure you want to delete this chat? This action cannot be undone.'
          }
        });
        dialogContent.appendChild(message);
        
        // Add actions
        const actions = DOM.create('div', {
          props: { className: 'dialog-actions' }
        });
        
        const cancelBtn = DOM.create('button', {
          props: {
            className: 'btn-secondary',
            textContent: 'Cancel'
          },
          events: {
            click: () => dialog.remove()
          }
        });
        
        const deleteBtn = DOM.create('button', {
          props: {
            className: 'btn-danger',
            textContent: 'Delete'
          },
          events: {
            click: () => {
              dialog.remove();
              this._deleteChat(chatId);
            }
          }
        });
        
        actions.appendChild(cancelBtn);
        actions.appendChild(deleteBtn);
        dialogContent.appendChild(actions);
        
        dialog.appendChild(dialogContent);
        document.body.appendChild(dialog);
        
        // Add event listener to close when clicking outside
        setTimeout(() => {
          dialog.addEventListener('click', e => {
            if (e.target === dialog) dialog.remove();
          });
        }, 0);
      }
      
      /**
       * Delete a chat
       * @param {string} chatId - Chat ID
       * @private
       */
      _deleteChat(chatId) {
        // Emit event for app to handle
        this._emitEvent('deleteChat', { chatId });
      }
      
      /**
       * Clear chat history with animation
       * @param {HTMLElement} container - Chat history container
       * @param {Function} callback - Callback after clearing
       * @private
       */
      _clearChatHistory(container, callback) {
        const items = container.querySelectorAll('li');
        
        if (items.length === 0) {
          callback();
          return;
        }
        
        // Add removing class to animate out
        items.forEach((item, index) => {
          item.style.animationDelay = `${index * 30}ms`;
          item.classList.add('removing');
        });
        
        // Wait for animations to complete
        setTimeout(() => {
          DOM.empty(container);
          callback();
        }, 300);
      }
      
      /**
       * Animate chat history items
       * @param {HTMLElement} container - Chat history container
       * @private
       */
      _animateChatHistoryItems(container) {
        const items = container.querySelectorAll('li');
        
        items.forEach((item, index) => {
          item.style.animationDelay = `${index * 30}ms`;
          item.classList.add('entering');
          
          // Remove animation class after it completes
          setTimeout(() => {
            item.classList.remove('entering');
            item.style.animationDelay = '';
          }, 500 + index * 30);
        });
      }
      
      /**
       * Create info panel
       * @returns {HTMLElement} Info panel
       * @private
       */
      _createInfoPanel() {
        // Create panel
        const panel = DOM.create('div', {
          attrs: { id: 'infoPanel' },
          props: { className: 'wikichat-info-panel' }
        });
        
        // Add close button
        const closeBtn = DOM.create('button', {
          props: {
            className: 'panel-close-btn',
            innerHTML: `
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            `
          },
          attrs: {
            'aria-label': 'Close panel'
          },
          events: {
            click: () => panel.classList.remove('visible')
          }
        });
        
        panel.appendChild(closeBtn);
        
        // Add to body
        document.body.appendChild(panel);
        
        // Store reference
        this.state.elements.set('infoPanel', panel);
        
        return panel;
      }
      
      /**
       * Load more messages above current view
       * @private
       */
      _loadMoreAbove() {
        if (!this.config.virtualScroller.enabled) return;
        
        const { 
          bufferedStartIndex,
          visibleStartIndex, 
          needsUpdate 
        } = this.state.virtualScroller;
        
        // Skip if already at the top or if an update is pending
        if (bufferedStartIndex === 0 || needsUpdate) return;
        
        // Calculate range to load
        const loadCount = this.config.virtualScroller.chunkSize;
        const newStartIndex = Math.max(0, bufferedStartIndex - loadCount);
        
        // Request rendering of newly visible items
        this.state.virtualScroller.bufferedStartIndex = newStartIndex;
        this.state.virtualScroller.needsUpdate = true;
        
        // Update virtual scroller
        this._updateVirtualScroller();
      }
      
      /**
       * Load more messages below current view
       * @private
       */
      _loadMoreBelow() {
        if (!this.config.virtualScroller.enabled) return;
        
        const { 
          bufferedEndIndex, 
          totalMessages, 
          needsUpdate
        } = this.state.virtualScroller;
        
        // Skip if already at the bottom or if an update is pending
        if (bufferedEndIndex >= totalMessages - 1 || needsUpdate) return;
        
        // Calculate range to load
        const loadCount = this.config.virtualScroller.chunkSize;
        const newEndIndex = Math.min(totalMessages - 1, bufferedEndIndex + loadCount);
        
        // Request rendering of newly visible items
        this.state.virtualScroller.bufferedEndIndex = newEndIndex;
        this.state.virtualScroller.needsUpdate = true;
        
        // Update virtual scroller
        this._updateVirtualScroller();
      }
      
      /**
       * Update virtual scroller to show only visible and buffered messages
       * @private
       */
      _updateVirtualScroller() {
        if (!this.config.virtualScroller.enabled) return;
        
        // Get all messages
        const messages = Array.from(this.state.messages.values())
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // Update total count
        this.state.virtualScroller.totalMessages = messages.length;
        
        // If there are no messages, nothing to do
        if (messages.length === 0) return;
        
        // Find visible messages
        const visibleMessageIds = Array.from(this.state.visibleMessages);
        const visibleMessages = messages.filter(m => visibleMessageIds.includes(m.id));
        
        // If no messages are visible, use a default range
        if (visibleMessages.length === 0) {
          this.state.virtualScroller.visibleStartIndex = 0;
          this.state.virtualScroller.visibleEndIndex = Math.min(
            this.config.virtualScroller.bufferSize,
            messages.length - 1
          );
        } else {
          // Find visible range
          const visibleIndices = visibleMessages.map(m => messages.indexOf(m));
          this.state.virtualScroller.visibleStartIndex = Math.min(...visibleIndices);
          this.state.virtualScroller.visibleEndIndex = Math.max(...visibleIndices);
        }
        
        // Calculate buffer range
        const bufferSize = this.config.virtualScroller.bufferSize;
        const newBufferedStartIndex = Math.max(0, 
          this.state.virtualScroller.visibleStartIndex - bufferSize);
        const newBufferedEndIndex = Math.min(
          messages.length - 1,
          this.state.virtualScroller.visibleEndIndex + bufferSize
        );
        
        // Update buffer indices
        this.state.virtualScroller.bufferedStartIndex = newBufferedStartIndex;
        this.state.virtualScroller.bufferedEndIndex = newBufferedEndIndex;
        
        // Calculate which messages are outside the buffer and should be hidden
        const toHide = messages.filter((m, index) => 
          index < newBufferedStartIndex || index > newBufferedEndIndex);
        
        // Calculate which messages should be shown
        const toShow = messages.filter((m, index) => 
          index >= newBufferedStartIndex && index <= newBufferedEndIndex);
        
        // Hide messages outside buffer
        toHide.forEach(message => {
          const element = message.element;
          if (element && element.parentNode) {
            // Use recycling if configured
            if (this.config.performance.domRecycling) {
              this.state.virtualScroller.recycledNodes.push(element);
              element.parentNode.removeChild(element);
              message.inDOM = false;
            } else {
              element.style.display = 'none';
            }
          }
        });
        
        // Show messages in buffer
        const chatContainer = this.state.elements.get('chatContainer');
        const topSpacer = this.state.elements.get('topSpacer');
        const bottomSpacer = this.state.elements.get('bottomSpacer');
        
        if (!chatContainer || !topSpacer || !bottomSpacer) return;
        
        // Calculate average height
        let totalHeight = 0;
        let measuredCount = 0;
        
        toShow.forEach(message => {
          if (message.element) {
            const height = message.element.offsetHeight;
            if (height > 0) {
              totalHeight += height;
              measuredCount++;
              
              // Store height
              this.state.virtualScroller.itemHeights.set(message.id, height);
            }
          }
        });
        
        if (measuredCount > 0) {
          this.state.virtualScroller.averageItemHeight = totalHeight / measuredCount;
        }
        
        // Update spacers
        if (this.state.virtualScroller.averageItemHeight > 0) {
          const avgHeight = this.state.virtualScroller.averageItemHeight;
          
          // Calculate spacer heights
          const topSpacerHeight = newBufferedStartIndex * avgHeight;
          const bottomSpacerHeight = (messages.length - newBufferedEndIndex - 1) * avgHeight;
          
          // Update spacers
          topSpacer.style.height = `${topSpacerHeight}px`;
          bottomSpacer.style.height = `${bottomSpacerHeight}px`;
        }
        
        // Mark update as complete
        this.state.virtualScroller.needsUpdate = false;
      }
      
      /**
       * Load content for visible messages (lazy loading)
       * @private
       */
      _loadVisibleContent() {
        if (!this.config.performance.lazyLoadContent) return;
        
        // Process only a limited number of messages at once
        const visibleIds = Array.from(this.state.visibleMessages);
        const toLoad = [];
        
        for (const messageId of visibleIds) {
          const messageData = this.state.messages.get(messageId);
          
          if (messageData && !messageData.contentLoaded) {
            toLoad.push(messageId);
            
            // Limit batch size
            if (toLoad.length >= this.config.performance.concurrentRendering) {
              break;
            }
          }
        }
        
        // Load content for each message
        toLoad.forEach(messageId => {
          this._loadMessageContent(messageId);
        });
      }
      
      /**
       * Load content for a message
       * @param {string} messageId - Message ID
       * @private
       */
      _loadMessageContent(messageId) {
        const messageData = this.state.messages.get(messageId);
        if (!messageData || messageData.contentLoaded) return;
        
        const { element, data } = messageData;
        
        // Mark as loading
        const contentElement = element.querySelector(`.${CSS.content.container}`);
        if (!contentElement) return;
        
        // Add loading class
        DOM.addClass(contentElement, CSS.content.loading);
        
        // Use appropriate renderer
        const renderStrategy = this._getRendererForMessage(data);
        const renderer = this.renderers.get(renderStrategy);
        
        if (renderer) {
          try {
            // Clear existing content
            DOM.empty(contentElement);
            
            // Apply renderer
            renderer(contentElement, data);
            
            // Remove loading class
            DOM.removeClass(contentElement, CSS.content.loading);
            
            // Mark as loaded
            messageData.contentLoaded = true;
          } catch (error) {
            console.error('Error rendering message content:', error);
            
            // Fallback to default renderer
            this.renderers.get(RENDERERS.DEFAULT)(contentElement, data);
            
            // Remove loading class
            DOM.removeClass(contentElement, CSS.content.loading);
          }
        }
      }
      
      /**
       * Rehighlight visible code blocks
       * @private
       */
      _rehighlightCodeBlocks() {
        if (!this.config.codeHighlighting.enabled || !this.dependencies.codeHighlighter) return;
        
        // Find visible messages
        const visibleIds = Array.from(this.state.visibleMessages);
        
        // Process code blocks in visible messages
        visibleIds.forEach(messageId => {
          const messageData = this.state.messages.get(messageId);
          if (!messageData) return;
          
          const { element } = messageData;
          
          // Find code blocks
          const codeBlocks = element.querySelectorAll('pre code');
          
          // Rehighlight each block
          codeBlocks.forEach(codeElement => {
            try {
              // Reset enhanced state to force re-enhancement
              const preElement = codeElement.parentElement;
              if (preElement) {
                preElement.dataset.enhanced = 'false';
              }
              
              // Rehighlight
              this.dependencies.codeHighlighter.highlightElement(codeElement);
              
              // Re-enhance code blocks
              this._enhanceCodeBlocks(element);
            } catch (e) {
              console.warn('Failed to rehighlight code block:', e);
            }
          });
        });
      }
      
      /**
       * Update message layout after changes
       * @private
       */
      _updateLayout() {
        // Update message grouping
        this._updateMessageGrouping();
        
        // Update date headers
        this._updateDateHeaders();
        
        // Update virtual scrolling
        if (this.config.virtualScroller.enabled) {
          this._updateVirtualScroller();
        }
      }
      
      /**
       * Update message grouping
       * @private
       */
      _updateMessageGrouping() {
        if (!this.config.messageGrouping.enabled) return;
        
        // Get all messages in order
        const messages = Array.from(this.state.messages.values())
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // Skip if too few messages
        if (messages.length <= 1) return;
        
        // Process each message after the first
        for (let i = 1; i < messages.length; i++) {
          const current = messages[i];
          const previous = messages[i-1];
          
          // Check if messages should be grouped
          const shouldGroup = this._shouldGroup(previous.data, current.data);
          
          // Update grouped class
          if (shouldGroup) {
            DOM.addClass(current.element, CSS.message.grouped);
          } else {
            DOM.removeClass(current.element, CSS.message.grouped);
          }
        }
      }
      
      /**
       * Check if messages should be grouped
       * @param {Object} previous - Previous message
       * @param {Object} current - Current message
       * @returns {boolean} Whether they should be grouped
       * @private
       */
      _shouldGroup(previous, current) {
        // Skip if disabled
        if (!this.config.messageGrouping.enabled) return false;
        
        // Must be same role
        if (previous.role !== current.role) return false;
        
        // Check time threshold
        const timeDiff = current.timestamp - previous.timestamp;
        return timeDiff < this.config.messageGrouping.timeThreshold;
      }
      
      /**
       * Check if message should group with previous
       * @param {Object} message - Message to check
       * @returns {boolean} Whether it should be grouped
       * @private
       */
      _shouldGroupWithPreviousMessage(message) {
        // Get previous message
        const messages = Array.from(this.state.messages.values())
          .sort((a, b) => b.timestamp - a.timestamp);
        
        // No messages to group with
        if (messages.length === 0) return false;
        
        // Get most recent message
        const previousMessage = messages[0].data;
        
        // Check if they should be grouped
        return this._shouldGroup(previousMessage, message);
      }
      
      /**
       * Update date headers
       * @private
       */
      _updateDateHeaders() {
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return;
        
        // Remove existing date headers
        const existingHeaders = chatContainer.querySelectorAll('.date-header');
        existingHeaders.forEach(header => {
          DOM.remove(header);
        });
        
        // Get all messages in order
        const messages = Array.from(this.state.messages.values())
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // Skip if no messages
        if (messages.length === 0) return;
        
        // Track dates we've seen
        const dates = new Set();
        
        // Add date header before first message
        const firstMessage = messages[0];
        const firstDate = this._getDateString(firstMessage.timestamp);
        dates.add(firstDate);
        
        const firstHeader = this._createDateHeader(firstMessage.timestamp);
        chatContainer.insertBefore(firstHeader, firstMessage.element);
        
        // Check remaining messages
        for (let i = 1; i < messages.length; i++) {
          const message = messages[i];
          const date = this._getDateString(message.timestamp);
          
          // Add header if this is a new date
          if (!dates.has(date)) {
            dates.add(date);
            
            // Create and insert header
            const header = this._createDateHeader(message.timestamp);
            chatContainer.insertBefore(header, message.element);
          }
        }
      }
      
      /**
       * Check if a date header should be added for a timestamp
       * @param {number} timestamp - Message timestamp
       * @returns {boolean} Whether a header is needed
       * @private
       */
      _shouldAddDateHeader(timestamp) {
        // Get date string
        const date = this._getDateString(timestamp);
        
        // Check existing messages
        const messages = Array.from(this.state.messages.values());
        
        // Skip if no messages
        if (messages.length === 0) return true;
        
        // Check if we have a message on this date
        return !messages.some(message => 
          this._getDateString(message.timestamp) === date);
      }
      
      /**
       * Create a date header element
       * @param {number} timestamp - Date timestamp
       * @returns {HTMLElement} Date header
       * @private
       */
      _createDateHeader(timestamp) {
        const dateString = this._formatDateHeader(timestamp);
        
        const header = DOM.create('div', {
          attrs: {
            'data-date': this._getDateString(timestamp)
          },
          props: {
            className: 'date-header',
            textContent: dateString
          }
        });
        
        return header;
      }
      
      /**
       * Get standardized date string for a timestamp
       * @param {number} timestamp - Timestamp to format
       * @returns {string} Date string (YYYY-MM-DD)
       * @private
       */
      _getDateString(timestamp) {
        const date = new Date(timestamp);
        return date.toISOString().split('T')[0];
      }
      
      /**
       * Format date for header display
       * @param {number} timestamp - Date timestamp
       * @returns {string} Formatted date
       * @private
       */
      _formatDateHeader(timestamp) {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Format for today/yesterday
        if (this._getDateString(date) === this._getDateString(today)) {
          return 'Today';
        } else if (this._getDateString(date) === this._getDateString(yesterday)) {
          return 'Yesterday';
        }
        
        // Format for other dates
        return date.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
      }
      
      /**
       * Update sticky date headers
       * @private
       */
      _updateStickyHeaders() {
        const headers = document.querySelectorAll('.date-header');
        if (!headers.length) return;
        
        // Find the header that should be sticky
        let stickyHeader = null;
        let smallestTopValue = Infinity;
        
        headers.forEach(header => {
          const rect = header.getBoundingClientRect();
          
          // Header is above the viewport
          if (rect.top <= 0) {
            // Find the one closest to top of viewport
            if (rect.top > -rect.height && rect.top > -smallestTopValue) {
              stickyHeader = header;
              smallestTopValue = Math.abs(rect.top);
            }
            
            // Remove sticky from all headers
            header.classList.remove('sticky');
          }
        });
        
        // Add sticky class to the selected header
        if (stickyHeader) {
          stickyHeader.classList.add('sticky');
        }
      }
      
      /**
       * Update all message timestamps
       * @private
       */
      _updateAllTimestamps() {
        // Skip if format is not relative
        if (this.config.timestamps.format !== 'relative') return;
        
        // Update visible messages for efficiency
        const visibleIds = Array.from(this.state.visibleMessages);
        
        for (const messageId of visibleIds) {
          const messageData = this.state.messages.get(messageId);
          if (!messageData) continue;
          
          const { element, timestamp } = messageData;
          this._updateMessageTimestamp(element, timestamp);
        }
      }
      
      /**
       * Update timestamp for a message element
       * @param {HTMLElement} element - Message element
       * @param {number} timestamp - Timestamp to update
       * @private
       */
      _updateMessageTimestamp(element, timestamp) {
        const timestampElement = element.querySelector('.message-timestamp');
        if (!timestampElement) return;
        
        if (!timestamp && timestampElement.dataset.timestamp) {
          timestamp = parseInt(timestampElement.dataset.timestamp, 10);
        }
        
        if (timestamp) {
          timestampElement.textContent = this._formatTimestamp(timestamp);
        }
      }
      
      /**
       * Format a timestamp according to settings
       * @param {number} timestamp - Timestamp to format
       * @returns {string} Formatted timestamp
       * @private
       */
      _formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        
        switch (this.config.timestamps.format) {
          case 'relative':
            return this._formatRelativeTime(timestamp);
            
          case 'time':
            return date.toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: 'numeric'
            });
            
          case 'datetime':
            return date.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric'
            });
            
          default:
            return date.toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: 'numeric'
            });
        }
      }
      
      /**
       * Format a timestamp as relative time
       * @param {number} timestamp - Timestamp to format
       * @returns {string} Relative time string
       * @private
       */
      _formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        // Just now (< 1 minute)
        if (diff < 60000) {
          return 'just now';
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
        
        // Weeks
        if (diff < 2592000000) {
          const weeks = Math.floor(diff / 604800000);
          return `${weeks}w ago`;
        }
        
        // Months
        if (diff < 31536000000) {
          const months = Math.floor(diff / 2592000000);
          return `${months}mo ago`;
        }
        
        // Years
        const years = Math.floor(diff / 31536000000);
        return `${years}y ago`;
      }
      
      /**
       * Hide welcome screen
       * @private
       */
      _hideWelcomeScreen() {
        const welcomeScreen = this.state.elements.get('welcomeScreen');
        if (welcomeScreen && !welcomeScreen.classList.contains(CSS.layout.hidden)) {
          welcomeScreen.classList.add(CSS.layout.hidden);
          
          // Focus input after hiding welcome screen
          setTimeout(() => {
            const userInput = this.state.elements.get('userInput');
            if (userInput) userInput.focus();
          }, 100);
        }
      }
      
      /**
       * Show welcome screen
       * @private
       */
      _showWelcomeScreen() {
        const welcomeScreen = this.state.elements.get('welcomeScreen');
        if (welcomeScreen) {
          welcomeScreen.classList.remove(CSS.layout.hidden);
        }
      }
      
      /**
       * Announce a message to screen readers
       * @param {Object} message - Message data
       * @param {boolean} force - Whether to force announcement
       * @private
       */
      _announceMessage(message, force = false) {
        if (!this.config.accessibility.announceMessages && !force) return;
        
        const liveRegion = this.state.elements.get('liveRegion');
        if (!liveRegion) return;
        
        // Create announcement text
        let announcement = '';
        
        if (message.type === 'error') {
          announcement = `Error: ${message.content || message.error || 'An error occurred'}`;
        } else {
          const speaker = message.role === 'human' ? 'You' : 'Claude';
          let content = '';
          
          if (typeof message.content === 'string') {
            // Truncate long messages
            content = message.content.length > 200 ?
              message.content.substring(0, 200) + '...' :
              message.content;
          } else if (message.content && typeof message.content === 'object') {
            content = '[Complex content]';
          }
          
          announcement = `${speaker}: ${content}`;
        }
        
        // Update live region
        liveRegion.textContent = announcement;
      }
      
      /**
       * Announce text to screen readers
       * @param {string} text - Text to announce
       * @private
       */
      _announceToScreenReader(text) {
        const liveRegion = this.state.elements.get('liveRegion');
        if (!liveRegion) return;
        
        liveRegion.textContent = text;
      }
      
      /**
       * Show a toast notification
       * @param {Object} options - Toast options
       * @private
       */
      _showToast(options = {}) {
        const {
          title = '',
          message = '',
          type = 'info',
          duration = 5000,
          actions = []
        } = options;
        
        // Add to queue
        this.state.toastQueue.push({
          title,
          message,
          type,
          duration,
          actions,
          id: `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        });
        
        // Process queue
        this._processToastQueue();
      }
      
      /**
       * Process toast notification queue
       * @private
       */
      _processToastQueue() {
        if (this.state.toastQueue.length === 0) return;
        
        const toastContainer = this.state.elements.get('toastContainer');
        if (!toastContainer) return;
        
        // Get next toast
        const toast = this.state.toastQueue.shift();
        
        // Create toast element
        const toastElement = DOM.create('div', {
          attrs: {
            'role': 'alert',
            'aria-live': 'polite',
            'id': toast.id
          },
          props: {
            className: `wikichat-toast ${toast.type}`
          }
        });
        
        // Add content
        const content = DOM.create('div', {
          props: { className: 'toast-content' }
        });
        
        // Add icon based on type
        const icon = DOM.create('div', {
          props: {
            className: 'toast-icon',
            innerHTML: this._getToastIcon(toast.type)
          }
        });
        content.appendChild(icon);
        
        // Add text
        const text = DOM.create('div', {
          props: { className: 'toast-text' }
        });
        
        if (toast.title) {
          const title = DOM.create('div', {
            props: {
              className: 'toast-title',
              textContent: toast.title
            }
          });
          text.appendChild(title);
        }
        
        if (toast.message) {
          const message = DOM.create('div', {
            props: {
              className: 'toast-message',
              textContent: toast.message
            }
          });
          text.appendChild(message);
        }
        
        content.appendChild(text);
        toastElement.appendChild(content);
        
        // Add close button
        const closeBtn = DOM.create('button', {
          attrs: {
            'aria-label': 'Close notification',
            'type': 'button'
          },
          props: {
            className: 'toast-close',
            innerHTML: '&times;'
          },
          events: {
            click: () => this._removeToast(toastElement)
          }
        });
        toastElement.appendChild(closeBtn);
        
        // Add actions
        if (toast.actions.length > 0) {
          const actions = DOM.create('div', {
            props: { className: 'toast-actions' }
          });
          
          toast.actions.forEach(action => {
            const button = DOM.create('button', {
              props: {
                className: 'toast-action',
                textContent: action.label
              },
              events: {
                click: () => {
                  if (action.callback) {
                    action.callback();
                  }
                  this._removeToast(toastElement);
                }
              }
            });
            actions.appendChild(button);
          });
          
          toastElement.appendChild(actions);
        }
        
        // Add to container
        toastContainer.appendChild(toastElement);
        
        // Animate in
        requestAnimationFrame(() => {
          toastElement.classList.add('visible');
        });
        
        // Auto-remove after duration
        if (toast.duration > 0) {
          setTimeout(() => {
            this._removeToast(toastElement);
          }, toast.duration);
        }
        
        // Process next toast after a delay
        if (this.state.toastQueue.length > 0) {
          setTimeout(() => {
            this._processToastQueue();
          }, 300);
        }
      }
      
      /**
       * Remove a toast notification
       * @param {HTMLElement} toastElement - Toast element
       * @private
       */
      _removeToast(toastElement) {
        if (!toastElement) return;
        
        // Animate out
        toastElement.classList.remove('visible');
        
        // Remove after animation
        setTimeout(() => {
          DOM.remove(toastElement);
          
          // Process next toast if any
          if (this.state.toastQueue.length > 0) {
            this._processToastQueue();
          }
        }, 300);
      }
      
      /**
       * Get icon for toast notification
       * @param {string} type - Toast type
       * @returns {string} Icon HTML
       * @private
       */
      _getToastIcon(type) {
        switch (type) {
          case 'success':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 12l2 2 4-4"></path>
                  </svg>`;
                  
          case 'error':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>`;
                  
          case 'warning':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>`;
                  
          case 'info':
          default:
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>`;
        }
      }
      
      /**
       * Process keyboard shortcuts
       * @param {KeyboardEvent} e - Keyboard event
       * @returns {boolean} Whether a shortcut was triggered
       * @private
       */
      _processKeyboardShortcuts(e) {
        // Skip if typing in input fields
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
          return false;
        }
        
        // Check registered shortcuts
        for (const [id, shortcut] of this.state.registeredShortcuts.entries()) {
          if (e.key === shortcut.key &&
              e.ctrlKey === !!shortcut.modifiers.ctrlKey &&
              e.altKey === !!shortcut.modifiers.altKey &&
              e.shiftKey === !!shortcut.modifiers.shiftKey &&
              e.metaKey === !!shortcut.modifiers.metaKey) {
            
            const result = shortcut.callback(e);
            
            if (result !== false) {
              e.preventDefault();
            }
            
            return true;
          }
        }
        
        return false;
      }
      
      /**
       * Show keyboard shortcuts dialog
       * @private
       */
      _showKeyboardShortcuts() {
        // Create modal
        const modal = DOM.create('div', {
          props: { className: 'wikichat-modal shortcuts-modal' }
        });
        
        const content = DOM.create('div', {
          props: { className: 'modal-content' }
        });
        
        // Add header
        const header = DOM.create('div', {
          props: { className: 'modal-header' }
        });
        
        const title = DOM.create('h3', {
          props: { textContent: 'Keyboard Shortcuts' }
        });
        
        const closeBtn = DOM.create('button', {
          props: {
            className: 'modal-close-btn',
            innerHTML: '&times;'
          },
          attrs: {
            'aria-label': 'Close'
          },
          events: {
            click: () => modal.remove()
          }
        });
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        content.appendChild(header);
        
        // Create shortcuts list
        const shortcutsList = DOM.create('div', {
          props: { className: 'shortcuts-list' }
        });
        
        // Group shortcuts by category
        const categories = {
          'Navigation': [],
          'Messages': [],
          'Formatting': [],
          'Other': []
        };
        
        // Sort shortcuts into categories
        for (const [id, shortcut] of this.state.registeredShortcuts.entries()) {
          const keyCombo = this._formatKeyboardShortcut(shortcut);
          
          const shortcutItem = {
            key: keyCombo,
            description: shortcut.description
          };
          
          // Categorize based on description
          if (shortcut.description.includes('message')) {
            categories['Messages'].push(shortcutItem);
          } else if (['Bold', 'Italic', 'Inline code'].includes(shortcut.description)) {
            categories['Formatting'].push(shortcutItem);
          } else if (['New chat', 'Focus input', 'Settings'].includes(shortcut.description)) {
            categories['Navigation'].push(shortcutItem);
          } else {
            categories['Other'].push(shortcutItem);
          }
        }
        
        // Add each category
        Object.entries(categories).forEach(([category, shortcuts]) => {
          if (shortcuts.length === 0) return;
          
          const categorySection = DOM.create('div', {
            props: { className: 'shortcuts-category' }
          });
          
          const categoryTitle = DOM.create('h4', {
            props: { textContent: category }
          });
          categorySection.appendChild(categoryTitle);
          
          const shortcutItems = DOM.create('div', {
            props: { className: 'shortcut-items' }
          });
          
          shortcuts.forEach(shortcut => {
            const item = DOM.create('div', {
              props: { className: 'shortcut-item' }
            });
            
            const key = DOM.create('div', {
              props: {
                className: 'shortcut-key',
                innerHTML: shortcut.key
              }
            });
            
            const description = DOM.create('div', {
              props: {
                className: 'shortcut-description',
                textContent: shortcut.description
              }
            });
            
            item.appendChild(key);
            item.appendChild(description);
            shortcutItems.appendChild(item);
          });
          
          categorySection.appendChild(shortcutItems);
          shortcutsList.appendChild(categorySection);
        });
        
        content.appendChild(shortcutsList);
        modal.appendChild(content);
        
        // Add to body
        document.body.appendChild(modal);
        
        // Add event listener to close when clicking outside
        setTimeout(() => {
          modal.addEventListener('click', e => {
            if (e.target === modal) modal.remove();
          });
        }, 0);
        
        // Add Escape key handler
        const keyHandler = e => {
          if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', keyHandler);
          }
        };
        
        document.addEventListener('keydown', keyHandler);
        
        return true;
      }
      
      /**
       * Format keyboard shortcut for display
       * @param {Object} shortcut - Shortcut data
       * @returns {string} Formatted shortcut HTML
       * @private
       */
      _formatKeyboardShortcut(shortcut) {
        const parts = [];
        
        // Add modifiers
        if (shortcut.modifiers.ctrlKey) {
          parts.push('<kbd>Ctrl</kbd>');
        }
        
        if (shortcut.modifiers.altKey) {
          parts.push('<kbd>Alt</kbd>');
        }
        
        if (shortcut.modifiers.shiftKey) {
          parts.push('<kbd>Shift</kbd>');
        }
        
        if (shortcut.modifiers.metaKey) {
          parts.push('<kbd>⌘</kbd>');
        }
        
        // Add key
        let keyDisplay = shortcut.key;
        
        // Format special keys
        switch (shortcut.key) {
          case 'ArrowUp':
            keyDisplay = '↑';
            break;
          case 'ArrowDown':
            keyDisplay = '↓';
            break;
          case 'ArrowLeft':
            keyDisplay = '←';
            break;
          case 'ArrowRight':
            keyDisplay = '→';
            break;
          case 'Enter':
            keyDisplay = 'Enter';
            break;
          case 'Escape':
            keyDisplay = 'Esc';
            break;
        }
        
        parts.push(`<kbd>${keyDisplay}</kbd>`);
        
        // Join with plus signs
        return parts.join(' + ');
      }
      
      /**
       * Save an action to the undo stack
       * @param {Object} action - Action data
       * @private
       */
      _saveToUndoStack(action) {
        // Add timestamp for tracking
        action.timestamp = Date.now();
        
        // Add to undo stack
        this.state.undoStack.push(action);
        
        // Clear redo stack on new action
        this.state.redoStack = [];
        
        // Limit stack size
        if (this.state.undoStack.length > 50) {
          this.state.undoStack.shift();
        }
      }
      
      /**
       * Undo the last action
       * @private
       */
      _undo() {
        if (this.state.undoStack.length === 0) return false;
        
        // Get last action
        const action = this.state.undoStack.pop();
        
        // Add to redo stack
        this.state.redoStack.push(action);
        
        // Perform undo based on action type
        switch (action.type) {
          case 'edit':
            // Restore previous content
            const messageData = this.state.messages.get(action.messageId);
            if (messageData) {
              messageData.data.content = action.previousContent;
              this._updateMessageElement(messageData.element, messageData.data);
            }
            break;
            
          case 'remove':
            // Restore message
            this.addMessage(action.data, { 
              scrollIntoView: true,
              animate: true,
              addToHistory: false
            });
            break;
            
          case 'update':
            // Restore previous data
            const msgData = this.state.messages.get(action.messageId);
            if (msgData) {
              msgData.data = { ...action.previousData };
              this._updateMessageElement(msgData.element, msgData.data);
            }
            break;
        }
        
        // Show toast
        this._showToast({
          title: 'Undo',
          message: 'Last action undone',
          type: 'info',
          duration: 2000
        });
        
        return true;
      }
      
      /**
       * Redo the last undone action
       * @private
       */
      _redo() {
        if (this.state.redoStack.length === 0) return false;
        
        // Get last undone action
        const action = this.state.redoStack.pop();
        
        // Add back to undo stack
        this.state.undoStack.push(action);
        
        // Perform redo based on action type
        switch (action.type) {
          case 'edit':
            // Restore new content
            const messageData = this.state.messages.get(action.messageId);
            if (messageData) {
              messageData.data.content = action.newContent;
              this._updateMessageElement(messageData.element, messageData.data);
            }
            break;
            
          case 'remove':
            // Remove message again
            this.removeMessage(action.messageId, { addToHistory: false });
            break;
            
          case 'update':
            // Restore updated data
            const msgData = this.state.messages.get(action.messageId);
            if (msgData) {
              msgData.data = { ...action.currentData };
              this._updateMessageElement(msgData.element, msgData.data);
            }
            break;
        }
        
        // Show toast
        this._showToast({
          title: 'Redo',
          message: 'Action redone',
          type: 'info',
          duration: 2000
        });
        
        return true;
      }
      
      /**
       * Initialize plugins
       * @returns {Promise} Resolved when plugins are loaded
       * @private
       */
      async _initPlugins() {
        // Skip if no plugin system
        if (!window.WikiChatPlugins) return;
        
        try {
          const plugins = window.WikiChatPlugins.getPlugins();
          
          // Initialize each plugin
          for (const plugin of plugins) {
            if (plugin.ui && typeof plugin.ui.init === 'function') {
              await plugin.ui.init(this);
              this.state.loadedPlugins.add(plugin.id);
            }
          }
        } catch (error) {
          console.error('Error initializing plugins:', error);
        }
      }
      
      /**
       * Update styles for theme, accessibility, etc.
       * @private
       */
      _updateStyles() {
        // High contrast
        document.documentElement.toggleAttribute(
          'data-high-contrast', 
          this.config.accessibility.highContrast
        );
        
        // Reduced motion
        document.documentElement.toggleAttribute(
          'data-reduced-motion', 
          this.config.animations.reducedMotion
        );
      }
      
      /**
       * Update layout measurements
       * @private
       */
      _updateLayoutMeasurements() {
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return;
        
        // Update container dimensions
        if (this.config.virtualScroller.enabled) {
          this.state.virtualScroller.containerHeight = chatContainer.clientHeight;
        }
      }
      
      /**
       * Process render queue
       * @private
       */
      _processRenderQueue() {
        if (this.state.renderQueue.length === 0) return;
        
        // Process a batch of items
        const batchSize = this.config.performance.batchSize;
        const batch = this.state.renderQueue.splice(0, batchSize);
        
        // Process each item
        batch.forEach(item => {
          try {
            // Call render function
            item.render();
          } catch (error) {
            console.error('Error processing render item:', error);
          }
        });
        
        // Continue processing if items remain
        if (this.state.renderQueue.length > 0) {
          this.state.renderTimer = setTimeout(() => {
            this._processRenderQueue();
          }, this.config.performance.debounceRender);
        }
      }
      
      /**
       * Add item to render queue
       * @param {Function} renderFn - Render function
       * @param {number} priority - Priority (lower = higher priority)
       * @private
       */
      _queueRender(renderFn, priority = 10) {
        this.state.renderQueue.push({
          render: renderFn,
          priority,
          timestamp: Date.now()
        });
        
        // Sort by priority
        this.state.renderQueue.sort((a, b) => a.priority - b.priority);
        
        // Start processing if needed
        if (!this.state.renderTimer) {
          this.state.renderTimer = setTimeout(() => {
            this._processRenderQueue();
          }, this.config.performance.debounceRender);
        }
      }
      
      /**
       * Increment unread count
       * @private
       */
      _incrementUnreadCount() {
        // Emit event for app to handle
        this._emitEvent('unreadIncremented', { timestamp: Date.now() });
      }
    }
  
    // ===============================================================
    // Public API
    // ===============================================================
    
    // Create controller instance
    const controller = new Controller();
    
    // Return public API
    return {
      init: controller.init,
      destroy: controller.destroy,
      render: controller.render,
      
      // Message management
      addMessage: controller.addMessage,
      updateMessage: controller.updateMessage,
      removeMessage: controller.removeMessage,
      startStreaming: controller.startStreaming,
      appendStreamContent: controller.appendStreamContent,
      stopStreaming: controller.stopStreaming,
      showThinking: controller.showThinking,
      hideThinking: controller.hideThinking,
      
      // Navigation
      scrollToBottom: controller.scrollToBottom,
      scrollToMessage: controller.scrollToMessage,
      
      // Chat history
      updateChatHistoryUI: controller.updateChatHistoryUI,
      selectChat: controller.selectChat,
      
      // Wikipedia integration
      loadWikipediaArticle: controller.loadWikipediaArticle,
      showArticleSummary: controller.showArticleSummary,
      generateCitation: controller.generateCitation,
      
      // Event handling
      on: controller.on
    };
  })();
  
  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
  }