/**
 * ClaudeChat Application Core
 * 
 * A sophisticated AI chat application with advanced features, including:
 * - Modern flux architecture with immutable state management
 * - Event-driven communication with UI components
 * - Reactive state with selector-based subscriptions
 * - Background processing with Web Workers
 * - Offline support with sync capabilities
 * - Comprehensive error recovery system
 * - Performance optimizations for large conversations
 * - Support for all Claude model capabilities
 */

// Core application with ES modules pattern
const ClaudeApp = (() => {
    /**
     * Core Event Bus
     * Centralized event system for decoupled communication between components
     */
    class EventBus {
      #listeners = new Map();
      #wildcardListeners = new Set();
      
      /**
       * Subscribe to an event
       * @param {string} eventName - Name of the event to subscribe to
       * @param {Function} callback - Function to call when event is emitted
       * @returns {Function} Unsubscribe function
       */
      subscribe(eventName, callback) {
        if (!this.#listeners.has(eventName)) {
          this.#listeners.set(eventName, new Set());
        }
        
        this.#listeners.get(eventName).add(callback);
        
        // Return unsubscribe function
        return () => {
          const listeners = this.#listeners.get(eventName);
          if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
              this.#listeners.delete(eventName);
            }
          }
        };
      }
      
      /**
       * Subscribe to all events
       * @param {Function} callback - Function to call for any event
       * @returns {Function} Unsubscribe function
       */
      subscribeToAll(callback) {
        this.#wildcardListeners.add(callback);
        
        // Return unsubscribe function
        return () => {
          this.#wildcardListeners.delete(callback);
        };
      }
      
      /**
       * Subscribe to an event once
       * @param {string} eventName - Name of the event to subscribe to
       * @param {Function} callback - Function to call when event is emitted
       * @returns {Function} Unsubscribe function
       */
      once(eventName, callback) {
        const unsubscribe = this.subscribe(eventName, (...args) => {
          unsubscribe();
          callback(...args);
        });
        
        return unsubscribe;
      }
      
      /**
       * Emit an event
       * @param {string} eventName - Name of the event to emit
       * @param {any} data - Data to pass to event handlers
       */
      emit(eventName, data = {}) {
        // Call specific event listeners
        const listeners = this.#listeners.get(eventName);
        if (listeners) {
          for (const callback of listeners) {
            try {
              callback(data);
            } catch (error) {
              console.error(`Error in event listener for "${eventName}":`, error);
            }
          }
        }
        
        // Call wildcard listeners
        for (const callback of this.#wildcardListeners) {
          try {
            callback(eventName, data);
          } catch (error) {
            console.error(`Error in wildcard listener for "${eventName}":`, error);
          }
        }
      }
    }
  
    /**
     * State Store
     * Implements a Redux-like pattern with actions, reducers, and middleware
     */
    class Store {
      #state;
      #reducers;
      #listeners = new Map();
      #batchedUpdates = new Set();
      #isBatching = false;
      #middleware = [];
      #eventBus;
      
      /**
       * Create a new Store instance
       * @param {Object} initialState - Initial state object
       * @param {Object} reducers - Map of reducer functions
       * @param {Array} middleware - Array of middleware functions
       * @param {EventBus} eventBus - Event bus instance
       */
      constructor(initialState = {}, reducers = {}, middleware = [], eventBus) {
        this.#state = { ...initialState };
        this.#reducers = reducers;
        this.#middleware = middleware;
        this.#eventBus = eventBus;
      }
      
      /**
       * Get the current state
       * @returns {Object} The current state
       */
      getState() {
        return { ...this.#state };
      }
      
      /**
       * Dispatch an action to update state
       * @param {Object|Function} action - Action object or thunk function
       * @returns {Promise<any>} Result of the action
       */
      async dispatch(action) {
        // Handle thunks (functions that return a promise)
        if (typeof action === 'function') {
          return action(this.dispatch.bind(this), this.getState.bind(this));
        }
        
        // Apply middleware
        let processedAction = action;
        for (const middleware of this.#middleware) {
          processedAction = middleware(processedAction, this.getState.bind(this));
        }
        
        // Find the appropriate reducer
        const { type, ...payload } = processedAction;
        if (!type) {
          console.error('Action must have a type property:', action);
          return;
        }
        
        const reducer = this.#reducers[type] || this.#reducers['DEFAULT'];
        
        // Skip if no reducer found and no default
        if (!reducer) return;
        
        // Apply the reducer to get new state
        const newState = reducer(this.#state, payload);
        
        // Batch state updates for performance
        this.#batchUpdate(() => {
          // Update the state
          const prevState = { ...this.#state };
          this.#state = newState;
          
          // Notify listeners of state changes
          this.#notifyListeners(prevState);
          
          // Emit state change event for UI components
          this.#eventBus.emit('state:changed', {
            type,
            payload,
            prevState,
            currentState: this.#state
          });
        });
        
        return this.#state;
      }
      
      /**
       * Subscribe to state changes
       * @param {Function|string} selectorOrPath - Selector function or dot path
       * @param {Function} callback - Function to call when selected state changes
       * @returns {Function} Unsubscribe function
       */
      subscribe(selectorOrPath, callback) {
        let selector;
        
        // Handle string paths (e.g., 'user.profile.name')
        if (typeof selectorOrPath === 'string') {
          const path = selectorOrPath.split('.');
          selector = (state) => {
            let value = state;
            for (const key of path) {
              if (value === undefined || value === null) return undefined;
              value = value[key];
            }
            return value;
          };
        } else if (typeof selectorOrPath === 'function') {
          selector = selectorOrPath;
        } else {
          // Default to whole state if no valid selector
          selector = state => state;
        }
        
        // Store the listener with its selector
        if (!this.#listeners.has(selector)) {
          this.#listeners.set(selector, new Set());
        }
        
        this.#listeners.get(selector).add(callback);
        
        // Return unsubscribe function
        return () => {
          const listeners = this.#listeners.get(selector);
          if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
              this.#listeners.delete(selector);
            }
          }
        };
      }
      
      /**
       * Batch state updates to reduce renders
       * @param {Function} updateFn - Function that performs state updates
       */
      #batchUpdate(updateFn) {
        const wasAlreadyBatching = this.#isBatching;
        this.#isBatching = true;
        
        try {
          updateFn();
        } finally {
          if (!wasAlreadyBatching) {
            // Only flush at the end of the outermost batch
            this.#isBatching = false;
            this.#flushBatchedUpdates();
          }
        }
      }
      
      /**
       * Flush all batched updates
       */
      #flushBatchedUpdates() {
        // Use requestAnimationFrame to align with UI updates
        requestAnimationFrame(() => {
          const updatesToProcess = new Set(this.#batchedUpdates);
          this.#batchedUpdates.clear();
          
          for (const update of updatesToProcess) {
            update();
          }
        });
      }
      
      /**
       * Notify listeners of state changes
       * @param {Object} prevState - Previous state before update
       */
      #notifyListeners(prevState) {
        for (const [selector, callbacks] of this.#listeners.entries()) {
          const prevSelectedState = selector(prevState);
          const newSelectedState = selector(this.#state);
          
          // Only notify if selected state has changed
          if (!this.#isEqual(prevSelectedState, newSelectedState)) {
            for (const callback of callbacks) {
              // Add to batched updates for efficient processing
              this.#batchedUpdates.add(() => {
                try {
                  callback(newSelectedState, prevSelectedState);
                } catch (error) {
                  console.error('Error in state change listener:', error);
                }
              });
            }
          }
        }
      }
      
      /**
       * Check if two values are equal (shallow comparison)
       * @param {any} a - First value
       * @param {any} b - Second value
       * @returns {boolean} Whether the values are equal
       */
      #isEqual(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return false;
        if (typeof a !== 'object' || typeof b !== 'object') return false;
        
        // Handle arrays
        if (Array.isArray(a) && Array.isArray(b)) {
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
          }
          return true;
        }
        
        // Handle objects (shallow comparison)
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        
        if (keysA.length !== keysB.length) return false;
        
        for (const key of keysA) {
          if (a[key] !== b[key]) return false;
        }
        
        return true;
      }
    }
  
    /**
     * API Client for interacting with the Claude API
     * Handles authentication, request/response formatting, streaming, and error handling
     */
    class ApiClient {
      #apiKey = null;
      #apiVersion = '2023-06-01';
      #baseUrl = 'https://api.anthropic.com';
      #eventBus;
      #retryConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000
      };
      
      /**
       * Create new API client
       * @param {EventBus} eventBus - Event bus for emitting API events
       */
      constructor(eventBus) {
        this.#eventBus = eventBus;
      }
      
      /**
       * Set the API key
       * @param {string} apiKey - Anthropic API key
       */
      setApiKey(apiKey) {
        this.#apiKey = apiKey;
      }
      
      /**
       * Get the API key
       * @returns {string|null} Current API key
       */
      getApiKey() {
        return this.#apiKey;
      }
      
      /**
       * Check if the API client is configured
       * @returns {boolean} Whether API client has an API key
       */
      isConfigured() {
        return Boolean(this.#apiKey);
      }
      
      /**
       * Send a message to Claude and get a response
       * @param {Array} messages - Array of message objects
       * @param {Object} options - Request options
       * @returns {Promise<Object>} Claude response
       */
      async sendMessage(messages, options = {}) {
        if (!this.#apiKey) {
          throw new Error('API key not configured');
        }
        
        const {
          model = 'claude-3-7-sonnet-20250219',
          temperature = 0.7,
          maxTokens = 4096,
          system = '',
          tools = [],
          streaming = false,
          onProgress = null,
          thinkingEnabled = false,
          thinkingBudget = 10240
        } = options;
        
        // Build request payload
        const payload = {
          model,
          messages,
          max_tokens: maxTokens,
          temperature
        };
        
        // Add system prompt if provided
        if (system) {
          payload.system = system;
        }
        
        // Add tools if provided
        if (tools && tools.length > 0) {
          payload.tools = tools;
        }
        
        // Add thinking mode if enabled
        if (thinkingEnabled) {
          payload.thinking = {
            type: "extended",
            budget_tokens: thinkingBudget
          };
        }
        
        // Add streaming if requested
        if (streaming) {
          payload.stream = true;
          return this.#streamingRequest('/v1/messages', payload, onProgress);
        }
        
        // Standard request
        return this.#request('/v1/messages', payload);
      }
      
      /**
       * Make a standard request to the Claude API
       * @param {string} endpoint - API endpoint
       * @param {Object} payload - Request payload
       * @param {number} retryCount - Current retry attempt
       * @returns {Promise<Object>} API response
       */
      async #request(endpoint, payload, retryCount = 0) {
        try {
          this.#eventBus.emit('api:request', { endpoint, payload });
          
          const response = await fetch(`${this.#baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.#apiKey,
              'anthropic-version': this.#apiVersion
            },
            body: JSON.stringify(payload)
          });
          
          // Handle unsuccessful responses
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new ApiError(
              errorData.error?.message || response.statusText,
              response.status,
              errorData
            );
          }
          
          const data = await response.json();
          this.#eventBus.emit('api:response', { endpoint, response: data });
          
          return data;
        } catch (error) {
          // Handle rate limiting with exponential backoff
          if (
            error instanceof ApiError && 
            (error.status === 429 || (error.status >= 500 && error.status < 600)) && 
            retryCount < this.#retryConfig.maxRetries
          ) {
            const delay = Math.min(
              this.#retryConfig.baseDelay * Math.pow(2, retryCount),
              this.#retryConfig.maxDelay
            ) * (0.75 + Math.random() * 0.5); // Add jitter
            
            this.#eventBus.emit('api:retry', { 
              endpoint, 
              retryCount: retryCount + 1, 
              delay, 
              error 
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.#request(endpoint, payload, retryCount + 1);
          }
          
          // Re-throw error for other cases
          this.#eventBus.emit('api:error', { endpoint, error });
          throw error;
        }
      }
      
      /**
       * Make a streaming request to the Claude API
       * @param {string} endpoint - API endpoint
       * @param {Object} payload - Request payload
       * @param {Function} onProgress - Callback for streaming progress
       * @returns {Promise<Object>} Final response object
       */
      async #streamingRequest(endpoint, payload, onProgress) {
        try {
          this.#eventBus.emit('api:streamStart', { endpoint, payload });
          
          const response = await fetch(`${this.#baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.#apiKey,
              'anthropic-version': this.#apiVersion
            },
            body: JSON.stringify(payload)
          });
          
          // Handle unsuccessful responses
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new ApiError(
              errorData.error?.message || response.statusText,
              response.status,
              errorData
            );
          }
          
          // Process the stream
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          let result = {
            id: null,
            role: 'assistant',
            content: '',
            model: payload.model,
            stop_reason: null,
            type: 'message'
          };
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }
            
            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete events in buffer
            let boundary;
            while ((boundary = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 1);
              
              if (!line.trim() || !line.startsWith('data: ')) continue;
              
              const eventData = line.slice(6); // Remove 'data: ' prefix
              
              // Check for end marker
              if (eventData === '[DONE]') break;
              
              try {
                const parsed = JSON.parse(eventData);
                
                // Extract message ID if available
                if (parsed.message?.id && !result.id) {
                  result.id = parsed.message.id;
                }
                
                // Handle content block delta
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  result.content += parsed.delta.text;
                  
                  if (onProgress) {
                    onProgress({
                      type: 'content',
                      content: result.content,
                      delta: parsed.delta.text
                    });
                  }
                }
                
                // Handle message stop
                if (parsed.type === 'message_stop') {
                  result.stop_reason = 'end_turn';
                }
                
                // Handle thinking progress
                if (parsed.type === 'thinking_progress') {
                  if (onProgress) {
                    onProgress({
                      type: 'thinking',
                      pulse: parsed.pulse
                    });
                  }
                }
                
                // Emit stream event for each chunk
                this.#eventBus.emit('api:stream', { 
                  type: parsed.type, 
                  data: parsed
                });
              } catch (e) {
                console.error('Error parsing stream event:', e, eventData);
              }
            }
          }
          
          // Emit completion event
          this.#eventBus.emit('api:streamEnd', { result });
          
          return result;
        } catch (error) {
          this.#eventBus.emit('api:streamError', { endpoint, error });
          throw error;
        }
      }
    }
  
    /**
     * Custom API error class
     */
    class ApiError extends Error {
      constructor(message, status, data = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
      }
    }
  
    /**
     * Storage service for persisting data locally
     */
    class StorageService {
      #eventBus;
      #storageType = 'localStorage';
      #dbName = 'claude-chat-db';
      #db = null;
      #isInitialized = false;
      
      /**
       * Create a new storage service
       * @param {EventBus} eventBus - Event bus instance
       */
      constructor(eventBus) {
        this.#eventBus = eventBus;
      }
      
      /**
       * Initialize the storage service
       * @returns {Promise<boolean>} Whether initialization was successful
       */
      async initialize() {
        try {
          // Try to use IndexedDB if available
          if ('indexedDB' in window) {
            await this.#initIndexedDB();
            this.#storageType = 'indexedDB';
          } else {
            // Fall back to localStorage
            this.#testLocalStorage();
            this.#storageType = 'localStorage';
          }
          
          this.#isInitialized = true;
          this.#eventBus.emit('storage:initialized', { type: this.#storageType });
          return true;
        } catch (error) {
          // Fall back to in-memory storage
          console.error('Failed to initialize persistent storage:', error);
          this.#storageType = 'memory';
          this.#db = new Map();
          this.#isInitialized = true;
          this.#eventBus.emit('storage:error', { 
            error, 
            fallback: 'in-memory' 
          });
          return false;
        }
      }
      
      /**
       * Initialize IndexedDB
       * @returns {Promise<void>}
       */
      async #initIndexedDB() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(this.#dbName, 1);
          
          request.onerror = () => {
            reject(new Error('Could not open IndexedDB'));
          };
          
          request.onsuccess = () => {
            this.#db = request.result;
            resolve();
          };
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object stores
            if (!db.objectStoreNames.contains('chats')) {
              db.createObjectStore('chats', { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains('preferences')) {
              db.createObjectStore('preferences', { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains('keyValue')) {
              db.createObjectStore('keyValue', { keyPath: 'key' });
            }
          };
        });
      }
      
      /**
       * Test if localStorage is available
       * @throws {Error} If localStorage is not available
       */
      #testLocalStorage() {
        const testKey = '__storage_test__';
        try {
          localStorage.setItem(testKey, testKey);
          localStorage.removeItem(testKey);
        } catch (e) {
          throw new Error('localStorage is not available');
        }
      }
      
      /**
       * Get an item from storage
       * @param {string} key - Storage key
       * @param {string} collection - Optional collection/table name
       * @returns {Promise<any>} The stored value or null
       */
      async getItem(key, collection = 'keyValue') {
        if (!this.#isInitialized) {
          await this.initialize();
        }
        
        if (this.#storageType === 'indexedDB') {
          return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([collection], 'readonly');
            const store = transaction.objectStore(collection);
            const request = collection === 'keyValue' 
              ? store.get({ key }) 
              : store.get(key);
            
            request.onerror = () => reject(new Error(`Failed to get ${key}`));
            request.onsuccess = () => {
              resolve(request.result ? 
                (collection === 'keyValue' ? request.result.value : request.result) : 
                null);
            };
          });
        } else if (this.#storageType === 'localStorage') {
          const fullKey = collection === 'keyValue' ? key : `${collection}:${key}`;
          const value = localStorage.getItem(fullKey);
          return value ? JSON.parse(value) : null;
        } else {
          // In-memory fallback
          const fullKey = collection === 'keyValue' ? key : `${collection}:${key}`;
          return this.#db.get(fullKey) || null;
        }
      }
      
      /**
       * Set an item in storage
       * @param {string} key - Storage key
       * @param {any} value - Value to store
       * @param {string} collection - Optional collection/table name
       * @returns {Promise<boolean>} Whether set was successful
       */
      async setItem(key, value, collection = 'keyValue') {
        if (!this.#isInitialized) {
          await this.initialize();
        }
        
        try {
          if (this.#storageType === 'indexedDB') {
            return new Promise((resolve, reject) => {
              const transaction = this.#db.transaction([collection], 'readwrite');
              const store = transaction.objectStore(collection);
              const request = collection === 'keyValue'
                ? store.put({ key, value })
                : store.put(value);
              
              request.onerror = () => reject(new Error(`Failed to set ${key}`));
              request.onsuccess = () => resolve(true);
            });
          } else if (this.#storageType === 'localStorage') {
            const fullKey = collection === 'keyValue' ? key : `${collection}:${key}`;
            localStorage.setItem(fullKey, JSON.stringify(value));
            return true;
          } else {
            // In-memory fallback
            const fullKey = collection === 'keyValue' ? key : `${collection}:${key}`;
            this.#db.set(fullKey, value);
            return true;
          }
        } catch (error) {
          this.#eventBus.emit('storage:error', { operation: 'set', key, error });
          
          // Handle quota exceeded errors
          if (error.name === 'QuotaExceededError' || 
              error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            await this.#handleStorageQuotaError(collection);
            // Try again
            return this.setItem(key, value, collection);
          }
          
          return false;
        }
      }
      
      /**
       * Remove an item from storage
       * @param {string} key - Storage key
       * @param {string} collection - Optional collection/table name
       * @returns {Promise<boolean>} Whether removal was successful
       */
      async removeItem(key, collection = 'keyValue') {
        if (!this.#isInitialized) {
          await this.initialize();
        }
        
        try {
          if (this.#storageType === 'indexedDB') {
            return new Promise((resolve, reject) => {
              const transaction = this.#db.transaction([collection], 'readwrite');
              const store = transaction.objectStore(collection);
              const request = collection === 'keyValue'
                ? store.delete({ key })
                : store.delete(key);
              
              request.onerror = () => reject(new Error(`Failed to remove ${key}`));
              request.onsuccess = () => resolve(true);
            });
          } else if (this.#storageType === 'localStorage') {
            const fullKey = collection === 'keyValue' ? key : `${collection}:${key}`;
            localStorage.removeItem(fullKey);
            return true;
          } else {
            // In-memory fallback
            const fullKey = collection === 'keyValue' ? key : `${collection}:${key}`;
            return this.#db.delete(fullKey);
          }
        } catch (error) {
          this.#eventBus.emit('storage:error', { operation: 'remove', key, error });
          return false;
        }
      }
      
      /**
       * Get all items from a collection
       * @param {string} collection - Collection name
       * @returns {Promise<Array>} Array of items
       */
      async getAllItems(collection) {
        if (!this.#isInitialized) {
          await this.initialize();
        }
        
        try {
          if (this.#storageType === 'indexedDB') {
            return new Promise((resolve, reject) => {
              const transaction = this.#db.transaction([collection], 'readonly');
              const store = transaction.objectStore(collection);
              const request = store.getAll();
              
              request.onerror = () => reject(new Error(`Failed to get all items from ${collection}`));
              request.onsuccess = () => resolve(request.result || []);
            });
          } else if (this.#storageType === 'localStorage') {
            const items = [];
            const prefix = `${collection}:`;
            
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith(prefix)) {
                const value = localStorage.getItem(key);
                if (value) {
                  items.push(JSON.parse(value));
                }
              }
            }
            
            return items;
          } else {
            // In-memory fallback
            const items = [];
            const prefix = `${collection}:`;
            
            for (const [key, value] of this.#db.entries()) {
              if (key.startsWith(prefix)) {
                items.push(value);
              }
            }
            
            return items;
          }
        } catch (error) {
          this.#eventBus.emit('storage:error', { operation: 'getAll', collection, error });
          return [];
        }
      }
      
      /**
       * Clear all data from storage
       * @returns {Promise<boolean>} Whether clear was successful
       */
      async clear() {
        if (!this.#isInitialized) {
          await this.initialize();
        }
        
        try {
          if (this.#storageType === 'indexedDB') {
            return new Promise((resolve, reject) => {
              // Clear all object stores
              const transaction = this.#db.transaction(['chats', 'preferences', 'keyValue'], 'readwrite');
              
              transaction.onerror = () => reject(new Error('Failed to clear storage'));
              transaction.oncomplete = () => resolve(true);
              
              transaction.objectStore('chats').clear();
              transaction.objectStore('preferences').clear();
              transaction.objectStore('keyValue').clear();
            });
          } else if (this.#storageType === 'localStorage') {
            localStorage.clear();
            return true;
          } else {
            // In-memory fallback
            this.#db.clear();
            return true;
          }
        } catch (error) {
          this.#eventBus.emit('storage:error', { operation: 'clear', error });
          return false;
        }
      }
      
      /**
       * Handle storage quota exceeded errors
       * @param {string} collection - Collection that caused the error
       * @returns {Promise<void>}
       */
      async #handleStorageQuotaError(collection) {
        if (collection === 'chats') {
          // Try to free up space by removing oldest chats
          const chats = await this.getAllItems('chats');
          
          if (chats.length > 10) {
            // Sort by date and keep only the 10 most recent
            const sorted = chats.sort((a, b) => {
              const dateA = new Date(a.updatedAt || a.createdAt);
              const dateB = new Date(b.updatedAt || b.createdAt);
              return dateB - dateA; // Descending (newest first)
            });
            
            // Delete oldest chats
            const toDelete = sorted.slice(10);
            for (const chat of toDelete) {
              await this.removeItem(chat.id, 'chats');
            }
          }
        }
        
        this.#eventBus.emit('storage:quotaExceeded', { collection });
      }
    }
  
    /**
     * Work Manager for handling CPU-intensive tasks in background
     */
    class WorkerManager {
      #workers = new Map();
      #eventBus;
      #isSupported;
      
      /**
       * Create a new worker manager
       * @param {EventBus} eventBus - Event bus instance
       */
      constructor(eventBus) {
        this.#eventBus = eventBus;
        this.#isSupported = typeof Worker !== 'undefined';
      }
      
      /**
       * Check if Web Workers are supported
       * @returns {boolean} Whether workers are supported
       */
      isSupported() {
        return this.#isSupported;
      }
      
      /**
       * Initialize worker manager and create workers
       * @returns {Promise<boolean>} Whether initialization was successful
       */
      async initialize() {
        if (!this.#isSupported) {
          this.#eventBus.emit('workers:unsupported');
          return false;
        }
        
        try {
          // Create markdown processing worker
          this.#createWorker('markdown', '/workers/markdown-worker.js');
          
          // Create syntax highlighting worker
          this.#createWorker('syntax', '/workers/syntax-worker.js');
          
          this.#eventBus.emit('workers:initialized');
          return true;
        } catch (error) {
          console.error('Error initializing workers:', error);
          this.#eventBus.emit('workers:error', { error });
          this.#isSupported = false;
          return false;
        }
      }
      
      /**
       * Create a new worker
       * @param {string} name - Worker name
       * @param {string} scriptPath - Path to worker script
       * @returns {Worker} The created worker
       */
      #createWorker(name, scriptPath) {
        if (!this.#isSupported) return null;
        
        try {
          const worker = new Worker(scriptPath);
          
          worker.onerror = (error) => {
            console.error(`Error in ${name} worker:`, error);
            this.#eventBus.emit('workers:error', { worker: name, error });
          };
          
          this.#workers.set(name, worker);
          return worker;
        } catch (error) {
          console.error(`Failed to create ${name} worker:`, error);
          this.#eventBus.emit('workers:error', { worker: name, error });
          return null;
        }
      }
      
      /**
       * Process Markdown content in a worker
       * @param {string} content - Markdown content to process
       * @returns {Promise<string>} Processed HTML
       */
      async processMarkdown(content) {
        if (!this.#isSupported || !this.#workers.has('markdown')) {
          // Fallback to basic processing if worker not available
          return this.#processMarkdownBasic(content);
        }
        
        return new Promise((resolve, reject) => {
          const worker = this.#workers.get('markdown');
          
          // Set up message handler for this request
          const messageHandler = (event) => {
            if (event.data.type === 'result') {
              worker.removeEventListener('message', messageHandler);
              resolve(event.data.html);
            } else if (event.data.type === 'error') {
              worker.removeEventListener('message', messageHandler);
              reject(new Error(event.data.error));
            }
          };
          
          worker.addEventListener('message', messageHandler);
          
          // Send content to worker
          worker.postMessage({
            type: 'process',
            content
          });
          
          // Set timeout for worker response
          setTimeout(() => {
            worker.removeEventListener('message', messageHandler);
            reject(new Error('Markdown processing timed out'));
          }, 5000);
        });
      }
      
      /**
       * Basic markdown processing fallback
       * @param {string} content - Markdown content
       * @returns {string} Processed HTML
       */
      #processMarkdownBasic(content) {
        if (!content) return '';
        
        // Escape HTML
        let html = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        
        // Process code blocks
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
          return `<pre${lang ? ` data-language="${lang}"` : ''}><code${lang ? ` class="language-${lang}"` : ''}>${code}</code></pre>`;
        });
        
        // Process inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Process bold and italic
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Process paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = `<p>${html}</p>`;
        
        return html;
      }
      
      /**
       * Highlight code syntax in a worker
       * @param {string} code - Code to highlight
       * @param {string} language - Language of code
       * @returns {Promise<string>} Highlighted HTML
       */
      async highlightCode(code, language) {
        if (!this.#isSupported || !this.#workers.has('syntax')) {
          return code; // Return unhighlighted code if worker not available
        }
        
        return new Promise((resolve, reject) => {
          const worker = this.#workers.get('syntax');
          
          // Set up message handler for this request
          const messageHandler = (event) => {
            if (event.data.type === 'result') {
              worker.removeEventListener('message', messageHandler);
              resolve(event.data.html);
            } else if (event.data.type === 'error') {
              worker.removeEventListener('message', messageHandler);
              reject(new Error(event.data.error));
            }
          };
          
          worker.addEventListener('message', messageHandler);
          
          // Send content to worker
          worker.postMessage({
            type: 'highlight',
            code,
            language
          });
          
          // Set timeout for worker response
          setTimeout(() => {
            worker.removeEventListener('message', messageHandler);
            reject(new Error('Syntax highlighting timed out'));
          }, 2000);
        });
      }
      
      /**
       * Terminate all workers
       */
      terminateAll() {
        for (const [name, worker] of this.#workers.entries()) {
          try {
            worker.terminate();
            this.#eventBus.emit('workers:terminated', { worker: name });
          } catch (error) {
            console.error(`Error terminating ${name} worker:`, error);
          }
        }
        
        this.#workers.clear();
      }
    }
  
    /**
     * Chat Manager
     * Handles conversation creation, loading, updating, and message sending
     */
    class ChatManager {
      #eventBus;
      #store;
      #apiClient;
      #storage;
      #workerManager;
      #autoSaveInterval = null;
      
      /**
       * Create a new chat manager
       * @param {EventBus} eventBus - Event bus instance
       * @param {Store} store - State store
       * @param {ApiClient} apiClient - API client
       * @param {StorageService} storage - Storage service
       * @param {WorkerManager} workerManager - Worker manager
       */
      constructor(eventBus, store, apiClient, storage, workerManager) {
        this.#eventBus = eventBus;
        this.#store = store;
        this.#apiClient = apiClient;
        this.#storage = storage;
        this.#workerManager = workerManager;
        
        // Set up event listeners
        this.#setupEventListeners();
      }
      
      /**
       * Set up event listeners
       */
      #setupEventListeners() {
        // Listen for UI events
        this.#eventBus.subscribe('chat:new', () => this.createNewChat());
        this.#eventBus.subscribe('chat:load', ({ chatId }) => this.loadChat(chatId));
        this.#eventBus.subscribe('chat:delete', ({ chatId }) => this.deleteChat(chatId));
        this.#eventBus.subscribe('chat:send', ({ content, options }) => this.sendMessage(content, options));
        this.#eventBus.subscribe('message:edit', ({ messageId, content }) => this.editMessage(messageId, content));
        this.#eventBus.subscribe('message:regenerate', ({ messageId }) => this.regenerateMessage(messageId));
        
        // Set up auto-save
        this.#autoSaveInterval = setInterval(() => {
          const { currentChat } = this.#store.getState();
          if (currentChat?.dirty) {
            this.#saveCurrentChat();
          }
        }, 30000); // Save every 30 seconds if dirty
      }
      
      /**
       * Initialize the chat manager
       * @returns {Promise<void>}
       */
      async initialize() {
        // Load chats from storage
        const chats = await this.#storage.getAllItems('chats') || [];
        
        // Update store with loaded chats
        this.#store.dispatch({ 
          type: 'SET_CHATS', 
          chats: chats.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt);
            const dateB = new Date(b.updatedAt || b.createdAt);
            return dateB - dateA; // Sort newest first
          })
        });
        
        // Load last active chat
        await this.loadLastActiveChat();
        
        this.#eventBus.emit('chatManager:initialized');
      }
      
      /**
       * Load the last active chat
       * @returns {Promise<void>}
       */
      async loadLastActiveChat() {
        const lastChatId = await this.#storage.getItem('lastActiveChatId');
        const { chats } = this.#store.getState();
        
        if (lastChatId && chats.find(chat => chat.id === lastChatId)) {
          await this.loadChat(lastChatId);
        } else if (chats.length > 0) {
          await this.loadChat(chats[0].id);
        } else {
          await this.createNewChat();
        }
      }
      
      /**
       * Generate a unique ID
       * @param {string} prefix - Optional prefix for the ID
       * @returns {string} Unique ID
       */
      #generateId(prefix = '') {
        return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
      }
      
      /**
       * Create a new chat
       * @returns {Promise<Object>} The new chat object
       */
      async createNewChat() {
        const newChat = {
          id: this.#generateId(),
          title: 'New Chat',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dirty: false
        };
        
        // Update store
        await this.#store.dispatch({ type: 'ADD_CHAT', chat: newChat });
        await this.#store.dispatch({ type: 'SET_CURRENT_CHAT', chatId: newChat.id });
        
        // Save to storage
        await this.#storage.setItem(newChat.id, newChat, 'chats');
        await this.#storage.setItem('lastActiveChatId', newChat.id);
        
        // Notify UI
        this.#eventBus.emit('chat:created', { chat: newChat });
        
        return newChat;
      }
      
      /**
       * Load a chat by ID
       * @param {string} chatId - ID of chat to load
       * @returns {Promise<Object|null>} The loaded chat object or null
       */
      async loadChat(chatId) {
        const { chats } = this.#store.getState();
        const chat = chats.find(c => c.id === chatId);
        
        if (!chat) {
          console.error(`Chat with ID ${chatId} not found`);
          return null;
        }
        
        // Update store
        await this.#store.dispatch({ type: 'SET_CURRENT_CHAT', chatId });
        
        // Save as last active
        await this.#storage.setItem('lastActiveChatId', chatId);
        
        // Notify UI
        this.#eventBus.emit('chat:loaded', { chat });
        
        return chat;
      }
      
      /**
       * Delete a chat by ID
       * @param {string} chatId - ID of chat to delete
       * @returns {Promise<boolean>} Whether deletion was successful
       */
      async deleteChat(chatId) {
        const { chats, currentChat } = this.#store.getState();
        
        // Remove from store
        await this.#store.dispatch({ type: 'DELETE_CHAT', chatId });
        
        // Remove from storage
        await this.#storage.removeItem(chatId, 'chats');
        
        // If the deleted chat was the current one, load another
        if (currentChat && currentChat.id === chatId) {
          const updatedChats = chats.filter(c => c.id !== chatId);
          
          if (updatedChats.length > 0) {
            await this.loadChat(updatedChats[0].id);
          } else {
            await this.createNewChat();
          }
        }
        
        // Notify UI
        this.#eventBus.emit('chat:deleted', { chatId });
        
        return true;
      }
      
      /**
       * Save current chat to storage
       * @returns {Promise<boolean>} Whether save was successful
       */
      async #saveCurrentChat() {
        const { currentChat } = this.#store.getState();
        
        if (!currentChat) return false;
        
        // Update timestamp and dirty flag
        await this.#store.dispatch({
          type: 'UPDATE_CHAT',
          chatId: currentChat.id,
          updates: { 
            updatedAt: new Date().toISOString(),
            dirty: false
          }
        });
        
        // Get updated chat from store
        const updatedChat = this.#store.getState().chats.find(c => c.id === currentChat.id);
        
        // Save to storage
        await this.#storage.setItem(updatedChat.id, updatedChat, 'chats');
        
        // Notify of save
        this.#eventBus.emit('chat:saved', { chat: updatedChat });
        
        return true;
      }
      
      /**
       * Format messages for the API
       * @param {Array} messages - Messages to format
       * @returns {Array} Formatted messages
       */
      #formatMessagesForApi(messages) {
        return messages.map(msg => {
          // Basic conversion
          const apiMsg = {
            role: msg.role === 'human' ? 'user' : 'assistant',
            content: msg.role === 'human' ? msg.content : (msg.rawContent || msg.content)
          };
          
          // Handle files for user messages
          if (msg.role === 'human' && msg.files && msg.files.length > 0) {
            // Convert to API content array format
            apiMsg.content = [
              { type: 'text', text: msg.content || 'Please analyze these files.' }
            ];
            
            // Add each file to content array
            msg.files.forEach(file => {
              if (file.type === 'image' || file.type.startsWith('image/')) {
                // For images, extract base64 data
                const imageData = typeof file.content === 'string' && file.content.includes('base64,')
                  ? file.content.split(',')[1]
                  : file.content;
                  
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
      }
      
      /**
       * Send a message and get AI response
       * @param {string} content - Message content
       * @param {Object} options - Send options
       * @returns {Promise<Object>} The assistant's response message
       */
      async sendMessage(content, options = {}) {
        const { currentChat, preferences } = this.#store.getState();
        
        if (!currentChat) {
          throw new Error('No active chat to send message to');
        }
        
        if (!this.#apiClient.isConfigured()) {
          throw new Error('API key not configured');
        }
        
        // Create user message
        const userMessage = {
          id: this.#generateId('msg'),
          role: 'human',
          content: content.trim(),
          timestamp: Date.now()
        };
        
        // Add files if provided
        if (options.files && options.files.length > 0) {
          userMessage.files = options.files;
        }
        
        // Update store with user message
        await this.#store.dispatch({ 
          type: 'ADD_MESSAGE', 
          chatId: currentChat.id, 
          message: userMessage 
        });
        
        // Mark chat as dirty
        await this.#store.dispatch({
          type: 'UPDATE_CHAT',
          chatId: currentChat.id,
          updates: { dirty: true }
        });
        
        // If this is the first message, update the chat title
        if (currentChat.messages.length === 0) {
          const title = content.length > 30
            ? content.substring(0, 30) + '...'
            : content;
            
          await this.#store.dispatch({
            type: 'UPDATE_CHAT',
            chatId: currentChat.id,
            updates: { title }
          });
        }
        
        // Save chat state
        await this.#saveCurrentChat();
        
        // Start processing state
        await this.#store.dispatch({ type: 'SET_PROCESSING', isProcessing: true });
        
        try {
          // Notify UI that we're thinking (for UI to show thinking indicator)
          this.#eventBus.emit('assistant:thinking', { messageId: userMessage.id });
          
          // Format messages for API
          const apiMessages = this.#formatMessagesForApi(currentChat.messages);
          
          // Get streaming response from API
          const response = await this.#apiClient.sendMessage(apiMessages, {
            model: preferences.model,
            temperature: preferences.temperature,
            maxTokens: preferences.maxTokens,
            streaming: true,
            thinkingEnabled: preferences.enableThinkingMode,
            thinkingBudget: preferences.thinkingBudget,
            onProgress: (progress) => {
              if (progress.type === 'content') {
                this.#eventBus.emit('assistant:streaming', {
                  content: progress.content,
                  delta: progress.delta
                });
              } else if (progress.type === 'thinking') {
                this.#eventBus.emit('assistant:thinking:progress', {
                  pulse: progress.pulse
                });
              }
            }
          });
          
          // Process Markdown in the response if possible
          let processedContent = response.content;
          if (this.#workerManager.isSupported() && preferences.enableMarkdown) {
            try {
              processedContent = await this.#workerManager.processMarkdown(response.content);
            } catch (error) {
              console.error('Error processing markdown:', error);
              // Fall back to original content
              processedContent = response.content;
            }
          }
          
          // Create assistant message
          const assistantMessage = {
            id: response.id || this.#generateId('msg'),
            role: 'assistant',
            content: processedContent,
            rawContent: response.content,
            timestamp: Date.now(),
            model: response.model
          };
          
          // Update store with assistant message
          await this.#store.dispatch({ 
            type: 'ADD_MESSAGE', 
            chatId: currentChat.id, 
            message: assistantMessage 
          });
          
          // Mark chat as dirty
          await this.#store.dispatch({
            type: 'UPDATE_CHAT',
            chatId: currentChat.id,
            updates: { dirty: true }
          });
          
          // Save chat state
          await this.#saveCurrentChat();
          
          // Notify UI that assistant finished responding
          this.#eventBus.emit('assistant:responded', { 
            message: assistantMessage 
          });
          
          return assistantMessage;
        } catch (error) {
          // Create error message
          const errorMessage = {
            id: this.#generateId('err'),
            role: 'assistant',
            content: `Error: ${error.message}. Please try again or check your settings.`,
            timestamp: Date.now(),
            isError: true
          };
          
          // Update store with error message
          await this.#store.dispatch({ 
            type: 'ADD_MESSAGE', 
            chatId: currentChat.id, 
            message: errorMessage 
          });
          
          // Mark chat as dirty
          await this.#store.dispatch({
            type: 'UPDATE_CHAT',
            chatId: currentChat.id,
            updates: { dirty: true }
          });
          
          // Save chat state
          await this.#saveCurrentChat();
          
          // Notify UI of error
          this.#eventBus.emit('assistant:error', { 
            error, 
            message: errorMessage 
          });
          
          throw error;
        } finally {
          // End processing state
          await this.#store.dispatch({ type: 'SET_PROCESSING', isProcessing: false });
        }
      }
      
      /**
       * Edit an existing message and regenerate the response
       * @param {string} messageId - ID of message to edit
       * @param {string} content - New message content
       * @returns {Promise<boolean>} Whether edit was successful
       */
      async editMessage(messageId, content) {
        const { currentChat } = this.#store.getState();
        
        if (!currentChat) {
          throw new Error('No active chat for editing');
        }
        
        // Find message index
        const messageIndex = currentChat.messages.findIndex(msg => msg.id === messageId);
        
        if (messageIndex === -1) {
          throw new Error(`Message with ID ${messageId} not found`);
        }
        
        const message = currentChat.messages[messageIndex];
        
        // Only human messages can be edited
        if (message.role !== 'human') {
          throw new Error('Only user messages can be edited');
        }
        
        // Update the message
        await this.#store.dispatch({
          type: 'UPDATE_MESSAGE',
          chatId: currentChat.id,
          messageId,
          updates: {
            content: content.trim(),
            edited: true,
            editedAt: Date.now()
          }
        });
        
        // Remove all subsequent messages
        await this.#store.dispatch({
          type: 'TRUNCATE_MESSAGES',
          chatId: currentChat.id,
          fromIndex: messageIndex + 1
        });
        
        // Mark chat as dirty
        await this.#store.dispatch({
          type: 'UPDATE_CHAT',
          chatId: currentChat.id,
          updates: { dirty: true }
        });
        
        // Save changes
        await this.#saveCurrentChat();
        
        // Notify UI of edit
        this.#eventBus.emit('message:edited', { 
          messageId, 
          content: content.trim() 
        });
        
        // Automatically send the edited message to get a new response
        await this.sendMessage(content.trim());
        
        return true;
      }
      
      /**
       * Regenerate an assistant message
       * @param {string} messageId - ID of message to regenerate
       * @returns {Promise<boolean>} Whether regeneration was successful
       */
      async regenerateMessage(messageId) {
        const { currentChat } = this.#store.getState();
        
        if (!currentChat) {
          throw new Error('No active chat for regeneration');
        }
        
        // Find message index
        const messageIndex = currentChat.messages.findIndex(msg => msg.id === messageId);
        
        if (messageIndex === -1) {
          throw new Error(`Message with ID ${messageId} not found`);
        }
        
        const message = currentChat.messages[messageIndex];
        
        // Only assistant messages can be regenerated
        if (message.role !== 'assistant') {
          throw new Error('Only assistant messages can be regenerated');
        }
        
        // Find the preceding user message
        let userMessageIndex = messageIndex - 1;
        while (userMessageIndex >= 0) {
          if (currentChat.messages[userMessageIndex].role === 'human') {
            break;
          }
          userMessageIndex--;
        }
        
        if (userMessageIndex < 0) {
          throw new Error('No user message found to regenerate from');
        }
        
        const userMessage = currentChat.messages[userMessageIndex];
        
        // Remove this and all subsequent messages
        await this.#store.dispatch({
          type: 'TRUNCATE_MESSAGES',
          chatId: currentChat.id,
          fromIndex: messageIndex
        });
        
        // Mark chat as dirty
        await this.#store.dispatch({
          type: 'UPDATE_CHAT',
          chatId: currentChat.id,
          updates: { dirty: true }
        });
        
        // Save changes
        await this.#saveCurrentChat();
        
        // Notify UI
        this.#eventBus.emit('message:regenerating', { 
          messageId, 
          userMessageId: userMessage.id 
        });
        
        // Send the user message again to get a new response
        await this.sendMessage(userMessage.content, {
          files: userMessage.files
        });
        
        return true;
      }
      
      /**
       * Clean up resources
       */
      cleanup() {
        if (this.#autoSaveInterval) {
          clearInterval(this.#autoSaveInterval);
          this.#autoSaveInterval = null;
        }
        
        // Save any pending changes
        const { currentChat } = this.#store.getState();
        if (currentChat?.dirty) {
          this.#saveCurrentChat();
        }
      }
    }
  
    /**
     * Preferences Manager
     * Manages user preferences and settings
     */
    class PreferencesManager {
      #eventBus;
      #store;
      #storage;
      #defaultPreferences = {
        apiKey: '',
        model: 'claude-3-7-sonnet-20250219',
        temperature: 0.7,
        maxTokens: 4096,
        thinkingBudget: 10240,
        enableThinkingMode: true,
        theme: 'system',
        messagesToKeep: 100,
        autoScroll: true,
        enableSounds: false,
        enableMarkdown: true,
        enableSyntaxHighlighting: true,
        preferredLanguage: 'en'
      };
      
      /**
       * Create a new preferences manager
       * @param {EventBus} eventBus - Event bus instance
       * @param {Store} store - State store
       * @param {StorageService} storage - Storage service
       */
      constructor(eventBus, store, storage) {
        this.#eventBus = eventBus;
        this.#store = store;
        this.#storage = storage;
      }
      
      /**
       * Initialize preferences
       * @returns {Promise<Object>} Loaded preferences
       */
      async initialize() {
        // Load preferences from storage
        const savedPreferences = await this.#storage.getItem('preferences') || {};
        
        // Merge with defaults
        const preferences = {
          ...this.#defaultPreferences,
          ...savedPreferences
        };
        
        // Update store
        this.#store.dispatch({ type: 'SET_PREFERENCES', preferences });
        
        // Apply initial preferences
        this.applyPreferences(preferences);
        
        // Set up event listeners
        this.#eventBus.subscribe('preferences:update', ({ key, value }) => {
          this.setPreference(key, value);
        });
        
        this.#eventBus.subscribe('preferences:reset', () => {
          this.resetPreferences();
        });
        
        this.#eventBus.emit('preferences:initialized', { preferences });
        
        return preferences;
      }
      
      /**
       * Apply preferences to the application
       * @param {Object} preferences - Preferences to apply
       */
      applyPreferences(preferences) {
        // Apply theme
        this.#applyTheme(preferences.theme);
        
        // Apply other visual preferences
        if (preferences.enableMarkdown) {
          document.body.classList.remove('markdown-disabled');
        } else {
          document.body.classList.add('markdown-disabled');
        }
        
        if (preferences.enableSyntaxHighlighting) {
          document.body.classList.remove('syntax-disabled');
        } else {
          document.body.classList.add('syntax-disabled');
        }
        
        this.#eventBus.emit('preferences:applied', { preferences });
      }
      
      /**
       * Apply theme preference
       * @param {string} theme - Theme preference (light, dark, or system)
       */
      #applyTheme(theme) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark);
        
        if (shouldUseDark) {
          document.body.classList.add('dark-theme');
        } else {
          document.body.classList.remove('dark-theme');
        }
      }
      
      /**
       * Get all preferences
       * @returns {Object} Current preferences
       */
      getPreferences() {
        return this.#store.getState().preferences;
      }
      
      /**
       * Get a specific preference
       * @param {string} key - Preference key
       * @param {any} defaultValue - Default value if preference not found
       * @returns {any} Preference value
       */
      getPreference(key, defaultValue) {
        const { preferences } = this.#store.getState();
        return key in preferences ? preferences[key] : defaultValue;
      }
      
      /**
       * Set a preference
       * @param {string} key - Preference key
       * @param {any} value - Preference value
       * @returns {Promise<boolean>} Whether set was successful
       */
      async setPreference(key, value) {
        const { preferences } = this.#store.getState();
        
        if (!(key in preferences) && !(key in this.#defaultPreferences)) {
          console.warn(`Setting unknown preference: ${key}`);
        }
        
        // Update store
        this.#store.dispatch({ 
          type: 'UPDATE_PREFERENCES', 
          updates: { [key]: value } 
        });
        
        // Get updated preferences
        const updatedPreferences = this.#store.getState().preferences;
        
        // Save to storage
        await this.#storage.setItem('preferences', updatedPreferences);
        
        // Apply any visual changes
        this.applyPreferences(updatedPreferences);
        
        this.#eventBus.emit('preferences:changed', { 
          key, 
          value, 
          preferences: updatedPreferences 
        });
        
        return true;
      }
      
      /**
       * Update multiple preferences at once
       * @param {Object} updates - Object with preference updates
       * @returns {Promise<boolean>} Whether update was successful
       */
      async updatePreferences(updates) {
        // Update store
        this.#store.dispatch({ 
          type: 'UPDATE_PREFERENCES', 
          updates 
        });
        
        // Get updated preferences
        const updatedPreferences = this.#store.getState().preferences;
        
        // Save to storage
        await this.#storage.setItem('preferences', updatedPreferences);
        
        // Apply any visual changes
        this.applyPreferences(updatedPreferences);
        
        this.#eventBus.emit('preferences:bulkChanged', { 
          updates, 
          preferences: updatedPreferences 
        });
        
        return true;
      }
      
      /**
       * Reset preferences to defaults
       * @returns {Promise<boolean>} Whether reset was successful
       */
      async resetPreferences() {
        const apiKey = this.getPreference('apiKey', '');
        
        // Update store with defaults (keeping API key)
        this.#store.dispatch({ 
          type: 'SET_PREFERENCES', 
          preferences: {
            ...this.#defaultPreferences,
            apiKey
          }
        });
        
        // Get updated preferences
        const updatedPreferences = this.#store.getState().preferences;
        
        // Save to storage
        await this.#storage.setItem('preferences', updatedPreferences);
        
        // Apply defaults
        this.applyPreferences(updatedPreferences);
        
        this.#eventBus.emit('preferences:reset', { 
          preferences: updatedPreferences 
        });
        
        return true;
      }
    }
  
    /**
     * Network Monitor
     * Monitors network status and manages offline functionality
     */
    class NetworkMonitor {
      #eventBus;
      #store;
      #isOnline = navigator.onLine;
      #checkInterval = null;
      #pendingRequests = new Map();
      
      /**
       * Create a new network monitor
       * @param {EventBus} eventBus - Event bus instance
       * @param {Store} store - State store
       */
      constructor(eventBus, store) {
        this.#eventBus = eventBus;
        this.#store = store;
      }
      
      /**
       * Initialize the network monitor
       */
      initialize() {
        // Set initial state
        this.#store.dispatch({ 
          type: 'SET_NETWORK_STATUS', 
          status: this.#isOnline ? 'online' : 'offline' 
        });
        
        // Set up event listeners
        window.addEventListener('online', () => this.#handleOnline());
        window.addEventListener('offline', () => this.#handleOffline());
        
        // Set up periodic connection check
        this.#startConnectionCheck();
        
        this.#eventBus.emit('network:initialized', { 
          isOnline: this.#isOnline 
        });
      }
      
      /**
       * Start periodic connection check
       */
      #startConnectionCheck() {
        // Clear any existing interval
        if (this.#checkInterval) {
          clearInterval(this.#checkInterval);
        }
        
        // Check connection every 30 seconds
        this.#checkInterval = setInterval(() => {
          this.checkConnectivity();
        }, 30000);
      }
      
      /**
       * Handle going online
       */
      #handleOnline() {
        const wasOffline = !this.#isOnline;
        this.#isOnline = true;
        
        this.#store.dispatch({ type: 'SET_NETWORK_STATUS', status: 'online' });
        this.#eventBus.emit('network:online');
        
        // If we were previously offline, process any pending requests
        if (wasOffline) {
          this.processPendingRequests();
        }
      }
      
      /**
       * Handle going offline
       */
      #handleOffline() {
        this.#isOnline = false;
        this.#store.dispatch({ type: 'SET_NETWORK_STATUS', status: 'offline' });
        this.#eventBus.emit('network:offline');
      }
      
      /**
       * Actively check connectivity by making a network request
       * @returns {Promise<boolean>} Whether device is online
       */
      async checkConnectivity() {
        try {
          // Try to fetch a small resource to verify connection
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch('/ping.json', {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          const online = response.ok;
          
          if (online !== this.#isOnline) {
            if (online) {
              this.#handleOnline();
            } else {
              this.#handleOffline();
            }
          }
          
          return online;
        } catch (error) {
          // If fetch fails, we're likely offline
          if (this.#isOnline) {
            this.#handleOffline();
          }
          return false;
        }
      }
      
      /**
       * Queue a request to be processed when back online
       * @param {string} id - Request ID
       * @param {Function} handler - Function to call when online
       */
      queueRequest(id, handler) {
        this.#pendingRequests.set(id, handler);
        this.#store.dispatch({ 
          type: 'ADD_PENDING_REQUEST', 
          id 
        });
        
        this.#eventBus.emit('network:requestQueued', { id });
      }
      
      /**
       * Process all pending requests
       * @returns {Promise<Array>} Results of processing
       */
      async processPendingRequests() {
        const results = [];
        
        for (const [id, handler] of this.#pendingRequests.entries()) {
          try {
            this.#eventBus.emit('network:processingRequest', { id });
            const result = await handler();
            results.push({ id, success: true, result });
            this.#eventBus.emit('network:requestProcessed', { id, success: true });
          } catch (error) {
            results.push({ id, success: false, error });
            this.#eventBus.emit('network:requestFailed', { id, error });
          } finally {
            this.#pendingRequests.delete(id);
            this.#store.dispatch({ type: 'REMOVE_PENDING_REQUEST', id });
          }
        }
        
        return results;
      }
      
      /**
       * Check if device is currently online
       * @returns {boolean} Whether device is online
       */
      isOnline() {
        return this.#isOnline;
      }
      
      /**
       * Clean up resources used by the network monitor
       */
      cleanup() {
        if (this.#checkInterval) {
          clearInterval(this.#checkInterval);
          this.#checkInterval = null;
        }
        
        window.removeEventListener('online', this.#handleOnline);
        window.removeEventListener('offline', this.#handleOffline);
      }
    }
  
    /**
     * Error Boundary
     * Handles application errors and provides recovery options
     */
    class ErrorBoundary {
      #eventBus;
      #store;
      #unhandledErrors = 0;
      #errorResetTimeout = null;
      
      /**
       * Create a new error boundary
       * @param {EventBus} eventBus - Event bus instance
       * @param {Store} store - State store
       */
      constructor(eventBus, store) {
        this.#eventBus = eventBus;
        this.#store = store;
      }
      
      /**
       * Initialize error boundary
       */
      initialize() {
        // Set up global error handlers
        window.addEventListener('error', (event) => {
          this.handleError(event.error, 'window.error');
          // Don't prevent default to allow browser's default error handling
        });
        
        window.addEventListener('unhandledrejection', (event) => {
          this.handleError(event.reason, 'promise.rejection');
          // Don't prevent default to allow browser's default error handling
        });
        
        // Listen for reported errors from components
        this.#eventBus.subscribe('error:report', ({ error, context }) => {
          this.handleError(error, context);
        });
        
        // Reset unhandled error count after 30 seconds of no errors
        this.#resetErrorCountAfterDelay();
      }
      
      /**
       * Handle an application error
       * @param {Error} error - The error that occurred
       * @param {string} context - Where the error occurred
       */
      handleError(error, context = 'unknown') {
        // Increment unhandled error count
        this.#unhandledErrors++;
        
        // Reset the error timeout
        this.#resetErrorCountAfterDelay();
        
        // Format error for storing
        const formattedError = {
          message: error?.message || 'Unknown error',
          stack: error?.stack,
          context,
          timestamp: Date.now()
        };
        
        // Log error to console
        console.error(`Error in ${context}:`, error);
        
        // Update store with error
        this.#store.dispatch({ 
          type: 'ADD_ERROR', 
          error: formattedError 
        });
        
        // Emit error event
        this.#eventBus.emit('error:occurred', {
          error: formattedError,
          count: this.#unhandledErrors
        });
        
        // Check for critical error state
        if (this.#unhandledErrors >= 5) {
          this.enterRecoveryMode();
        }
      }
      
      /**
       * Reset error count after delay
       */
      #resetErrorCountAfterDelay() {
        // Clear any existing timeout
        if (this.#errorResetTimeout) {
          clearTimeout(this.#errorResetTimeout);
        }
        
        // Set new timeout
        this.#errorResetTimeout = setTimeout(() => {
          if (this.#unhandledErrors > 0) {
            this.#unhandledErrors = 0;
            this.#eventBus.emit('error:countReset');
          }
        }, 30000);
      }
      
      /**
       * Enter recovery mode when too many errors occur
       */
      enterRecoveryMode() {
        this.#eventBus.emit('error:recoveryMode');
        
        // Show recovery UI
        this.showRecoveryUI();
      }
      
      /**
       * Show recovery UI with options to reset or reload
       */
      showRecoveryUI() {
        // Get current state for debugging
        const state = this.#store.getState();
        const errors = state.errors || [];
        
        // Create recovery UI
        const recoveryEl = document.createElement('div');
        recoveryEl.className = 'error-recovery-screen';
        recoveryEl.innerHTML = `
          <div class="error-recovery-container">
            <h2>Something went wrong</h2>
            <p>The application encountered multiple errors. Please try one of the following options:</p>
            <div class="recovery-actions">
              <button id="error-reload" class="btn-primary">Reload Application</button>
              <button id="error-reset-state" class="btn-secondary">Reset Application State</button>
              <button id="error-show-details" class="btn-text">Show Error Details</button>
            </div>
            <div class="error-details" style="display: none;">
              <h3>Error Details</h3>
              <pre>${errors.slice(-3).map(e => `[${new Date(e.timestamp).toLocaleString()}] ${e.context}: ${e.message}`).join('\n\n')}</pre>
            </div>
          </div>
        `;
        
        // Add to document
        document.body.appendChild(recoveryEl);
        
        // Set up action buttons
        document.getElementById('error-reload').addEventListener('click', () => {
          window.location.reload();
        });
        
        document.getElementById('error-reset-state').addEventListener('click', () => {
          this.resetApplicationState().then(() => {
            window.location.reload();
          });
        });
        
        document.getElementById('error-show-details').addEventListener('click', () => {
          const detailsEl = recoveryEl.querySelector('.error-details');
          const buttonEl = document.getElementById('error-show-details');
          
          if (detailsEl.style.display === 'none') {
            detailsEl.style.display = 'block';
            buttonEl.textContent = 'Hide Error Details';
          } else {
            detailsEl.style.display = 'none';
            buttonEl.textContent = 'Show Error Details';
          }
        });
      }
      
      /**
       * Reset application state
       * @returns {Promise<boolean>} Whether reset was successful
       */
      async resetApplicationState() {
        try {
          // Get reference to storage
          const storage = window.app?.storage;
          
          if (storage) {
            // Only clear app data, not preferences
            const preferences = await storage.getItem('preferences');
            await storage.clear();
            
            // Restore preferences
            if (preferences) {
              await storage.setItem('preferences', preferences);
            }
          } else {
            // Fallback to clearing localStorage
            localStorage.clear();
          }
          
          return true;
        } catch (error) {
          console.error('Failed to reset application state:', error);
          return false;
        }
      }
    }
  
    /**
     * State reducers
     * Pure functions that calculate new state from actions
     */
    const reducers = {
      // Set full list of chats
      SET_CHATS: (state, { chats }) => ({
        ...state,
        chats: [...chats]
      }),
      
      // Add a new chat
      ADD_CHAT: (state, { chat }) => ({
        ...state,
        chats: [chat, ...state.chats]
      }),
      
      // Update chat properties
      UPDATE_CHAT: (state, { chatId, updates }) => ({
        ...state,
        chats: state.chats.map(chat => 
          chat.id === chatId ? { ...chat, ...updates } : chat
        ),
        currentChat: state.currentChat?.id === chatId
          ? { ...state.currentChat, ...updates }
          : state.currentChat
      }),
      
      // Delete a chat
      DELETE_CHAT: (state, { chatId }) => ({
        ...state,
        chats: state.chats.filter(chat => chat.id !== chatId),
        currentChat: state.currentChat?.id === chatId
          ? null
          : state.currentChat
      }),
      
      // Set current chat
      SET_CURRENT_CHAT: (state, { chatId }) => ({
        ...state,
        currentChat: state.chats.find(chat => chat.id === chatId) || null
      }),
      
      // Add a message to a chat
      ADD_MESSAGE: (state, { chatId, message }) => {
        // Find chat to update
        const chatToUpdate = state.chats.find(chat => chat.id === chatId);
        
        if (!chatToUpdate) return state;
        
        // Create updated chat with new message
        const updatedChat = {
          ...chatToUpdate,
          messages: [...(chatToUpdate.messages || []), message]
        };
        
        return {
          ...state,
          chats: state.chats.map(chat => 
            chat.id === chatId ? updatedChat : chat
          ),
          currentChat: state.currentChat?.id === chatId
            ? updatedChat
            : state.currentChat
        };
      },
      
      // Update a message
      UPDATE_MESSAGE: (state, { chatId, messageId, updates }) => {
        // Find chat to update
        const chatToUpdate = state.chats.find(chat => chat.id === chatId);
        
        if (!chatToUpdate) return state;
        
        // Update the message in the chat
        const updatedMessages = chatToUpdate.messages.map(msg => 
          msg.id === messageId ? { ...msg, ...updates } : msg
        );
        
        // Create updated chat with modified message
        const updatedChat = {
          ...chatToUpdate,
          messages: updatedMessages
        };
        
        return {
          ...state,
          chats: state.chats.map(chat => 
            chat.id === chatId ? updatedChat : chat
          ),
          currentChat: state.currentChat?.id === chatId
            ? updatedChat
            : state.currentChat
        };
      },
      
      // Truncate messages from a specific index
      TRUNCATE_MESSAGES: (state, { chatId, fromIndex }) => {
        // Find chat to update
        const chatToUpdate = state.chats.find(chat => chat.id === chatId);
        
        if (!chatToUpdate) return state;
        
        // Truncate messages
        const updatedMessages = chatToUpdate.messages.slice(0, fromIndex);
        
        // Create updated chat with truncated messages
        const updatedChat = {
          ...chatToUpdate,
          messages: updatedMessages
        };
        
        return {
          ...state,
          chats: state.chats.map(chat => 
            chat.id === chatId ? updatedChat : chat
          ),
          currentChat: state.currentChat?.id === chatId
            ? updatedChat
            : state.currentChat
        };
      },
      
      // Set processing state
      SET_PROCESSING: (state, { isProcessing }) => ({
        ...state,
        isProcessing
      }),
      
      // Set network status
      SET_NETWORK_STATUS: (state, { status }) => ({
        ...state,
        networkStatus: status
      }),
      
      // Add pending request
      ADD_PENDING_REQUEST: (state, { id }) => ({
        ...state,
        pendingRequests: [...state.pendingRequests, id]
      }),
      
      // Remove pending request
      REMOVE_PENDING_REQUEST: (state, { id }) => ({
        ...state,
        pendingRequests: state.pendingRequests.filter(reqId => reqId !== id)
      }),
      
      // Set preferences
      SET_PREFERENCES: (state, { preferences }) => ({
        ...state,
        preferences
      }),
      
      // Update specific preferences
      UPDATE_PREFERENCES: (state, { updates }) => ({
        ...state,
        preferences: {
          ...state.preferences,
          ...updates
        }
      }),
      
      // Add error
      ADD_ERROR: (state, { error }) => ({
        ...state,
        errors: [...(state.errors || []), error],
        lastError: error
      }),
      
      // Clear errors
      CLEAR_ERRORS: (state) => ({
        ...state,
        errors: [],
        lastError: null
      }),
      
      // Attach files
      SET_ATTACHED_FILES: (state, { files }) => ({
        ...state,
        attachedFiles: files
      }),
      
      // Clear attached files
      CLEAR_ATTACHED_FILES: (state) => ({
        ...state,
        attachedFiles: []
      })
    };
  
    /**
     * Initial application state
     */
    const initialState = {
      // User chats
      chats: [],
      currentChat: null,
      
      // UI state
      isProcessing: false,
      attachedFiles: [],
      networkStatus: 'online',
      pendingRequests: [],
      
      // User preferences
      preferences: {
        apiKey: '',
        model: 'claude-3-7-sonnet-20250219',
        temperature: 0.7,
        maxTokens: 4096,
        thinkingBudget: 10240,
        enableThinkingMode: true,
        theme: 'system',
        messagesToKeep: 100,
        autoScroll: true,
        enableSounds: false,
        enableMarkdown: true,
        enableSyntaxHighlighting: true,
        preferredLanguage: 'en'
      },
      
      // Error tracking
      errors: [],
      lastError: null
    };
  
    /**
     * Middleware functions for processing actions before they reach reducers
     */
    const middleware = [
      // Logging middleware
      (action, getState) => {
        if (typeof window !== 'undefined' && window.DEBUG_ENABLED) {
          console.log('Action:', action.type, action);
        }
        return action;
      },
      
      // Timestamp middleware
      (action) => {
        return {
          ...action,
          timestamp: Date.now()
        };
      }
    ];
  
    /**
     * Main Application Class
     * Orchestrates all components and manages the application lifecycle
     */
    class App {
      #eventBus;
      #store;
      #apiClient;
      #storage;
      #chatManager;
      #preferencesManager;
      #workerManager;
      #networkMonitor;
      #errorBoundary;
      #isInitialized = false;
      
      /**
       * Create main application instance
       */
      constructor() {
        console.log('Creating Claude Chat application instance');
      }
      
      /**
       * Initialize the application
       * @returns {Promise<void>}
       */
      async initialize() {
        try {
          console.time('App Initialization');
          
          // Create core services
          this.#eventBus = new EventBus();
          this.#store = new Store(initialState, reducers, middleware, this.#eventBus);
          this.#apiClient = new ApiClient(this.#eventBus);
          this.#storage = new StorageService(this.#eventBus);
          this.#workerManager = new WorkerManager(this.#eventBus);
          this.#networkMonitor = new NetworkMonitor(this.#eventBus, this.#store);
          this.#errorBoundary = new ErrorBoundary(this.#eventBus, this.#store);
          this.#preferencesManager = new PreferencesManager(this.#eventBus, this.#store, this.#storage);
          this.#chatManager = new ChatManager(this.#eventBus, this.#store, this.#apiClient, this.#storage, this.#workerManager);
          
          // Initialize error boundary first
          this.#errorBoundary.initialize();
          
          // Initialize storage
          await this.#storage.initialize();
          
          // Initialize and apply preferences
          await this.#preferencesManager.initialize();
          
          // Initialize workers
          await this.#workerManager.initialize();
          
          // Initialize network monitor
          this.#networkMonitor.initialize();
          
          // Initialize chat manager
          await this.#chatManager.initialize();
          
          // Connect to UI components
          this.#connectToUI();
          
          // Set initialization flag
          this.#isInitialized = true;
          
          // Log completion
          console.timeEnd('App Initialization');
          
          // Notify that app is ready
          this.#eventBus.emit('app:ready');
          
          return true;
        } catch (error) {
          console.error('Failed to initialize application:', error);
          this.#errorBoundary.handleError(error, 'app:initialize');
          
          // Show fatal error UI
          this.#showFatalErrorUI(error);
          
          return false;
        }
      }
      
      /**
       * Connect to UI components using the event bus
       */
      #connectToUI() {
        // Listen for UI lifecycle events
        this.#eventBus.subscribe('ui:ready', () => {
          // Update UI with current state
          this.refreshUI();
        });
        
        // Publish state changes to UI
        this.#store.subscribe((state) => {
          this.#eventBus.emit('state:updated', { state });
        });
        
        // Listen for API key changes
        this.#store.subscribe('preferences.apiKey', (apiKey) => {
          if (apiKey) {
            this.#apiClient.setApiKey(apiKey);
          }
        });
      }
      
      /**
       * Refresh the UI with current state
       */
      refreshUI() {
        const state = this.#store.getState();
        
        // Emit events to update UI components
        this.#eventBus.emit('chats:updated', { chats: state.chats });
        
        if (state.currentChat) {
          this.#eventBus.emit('currentChat:updated', { 
            chat: state.currentChat 
          });
        }
        
        this.#eventBus.emit('preferences:updated', { 
          preferences: state.preferences 
        });
      }
      
      /**
       * Show fatal error UI when initialization fails
       * @param {Error} error - The error that caused initialization to fail
       */
      #showFatalErrorUI(error) {
        // Create error UI
        const errorUI = document.createElement('div');
        errorUI.className = 'fatal-error-screen';
        errorUI.innerHTML = `
          <div class="fatal-error-container">
            <h2>Unable to Start Application</h2>
            <p>We encountered a problem while starting Claude Chat.</p>
            <div class="error-message">
              <p>${error.message || 'Unknown error'}</p>
            </div>
            <div class="recovery-actions">
              <button id="error-reload" class="btn-primary">Reload Application</button>
              <button id="error-reset" class="btn-secondary">Reset and Reload</button>
            </div>
            <div class="error-details">
              <details>
                <summary>Error Details</summary>
                <pre>${error.stack || 'No stack trace available'}</pre>
              </details>
            </div>
          </div>
        `;
        
        // Add to document
        document.body.appendChild(errorUI);
        
        // Set up action buttons
        document.getElementById('error-reload').addEventListener('click', () => {
          window.location.reload();
        });
        
        document.getElementById('error-reset').addEventListener('click', async () => {
          try {
            // Try to clear storage
            if (this.#storage && this.#storage.clear) {
              await this.#storage.clear();
            } else {
              localStorage.clear();
            }
          } catch (e) {
            console.error('Failed to clear storage:', e);
          }
          
          window.location.reload();
        });
      }
      
      /**
       * Cleanup resources when app is closing
       */
      cleanup() {
        if (this.#networkMonitor) {
          this.#networkMonitor.cleanup();
        }
        
        if (this.#workerManager) {
          this.#workerManager.terminateAll();
        }
        
        if (this.#chatManager) {
          this.#chatManager.cleanup();
        }
        
        this.#eventBus.emit('app:cleanup');
      }
      
      /**
       * Get the event bus instance
       * @returns {EventBus} The application event bus
       */
      getEventBus() {
        return this.#eventBus;
      }
      
      /**
       * Get the state store instance
       * @returns {Store} The application state store
       */
      getStore() {
        return this.#store;
      }
      
      /**
       * Expose public methods for external components
       * @returns {Object} Public API
       */
      getPublicAPI() {
        return {
          // Core methods
          initialize: this.initialize.bind(this),
          cleanup: this.cleanup.bind(this),
          
          // Event methods
          on: (event, callback) => this.#eventBus.subscribe(event, callback),
          once: (event, callback) => this.#eventBus.once(event, callback),
          emit: (event, data) => this.#eventBus.emit(event, data),
          
          // State methods
          getState: () => this.#store.getState(),
          dispatch: (action) => this.#store.dispatch(action),
          subscribe: (selector, callback) => this.#store.subscribe(selector, callback),
          
          // API methods
          sendMessage: (content, options) => this.#chatManager.sendMessage(content, options),
          
          // Chat methods
          createChat: () => this.#chatManager.createNewChat(),
          loadChat: (chatId) => this.#chatManager.loadChat(chatId),
          deleteChat: (chatId) => this.#chatManager.deleteChat(chatId),
          
          // Preference methods
          getPreferences: () => this.#preferencesManager.getPreferences(),
          setPreference: (key, value) => this.#preferencesManager.setPreference(key, value),
          resetPreferences: () => this.#preferencesManager.resetPreferences(),
          
          // Network methods
          isOnline: () => this.#networkMonitor.isOnline(),
          
          // Status
          isInitialized: () => this.#isInitialized
        };
      }
    }
  
    // Create and initialize application instance
    const app = new App();
    let appPublicAPI;
    
    // Initialize the application when DOM is ready
    document.addEventListener('DOMContentLoaded', async () => {
      try {
        await app.initialize();
        appPublicAPI = app.getPublicAPI();
        
        // Expose public API to window for external access
        window.claudeApp = appPublicAPI;
        
        // Handle cleanup on page unload
        window.addEventListener('beforeunload', () => {
          app.cleanup();
        });
      } catch (error) {
        console.error('Failed to start application:', error);
        
        // Show basic error message
        document.body.innerHTML = `
          <div class="startup-error">
            <h2>Application Start Failed</h2>
            <p>${error.message || 'Unknown error'}</p>
            <button onclick="window.location.reload()">Reload Application</button>
          </div>
        `;
      }
    });
    
    // Return public API for module exports
    return appPublicAPI;
  })();