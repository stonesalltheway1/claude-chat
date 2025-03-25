/**
 * Claude Chat UI Controller
 * 
 * A high-performance UI system for Claude Chat that provides:
 * - Component-based architecture integration for maintainable UI
 * - Virtual scrolling with DOM recycling for efficient message rendering
 * - View Transitions API integration for smooth UI transitions
 * - Web Worker offloading for CPU-intensive tasks like markdown and code highlighting
 * - Optimized batched DOM updates to prevent layout thrashing
 * - Comprehensive accessibility features with ARIA compliance
 * - Efficient event delegation system for optimal event handling
 * - Responsive design supporting mobile and desktop layouts
 * - Error recovery mechanisms with graceful degradation
 * 
 * @version 4.0.0
 */

import componentLoader from './component-loader.js';
import { EventBus, debounce, throttle, isElementVisible } from './utils.js';
import * as ThemeManager from './theme.js';
import * as APIClient from './api.js';

/**
 * UI Controller for Claude Chat application
 */
class UIController {
  // Private fields
  #state;
  #elements = new Map();
  #eventBus;
  #virtualScroller;
  #markdownProcessor;
  #codeHighlighter;
  #intersectionObserver;
  #resizeObserver;
  #updateQueue = [];
  #processingUpdates = false;
  #pendingAnimationFrame = null;
  #recycledNodes = new Map();
  #config;
  
  /**
   * Initialize UI Controller
   * @param {Object} options - Configuration options
   * @returns {Promise<UIController>} - Initialized controller
   */
  async initialize(options = {}) {
    console.time('UI Initialization');
    
    // Initialize state
    this.#state = {
      initialized: false,
      messages: new Map(),
      visibleMessages: new Set(),
      renderedElements: new Map(),
      messageGroupRanges: new Map(),
      pendingRenders: new Set(),
      streaming: {
        active: false,
        messageId: null,
        content: '',
        startTime: 0
      },
      thinking: false,
      scrollLocked: true,
      scrollPosition: 0,
      lastScrollTop: 0,
      scrollDirection: 'down',
      virtualScrolling: {
        enabled: true,
        startIndex: 0,
        endIndex: 0,
        bufferSize: 10,
        itemHeights: new Map(),
        averageHeight: 100
      },
      theme: {
        current: 'system',
        systemPreference: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      },
      sidebarExpanded: window.innerWidth >= 1024,
      inputHeight: 56,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      isMobile: window.innerWidth < 768,
      isComposing: false,
      activeChatId: null,
      lastActiveElement: null,
      undoStack: [],
      redoStack: []
    };
    
    // Default configuration
    this.#config = {
      templates: {
        userMessage: 'assets/templates/message-templates.html#userMessageTemplate',
        assistantMessage: 'assets/templates/message-templates.html#assistantMessageTemplate',
        codeBlock: 'assets/templates/message-templates.html#codeBlockTemplate',
        modal: 'assets/templates/modal-dialogs.html#modalTemplate',
        settings: 'assets/templates/settings-panel.html#settingsPanelTemplate',
        notification: 'assets/templates/modal-dialogs.html#notificationTemplate',
        chatInterface: 'assets/templates/chat-interface.html#chatInterfaceTemplate',
        messageActions: 'assets/templates/message-templates.html#messageActionsTemplate'
      },
      selectors: {
        chatContainer: '#chatContainer',
        messageList: '.message-list',
        userInput: '#userInput',
        sendButton: '#sendButton',
        scrollToBottomBtn: '#scrollToBottomBtn',
        welcomeScreen: '#welcomeScreen',
        settingsPanel: '#settingsPanel',
        sidebar: '#sidebar',
        modalContainer: '#modalContainer',
        notificationContainer: '#notificationContainer',
        themeToggle: '#themeToggle',
        menuButton: '#menuBtn',
        newChatButton: '#newChatBtn',
        chatHistory: '#chatHistory'
      },
      virtualScrolling: {
        enabled: true,
        bufferSize: 10,
        measureInterval: 200,
        maxRecycledNodes: 20
      },
      animation: {
        messageFadeInDuration: 280,
        modalTransitionDuration: 250,
        scrollBehavior: 'smooth',
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        useViewTransitions: 'startViewTransition' in document
      },
      performance: {
        batchSize: 8, 
        renderThrottle: 16,
        scrollThrottle: 100,
        resizeDebounce: 150,
        maxPendingUpdates: 100
      },
      markdown: {
        enabled: true,
        sanitize: true
      },
      codeHighlighting: {
        enabled: true,
        useWorker: true,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      },
      ...options
    };
    
    // Create event bus
    this.#eventBus = new EventBus();
    
    try {
      // Cache DOM elements
      this.#cacheElements();
      
      // Initialize processors and observers
      await this.#initProcessors();
      this.#setupObservers();
      
      // Set up event listeners
      this.#setupEventHandlers();
      
      // Initialize virtual scrolling if enabled
      if (this.#config.virtualScrolling.enabled) {
        this.#initVirtualScrolling();
      }
      
      // Set initial theme
      this.#initTheme();
      
      // Create required UI elements if missing
      this.#createRequiredElements();
      
      // Set state as initialized
      this.#state.initialized = true;
      
      console.timeEnd('UI Initialization');
      
      // Emit initialized event
      this.#emit('ui:initialized', { 
        timestamp: Date.now() 
      });
      
      return this;
    } catch (error) {
      console.error('Failed to initialize UI Controller:', error);
      
      // Attempt to show error message
      this.#showInitializationError(error);
      
      // Emit error event
      this.#emit('ui:error', { error });
      
      throw error;
    }
  }
  
  /**
   * Cache important DOM elements
   * @private
   */
  #cacheElements() {
    // Cache critical DOM elements for faster access
    for (const [key, selector] of Object.entries(this.#config.selectors)) {
      const element = document.querySelector(selector);
      if (element) {
        this.#elements.set(key, element);
      }
    }
  }
  
  /**
   * Initialize markdown and code highlighting processors
   * @private
   */
  async #initProcessors() {
    // Initialize markdown processor
    if (this.#config.markdown.enabled) {
      this.#markdownProcessor = {
        worker: null,
        pendingTasks: new Map(),
        taskCounter: 0
      };
      
      try {
        // Try to initialize web worker for markdown
        if (window.Worker) {
          this.#markdownProcessor.worker = new Worker(new URL('./markdown-worker.js', import.meta.url));
          
          // Set up message handler
          this.#markdownProcessor.worker.addEventListener('message', event => {
            const { id, html, error } = event.data;
            
            if (id && this.#markdownProcessor.pendingTasks.has(id)) {
              const { resolve, reject } = this.#markdownProcessor.pendingTasks.get(id);
              this.#markdownProcessor.pendingTasks.delete(id);
              
              if (error) {
                reject(new Error(error));
              } else {
                resolve(html);
              }
            }
          });
          
          // Initialize worker
          this.#markdownProcessor.worker.postMessage({ 
            type: 'init',
            sanitize: this.#config.markdown.sanitize
          });
        } else {
          // Fallback to synchronous processing
          const { marked } = await import('https://cdn.jsdelivr.net/npm/marked@4.2.4/marked.esm.js');
          const DOMPurify = await import('https://cdn.jsdelivr.net/npm/dompurify@2.4.0/dist/purify.es.min.js');
          
          this.#markdownProcessor.processMarkdown = (markdown) => {
            try {
              const html = marked.parse(markdown);
              return Promise.resolve(
                this.#config.markdown.sanitize ? DOMPurify.default.sanitize(html) : html
              );
            } catch (error) {
              return Promise.reject(error);
            }
          };
        }
      } catch (error) {
        console.warn('Failed to initialize markdown processor:', error);
        
        // Provide basic fallback
        this.#markdownProcessor.processMarkdown = (markdown) => {
          return Promise.resolve(this.#escapeHtml(markdown).replace(/\n/g, '<br>'));
        };
      }
    }
    
    // Initialize code highlighter
    if (this.#config.codeHighlighting.enabled) {
      this.#codeHighlighter = {
        worker: null,
        pendingTasks: new Map(),
        taskCounter: 0,
        theme: this.#config.codeHighlighting.theme
      };
      
      try {
        // Try to initialize web worker for highlighting
        if (window.Worker && this.#config.codeHighlighting.useWorker) {
          this.#codeHighlighter.worker = new Worker(new URL('./highlight-worker.js', import.meta.url));
          
          // Set up message handler
          this.#codeHighlighter.worker.addEventListener('message', event => {
            const { id, html, error } = event.data;
            
            if (id && this.#codeHighlighter.pendingTasks.has(id)) {
              const { resolve, reject } = this.#codeHighlighter.pendingTasks.get(id);
              this.#codeHighlighter.pendingTasks.delete(id);
              
              if (error) {
                reject(new Error(error));
              } else {
                resolve(html);
              }
            }
          });
          
          // Initialize worker
          this.#codeHighlighter.worker.postMessage({ 
            type: 'init',
            theme: this.#config.codeHighlighting.theme
          });
        } else {
          // Fallback to synchronous highlighting
          const hljs = await import('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/es/highlight.min.js');
          
          this.#codeHighlighter.highlightCode = (code, language) => {
            try {
              const result = language 
                ? hljs.default.highlight(code, { language })
                : hljs.default.highlightAuto(code);
              return Promise.resolve(result.value);
            } catch (error) {
              return Promise.reject(error);
            }
          };
        }
        
        // Load CSS for code highlighting
        this.#loadCodeHighlightingStyles();
      } catch (error) {
        console.warn('Failed to initialize code highlighter:', error);
        
        // Provide basic fallback
        this.#codeHighlighter.highlightCode = (code) => {
          return Promise.resolve(this.#escapeHtml(code));
        };
      }
    }
  }
  
  /**
   * Load code highlighting styles
   * @private
   */
  #loadCodeHighlightingStyles() {
    const theme = this.#codeHighlighter.theme;
    const styleId = 'highlight-styles';
    
    // Remove existing style if present
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Add new style
    const styleLink = document.createElement('link');
    styleLink.id = styleId;
    styleLink.rel = 'stylesheet';
    styleLink.href = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/styles/${theme === 'dark' ? 'github-dark' : 'github'}.min.css`;
    document.head.appendChild(styleLink);
  }
  
  /**
   * Set up intersection and resize observers
   * @private
   */
  #setupObservers() {
    // Setup intersection observer for tracking visible messages
    this.#intersectionObserver = new IntersectionObserver(
      (entries) => {
        let needsUpdate = false;
        
        for (const entry of entries) {
          const messageId = entry.target.dataset.messageId;
          if (!messageId) continue;
          
          if (entry.isIntersecting) {
            this.#state.visibleMessages.add(messageId);
            needsUpdate = true;
          } else {
            this.#state.visibleMessages.delete(messageId);
            needsUpdate = true;
          }
        }
        
        if (needsUpdate && this.#config.virtualScrolling.enabled) {
          this.#updateVirtualScroller();
        }
      },
      {
        root: this.#elements.get('chatContainer'),
        rootMargin: '200px 0px',
        threshold: [0, 0.1, 0.5, 0.9, 1]
      }
    );
    
    // Setup resize observer for container size changes
    if (window.ResizeObserver) {
      this.#resizeObserver = new ResizeObserver(
        debounce((entries) => {
          for (const entry of entries) {
            if (entry.target === this.#elements.get('chatContainer')) {
              this.#handleResize();
            }
          }
        }, this.#config.performance.resizeDebounce)
      );
      
      const chatContainer = this.#elements.get('chatContainer');
      if (chatContainer) {
        this.#resizeObserver.observe(chatContainer);
      }
    }
    
    // Observe theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      this.#state.theme.systemPreference = event.matches ? 'dark' : 'light';
      
      if (this.#state.theme.current === 'system') {
        this.#applyTheme(this.#state.theme.systemPreference);
      }
    });
    
    // Observe reduced motion preference
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
      this.#config.animation.reducedMotion = event.matches;
    });
  }
  
  /**
   * Set up event handlers for user interactions
   * @private
   */
  #setupEventHandlers() {
    // Setup chat container scroll handler
    const chatContainer = this.#elements.get('chatContainer');
    if (chatContainer) {
      chatContainer.addEventListener('scroll', throttle(() => {
        this.#handleScroll();
      }, this.#config.performance.scrollThrottle), { passive: true });
      
      // Event delegation for message actions
      chatContainer.addEventListener('click', event => {
        // Handle message action buttons
        const actionButton = event.target.closest('[data-message-action]');
        if (actionButton) {
          const messageElement = actionButton.closest('[data-message-id]');
          if (messageElement) {
            const messageId = messageElement.dataset.messageId;
            const action = actionButton.dataset.messageAction;
            
            event.preventDefault();
            this.#handleMessageAction(messageId, action);
          }
        }
        
        // Handle code block actions
        const codeActionButton = event.target.closest('[data-code-action]');
        if (codeActionButton) {
          const codeBlock = codeActionButton.closest('.code-block');
          if (codeBlock) {
            const action = codeActionButton.dataset.codeAction;
            
            event.preventDefault();
            this.#handleCodeAction(codeBlock, action);
          }
        }
      });
    }
    
    // Setup user input handlers
    const userInput = this.#elements.get('userInput');
    if (userInput) {
      // Auto-resize textarea
      userInput.addEventListener('input', () => {
        this.#resizeTextarea(userInput);
        this.#updateSendButtonState();
      });
      
      // Send on Enter (without shift)
      userInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          this.#sendMessage();
        }
      });
      
      // Track composition state (for IME input)
      userInput.addEventListener('compositionstart', () => {
        this.#state.isComposing = true;
      });
      
      userInput.addEventListener('compositionend', () => {
        this.#state.isComposing = false;
      });
    }
    
    // Setup send button handler
    const sendButton = this.#elements.get('sendButton');
    if (sendButton) {
      sendButton.addEventListener('click', () => {
        this.#sendMessage();
      });
    }
    
    // Setup scroll to bottom button
    const scrollToBottomBtn = this.#elements.get('scrollToBottomBtn');
    if (scrollToBottomBtn) {
      scrollToBottomBtn.addEventListener('click', () => {
        this.scrollToBottom();
      });
    }
    
    // Setup theme toggle
    const themeToggle = this.#elements.get('themeToggle'); 
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.#cycleTheme();
      });
    }
    
    // Setup new chat button
    const newChatButton = this.#elements.get('newChatButton');
    if (newChatButton) {
      newChatButton.addEventListener('click', () => {
        this.#emit('newChat:requested');
      });
    }
    
    // Setup sidebar toggle
    const menuButton = this.#elements.get('menuButton');
    if (menuButton) {
      menuButton.addEventListener('click', () => {
        this.#toggleSidebar();
      });
    }
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', event => {
      this.#handleKeyboardShortcut(event);
    });
    
    // Window resize handler
    window.addEventListener('resize', debounce(() => {
      this.#state.windowWidth = window.innerWidth;
      this.#state.windowHeight = window.innerHeight;
      this.#state.isMobile = window.innerWidth < 768;
      
      this.#handleResize();
    }, this.#config.performance.resizeDebounce));
  }
  
  /**
   * Initialize theme based on system preference and saved settings
   * @private
   */
  #initTheme() {
    // Get saved theme or use system preference
    const savedTheme = localStorage.getItem('theme') || 'system';
    this.#state.theme.current = savedTheme;
    
    // Apply theme
    this.#applyTheme(
      savedTheme === 'system' 
        ? this.#state.theme.systemPreference 
        : savedTheme
    );
  }
  
  /**
   * Apply a theme to the document
   * @param {string} theme - Theme to apply ('light' or 'dark')
   * @private
   */
  #applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update code highlighting theme if it changes
    if (this.#codeHighlighter && this.#codeHighlighter.theme !== theme) {
      this.#codeHighlighter.theme = theme;
      this.#loadCodeHighlightingStyles();
      
      // Notify the worker of theme change
      if (this.#codeHighlighter.worker) {
        this.#codeHighlighter.worker.postMessage({
          type: 'setTheme',
          theme
        });
      }
    }
    
    // Emit theme change event
    this.#emit('theme:changed', { theme });
  }
  
  /**
   * Cycle through theme options (light -> dark -> system)
   * @private
   */
  #cycleTheme() {
    const current = this.#state.theme.current;
    let next;
    
    if (current === 'light') {
      next = 'dark';
    } else if (current === 'dark') {
      next = 'system';
    } else {
      next = 'light';
    }
    
    this.#state.theme.current = next;
    localStorage.setItem('theme', next);
    
    this.#applyTheme(
      next === 'system' 
        ? this.#state.theme.systemPreference 
        : next
    );
  }
  
  /**
   * Create required UI elements if they don't exist
   * @private
   */
  #createRequiredElements() {
    // Create modal container if missing
    if (!document.getElementById('modalContainer')) {
      const modalContainer = document.createElement('div');
      modalContainer.id = 'modalContainer';
      modalContainer.className = 'modal-container';
      modalContainer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(modalContainer);
      this.#elements.set('modalContainer', modalContainer);
    }
    
    // Create notification container if missing
    if (!document.getElementById('notificationContainer')) {
      const notifContainer = document.createElement('div');
      notifContainer.id = 'notificationContainer';
      notifContainer.className = 'notification-container';
      notifContainer.setAttribute('aria-live', 'polite');
      document.body.appendChild(notifContainer);
      this.#elements.set('notificationContainer', notifContainer);
    }
    
    // Create screen reader live region if missing
    if (!document.getElementById('srLiveRegion')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'srLiveRegion';
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveRegion);
      this.#elements.set('srLiveRegion', liveRegion);
    }
    
    // Create scroll to bottom button if missing
    const chatContainer = this.#elements.get('chatContainer');
    if (chatContainer && !this.#elements.get('scrollToBottomBtn')) {
      const scrollBtn = document.createElement('button');
      scrollBtn.id = 'scrollToBottomBtn';
      scrollBtn.className = 'scroll-to-bottom-btn';
      scrollBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;
      scrollBtn.setAttribute('aria-label', 'Scroll to bottom');
      scrollBtn.setAttribute('type', 'button');
      chatContainer.appendChild(scrollBtn);
      
      this.#elements.set('scrollToBottomBtn', scrollBtn);
      scrollBtn.addEventListener('click', () => this.scrollToBottom());
    }
  }
  
  /**
   * Initialize virtual scrolling system
   * @private
   */
  #initVirtualScrolling() {
    const chatContainer = this.#elements.get('chatContainer');
    if (!chatContainer) return;
    
    // Setup virtual scrolling state
    this.#virtualScroller = {
      container: chatContainer,
      spacers: {
        top: document.createElement('div'),
        bottom: document.createElement('div')
      },
      sentinels: {
        top: document.createElement('div'),
        bottom: document.createElement('div')
      },
      messageContainer: null,
      enabled: this.#config.virtualScrolling.enabled,
      bufferSize: this.#config.virtualScrolling.bufferSize,
      visibleStartIndex: 0,
      visibleEndIndex: 0,
      totalItems: 0,
      visibleItems: new Set(),
      itemPositions: new Map(),
      averageHeight: 100,
      lastMeasuredIndex: -1,
      scheduled: false
    };
    
    // Create or find message container
    let messageContainer = chatContainer.querySelector(this.#config.selectors.messageList);
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'message-list';
      chatContainer.appendChild(messageContainer);
    }
    this.#virtualScroller.messageContainer = messageContainer;
    
    // Setup spacers
    const { spacers, sentinels } = this.#virtualScroller;
    
    spacers.top.className = 'virtual-spacer virtual-spacer-top';
    spacers.bottom.className = 'virtual-spacer virtual-spacer-bottom';
    
    sentinels.top.className = 'virtual-sentinel virtual-sentinel-top';
    sentinels.bottom.className = 'virtual-sentinel virtual-sentinel-bottom';
    
    sentinels.top.setAttribute('aria-hidden', 'true');
    sentinels.bottom.setAttribute('aria-hidden', 'true');
    
    // Add elements to DOM in correct order
    messageContainer.insertBefore(sentinels.top, messageContainer.firstChild);
    messageContainer.insertBefore(spacers.top, messageContainer.firstChild);
    messageContainer.appendChild(spacers.bottom);
    messageContainer.appendChild(sentinels.bottom);
    
    // Setup sentinel observers
    const sentinelObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        
        if (entry.target === sentinels.top) {
          this.#loadMoreAbove();
        } else if (entry.target === sentinels.bottom) {
          this.#loadMoreBelow();
        }
      });
    }, {
      root: chatContainer,
      rootMargin: '300px 0px',
      threshold: 0
    });
    
    sentinelObserver.observe(sentinels.top);
    sentinelObserver.observe(sentinels.bottom);
    
    // Initial measurements
    this.#scheduleVirtualScrollerUpdate();
  }
  
  /**
   * Schedule an update to the virtual scroller
   * @private
   */
  #scheduleVirtualScrollerUpdate() {
    if (this.#virtualScroller.scheduled) return;
    
    this.#virtualScroller.scheduled = true;
    
    requestAnimationFrame(() => {
      this.#updateVirtualScroller();
      this.#virtualScroller.scheduled = false;
    });
  }
  
  /**
   * Update virtual scroller based on visible messages
   * @private
   */
  #updateVirtualScroller() {
    if (!this.#virtualScroller || !this.#virtualScroller.enabled) return;
    
    const messages = Array.from(this.#state.messages.values())
      .sort((a, b) => a.timestamp - b.timestamp);
    
    this.#virtualScroller.totalItems = messages.length;
    
    if (messages.length === 0) {
      // Reset spacers when no messages
      this.#virtualScroller.spacers.top.style.height = '0px';
      this.#virtualScroller.spacers.bottom.style.height = '0px';
      return;
    }
    
    // Get visible message indices
    const visibleIndices = Array.from(this.#state.visibleMessages)
      .map(id => messages.findIndex(m => m.id === id))
      .filter(index => index !== -1);
    
    if (visibleIndices.length === 0) {
      // If no messages are visible, render the first batch
      this.#virtualScroller.visibleStartIndex = 0;
      this.#virtualScroller.visibleEndIndex = Math.min(
        this.#virtualScroller.bufferSize * 2,
        messages.length - 1
      );
    } else {
      // Update based on visible messages
      this.#virtualScroller.visibleStartIndex = Math.min(...visibleIndices);
      this.#virtualScroller.visibleEndIndex = Math.max(...visibleIndices);
    }
    
    // Add buffer
    const bufferSize = this.#virtualScroller.bufferSize;
    const bufferStartIndex = Math.max(0, this.#virtualScroller.visibleStartIndex - bufferSize);
    const bufferEndIndex = Math.min(
      messages.length - 1,
      this.#virtualScroller.visibleEndIndex + bufferSize
    );
    
    // Update spacer heights
    this.#updateSpacerHeights(messages, bufferStartIndex, bufferEndIndex);
    
    // Render or recycle messages in buffer range
    this.#renderMessagesInRange(messages, bufferStartIndex, bufferEndIndex);
  }
  
  /**
   * Update spacer heights for virtual scrolling
   * @param {Array} messages - All messages
   * @param {number} bufferStartIndex - Start index of buffered range
   * @param {number} bufferEndIndex - End index of buffered range
   * @private
   */
  #updateSpacerHeights(messages, bufferStartIndex, bufferEndIndex) {
    const { spacers, itemPositions, averageHeight } = this.#virtualScroller;
    
    // Calculate top spacer height (items above buffer)
    let topHeight = 0;
    for (let i = 0; i < bufferStartIndex; i++) {
      const message = messages[i];
      topHeight += itemPositions.get(message.id) || averageHeight;
    }
    
    // Calculate bottom spacer height (items below buffer)
    let bottomHeight = 0;
    for (let i = bufferEndIndex + 1; i < messages.length; i++) {
      const message = messages[i];
      bottomHeight += itemPositions.get(message.id) || averageHeight;
    }
    
    // Update spacer heights
    spacers.top.style.height = `${topHeight}px`;
    spacers.bottom.style.height = `${bottomHeight}px`;
  }
  
  /**
   * Render or recycle messages in buffer range
   * @param {Array} messages - All messages
   * @param {number} bufferStartIndex - Start index of buffered range
   * @param {number} bufferEndIndex - End index of buffered range
   * @private
   */
  #renderMessagesInRange(messages, bufferStartIndex, bufferEndIndex) {
    // Create sets for current and needed messages
    const currentlyRendered = new Set(this.#state.renderedElements.keys());
    const needToRender = new Set();
    
    // Determine which messages should be in the DOM
    for (let i = bufferStartIndex; i <= bufferEndIndex; i++) {
      if (i >= 0 && i < messages.length) {
        needToRender.add(messages[i].id);
      }
    }
    
    // Find messages to add and remove
    const toRemove = Array.from(currentlyRendered).filter(id => !needToRender.has(id));
    const toAdd = Array.from(needToRender).filter(id => !currentlyRendered.has(id));
    
    // Remove messages no longer in view
    for (const messageId of toRemove) {
      const element = this.#state.renderedElements.get(messageId);
      if (element && element.parentNode) {
        // Recycle node for later reuse
        this.#recycleMessageNode(messageId, element);
        
        // Remove from DOM
        element.remove();
        
        // Remove from rendered elements
        this.#state.renderedElements.delete(messageId);
      }
    }
    
    // Add new messages
    for (const messageId of toAdd) {
      const message = this.#state.messages.get(messageId);
      if (!message) continue;
      
      // Render message (recycling DOM nodes when possible)
      this.#renderMessage(message);
    }
    
    // Measure message heights after rendering
    this.#measureMessageHeights();
  }
  
  /**
   * Measure heights of rendered messages
   * @private
   */
  #measureMessageHeights() {
    if (!this.#virtualScroller || !this.#virtualScroller.enabled) return;
    
    const { itemPositions } = this.#virtualScroller;
    
    let totalHeight = 0;
    let count = 0;
    
    // Measure all rendered messages
    for (const [messageId, element] of this.#state.renderedElements.entries()) {
      if (element && element.offsetHeight > 0) {
        const height = element.offsetHeight;
        itemPositions.set(messageId, height);
        
        totalHeight += height;
        count++;
      }
    }
    
    // Update average height
    if (count > 0) {
      this.#virtualScroller.averageHeight = Math.round(totalHeight / count);
    }
  }
  
  /**
   * Load more messages above the current visible area
   * @private
   */
  #loadMoreAbove() {
    if (!this.#virtualScroller || this.#virtualScroller.visibleStartIndex <= 0) return;
    
    this.#scheduleVirtualScrollerUpdate();
    this.#emit('messages:loadMoreAbove');
  }
  
  /**
   * Load more messages below the current visible area
   * @private
   */
  #loadMoreBelow() {
    if (!this.#virtualScroller || 
        this.#virtualScroller.visibleEndIndex >= this.#virtualScroller.totalItems - 1) return;
    
    this.#scheduleVirtualScrollerUpdate();
    this.#emit('messages:loadMoreBelow');
  }
  
  /**
   * Recycle a message node for later reuse
   * @param {string} messageId - ID of the message
   * @param {HTMLElement} element - DOM element to recycle
   * @private
   */
  #recycleMessageNode(messageId, element) {
    const message = this.#state.messages.get(messageId);
    if (!message) return;
    
    const role = message.role;
    if (!this.#recycledNodes.has(role)) {
      this.#recycledNodes.set(role, []);
    }
    
    const recycledList = this.#recycledNodes.get(role);
    
    // Clone to remove event listeners
    const cloned = element.cloneNode(true);
    recycledList.push(cloned);
    
    // Limit recycled nodes pool
    if (recycledList.length > this.#config.virtualScrolling.maxRecycledNodes) {
      recycledList.shift();
    }
  }
  
  /**
   * Get a recycled node if available
   * @param {string} role - Message role
   * @returns {HTMLElement|null} - Recycled node or null
   * @private
   */
  #getRecycledNode(role) {
    if (!this.#recycledNodes.has(role) || this.#recycledNodes.get(role).length === 0) {
      return null;
    }
    
    return this.#recycledNodes.get(role).pop();
  }
  
  /**
   * Handle scroll events for chat container
   * @private
   */
  #handleScroll() {
    const chatContainer = this.#elements.get('chatContainer');
    if (!chatContainer) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    const atBottom = scrollHeight - scrollTop - clientHeight < 30;
    
    // Update scroll state
    this.#state.scrollPosition = scrollTop;
    this.#state.scrollDirection = scrollTop > this.#state.lastScrollTop ? 'down' : 'up';
    this.#state.lastScrollTop = scrollTop;
    this.#state.scrollLocked = atBottom;
    
    // Show/hide scroll to bottom button
    const scrollToBottomBtn = this.#elements.get('scrollToBottomBtn');
    if (scrollToBottomBtn) {
      scrollToBottomBtn.classList.toggle('visible', !atBottom);
    }
    
    // Emit scroll event
    this.#emit('scroll', {
      position: scrollTop,
      atBottom,
      direction: this.#state.scrollDirection
    });
    
    // Update virtual scroller if enabled
    if (this.#config.virtualScrolling.enabled) {
      this.#scheduleVirtualScrollerUpdate();
    }
  }
  
  /**
   * Handle resize events
   * @private
   */
  #handleResize() {
    // Recalculate message heights
    this.#measureMessageHeights();
    
    // Update virtual scroller
    if (this.#config.virtualScrolling.enabled) {
      this.#scheduleVirtualScrollerUpdate();
    }
    
    // Update UI for mobile/desktop
    document.documentElement.classList.toggle('is-mobile', this.#state.isMobile);
    
    // Emit resize event
    this.#emit('resize', {
      width: this.#state.windowWidth,
      height: this.#state.windowHeight,
      isMobile: this.#state.isMobile
    });
  }
  
  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  #handleKeyboardShortcut(event) {
    // Don't handle shortcuts if typing in input fields
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    
    // Escape key (works even when typing)
    if (event.key === 'Escape') {
      // Close modal if open
      const modalContainer = this.#elements.get('modalContainer');
      if (modalContainer && modalContainer.getAttribute('aria-hidden') === 'false') {
        this.closeModal();
        event.preventDefault();
        return;
      }
      
      // Close sidebar on mobile
      if (this.#state.isMobile && this.#state.sidebarExpanded) {
        this.#toggleSidebar();
        event.preventDefault();
        return;
      }
    }
    
    // Skip other shortcuts when typing
    if (isTyping) return;
    
    // Cmd/Ctrl+/ - Focus input
    if ((event.key === '/' || event.key === '?') && (event.metaKey || event.ctrlKey)) {
      const userInput = this.#elements.get('userInput');
      if (userInput) {
        userInput.focus();
        event.preventDefault();
      }
      return;
    }
    
    // / - Focus input (when not typing)
    if (event.key === '/' && !isTyping) {
      const userInput = this.#elements.get('userInput');
      if (userInput) {
        userInput.focus();
        event.preventDefault();
      }
      return;
    }
    
    // Cmd/Ctrl+Enter - Send message
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      this.#sendMessage();
      event.preventDefault();
      return;
    }
    
    // n - New chat
    if (event.key === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      this.#emit('newChat:requested');
      event.preventDefault();
      return;
    }
    
    // Cmd/Ctrl+k - Toggle sidebar
    if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
      this.#toggleSidebar();
      event.preventDefault();
      return;
    }
  }
  
  /**
   * Toggle sidebar visibility
   * @private
   */
  #toggleSidebar() {
    const sidebar = this.#elements.get('sidebar');
    if (!sidebar) return;
    
    this.#state.sidebarExpanded = !this.#state.sidebarExpanded;
    
    if (this.#config.animation.useViewTransitions) {
      // Use View Transitions API if available
      document.startViewTransition(() => {
        sidebar.classList.toggle('expanded', this.#state.sidebarExpanded);
        document.documentElement.classList.toggle('sidebar-expanded', this.#state.sidebarExpanded);
      });
    } else {
      // Standard toggle
      sidebar.classList.toggle('expanded', this.#state.sidebarExpanded);
      document.documentElement.classList.toggle('sidebar-expanded', this.#state.sidebarExpanded);
    }
    
    // Emit sidebar toggle event
    this.#emit('sidebar:toggled', {
      expanded: this.#state.sidebarExpanded
    });
  }
  
  /**
   * Resize textarea to fit content
   * @param {HTMLTextAreaElement} textarea - Textarea element
   * @private
   */
  #resizeTextarea(textarea) {
    if (!textarea) return;
    
    // Reset height to calculate new height
    textarea.style.height = 'auto';
    
    // Calculate new height with limits
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, 56), // Minimum 56px
      200 // Maximum 200px
    );
    
    // Apply new height
    textarea.style.height = `${newHeight}px`;
    
    // Update state
    this.#state.inputHeight = newHeight;
    
    // Update chat container padding to accommodate input size
    const chatContainer = this.#elements.get('chatContainer');
    if (chatContainer) {
      chatContainer.style.paddingBottom = `${newHeight + 32}px`;
    }
  }
  
  /**
   * Update send button state based on input content
   * @private
   */
  #updateSendButtonState() {
    const userInput = this.#elements.get('userInput');
    const sendButton = this.#elements.get('sendButton');
    
    if (!userInput || !sendButton) return;
    
    const isEmpty = userInput.value.trim().length === 0;
    
    sendButton.disabled = isEmpty;
    sendButton.setAttribute('aria-disabled', isEmpty ? 'true' : 'false');
    userInput.classList.toggle('empty', isEmpty);
  }
  
  /**
   * Send message from input field
   * @private
   */
  #sendMessage() {
    const userInput = this.#elements.get('userInput');
    if (!userInput) return;
    
    const content = userInput.value.trim();
    if (!content || this.#state.isComposing) return;
    
    // Generate message ID
    const messageId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create message object
    const message = {
      id: messageId,
      role: 'human',
      content,
      timestamp: Date.now()
    };
    
    // Add message to UI
    this.addMessage(message);
    
    // Clear input
    userInput.value = '';
    this.#resizeTextarea(userInput);
    this.#updateSendButtonState();
    
    // Refocus input
    userInput.focus();
    
    // Emit message sent event
    this.#emit('message:sent', {
      id: messageId,
      content
    });
    
    // Show welcome screen if needed
    const welcomeScreen = this.#elements.get('welcomeScreen');
    if (welcomeScreen && !welcomeScreen.classList.contains('hidden')) {
      welcomeScreen.classList.add('hidden');
    }
  }
  
  /**
   * Handle message action button clicks
   * @param {string} messageId - ID of the message
   * @param {string} action - Action to perform
   * @private
   */
  #handleMessageAction(messageId, action) {
    const message = this.#state.messages.get(messageId);
    if (!message) return;
    
    switch (action) {
      case 'copy':
        this.#copyMessageToClipboard(messageId);
        break;
      case 'edit':
        this.#editMessage(messageId);
        break;
      case 'regenerate':
        this.#regenerateResponse(messageId);
        break;
      case 'delete':
        this.#deleteMessage(messageId);
        break;
      case 'cite':
        this.#showCitation(messageId);
        break;
      default:
        console.warn(`Unknown message action: ${action}`);
    }
    
    // Emit message action event
    this.#emit('message:action', {
      messageId,
      action,
      message
    });
  }
  
  /**
   * Handle code block action
   * @param {HTMLElement} codeBlock - Code block element
   * @param {string} action - Action to perform
   * @private
   */
  #handleCodeAction(codeBlock, action) {
    if (action === 'copy') {
      const code = codeBlock.querySelector('code');
      if (code) {
        navigator.clipboard.writeText(code.textContent)
          .then(() => {
            // Show success indicator
            const copyBtn = codeBlock.querySelector('[data-code-action="copy"]');
            if (copyBtn) {
              copyBtn.classList.add('success');
              copyBtn.querySelector('.label').textContent = 'Copied!';
              
              setTimeout(() => {
                copyBtn.classList.remove('success');
                copyBtn.querySelector('.label').textContent = 'Copy';
              }, 2000);
            }
          })
          .catch(err => {
            console.error('Failed to copy code:', err);
            this.showNotification({
              type: 'error',
              message: 'Failed to copy code',
              duration: 3000
            });
          });
      }
    }
  }
  
  /**
   * Copy message content to clipboard
   * @param {string} messageId - ID of the message
   * @private
   */
  #copyMessageToClipboard(messageId) {
    const message = this.#state.messages.get(messageId);
    if (!message) return;
    
    navigator.clipboard.writeText(message.content)
      .then(() => {
        this.showNotification({
          type: 'success',
          message: 'Message copied to clipboard',
          duration: 2000
        });
      })
      .catch(err => {
        console.error('Failed to copy message:', err);
        this.showNotification({
          type: 'error',
          message: 'Failed to copy message',
          duration: 3000
        });
      });
  }
  
  /**
   * Edit a user message
   * @param {string} messageId - ID of the message
   * @private
   */
  #editMessage(messageId) {
    const message = this.#state.messages.get(messageId);
    if (!message || message.role !== 'human') return;
    
    const messageElement = this.#state.renderedElements.get(messageId);
    if (!messageElement) return;
    
    // Create edit interface by replacing content
    const contentContainer = messageElement.querySelector('.message-content');
    if (!contentContainer) return;
    
    try {
      // Save original content reference
      messageElement.dataset.originalContent = message.content;
      
      // Render edit component
      componentLoader.renderComponent(
        'assets/templates/message-templates.html#messageEditTemplate',
        contentContainer,
        {
          content: message.content
        }
      );
      
      // Add editing class
      messageElement.classList.add('editing');
      
      // Find and focus textarea
      const textarea = contentContainer.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        
        // Set up event listeners
        const saveBtn = contentContainer.querySelector('.save-edit');
        const cancelBtn = contentContainer.querySelector('.cancel-edit');
        
        if (saveBtn) {
          saveBtn.addEventListener('click', () => {
            this.#saveMessageEdit(messageId, textarea.value.trim());
          });
        }
        
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            this.#cancelMessageEdit(messageId);
          });
        }
        
        textarea.addEventListener('keydown', event => {
          // Save on Ctrl/Cmd+Enter
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            this.#saveMessageEdit(messageId, textarea.value.trim());
          }
          
          // Cancel on Escape
          if (event.key === 'Escape') {
            event.preventDefault();
            this.#cancelMessageEdit(messageId);
          }
        });
      }
      
      // Emit edit started event
      this.#emit('message:editStarted', {
        messageId
      });
    } catch (error) {
      console.error('Failed to create edit interface:', error);
      
      // Fallback to plain text editing
      const originalContent = message.content;
      
      contentContainer.innerHTML = `
        <div class="message-edit">
          <textarea class="message-edit-textarea">${originalContent}</textarea>
          <div class="message-edit-actions">
            <button class="cancel-edit">Cancel</button>
            <button class="save-edit">Save</button>
          </div>
        </div>
      `;
      
      // Add editing class
      messageElement.classList.add('editing');
      
      // Setup event handlers
      const textarea = contentContainer.querySelector('textarea');
      const saveBtn = contentContainer.querySelector('.save-edit');
      const cancelBtn = contentContainer.querySelector('.cancel-edit');
      
      if (textarea) textarea.focus();
      
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          this.#saveMessageEdit(messageId, textarea.value.trim());
        });
      }
      
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.#cancelMessageEdit(messageId);
        });
      }
    }
  }
  
  /**
   * Save edited message
   * @param {string} messageId - ID of the message
   * @param {string} newContent - New message content
   * @private
   */
  #saveMessageEdit(messageId, newContent) {
    const message = this.#state.messages.get(messageId);
    if (!message) return;
    
    // Skip if content hasn't changed
    if (message.content === newContent) {
      this.#cancelMessageEdit(messageId);
      return;
    }
    
    // Save original content for undo
    const originalContent = message.content;
    
    // Update message
    message.content = newContent;
    message.edited = true;
    message.editTimestamp = Date.now();
    
    // Update UI
    this.updateMessage(messageId, message);
    
    // Emit edit completed event
    this.#emit('message:editCompleted', {
      messageId,
      originalContent,
      newContent
    });
  }
  
  /**
   * Cancel message editing
   * @param {string} messageId - ID of the message
   * @private
   */
  #cancelMessageEdit(messageId) {
    const messageElement = this.#state.renderedElements.get(messageId);
    if (!messageElement) return;
    
    // Get original message
    const message = this.#state.messages.get(messageId);
    if (!message) return;
    
    // Rerender the message
    this.updateMessage(messageId, message);
    
    // Remove editing class
    messageElement.classList.remove('editing');
    
    // Emit edit canceled event
    this.#emit('message:editCanceled', {
      messageId
    });
  }
  
  /**
   * Delete a message
   * @param {string} messageId - ID of the message
   * @private
   */
  #deleteMessage(messageId) {
    const message = this.#state.messages.get(messageId);
    if (!message) return;
    
    // Show confirmation dialog
    this.showModal({
      title: 'Delete Message',
      content: 'Are you sure you want to delete this message?',
      actions: [
        {
          label: 'Cancel',
          type: 'secondary'
        },
        {
          label: 'Delete',
          type: 'danger',
          handler: () => {
            this.removeMessage(messageId);
            this.closeModal();
          }
        }
      ]
    });
  }
  
  /**
   * Regenerate assistant response
   * @param {string} messageId - ID of the message
   * @private
   */
  #regenerateResponse(messageId) {
    // Emit regenerate event
    this.#emit('message:regenerate', {
      messageId
    });
  }
  
  /**
   * Show citation for a message
   * @param {string} messageId - ID of the message
   * @private
   */
  #showCitation(messageId) {
    const message = this.#state.messages.get(messageId);
    if (!message) return;
    
    if (message.citation) {
      this.showModal({
        title: 'Citation',
        content: `<div class="citation-content">${message.citation}</div>`,
        actions: [
          {
            label: 'Copy',
            type: 'secondary',
            handler: () => {
              navigator.clipboard.writeText(message.citation.replace(/<[^>]*>/g, ''));
              this.closeModal();
              this.showNotification({
                type: 'success',
                message: 'Citation copied to clipboard',
                duration: 2000
              });
            }
          },
          {
            label: 'Close',
            type: 'primary'
          }
        ]
      });
    } else {
      this.showNotification({
        type: 'info',
        message: 'No citation available for this message',
        duration: 3000
      });
    }
  }
  
  /**
   * Show initialization error
   * @param {Error} error - Error object
   * @private
   */
  #showInitializationError(error) {
    console.error('UI initialization error:', error);
    
    // Create error container
    const container = document.createElement('div');
    container.className = 'initialization-error';
    container.innerHTML = `
      <div class="error-content">
        <h2>Failed to Initialize Chat UI</h2>
        <p>An error occurred while setting up the chat interface.</p>
        <div class="error-details">
          <p>${error.message}</p>
          <pre>${error.stack}</pre>
        </div>
        <button id="retryInitButton" class="retry-button">Retry</button>
      </div>
    `;
    
    // Add to document
    document.body.appendChild(container);
    
    // Add retry handler
    const retryButton = container.querySelector('#retryInitButton');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        container.remove();
        this.initialize(this.#config);
      });
    }
  }
  
  /**
   * Process markdown in a message
   * @param {string} text - Markdown text to process
   * @returns {Promise<string>} - HTML output
   * @private
   */
  async #processMarkdown(text) {
    if (!text) return '';
    
    if (!this.#config.markdown.enabled) {
      return this.#escapeHtml(text).replace(/\n/g, '<br>');
    }
    
    try {
      // Using web worker if available
      if (this.#markdownProcessor.worker) {
        const taskId = ++this.#markdownProcessor.taskCounter;
        
        return new Promise((resolve, reject) => {
          this.#markdownProcessor.pendingTasks.set(taskId, { resolve, reject });
          
          this.#markdownProcessor.worker.postMessage({
            type: 'process',
            id: taskId,
            markdown: text
          });
        });
      } 
      // Using direct processing
      else if (this.#markdownProcessor.processMarkdown) {
        return this.#markdownProcessor.processMarkdown(text);
      } 
      // Fallback
      else {
        return this.#escapeHtml(text).replace(/\n/g, '<br>');
      }
    } catch (error) {
      console.error('Markdown processing error:', error);
      return this.#escapeHtml(text).replace(/\n/g, '<br>');
    }
  }
  
  /**
   * Highlight code in a message
   * @param {string} code - Code to highlight
   * @param {string} language - Programming language
   * @returns {Promise<string>} - Highlighted HTML
   * @private
   */
  async #highlightCode(code, language) {
    if (!code) return '';
    
    if (!this.#config.codeHighlighting.enabled) {
      return this.#escapeHtml(code);
    }
    
    try {
      // Using web worker if available
      if (this.#codeHighlighter.worker) {
        const taskId = ++this.#codeHighlighter.taskCounter;
        
        return new Promise((resolve, reject) => {
          this.#codeHighlighter.pendingTasks.set(taskId, { resolve, reject });
          
          this.#codeHighlighter.worker.postMessage({
            type: 'highlight',
            id: taskId,
            code,
            language
          });
        });
      } 
      // Using direct highlighting
      else if (this.#codeHighlighter.highlightCode) {
        return this.#codeHighlighter.highlightCode(code, language);
      } 
      // Fallback
      else {
        return this.#escapeHtml(code);
      }
    } catch (error) {
      console.error('Code highlighting error:', error);
      return this.#escapeHtml(code);
    }
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   * @private
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Format a timestamp for display
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} - Formatted timestamp
   * @private
   */
  #formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);
    
    // Just now
    if (diffSeconds < 60) {
      return 'just now';
    }
    
    // Minutes ago
    if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes}m ago`;
    }
    
    // Hours ago
    if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours}h ago`;
    }
    
    // Days ago
    if (diffSeconds < 604800) {
      const days = Math.floor(diffSeconds / 86400);
      return `${days}d ago`;
    }
    
    // Date format
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }
  
  /**
   * Emit an event
   * @param {string} eventName - Name of the event
   * @param {Object} data - Event data
   * @private
   */
  #emit(eventName, data = {}) {
    // Add timestamp if not present
    if (!data.timestamp) {
      data.timestamp = Date.now();
    }
    
    // Emit through event bus
    this.#eventBus.emit(eventName, data);
  }
  
  /**
   * Schedule a UI update to be batched
   * @param {Function} updateFn - Update function to execute
   * @private
   */
  #scheduleUpdate(updateFn) {
    // Add to queue
    this.#updateQueue.push(updateFn);
    
    // Process queue if not already processing
    if (!this.#processingUpdates) {
      this.#processUpdateQueue();
    }
  }
  
  /**
   * Process batched updates
   * @private
   */
  #processUpdateQueue() {
    if (this.#updateQueue.length === 0) {
      this.#processingUpdates = false;
      return;
    }
    
    this.#processingUpdates = true;
    
    // Use requestAnimationFrame for optimal timing
    cancelAnimationFrame(this.#pendingAnimationFrame);
    this.#pendingAnimationFrame = requestAnimationFrame(() => {
      // Process a batch of updates
      const batch = this.#updateQueue.splice(0, this.#config.performance.batchSize);
      
      // Execute all updates in the batch
      batch.forEach(update => {
        try {
          update();
        } catch (error) {
          console.error('Error in batched update:', error);
        }
      });
      
      // Continue processing if more updates exist
      if (this.#updateQueue.length > 0) {
        setTimeout(() => {
          this.#processUpdateQueue();
        }, this.#config.performance.renderThrottle);
      } else {
        this.#processingUpdates = false;
      }
    });
  }
  
  /**
   * Render a message to the DOM
   * @param {Object} message - Message data
   * @returns {HTMLElement} - The rendered message element
   * @private
   */
  #renderMessage(message) {
    if (!message || !message.id) return null;
    
    try {
      // Determine template path
      let templatePath = '';
      if (message.role === 'human') {
        templatePath = this.#config.templates.userMessage;
      } else if (message.type === 'thinking') {
        templatePath = this.#config.templates.thinkingIndicator;
      } else {
        templatePath = this.#config.templates.assistantMessage;
      }
      
      // Determine container
      let container;
      
      if (this.#config.virtualScrolling.enabled) {
        container = this.#virtualScroller.messageContainer;
      } else {
        container = this.#elements.get('chatContainer');
      }
      
      if (!container) {
        console.error('No container found for rendering message');
        return null;
      }
      
      // Try to recycle existing node
      const recycledNode = this.#getRecycledNode(message.role);
      let messageElement;
      
      if (recycledNode) {
        // Update recycled node
        recycledNode.dataset.messageId = message.id;
        recycledNode.dataset.role = message.role;
        recycledNode.dataset.timestamp = message.timestamp;
        
        // Clear existing content
        while (recycledNode.firstChild) {
          recycledNode.removeChild(recycledNode.firstChild);
        }
        
        // Render into recycled node
        componentLoader.renderComponent(
          templatePath,
          recycledNode,
          {
            message: {
              ...message,
              formattedTime: this.#formatTimestamp(message.timestamp)
            }
          }
        );
        
        messageElement = recycledNode;
      } else {
        // Create new element
        messageElement = document.createElement('div');
        messageElement.className = `message message-${message.role}`;
        messageElement.dataset.messageId = message.id;
        messageElement.dataset.role = message.role;
        messageElement.dataset.timestamp = message.timestamp;
        
        if (message.type) {
          messageElement.dataset.type = message.type;
        }
        
        // Render component into the element
        componentLoader.renderComponent(
          templatePath,
          messageElement,
          {
            message: {
              ...message,
              formattedTime: this.#formatTimestamp(message.timestamp)
            }
          }
        );
      }
      
      // Process markdown and code after rendering
      this.#processMessageContent(messageElement, message);
      
      // Add to container if not already present
      if (!messageElement.parentNode) {
        // Determine position for message (preserve order)
        let insertBefore = null;
        
        if (this.#config.virtualScrolling.enabled) {
          // For virtual scrolling, position before bottom sentinel and spacer
          insertBefore = this.#virtualScroller.spacers.bottom;
        } else {
          // Without virtual scrolling, maintain chronological order
          const allMessages = Array.from(this.#state.messages.values())
            .sort((a, b) => a.timestamp - b.timestamp);
            
          const index = allMessages.findIndex(m => m.id === message.id);
          
          if (index < allMessages.length - 1) {
            const nextMessageId = allMessages[index + 1].id;
            const nextElement = this.#state.renderedElements.get(nextMessageId);
            if (nextElement) {
              insertBefore = nextElement;
            }
          }
        }
        
        if (insertBefore) {
          container.insertBefore(messageElement, insertBefore);
        } else {
          container.appendChild(messageElement);
        }
      }
      
      // Add animation class
      if (!this.#config.animation.reducedMotion) {
        messageElement.classList.add('message-enter');
        setTimeout(() => {
          messageElement.classList.remove('message-enter');
        }, this.#config.animation.messageFadeInDuration);
      }
      
      // Store reference
      this.#state.renderedElements.set(message.id, messageElement);
      
      // Observe for intersection
      this.#intersectionObserver?.observe(messageElement);
      
      return messageElement;
    } catch (error) {
      console.error('Error rendering message:', error);
      
      // Create fallback message element
      const fallbackElement = document.createElement('div');
      fallbackElement.className = `message message-${message.role} message-fallback`;
      fallbackElement.dataset.messageId = message.id;
      fallbackElement.dataset.role = message.role;
      fallbackElement.dataset.timestamp = message.timestamp;
      
      fallbackElement.innerHTML = `
        <div class="message-header">
          <div class="message-sender">${message.role === 'human' ? 'You' : 'Claude'}</div>
          <div class="message-time">${this.#formatTimestamp(message.timestamp)}</div>
        </div>
        <div class="message-content">
          <p>${this.#escapeHtml(message.content || '')}</p>
        </div>
      `;
      
      // Add to container
      const container = this.#virtualScroller?.messageContainer || this.#elements.get('chatContainer');
      if (container && !fallbackElement.parentNode) {
        container.appendChild(fallbackElement);
      }
      
      // Store reference
      this.#state.renderedElements.set(message.id, fallbackElement);
      
      // Observe for intersection
      this.#intersectionObserver?.observe(fallbackElement);
      
      return fallbackElement;
    }
  }
  
  /**
   * Process message content (markdown, code highlighting)
   * @param {HTMLElement} messageElement - Message element
   * @param {Object} message - Message data
   * @private
   */
  #processMessageContent(messageElement, message) {
    // Skip for special message types
    if (message.type === 'thinking' || !message.content) return;
    
    // Get content container
    const contentElement = messageElement.querySelector('.message-content');
    if (!contentElement) return;
    
    // For streaming messages, skip for now
    if (message.streaming) return;
    
    // Process markdown in content
    if (this.#config.markdown.enabled && typeof message.content === 'string') {
      // Schedule this as a low-priority update
      this.#scheduleUpdate(async () => {
        try {
          // Process markdown
          const html = await this.#processMarkdown(message.content);
          
          // Update content
          contentElement.innerHTML = html;
          
          // Process code blocks
          this.#processCodeBlocks(contentElement);
        } catch (error) {
          console.error('Error processing message markdown:', error);
          contentElement.textContent = message.content;
        }
      });
    }
  }
  
  /**
   * Process code blocks in a message
   * @param {HTMLElement} contentElement - Message content element
   * @private
   */
  #processCodeBlocks(contentElement) {
    if (!this.#config.codeHighlighting.enabled) return;
    
    // Find all code blocks
    const codeBlocks = contentElement.querySelectorAll('pre > code');
    
    for (const codeElement of codeBlocks) {
      const preElement = codeElement.parentElement;
      
      // Skip if already processed
      if (preElement.classList.contains('processed')) continue;
      
      // Extract language from class
      let language = '';
      const classMatch = codeElement.className.match(/language-(\w+)/);
      if (classMatch) {
        language = classMatch[1];
      }
      
      // Create code block wrapper
      const codeBlockWrapper = document.createElement('div');
      codeBlockWrapper.className = 'code-block';
      if (language) {
        codeBlockWrapper.dataset.language = language;
      }
      
      // Add language label
      if (language) {
        const langLabel = document.createElement('div');
        langLabel.className = 'code-language';
        langLabel.textContent = language;
        codeBlockWrapper.appendChild(langLabel);
      }
      
      // Add code actions
      const codeActions = document.createElement('div');
      codeActions.className = 'code-actions';
      codeActions.innerHTML = `
        <button class="code-action" data-code-action="copy" aria-label="Copy code">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="label">Copy</span>
        </button>
      `;
      codeBlockWrapper.appendChild(codeActions);
      
      // Get the code content
      const code = codeElement.textContent;
      
      // Schedule syntax highlighting
      this.#scheduleUpdate(async () => {
        try {
          // Highlight code
          const highlighted = await this.#highlightCode(code, language);
          
          // Update code element
          codeElement.innerHTML = highlighted;
          codeElement.dataset.highlighted = 'true';
        } catch (error) {
          console.error('Error highlighting code:', error);
        }
      });
      
      // Insert wrapper before pre and move pre inside it
      preElement.parentNode.insertBefore(codeBlockWrapper, preElement);
      codeBlockWrapper.appendChild(preElement);
      
      // Mark as processed
      preElement.classList.add('processed');
    }
  }
  
  // ===============================================================
  // Public API Methods
  // ===============================================================
  
  /**
   * Add a new message to the chat
   * @param {Object} message - Message data
   * @param {Object} options - Options for adding the message
   * @returns {HTMLElement} - The rendered message element
   */
  addMessage(message, options = {}) {
    if (!this.#state.initialized) {
      console.warn('UI not initialized. Call initialize() first.');
      return null;
    }
    
    const {
      scrollIntoView = true,
      animate = true,
      notify = true
    } = options;
    
    // Generate ID if not provided
    const messageId = message.id || `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Set timestamp if not provided
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }
    
    // Check if message already exists
    if (this.#state.messages.has(messageId)) {
      return this.updateMessage(messageId, message);
    }
    
    // Add ID to message
    const messageWithId = { ...message, id: messageId };
    
    // Store in state
    this.#state.messages.set(messageId, messageWithId);
    
    // Render message
    const messageElement = this.#renderMessage(messageWithId);
    
    // Hide welcome screen if visible
    const welcomeScreen = this.#elements.get('welcomeScreen');
    if (welcomeScreen && !welcomeScreen.classList.contains('hidden')) {
      welcomeScreen.classList.add('hidden');
    }
    
    // Scroll into view if requested
    if (scrollIntoView) {
      this.scrollToBottom();
    }
    
    // Announce to screen readers if needed
    if (notify) {
      const srMessage = message.role === 'human' 
        ? `You: ${message.content}` 
        : `Claude: ${message.content || ''}`;
      
      this.#announceToScreenReader(srMessage);
    }
    
    // Update virtual scrolling
    if (this.#config.virtualScrolling.enabled) {
      this.#scheduleVirtualScrollerUpdate();
    }
    
    // Emit message added event
    this.#emit('message:added', {
      messageId,
      message: messageWithId
    });
    
    return messageElement;
  }
  
  /**
   * Update an existing message
   * @param {string} messageId - ID of the message to update
   * @param {Object} messageData - New message data
   * @param {Object} options - Update options
   * @returns {HTMLElement} - The updated message element
   */
  updateMessage(messageId, messageData, options = {}) {
    if (!this.#state.initialized) {
      console.warn('UI not initialized. Call initialize() first.');
      return null;
    }
    
    const {
      scrollIntoView = false,
      partial = true,
      notify = false
    } = options;
    
    // Get existing message
    const existingMessage = this.#state.messages.get(messageId);
    if (!existingMessage) {
      console.warn(`Message with ID ${messageId} not found`);
      return null;
    }
    
    // Update message data
    const updatedMessage = partial
      ? { ...existingMessage, ...messageData }
      : { ...messageData, id: messageId };
    
    // Store updated message
    this.#state.messages.set(messageId, updatedMessage);
    
    // Re-render message
    const messageElement = this.#renderMessage(updatedMessage);
    
    // Scroll if requested
    if (scrollIntoView) {
      this.scrollToMessage(messageId);
    }
    
    // Announce to screen readers if needed
    if (notify && updatedMessage.content) {
      const srMessage = updatedMessage.role === 'human' 
        ? `You (updated): ${updatedMessage.content}` 
        : `Claude (updated): ${updatedMessage.content}`;
      
      this.#announceToScreenReader(srMessage);
    }
    
    // Emit message updated event
    this.#emit('message:updated', {
      messageId,
      message: updatedMessage
    });
    
    return messageElement;
  }
  
  /**
   * Remove a message from the chat
   * @param {string} messageId - ID of the message to remove
   * @param {Object} options - Removal options
   * @returns {boolean} - Success indicator
   */
  removeMessage(messageId, options = {}) {
    if (!this.#state.initialized) {
      console.warn('UI not initialized. Call initialize() first.');
      return false;
    }
    
    const { animate = true } = options;
    
    // Get message
    const message = this.#state.messages.get(messageId);
    if (!message) {
      console.warn(`Message with ID ${messageId} not found`);
      return false;
    }
    
    // Get element
    const messageElement = this.#state.renderedElements.get(messageId);
    
    // Remove from state
    this.#state.messages.delete(messageId);
    this.#state.renderedElements.delete(messageId);
    this.#state.visibleMessages.delete(messageId);
    
    // Remove element with animation
    if (messageElement) {
      if (animate && !this.#config.animation.reducedMotion) {
        messageElement.classList.add('message-exit');
        
        setTimeout(() => {
          messageElement.remove();
        }, this.#config.animation.messageFadeInDuration);
      } else {
        messageElement.remove();
      }
    }
    
    // Update virtual scrolling
    if (this.#config.virtualScrolling.enabled) {
      this.#scheduleVirtualScrollerUpdate();
    }
    
    // Emit message removed event
    this.#emit('message:removed', {
      messageId,
      message
    });
    
    return true;
  }
  
  /**
   * Start streaming a message
   * @param {string} messageId - ID of the message
   * @param {Object} initialData - Initial message data
   * @returns {HTMLElement} - The message element
   */
  startStreaming(messageId, initialData = {}) {
    if (!this.#state.initialized) {
      console.warn('UI not initialized. Call initialize() first.');
      return null;
    }
    
    // Hide thinking indicator if active
    if (this.#state.thinking) {
      this.hideThinking();
    }
    
    // Set streaming state
    this.#state.streaming = {
      active: true,
      messageId,
      content: initialData.content || '',
      startTime: Date.now()
    };
    
    // Create or update message
    const existingMessage = this.#state.messages.get(messageId);
    
    if (existingMessage) {
      // Update existing message
      return this.updateMessage(messageId, {
        ...initialData,
        streaming: true
      });
    } else {
      // Create new message
      return this.addMessage({
        id: messageId,
        role: 'assistant',
        content: initialData.content || '',
        timestamp: Date.now(),
        streaming: true,
        ...initialData
      });
    }
  }
  
  /**
   * Append content to a streaming message
   * @param {string} messageId - ID of the streaming message
   * @param {string} content - Content to append
   * @param {Object} options - Options for appending
   */
  appendStreamContent(messageId, content, options = {}) {
    if (!this.#state.initialized || !this.#state.streaming.active) {
      return;
    }
    
    const {
      scrollIntoView = true,
      replace = false
    } = options;
    
    // Get message
    const message = this.#state.messages.get(messageId);
    if (!message) return;
    
    // Update streaming content
    if (replace) {
      this.#state.streaming.content = content;
    } else {
      this.#state.streaming.content += content;
    }
    
    // Update message content
    message.content = this.#state.streaming.content;
    
    // Schedule content update
    this.#scheduleUpdate(() => {
      const messageElement = this.#state.renderedElements.get(messageId);
      if (!messageElement) return;
      
      const contentElement = messageElement.querySelector('.message-content');
      if (!contentElement) return;
      
      try {
        // Process markdown on streaming content
        this.#processMarkdown(message.content)
          .then(html => {
            contentElement.innerHTML = html;
            
            // Add typing cursor
            const cursor = document.createElement('span');
            cursor.className = 'typing-cursor';
            contentElement.appendChild(cursor);
            
            // Process code blocks
            this.#processCodeBlocks(contentElement);
          })
          .catch(err => {
            console.error('Error processing streaming markdown:', err);
            contentElement.textContent = message.content;
          });
      } catch (error) {
        console.error('Error updating streaming content:', error);
        contentElement.textContent = message.content;
      }
    });
    
    // Scroll to bottom if needed
    if (scrollIntoView && this.#state.scrollLocked) {
      this.scrollToBottom({ behavior: 'auto' });
    }
  }
  
  /**
   * Stop streaming and finalize message
   * @param {string} messageId - ID of the streaming message
   * @param {Object} finalData - Final message data
   * @returns {HTMLElement} - The finalized message element
   */
  stopStreaming(messageId, finalData = {}) {
    if (!this.#state.initialized || !this.#state.streaming.active) {
      return null;
    }
    
    // Get message
    const message = this.#state.messages.get(messageId);
    if (!message) return null;
    
    // Reset streaming state
    this.#state.streaming = {
      active: false,
      messageId: null,
      content: '',
      startTime: 0
    };
    
    // Finalize message
    const updatedMessage = {
      ...message,
      ...finalData,
      content: finalData.content || message.content || this.#state.streaming.content,
      streaming: false
    };
    
    // Update message
    const element = this.updateMessage(messageId, updatedMessage, {
      scrollIntoView: true,
      notify: true
    });
    
    // Emit streaming stopped event
    this.#emit('streaming:stopped', {
      messageId,
      content: updatedMessage.content,
      duration: Date.now() - (message.timestamp || 0)
    });
    
    return element;
  }
  
  /**
   * Show thinking indicator
   * @param {Object} options - Options for the indicator
   * @returns {HTMLElement} - The thinking indicator element
   */
  showThinking(options = {}) {
    if (!this.#state.initialized) {
      console.warn('UI not initialized. Call initialize() first.');
      return null;
    }
    
    const {
      model = 'Claude',
      message = `${model} is thinking...`
    } = options;
    
    // Create thinking message
    const thinkingId = `thinking-${Date.now()}`;
    const thinkingMessage = {
      id: thinkingId,
      role: 'assistant',
      type: 'thinking',
      content: message,
      timestamp: Date.now()
    };
    
    // Add message
    const element = this.addMessage(thinkingMessage, {
      scrollIntoView: true,
      notify: true
    });
    
    // Update state
    this.#state.thinking = true;
    
    return element;
  }
  
  /**
   * Hide thinking indicator
   * @returns {boolean} - Success indicator
   */
  hideThinking() {
    if (!this.#state.initialized || !this.#state.thinking) {
      return false;
    }
    
    // Find thinking message
    const thinkingMessage = Array.from(this.#state.messages.values())
      .find(msg => msg.type === 'thinking');
    
    if (thinkingMessage) {
      // Remove message
      this.removeMessage(thinkingMessage.id);
    }
    
    // Update state
    this.#state.thinking = false;
    
    return true;
  }
  
  /**
   * Scroll to the bottom of the chat
   * @param {Object} options - Scroll options
   */
  scrollToBottom(options = {}) {
    if (!this.#state.initialized) return;
    
    const { behavior = this.#config.animation.scrollBehavior } = options;
    const chatContainer = this.#elements.get('chatContainer');
    
    if (!chatContainer) return;
    
    // Use native scrollTo with animation
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: this.#config.animation.reducedMotion ? 'auto' : behavior
    });
    
    // Update scroll lock state
    this.#state.scrollLocked = true;
    
    // Hide scroll to bottom button
    const scrollToBottomBtn = this.#elements.get('scrollToBottomBtn');
    if (scrollToBottomBtn) {
      scrollToBottomBtn.classList.remove('visible');
    }
  }
  
  /**
   * Scroll to a specific message
   * @param {string} messageId - ID of the message
   * @param {Object} options - Scroll options
   * @returns {boolean} - Success indicator
   */
  scrollToMessage(messageId, options = {}) {
    if (!this.#state.initialized) return false;
    
    const {
      behavior = this.#config.animation.scrollBehavior,
      block = 'center',
      highlight = true
    } = options;
    
    // Get message element
    const messageElement = this.#state.renderedElements.get(messageId);
    if (!messageElement) return false;
    
    // Scroll to element
    messageElement.scrollIntoView({
      behavior: this.#config.animation.reducedMotion ? 'auto' : behavior,
      block
    });
    
    // Highlight briefly if requested
    if (highlight && !this.#config.animation.reducedMotion) {
      messageElement.classList.add('highlight');
      setTimeout(() => {
        messageElement.classList.remove('highlight');
      }, 1000);
    }
    
    return true;
  }
  
  /**
   * Clear the chat history
   */
  clearChat() {
    if (!this.#state.initialized) return;
    
    // Clear state
    this.#state.messages.clear();
    this.#state.renderedElements.clear();
    this.#state.visibleMessages.clear();
    
    // Clear DOM
    if (this.#config.virtualScrolling.enabled && this.#virtualScroller) {
      // In virtual scrolling mode, clear everything except spacers and sentinels
      const { spacers, sentinels, messageContainer } = this.#virtualScroller;
      
      // Remove all message elements
      const messages = messageContainer.querySelectorAll('[data-message-id]');
      messages.forEach(el => el.remove());
      
      // Reset spacers
      spacers.top.style.height = '0px';
      spacers.bottom.style.height = '0px';
    } else {
      // Simple clearing
      const chatContainer = this.#elements.get('chatContainer');
      if (chatContainer) {
        chatContainer.innerHTML = '';
      }
    }
    
    // Show welcome screen if available
    const welcomeScreen = this.#elements.get('welcomeScreen');
    if (welcomeScreen) {
      welcomeScreen.classList.remove('hidden');
    }
    
    // Emit cleared event
    this.#emit('chat:cleared');
  }
  
  /**
   * Update chat history UI
   * @param {Object} state - Application state
   */
  updateChatHistoryUI(state) {
    if (!this.#state.initialized) return;
    
    const { chats, currentChat } = state;
    if (!chats) return;
    
    const chatHistoryElement = this.#elements.get('chatHistory');
    if (!chatHistoryElement) return;
    
    try {
      // Render chat history component
      componentLoader.renderComponent(
        this.#config.templates.chatInterface,
        chatHistoryElement,
        {
          chats,
          currentChatId: currentChat?.id
        }
      );
      
      // Update current chat ID
      this.#state.activeChatId = currentChat?.id;
      
      // Add event handlers
      chatHistoryElement.querySelectorAll('[data-chat-id]').forEach(item => {
        const chatId = item.dataset.chatId;
        
        // Add click handler
        item.addEventListener('click', () => {
          this.#emit('chat:selected', { chatId });
        });
        
        // Add delete handler
        const deleteBtn = item.querySelector('[data-action="delete"]');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', event => {
            event.stopPropagation();
            this.#confirmChatDeletion(chatId);
          });
        }
      });
    } catch (error) {
      console.error('Failed to update chat history UI:', error);
      
      // Fallback implementation
      chatHistoryElement.innerHTML = `
        <ul class="chat-list">
          ${chats.map(chat => `
            <li class="chat-item ${chat.id === currentChat?.id ? 'active' : ''}">
              <button data-chat-id="${chat.id}">
                ${chat.title || 'New Chat'}
                <span class="chat-time">${this.#formatTimestamp(chat.updatedAt || chat.createdAt)}</span>
              </button>
            </li>
          `).join('')}
        </ul>
      `;
      
      // Add event handlers
      chatHistoryElement.querySelectorAll('[data-chat-id]').forEach(item => {
        const chatId = item.dataset.chatId;
        item.addEventListener('click', () => {
          this.#emit('chat:selected', { chatId });
        });
      });
    }
  }
  
  /**
   * Show confirmation for chat deletion
   * @param {string} chatId - ID of the chat to delete
   * @private
   */
  #confirmChatDeletion(chatId) {
    this.showModal({
      title: 'Delete Chat',
      content: 'Are you sure you want to delete this chat? This action cannot be undone.',
      actions: [
        {
          label: 'Cancel',
          type: 'secondary'
        },
        {
          label: 'Delete',
          type: 'danger',
          handler: () => {
            this.#emit('chat:deleted', { chatId });
            this.closeModal();
          }
        }
      ]
    });
  }
  
  /**
   * Show a modal dialog
   * @param {Object} options - Modal options
   * @returns {HTMLElement} - The modal element
   */
  showModal(options = {}) {
    if (!this.#state.initialized) {
      console.warn('UI not initialized. Call initialize() first.');
      return null;
    }
    
    const {
      title,
      content,
      templatePath,
      templateData,
      actions = [],
      closeOnBackdrop = true
    } = options;
    
    const modalContainer = this.#elements.get('modalContainer');
    if (!modalContainer) return null;
    
    try {
      // Clear existing content
      modalContainer.innerHTML = '';
      
      // Create modal content
      if (templatePath) {
        // Use custom template
        componentLoader.renderComponent(
          templatePath,
          modalContainer,
          {
            title,
            ...templateData,
            actions
          }
        );
      } else {
        // Use default modal template
        componentLoader.renderComponent(
          this.#config.templates.modal,
          modalContainer,
          {
            title,
            content,
            actions
          }
        );
      }
      
      // Save currently focused element to restore later
      this.#state.lastActiveElement = document.activeElement;
      
      // Show modal
      modalContainer.setAttribute('aria-hidden', 'false');
      
      // Add backdrop click handler
      if (closeOnBackdrop) {
        const handleBackdropClick = event => {
          if (event.target === modalContainer) {
            this.closeModal();
            modalContainer.removeEventListener('click', handleBackdropClick);
          }
        };
        
        modalContainer.addEventListener('click', handleBackdropClick);
      }
      
      // Set up action handlers
      actions.forEach((action, index) => {
        if (!action.handler) return;
        
        const button = modalContainer.querySelector(`.modal-action-${index}`);
        if (button) {
          button.addEventListener('click', action.handler);
        }
      });
      
      // Set up close button
      const closeButton = modalContainer.querySelector('.modal-close');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.closeModal();
        });
      }
      
      // Try to focus first button or close button
      setTimeout(() => {
        const firstAction = modalContainer.querySelector('.modal-action-0');
        const closeBtn = modalContainer.querySelector('.modal-close');
        
        if (firstAction) {
          firstAction.focus();
        } else if (closeBtn) {
          closeBtn.focus();
        }
      }, 50);
      
      // Emit modal shown event
      this.#emit('modal:shown', { title });
      
      return modalContainer.firstElementChild;
    } catch (error) {
      console.error('Failed to show modal:', error);
      
      // Fallback modal
      modalContainer.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2>${title || 'Modal'}</h2>
            <button class="modal-close" aria-label="Close">×</button>
          </div>
          <div class="modal-content">
            ${content || 'An error occurred while displaying this content.'}
          </div>
          <div class="modal-actions">
            <button class="modal-action modal-action-cancel">Close</button>
          </div>
        </div>
      `;
      
      // Show modal
      modalContainer.setAttribute('aria-hidden', 'false');
      
      // Add close handler
      const closeButton = modalContainer.querySelector('.modal-close, .modal-action-cancel');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.closeModal();
        });
      }
      
      return modalContainer.firstElementChild;
    }
  }
  
  /**
   * Close the current modal
   */
  closeModal() {
    if (!this.#state.initialized) return;
    
    const modalContainer = this.#elements.get('modalContainer');
    if (!modalContainer) return;
    
    // Hide modal
    modalContainer.setAttribute('aria-hidden', 'true');
    
    // Clear content after transition
    setTimeout(() => {
      modalContainer.innerHTML = '';
    }, this.#config.animation.modalTransitionDuration);
    
    // Restore focus
    if (this.#state.lastActiveElement) {
      this.#state.lastActiveElement.focus();
      this.#state.lastActiveElement = null;
    }
    
    // Emit modal closed event
    this.#emit('modal:closed');
  }
  
  /**
   * Show a notification
   * @param {Object} options - Notification options
   * @returns {HTMLElement} - The notification element
   */
  showNotification(options = {}) {
    if (!this.#state.initialized) {
      console.warn('UI not initialized. Call initialize() first.');
      return null;
    }
    
    const {
      type = 'info',
      message,
      title,
      duration = 5000,
      actions = []
    } = options;
    
    const notificationContainer = this.#elements.get('notificationContainer');
    if (!notificationContainer) return null;
    
    try {
      // Create notification element
      const notificationElement = document.createElement('div');
      notificationElement.className = `notification notification-${type}`;
      notificationElement.setAttribute('role', 'alert');
      
      // Render notification
      componentLoader.renderComponent(
        this.#config.templates.notification,
        notificationElement,
        {
          type,
          title,
          message,
          actions
        }
      );
      
      // Add to container
      notificationContainer.appendChild(notificationElement);
      
      // Animate in
      setTimeout(() => {
        notificationElement.classList.add('visible');
      }, 10);
      
      // Set up auto-dismiss
      let dismissTimeout;
      if (duration > 0) {
        dismissTimeout = setTimeout(() => {
          this.#dismissNotification(notificationElement);
        }, duration);
      }
      
      // Add close button handler
      const closeButton = notificationElement.querySelector('.notification-close');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          clearTimeout(dismissTimeout);
          this.#dismissNotification(notificationElement);
        });
      }
      
      // Set up action handlers
      const actionButtons = notificationElement.querySelectorAll('.notification-action');
      actionButtons.forEach((button, index) => {
        if (actions[index] && actions[index].handler) {
          button.addEventListener('click', () => {
            clearTimeout(dismissTimeout);
            actions[index].handler();
            this.#dismissNotification(notificationElement);
          });
        }
      });
      
      return notificationElement;
    } catch (error) {
      console.error('Failed to show notification:', error);
      
      // Fallback notification
      const notificationElement = document.createElement('div');
      notificationElement.className = `notification notification-${type}`;
      notificationElement.setAttribute('role', 'alert');
      notificationElement.innerHTML = `
        <div class="notification-content">
          ${title ? `<div class="notification-title">${title}</div>` : ''}
          <div class="notification-message">${message}</div>
          <button class="notification-close" aria-label="Close">×</button>
        </div>
      `;
      
      // Add to container
      notificationContainer.appendChild(notificationElement);
      
      // Animate in
      setTimeout(() => {
        notificationElement.classList.add('visible');
      }, 10);
      
      // Set up auto-dismiss
      if (duration > 0) {
        setTimeout(() => {
          this.#dismissNotification(notificationElement);
        }, duration);
      }
      
      // Add close button handler
      const closeButton = notificationElement.querySelector('.notification-close');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.#dismissNotification(notificationElement);
        });
      }
      
      return notificationElement;
    }
  }
  
  /**
   * Dismiss a notification
   * @param {HTMLElement} notification - Notification element
   * @private
   */
  #dismissNotification(notification) {
    if (!notification) return;
    
    // Animate out
    notification.classList.remove('visible');
    notification.classList.add('hiding');
    
    // Remove after animation
    setTimeout(() => {
      notification.remove();
    }, this.#config.animation.modalTransitionDuration);
  }
  
  /**
   * Announce a message to screen readers
   * @param {string} message - Message to announce
   * @private
   */
  #announceToScreenReader(message) {
    const srLiveRegion = this.#elements.get('srLiveRegion');
    if (!srLiveRegion) return;
    
    // Update live region
    srLiveRegion.textContent = message;
  }
  
  /**
   * Listen for an event
   * @param {string} eventName - Name of the event
   * @param {Function} handler - Event handler
   * @returns {Function} - Function to remove the listener
   */
  on(eventName, handler) {
    return this.#eventBus.on(eventName, handler);
  }
  
  /**
   * Clean up resources and event listeners
   */
  destroy() {
    if (!this.#state.initialized) return;
    
    // Clean up web workers
    if (this.#markdownProcessor?.worker) {
      this.#markdownProcessor.worker.terminate();
    }
    
    if (this.#codeHighlighter?.worker) {
      this.#codeHighlighter.worker.terminate();
    }
    
    // Clean up observers
    this.#intersectionObserver?.disconnect();
    this.#resizeObserver?.disconnect();
    
    // Clean up animation frame
    cancelAnimationFrame(this.#pendingAnimationFrame);
    
    // Clear message state
    this.#state.messages.clear();
    this.#state.renderedElements.clear();
    this.#state.visibleMessages.clear();
    
    // Clean up event listeners
    window.removeEventListener('resize', this.#handleResize);
    
    // Empty update queue
    this.#updateQueue = [];
    this.#processingUpdates = false;
    
    // Clear recycled nodes
    this.#recycledNodes.clear();
    
    // Mark as uninitialized
    this.#state.initialized = false;
    
    // Emit destroyed event
    this.#emit('ui:destroyed');
  }
}

// Create and export singleton instance
const uiController = new UIController();

export default uiController;