/**
 * Advanced Settings Management System for Claude Chat
 * 
 * Features:
 * - Schema-based configuration with JSON Schema validation
 * - Multi-tier encrypted storage with automatic sync
 * - Seamless migration between versions with history tracking
 * - Biometric authentication for sensitive settings
 * - AI-powered configuration recommendations
 * - Reactive UI binding with change detection
 * - Import/export with cryptographic signatures
 * - Advanced preset management with context awareness
 * - Sandboxed storage with origin private file system
 * - Performance optimizations for large configuration sets
 * 
 * @module settings
 * @version 3.1.0
 * @copyright Claude Chat Team 2025
 */

// Using modern ES module pattern for better tree-shaking and code splitting
const SettingsSystem = (() => {
    'use strict';
    
    // ===============================================================
    // Constants & Configuration
    // ===============================================================
    
    // Storage keys with namespaced versioning to avoid conflicts
    const STORAGE_KEYS = {
      SETTINGS: 'claude:settings:v3:data',
      SENSITIVE: 'claude:settings:v3:sensitive',
      VERSION: 'claude:settings:v3:version',
      HISTORY: 'claude:settings:v3:history',
      SYNC_STATE: 'claude:settings:v3:sync',
      PRESETS: 'claude:settings:v3:presets',
      USAGE_METRICS: 'claude:settings:v3:metrics'
    };
    
    // Available Claude API models (as of March 2025)
    const AVAILABLE_MODELS = [
      { value: 'claude-3-7-opus-20250219', label: 'Claude 3.7 Opus', description: 'Most capable Claude model with extended reasoning and enhanced ability to follow nuanced instructions' },
      { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', description: 'Balanced performance and efficiency for most tasks' },
      { value: 'claude-3-7-haiku-20250219', label: 'Claude 3.7 Haiku', description: 'Fast responses, optimized for chat and straightforward tasks' },
      { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', description: 'Improved reasoning and instruction following over Claude 3 Sonnet' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', description: 'High capability model for complex tasks' },
      { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', description: 'Balanced model for most use cases' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', description: 'Fast, efficient model for simple tasks' }
    ];
    
    // Settings schema with validation, defaults, and metadata
    const SETTINGS_SCHEMA = {
      apiKey: {
        type: 'string',
        default: '',
        sensitive: true,
        credentialStorage: true, // Use Credential Management API when available
        validate: value => typeof value === 'string',
        sanitize: value => value?.trim() || '',
        category: 'connection',
        label: 'API Key',
        description: 'Your Anthropic API key for accessing Claude',
        order: 0,
        required: true
      },
      model: {
        type: 'string',
        default: 'claude-3-7-sonnet-20250219',
        options: AVAILABLE_MODELS,
        validate: value => AVAILABLE_MODELS.some(model => model.value === value),
        category: 'ai',
        label: 'AI Model',
        description: 'The Claude model to use for generating responses',
        order: 0
      },
      temperature: {
        type: 'number',
        default: 0.7,
        min: 0,
        max: 1.0,
        step: 0.1,
        validate: value => typeof value === 'number' && value >= 0 && value <= 1,
        sanitize: value => Math.min(1, Math.max(0, parseFloat(value) || 0)),
        category: 'ai',
        label: 'Temperature',
        description: 'Controls randomness: lower values are more focused, higher values more creative',
        order: 1
      },
      topP: {
        type: 'number',
        default: 0.9,
        min: 0,
        max: 1.0,
        step: 0.05,
        validate: value => typeof value === 'number' && value >= 0 && value <= 1,
        sanitize: value => Math.min(1, Math.max(0, parseFloat(value) || 0)),
        category: 'ai',
        label: 'Top P',
        description: 'Controls diversity via nucleus sampling: 1.0 considers all tokens, lower values restrict to more likely tokens',
        order: 2,
        advanced: true
      },
      topK: {
        type: 'number',
        default: 40,
        min: 1,
        max: 100,
        step: 1,
        validate: value => typeof value === 'number' && value >= 1 && value <= 100,
        sanitize: value => Math.min(100, Math.max(1, parseInt(value) || 40)),
        category: 'ai',
        label: 'Top K',
        description: 'Limits token selection to the K most likely tokens. Lower values increase determinism.',
        order: 3,
        advanced: true
      },
      thinkingEnabled: {
        type: 'boolean',
        default: false,
        validate: value => typeof value === 'boolean',
        category: 'ai',
        label: 'Enable Thinking Mode',
        description: 'Shows Claude\'s reasoning process before delivering final answers',
        order: 4
      },
      thinkingBudget: {
        type: 'number',
        default: 10240,
        min: 1024,
        max: 120000,
        step: 1024,
        validate: value => typeof value === 'number' && value >= 1024,
        sanitize: value => Math.max(1024, parseInt(value) || 1024),
        category: 'ai',
        label: 'Thinking Budget',
        description: 'Maximum tokens allocated for Claude\'s thinking process',
        order: 5,
        conditionalDisplay: settings => settings.thinkingEnabled === true
      },
      maxTokens: {
        type: 'number',
        default: 4096,
        min: 1024,
        max: 30000,
        step: 1024,
        validate: value => typeof value === 'number' && value >= 1024,
        sanitize: value => Math.max(1024, parseInt(value) || 1024),
        category: 'ai',
        label: 'Max Tokens',
        description: 'Maximum number of tokens in Claude\'s response',
        order: 6
      },
      frequencyPenalty: {
        type: 'number',
        default: 0.0,
        min: 0.0,
        max: 2.0,
        step: 0.1,
        validate: value => typeof value === 'number' && value >= 0 && value <= 2,
        sanitize: value => Math.min(2, Math.max(0, parseFloat(value) || 0)),
        category: 'ai',
        label: 'Frequency Penalty',
        description: 'Reduces repetition by penalizing tokens based on their frequency in the text so far',
        order: 7,
        advanced: true
      },
      presencePenalty: {
        type: 'number',
        default: 0.0,
        min: 0.0,
        max: 2.0,
        step: 0.1,
        validate: value => typeof value === 'number' && value >= 0 && value <= 2,
        sanitize: value => Math.min(2, Math.max(0, parseFloat(value) || 0)),
        category: 'ai',
        label: 'Presence Penalty',
        description: 'Reduces repetition by penalizing tokens that have appeared in the text at all',
        order: 8,
        advanced: true
      },
      streaming: {
        type: 'boolean',
        default: true,
        validate: value => typeof value === 'boolean',
        category: 'interface',
        label: 'Streaming Responses',
        description: 'Show responses as Claude generates them',
        order: 0
      },
      typingEmulation: {
        type: 'boolean',
        default: false,
        validate: value => typeof value === 'boolean',
        category: 'interface',
        label: 'Typing Emulation',
        description: 'Emulate typing effect for responses (reduces perceived latency)',
        order: 1,
        conditionalDisplay: settings => settings.streaming === true
      },
      typingSpeed: {
        type: 'number',
        default: 30,
        min: 10,
        max: 100,
        step: 5,
        validate: value => typeof value === 'number' && value >= 10 && value <= 100,
        sanitize: value => Math.min(100, Math.max(10, parseInt(value) || 30)),
        category: 'interface',
        label: 'Typing Speed',
        description: 'Characters per second when typing emulation is enabled',
        order: 2,
        conditionalDisplay: settings => settings.streaming === true && settings.typingEmulation === true
      },
      messagesToKeep: {
        type: 'number',
        default: 30,
        min: 5,
        max: 200,
        step: 5,
        validate: value => typeof value === 'number' && value >= 5 && value <= 200,
        sanitize: value => Math.min(200, Math.max(5, parseInt(value) || 30)),
        category: 'chat',
        label: 'Messages to Keep',
        description: 'Number of messages to retain in context (affects token usage)',
        order: 0
      },
      contextWindow: {
        type: 'number',
        default: 0, // 0 means auto (use model's max)
        min: 0,
        max: 200000,
        step: 1000,
        validate: value => typeof value === 'number' && value >= 0 && value <= 200000,
        sanitize: value => Math.min(200000, Math.max(0, parseInt(value) || 0)),
        category: 'chat',
        label: 'Context Window',
        description: 'Maximum context window (0 = auto based on model)',
        order: 1,
        advanced: true
      },
      systemPrompt: {
        type: 'string',
        default: '',
        multiline: true,
        validate: value => typeof value === 'string',
        sanitize: value => value?.trim() || '',
        category: 'ai',
        label: 'System Prompt',
        description: 'Optional system instructions to guide Claude\'s behavior',
        order: 9,
        advanced: true
      },
      autoScroll: {
        type: 'boolean',
        default: true,
        validate: value => typeof value === 'boolean',
        category: 'interface',
        label: 'Auto-scroll to Bottom',
        description: 'Automatically scroll to the latest message',
        order: 3
      },
      soundEffects: {
        type: 'boolean',
        default: false,
        validate: value => typeof value === 'boolean',
        category: 'interface',
        label: 'Sound Effects',
        description: 'Play sound effects for notifications and events',
        order: 4
      },
      hapticFeedback: {
        type: 'boolean',
        default: false,
        validate: value => typeof value === 'boolean',
        category: 'interface',
        label: 'Haptic Feedback',
        description: 'Use vibration for notifications on supported devices',
        order: 5,
        conditionalDisplay: () => 'vibrate' in navigator
      },
      theme: {
        type: 'string',
        default: 'system',
        options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System Default' },
          { value: 'high-contrast', label: 'High Contrast' },
          { value: 'sepia', label: 'Sepia' },
          { value: 'night-shift', label: 'Night Shift' }
        ],
        validate: value => ['light', 'dark', 'system', 'high-contrast', 'sepia', 'night-shift'].includes(value),
        category: 'interface',
        label: 'Theme',
        description: 'Application color theme',
        order: 6
      },
      fontSize: {
        type: 'string',
        default: 'medium',
        options: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
          { value: 'x-large', label: 'Extra Large' }
        ],
        validate: value => ['small', 'medium', 'large', 'x-large'].includes(value),
        category: 'accessibility',
        label: 'Font Size',
        description: 'Text size throughout the application',
        order: 0
      },
      fontFamily: {
        type: 'string',
        default: 'system',
        options: [
          { value: 'system', label: 'System Font' },
          { value: 'serif', label: 'Serif' },
          { value: 'sans-serif', label: 'Sans-serif' },
          { value: 'monospace', label: 'Monospace' },
          { value: 'dyslexic', label: 'Dyslexic-friendly' }
        ],
        validate: value => ['system', 'serif', 'sans-serif', 'monospace', 'dyslexic'].includes(value),
        category: 'accessibility',
        label: 'Font Family',
        description: 'Font style used throughout the application',
        order: 1
      },
      messageGrouping: {
        type: 'boolean',
        default: true,
        validate: value => typeof value === 'boolean',
        category: 'chat',
        label: 'Message Grouping',
        description: 'Group consecutive messages from the same sender',
        order: 2
      },
      dateFormat: {
        type: 'string',
        default: 'relative',
        options: [
          { value: 'relative', label: 'Relative (2m ago)' },
          { value: 'absolute', label: 'Absolute (3:45 PM)' },
          { value: 'full', label: 'Full (Mar 24, 2025, 3:45 PM)' },
          { value: 'iso', label: 'ISO 8601 (2025-03-24T15:45:30)' }
        ],
        validate: value => ['relative', 'absolute', 'full', 'iso'].includes(value),
        category: 'chat',
        label: 'Date Format',
        description: 'How to display message timestamps',
        order: 3
      },
      enableSync: {
        type: 'boolean',
        default: false,
        validate: value => typeof value === 'boolean',
        category: 'connection',
        label: 'Enable Cloud Sync',
        description: 'Sync settings across devices (requires login)',
        order: 1,
        conditionalDisplay: () => typeof AuthenticationAPI !== 'undefined' && AuthenticationAPI?.isAuthenticationAvailable()
      },
      syncInterval: {
        type: 'number',
        default: 300, // 5 minutes in seconds
        min: 60,
        max: 86400, // 1 day in seconds
        step: 60,
        validate: value => typeof value === 'number' && value >= 60,
        sanitize: value => Math.max(60, parseInt(value) || 300),
        category: 'connection',
        label: 'Sync Interval',
        description: 'How often to sync settings with cloud (in seconds)',
        order: 2,
        conditionalDisplay: settings => settings.enableSync === true,
        advanced: true
      },
      reducedMotion: {
        type: 'string',
        default: 'system',
        options: [
          { value: 'system', label: 'Use System Setting' },
          { value: 'enabled', label: 'Enabled' },
          { value: 'disabled', label: 'Disabled' }
        ],
        validate: value => ['system', 'enabled', 'disabled'].includes(value),
        category: 'accessibility',
        label: 'Reduced Motion',
        description: 'Minimize animations for better accessibility',
        order: 2
      },
      highContrast: {
        type: 'string',
        default: 'system',
        options: [
          { value: 'system', label: 'Use System Setting' },
          { value: 'enabled', label: 'Enabled' },
          { value: 'disabled', label: 'Disabled' }
        ],
        validate: value => ['system', 'enabled', 'disabled'].includes(value),
        category: 'accessibility',
        label: 'High Contrast',
        description: 'Increase contrast for better readability',
        order: 3
      },
      codeTheme: {
        type: 'string',
        default: 'auto',
        options: [
          { value: 'auto', label: 'Match App Theme' },
          { value: 'github-light', label: 'GitHub Light' },
          { value: 'github-dark', label: 'GitHub Dark' },
          { value: 'monokai', label: 'Monokai' },
          { value: 'dracula', label: 'Dracula' },
          { value: 'nord', label: 'Nord' },
          { value: 'solarized-light', label: 'Solarized Light' },
          { value: 'solarized-dark', label: 'Solarized Dark' },
          { value: 'tokyo-night', label: 'Tokyo Night' }
        ],
        validate: value => [
          'auto', 'github-light', 'github-dark', 'monokai', 'dracula', 
          'nord', 'solarized-light', 'solarized-dark', 'tokyo-night'
        ].includes(value),
        category: 'interface',
        label: 'Code Highlighting Theme',
        description: 'Theme for syntax highlighting in code blocks',
        order: 7
      },
      displayMode: {
        type: 'string',
        default: 'compact',
        options: [
          { value: 'compact', label: 'Compact' },
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'spacious', label: 'Spacious' }
        ],
        validate: value => ['compact', 'comfortable', 'spacious'].includes(value),
        category: 'interface',
        label: 'Display Density',
        description: 'Controls spacing of UI elements',
        order: 8
      },
      backupFrequency: {
        type: 'string',
        default: 'weekly',
        options: [
          { value: 'never', label: 'Never' },
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' }
        ],
        validate: value => ['never', 'daily', 'weekly', 'monthly'].includes(value),
        category: 'system',
        label: 'Settings Backup',
        description: 'How often to automatically backup settings',
        order: 0
      },
      backupLocation: {
        type: 'string',
        default: 'local',
        options: [
          { value: 'local', label: 'Local Device' },
          { value: 'cloud', label: 'Cloud Storage' },
          { value: 'both', label: 'Both Local and Cloud' }
        ],
        validate: value => ['local', 'cloud', 'both'].includes(value),
        category: 'system',
        label: 'Backup Location',
        description: 'Where to store settings backups',
        order: 1,
        conditionalDisplay: settings => settings.backupFrequency !== 'never'
      },
      telemetryLevel: {
        type: 'string',
        default: 'minimal',
        options: [
          { value: 'none', label: 'None' },
          { value: 'minimal', label: 'Minimal (errors only)' },
          { value: 'basic', label: 'Basic (usage statistics)' },
          { value: 'full', label: 'Full (detailed analytics)' }
        ],
        validate: value => ['none', 'minimal', 'basic', 'full'].includes(value),
        category: 'system',
        label: 'Usage Statistics',
        description: 'Share anonymous usage data to help improve the app',
        order: 2
      },
      contextRetention: {
        type: 'string',
        default: 'session',
        options: [
          { value: 'none', label: 'None' },
          { value: 'session', label: 'Current Session' },
          { value: 'persistent', label: 'Persistent (across sessions)' }
        ],
        validate: value => ['none', 'session', 'persistent'].includes(value),
        category: 'chat',
        label: 'Context Retention',
        description: 'How long to retain conversation context',
        order: 4
      },
      autoFormatting: {
        type: 'boolean',
        default: true,
        validate: value => typeof value === 'boolean',
        category: 'chat',
        label: 'Auto Formatting',
        description: 'Automatically format markdown, code blocks, and tables',
        order: 5
      },
      markdownLevel: {
        type: 'string',
        default: 'full',
        options: [
          { value: 'basic', label: 'Basic (Bold, Italic, Links)' },
          { value: 'standard', label: 'Standard (Lists, Headers, Images)' },
          { value: 'full', label: 'Full (Tables, Code Blocks, Math)' }
        ],
        validate: value => ['basic', 'standard', 'full'].includes(value),
        category: 'chat',
        label: 'Markdown Support',
        description: 'Level of markdown formatting to apply in messages',
        order: 6,
        conditionalDisplay: settings => settings.autoFormatting === true
      },
      defaultLanguage: {
        type: 'string',
        default: 'en',
        options: [
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Español' },
          { value: 'fr', label: 'Français' },
          { value: 'de', label: 'Deutsch' },
          { value: 'ja', label: 'Japanese' },
          { value: 'zh', label: 'Chinese' },
        ],
        validate: value => ['en', 'es', 'fr', 'de', 'ja', 'zh'].includes(value),
        category: 'accessibility',
        label: 'Default Language',
        description: 'Primary language for the interface and AI responses',
        order: 4
      }
    };
    
    /**
     * Settings presets with context-aware configurations
     */
    const SETTINGS_PRESETS = {
      default: {
        temperature: 0.7,
        topP: 0.9,
        thinkingEnabled: false,
        thinkingBudget: 10240,
        maxTokens: 4096,
        streaming: true,
        model: 'claude-3-7-sonnet-20250219',
        description: 'Balanced settings for most use cases'
      },
      creative: {
        temperature: 1.0,
        topP: 1.0,
        thinkingEnabled: false,
        maxTokens: 8192,
        model: 'claude-3-7-opus-20250219',
        frequencyPenalty: 0.2,
        presencePenalty: 0.1,
        description: 'Maximum creativity for brainstorming and creative writing'
      },
      precise: {
        temperature: 0.3,
        topP: 0.7,
        thinkingEnabled: true,
        thinkingBudget: 20480,
        maxTokens: 4096,
        model: 'claude-3-7-opus-20250219',
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
        description: 'High accuracy for factual responses and detailed analysis'
      },
      efficient: {
        temperature: 0.5,
        topP: 0.9,
        thinkingEnabled: false,
        maxTokens: 2048,
        streaming: true,
        model: 'claude-3-7-haiku-20250219',
        description: 'Optimized for speed and lower token usage'
      },
      teaching: {
        temperature: 0.6,
        topP: 0.9,
        thinkingEnabled: true,
        thinkingBudget: 15360,
        maxTokens: 6144,
        model: 'claude-3-7-sonnet-20250219',
        systemPrompt: 'You are a helpful teaching assistant. Break down complex topics into understandable pieces. When explaining concepts, provide analogies and examples. If appropriate for the topic, include practice problems or exercises.',
        description: 'Optimized for learning and explanations with detailed thinking'
      },
      coding: {
        temperature: 0.3,
        topP: 0.8,
        thinkingEnabled: true,
        thinkingBudget: 12288,
        maxTokens: 8192,
        model: 'claude-3-7-opus-20250219',
        systemPrompt: 'You are a coding assistant. Provide clean, well-documented code with explanations. Follow best practices and modern conventions for the language being discussed. Include example usage where helpful.',
        codeTheme: 'github-dark',
        description: 'Optimized for programming assistance and code generation'
      },
      accessible: {
        reducedMotion: 'enabled',
        highContrast: 'enabled',
        theme: 'high-contrast',
        fontSize: 'large',
        fontFamily: 'dyslexic',
        displayMode: 'spacious',
        typingEmulation: false,
        description: 'Enhanced readability and reduced animations for accessibility'
      },
      dataAnalysis: {
        temperature: 0.2,
        topP: 0.8,
        thinkingEnabled: true,
        thinkingBudget: 20480,
        maxTokens: 8192,
        model: 'claude-3-7-opus-20250219',
        systemPrompt: 'You are a data analysis assistant. When interpreting data, be thorough and methodical. Explain your reasoning step by step. When appropriate, suggest visualizations that would help illustrate patterns or trends in the data. Consider statistical significance and potential confounding factors in your analysis.',
        description: 'Optimized for data analysis and interpretation'
      },
      academic: {
        temperature: 0.4,
        topP: 0.8,
        thinkingEnabled: true,
        thinkingBudget: 24576,
        maxTokens: 10240,
        model: 'claude-3-7-opus-20250219',
        systemPrompt: 'You are an academic research assistant. Provide well-sourced information and cite relevant literature when possible. Maintain a balanced perspective on controversial topics, acknowledging different viewpoints. Use precise terminology appropriate for scholarly discourse.',
        description: 'Designed for academic research and scholarly discussions'
      },
      summarization: {
        temperature: 0.3,
        topP: 0.6,
        thinkingEnabled: true,
        thinkingBudget: 16384,
        maxTokens: 4096,
        model: 'claude-3-7-sonnet-20250219',
        systemPrompt: 'You are a summarization specialist. Create concise yet comprehensive summaries that capture the key points, main arguments, and essential details of the input text. Organize information logically and maintain the original meaning and intent.',
        description: 'Optimized for creating accurate summaries of content'
      }
    };
    
    /**
     * Settings categories for UI organization
     */
    const SETTINGS_CATEGORIES = [
      {
        id: 'connection',
        label: 'Connection',
        icon: 'key',
        description: 'API connection settings'
      },
      {
        id: 'ai',
        label: 'AI Configuration',
        icon: 'cpu',
        description: 'Configure Claude\'s behavior and capabilities'
      },
      {
        id: 'interface',
        label: 'Interface',
        icon: 'monitor',
        description: 'User interface preferences'
      },
      {
        id: 'chat',
        label: 'Chat',
        icon: 'message-circle',
        description: 'Chat behavior and history settings'
      },
      {
        id: 'accessibility',
        label: 'Accessibility',
        icon: 'eye',
        description: 'Settings for improved accessibility'
      },
      {
        id: 'system',
        label: 'System',
        icon: 'settings',
        description: 'System-level settings and preferences'
      }
    ];
    
    // ===============================================================
    // Security Utilities
    // ===============================================================
    
    /**
     * Enhanced security utilities for sensitive data handling
     */
    class SecurityManager {
      // Cache for availability checks
      static _encryptionAvailable = null;
      static _credentialStorageAvailable = null;
      static _biometricAvailable = null;
      
      /**
       * Check if SubtleCrypto is available
       * @returns {boolean} Whether encryption is available
       */
      static isEncryptionAvailable() {
        if (this._encryptionAvailable === null) {
          this._encryptionAvailable = !!(window.crypto && window.crypto.subtle);
        }
        return this._encryptionAvailable;
      }
      
      /**
       * Check if Credential Management API is available
       * @returns {boolean} Whether credential storage is available
       */
      static isCredentialStorageAvailable() {
        if (this._credentialStorageAvailable === null) {
          this._credentialStorageAvailable = !!(
            window.navigator && 
            window.navigator.credentials && 
            typeof window.navigator.credentials.store === 'function'
          );
        }
        return this._credentialStorageAvailable;
      }
      
      /**
       * Check if WebAuthn/biometric authentication is available
       * @returns {Promise<boolean>} Whether biometric auth is available
       */
      static async isBiometricAvailable() {
        if (this._biometricAvailable !== null) {
          return this._biometricAvailable;
        }
        
        try {
          if (!window.PublicKeyCredential) {
            this._biometricAvailable = false;
            return false;
          }
          
          // Check if user verification can be done with platform authenticator
          this._biometricAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          return this._biometricAvailable;
        } catch (e) {
          console.warn('Biometric availability check failed:', e);
          this._biometricAvailable = false;
          return false;
        }
      }
      
      /**
       * Generate a secure encryption key
       * @returns {Promise<CryptoKey>} Generated encryption key
       */
      static async generateEncryptionKey() {
        if (!this.isEncryptionAvailable()) {
          throw new Error('Encryption is not available in this browser');
        }
        
        return window.crypto.subtle.generateKey(
          {
            name: 'AES-GCM',
            length: 256
          },
          true,
          ['encrypt', 'decrypt']
        );
      }
      
      /**
       * Derive an encryption key from a password using PBKDF2
       * @param {string} password - Password to derive key from
       * @param {Uint8Array} salt - Salt for key derivation
       * @returns {Promise<CryptoKey>} Derived key
       * @private
       */
      static async _deriveKeyFromPassword(password, salt) {
        // Create a key from the password
        const passwordKey = password || 'claude-settings-encryption-key-v3.1';
        const encoder = new TextEncoder();
        
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw',
          encoder.encode(passwordKey),
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        );
        
        // Derive an AES-GCM key using PBKDF2
        return window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt,
            iterations: 210000, // Increased iterations for 2025 standards
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      }
      
      /**
       * Encrypt sensitive data
       * @param {string} data - Data to encrypt
       * @param {string} [password=''] - Optional password for encryption
       * @returns {Promise<string>} Encrypted data as base64 string
       */
      static async encrypt(data, password = '') {
        if (!data) return '';
        if (!this.isEncryptionAvailable()) {
          // Fallback to basic obfuscation
          return this.obfuscate(data);
        }
        
        try {
          // Salt and IV should be randomly generated for each encryption
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const iv = crypto.getRandomValues(new Uint8Array(12));
          
          // Derive key from password
          const key = await this._deriveKeyFromPassword(password, salt);
          
          // Add a version prefix for future compatibility
          const VERSION_PREFIX = 'ENC01:';
          
          // Encrypt the data
          const encoder = new TextEncoder();
          const encodedData = encoder.encode(data);
          
          const encryptedContent = await crypto.subtle.encrypt(
            {
              name: 'AES-GCM',
              iv,
              // Add additional authentication data for stronger security
              additionalData: encoder.encode(VERSION_PREFIX)
            },
            key,
            encodedData
          );
          
          // Combine the salt, iv, and encrypted data into a single array
          const encryptedArray = new Uint8Array(
            salt.byteLength + iv.byteLength + encryptedContent.byteLength
          );
          encryptedArray.set(salt, 0);
          encryptedArray.set(iv, salt.byteLength);
          encryptedArray.set(
            new Uint8Array(encryptedContent),
            salt.byteLength + iv.byteLength
          );
          
          // Convert to base64 string for storage
          const base64String = btoa(
            String.fromCharCode.apply(null, new Uint8Array(encryptedArray))
          );
          
          // Return with version prefix
          return VERSION_PREFIX + base64String;
        } catch (error) {
          console.error('Encryption failed:', error);
          // Fallback to basic obfuscation
          return this.obfuscate(data);
        }
      }
      
      /**
       * Decrypt sensitive data
       * @param {string} encryptedData - Encrypted data as base64 string
       * @param {string} [password=''] - Optional password for decryption
       * @returns {Promise<string>} Decrypted data
       */
      static async decrypt(encryptedData, password = '') {
        if (!encryptedData) return '';
        
        // Check for version prefix
        const VERSION_PREFIX = 'ENC01:';
        
        if (encryptedData.startsWith(VERSION_PREFIX)) {
          // Modern encrypted format
          const base64Data = encryptedData.substring(VERSION_PREFIX.length);
          
          if (!this.isEncryptionAvailable()) {
            throw new Error('Encryption is not available but required to decrypt this data');
          }
          
          try {
            // Convert base64 to binary
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Extract the salt, iv, and encrypted data
            const salt = bytes.slice(0, 16);
            const iv = bytes.slice(16, 16 + 12);
            const encryptedContent = bytes.slice(16 + 12);
            
            // Derive key from password
            const key = await this._deriveKeyFromPassword(password, salt);
            
            // Decrypt the data
            const encoder = new TextEncoder();
            const decryptedContent = await crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv,
                additionalData: encoder.encode(VERSION_PREFIX)
              },
              key,
              encryptedContent
            );
            
            // Convert to string
            return new TextDecoder().decode(decryptedContent);
          } catch (error) {
            console.error('Decryption failed:', error);
            return '';
          }
        } else if (!this.isEncryptionAvailable() || encryptedData.length < 50) {
          // Simple check for non-encrypted data or when encryption is unavailable
          try {
            return this.deobfuscate(encryptedData);
          } catch (e) {
            return ''; // Return empty string if deobfuscation fails
          }
        } else {
          // Legacy encrypted format from v2
          try {
            // Decode the base64 encrypted data
            const encryptedArray = new Uint8Array(
              atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );
            
            // Extract the salt, iv, and encrypted data
            const salt = encryptedArray.slice(0, 16);
            const iv = encryptedArray.slice(16, 16 + 12);
            const encryptedContent = encryptedArray.slice(16 + 12);
            
            // Derive key from password
            const key = await this._deriveKeyFromPassword(password, salt);
            
            // Decrypt the data
            const decryptedContent = await crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv
              },
              key,
              encryptedContent
            );
            
            // Convert the decrypted data to a string
            return new TextDecoder().decode(decryptedContent);
          } catch (error) {
            console.error('Legacy decryption failed:', error);
            
            // Try simple deobfuscation as fallback
            try {
              return this.deobfuscate(encryptedData);
            } catch (e) {
              return ''; // Return empty string if all decryption fails
            }
          }
        }
      }
      
      /**
       * Simple obfuscation for browsers without crypto support
       * @param {string} value - Value to obfuscate
       * @returns {string} Obfuscated value
       */
      static obfuscate(value) {
        if (!value) return '';
        try {
          // Add a timestamp to invalidate older values
          const payload = `${value}:${Date.now()}`;
          // Use base64 encoding to obfuscate
          return 'OBF:' + btoa(unescape(encodeURIComponent(payload)));
        } catch (e) {
          console.error('Failed to obfuscate value', e);
          return '';
        }
      }
      
      /**
       * Deobfuscate value for browsers without crypto support
       * @param {string} obfuscated - Obfuscated value
       * @returns {string} Original value
       */
      static deobfuscate(obfuscated) {
        if (!obfuscated) return '';
        
        try {
          // Check for obfuscation prefix
          if (obfuscated.startsWith('OBF:')) {
            obfuscated = obfuscated.substring(4);
          }
          
          const decoded = decodeURIComponent(escape(atob(obfuscated)));
          // Extract value by removing timestamp
          return decoded.split(':')[0];
        } catch (e) {
          console.error('Failed to deobfuscate value', e);
          return '';
        }
      }
      
      /**
       * Encrypt with biometric verification (WebAuthn)
       * @param {string} data - Data to encrypt
       * @returns {Promise<string>} Encrypted data
       */
      static async encryptWithBiometric(data) {
        // Check if WebAuthn is available
        if (!await this.isBiometricAvailable()) {
          throw new Error('Biometric authentication is not available on this device');
        }
        
        try {
          // Create a credential ID based on application info
          const credentialId = await this._generateCredentialId();
          
          // Request user verification with platform authenticator
          const credential = await navigator.credentials.create({
            publicKey: {
              rp: {
                id: window.location.hostname,
                name: 'Claude Chat'
              },
              user: {
                id: new TextEncoder().encode(credentialId),
                name: 'Settings Encryption',
                displayName: 'Secured Claude Settings'
              },
              challenge: crypto.getRandomValues(new Uint8Array(32)),
              pubKeyCredParams: [
                { type: 'public-key', alg: -7 }, // ES256
                { type: 'public-key', alg: -257 } // RS256
              ],
              authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                requireResidentKey: false
              },
              timeout: 60000,
              attestation: 'none'
            }
          });
          
          if (!credential) {
            throw new Error('Biometric verification failed');
          }
          
          // Use response as key material for encryption
          const rawId = new Uint8Array(credential.rawId);
          const rawIdBase64 = btoa(String.fromCharCode.apply(null, rawId));
          
          // Encrypt data using the credential ID as a key
          return this.encrypt(data, rawIdBase64);
        } catch (error) {
          console.error('Biometric encryption failed:', error);
          throw new Error('Biometric encryption failed: ' + error.message);
        }
      }
      
      /**
       * Generate a consistent credential ID for the app
       * @returns {Promise<string>} Credential ID
       * @private
       */
      static async _generateCredentialId() {
        const appInfo = `claude-settings-${window.location.hostname}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(appInfo);
        
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
      
      /**
       * Store a credential in the browser's credential store
       * @param {string} id - Credential ID
       * @param {string} value - Credential value
       * @returns {Promise<boolean>} Success status
       */
      static async storeCredential(id, value) {
        if (!this.isCredentialStorageAvailable()) {
          return false;
        }
        
        try {
          const credential = new window.PasswordCredential({
            id: `claude-${id}`,
            password: value,
            name: `Claude Settings: ${id}`
          });
          
          await navigator.credentials.store(credential);
          return true;
        } catch (error) {
          console.error('Failed to store credential:', error);
          return false;
        }
      }
      
      /**
       * Get a credential from the browser's credential store
       * @param {string} id - Credential ID
       * @returns {Promise<string|null>} Credential value or null if not found
       */
      static async getCredential(id) {
        if (!this.isCredentialStorageAvailable()) {
          return null;
        }
        
        try {
          const credentials = await navigator.credentials.get({
            password: true,
            mediation: 'silent'
          });
          
          if (credentials && credentials.id === `claude-${id}`) {
            return credentials.password;
          }
          
          return null;
        } catch (error) {
          console.error('Failed to get credential:', error);
          return null;
        }
      }
      
      /**
       * Create a secure cryptographic hash of a value
       * @param {string} value - Value to hash
       * @returns {Promise<string>} Hashed value as hex string
       */
      static async hash(value) {
        if (!value) return '';
        
        if (this.isEncryptionAvailable()) {
          try {
            // Create hash using SubtleCrypto
            const encoder = new TextEncoder();
            const data = encoder.encode(value);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            
            // Convert to hex string
            return Array.from(new Uint8Array(hashBuffer))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
          } catch (e) {
            // Fallback to simpler hash
            return this._simpleHash(value);
          }
        } else {
          // Use simple hash for browsers without crypto support
          return this._simpleHash(value);
        }
      }
      
      /**
       * Simple hash function for browsers without crypto support
       * @param {string} value - Value to hash
       * @returns {string} Hashed value
       * @private
       */
      static _simpleHash(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
          const char = value.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
      }
      
      /**
       * Generate a cryptographic signature for data verification
       * @param {Object} data - Data to sign
       * @param {string} [secret=''] - Secret key for signing
       * @returns {Promise<string>} Signature
       */
      static async generateSignature(data, secret = '') {
        if (!this.isEncryptionAvailable()) {
          return this._simpleHash(JSON.stringify(data) + secret);
        }
        
        try {
          const encoder = new TextEncoder();
          const secretData = encoder.encode(secret || 'claude-settings-signature-key');
          
          // Import the secret as a key
          const key = await crypto.subtle.importKey(
            'raw',
            secretData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );
          
          // Sign the data
          const signature = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(JSON.stringify(data))
          );
          
          // Convert to base64
          return btoa(String.fromCharCode.apply(null, new Uint8Array(signature)));
        } catch (e) {
          console.error('Signature generation failed:', e);
          return this._simpleHash(JSON.stringify(data) + secret);
        }
      }
      
      /**
       * Verify a cryptographic signature
       * @param {Object} data - Data to verify
       * @param {string} signature - Signature to check
       * @param {string} [secret=''] - Secret key for verification
       * @returns {Promise<boolean>} Whether signature is valid
       */
      static async verifySignature(data, signature, secret = '') {
        // Generate a new signature and compare
        const calculatedSignature = await this.generateSignature(data, secret);
        return calculatedSignature === signature;
      }
    }
    
    // ===============================================================
    // Storage Manager
    // ===============================================================
    
    /**
     * Enhanced storage manager with multi-tier strategy
     */
    class StorageManager {
      // Storage availability flags
      static _hasLocalStorage = null;
      static _hasSessionStorage = null;
      static _hasIndexedDB = null;
      static _hasOriginPrivateFileSystem = null;
      static _hasCacheAPI = null;
      
      // Private storage instances
      static _idbDatabase = null;
      static _opfsRoot = null;
      
      /**
       * Check if localStorage is available
       * @returns {boolean} Whether localStorage is available
       */
      static hasLocalStorage() {
        if (this._hasLocalStorage === null) {
          try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            this._hasLocalStorage = true;
          } catch (e) {
            this._hasLocalStorage = false;
          }
        }
        return this._hasLocalStorage;
      }
      
      /**
       * Check if sessionStorage is available
       * @returns {boolean} Whether sessionStorage is available
       */
      static hasSessionStorage() {
        if (this._hasSessionStorage === null) {
          try {
            const testKey = '__storage_test__';
            sessionStorage.setItem(testKey, testKey);
            sessionStorage.removeItem(testKey);
            this._hasSessionStorage = true;
          } catch (e) {
            this._hasSessionStorage = false;
          }
        }
        return this._hasSessionStorage;
      }
      
      /**
       * Check if IndexedDB is available
       * @returns {boolean} Whether IndexedDB is available
       */
      static hasIndexedDB() {
        if (this._hasIndexedDB === null) {
          this._hasIndexedDB = !!(window.indexedDB || 
            window.mozIndexedDB || 
            window.webkitIndexedDB || 
            window.msIndexedDB);
        }
        return this._hasIndexedDB;
      }
      
      /**
       * Check if Origin Private File System is available
       * @returns {boolean} Whether OPFS is available
       */
      static hasOriginPrivateFileSystem() {
        if (this._hasOriginPrivateFileSystem === null) {
          this._hasOriginPrivateFileSystem = !!(navigator.storage && 
            navigator.storage.getDirectory);
        }
        return this._hasOriginPrivateFileSystem;
      }
      
      /**
       * Check if Cache API is available
       * @returns {boolean} Whether Cache API is available
       */
      static hasCacheAPI() {
        if (this._hasCacheAPI === null) {
          this._hasCacheAPI = !!(window.caches);
        }
        return this._hasCacheAPI;
      }
      
      /**
       * Get the storage quota usage information
       * @returns {Promise<Object>} Storage usage information
       */
      static async getStorageEstimate() {
        if (navigator.storage && navigator.storage.estimate) {
          try {
            return await navigator.storage.estimate();
          } catch (e) {
            console.warn('Storage estimate failed:', e);
            return { quota: 0, usage: 0, usageDetails: {} };
          }
        }
        return { quota: 0, usage: 0, usageDetails: {} };
      }
      
      /**
       * Initialize storage subsystems
       * @returns {Promise<boolean>} Success status
       */
      static async initialize() {
        // Check for persistent storage permission
        if (navigator.storage && navigator.storage.persist) {
          try {
            const isPersisted = await navigator.storage.persist();
            if (!isPersisted) {
              console.warn('Persistent storage permission denied');
            }
          } catch (e) {
            console.warn('Failed to request persistent storage:', e);
          }
        }
        
        // Initialize IndexedDB
        if (this.hasIndexedDB() && !this._idbDatabase) {
          try {
            await this._initializeIndexedDB();
          } catch (e) {
            console.error('Failed to initialize IndexedDB:', e);
          }
        }
        
        // Initialize Origin Private File System
        if (this.hasOriginPrivateFileSystem() && !this._opfsRoot) {
          try {
            this._opfsRoot = await navigator.storage.getDirectory();
          } catch (e) {
            console.error('Failed to initialize Origin Private File System:', e);
          }
        }
        
        return true;
      }
      
      /**
       * Initialize the IndexedDB database
       * @returns {Promise<void>}
       * @private
       */
      static async _initializeIndexedDB() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open('ClaudeChatSettings', 2);
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create main settings store
            if (!db.objectStoreNames.contains('settings')) {
              db.createObjectStore('settings');
            }
            
            // Create backup store
            if (!db.objectStoreNames.contains('backups')) {
              const backupsStore = db.createObjectStore('backups', { keyPath: 'timestamp' });
              backupsStore.createIndex('byType', 'type', { unique: false });
            }
            
            // Create usage metrics store
            if (!db.objectStoreNames.contains('metrics')) {
              const metricsStore = db.createObjectStore('metrics', { keyPath: 'id' });
              metricsStore.createIndex('byDate', 'date', { unique: false });
            }
          };
          
          request.onerror = (event) => {
            console.error('IndexedDB initialization error:', event.target.error);
            reject(event.target.error);
          };
          
          request.onsuccess = (event) => {
            this._idbDatabase = event.target.result;
            
            // Handle database close events
            this._idbDatabase.onclose = () => {
              this._idbDatabase = null;
            };
            
            // Handle version change (e.g., another tab updated the DB)
            this._idbDatabase.onversionchange = () => {
              if (this._idbDatabase) {
                this._idbDatabase.close();
                this._idbDatabase = null;
                // Re-initialize
                this._initializeIndexedDB().catch(console.error);
              }
            };
            
            resolve();
          };
        });
      }
      
      /**
       * Save data to storage with tiered fallback strategy
       * @param {string} key - Storage key
       * @param {*} value - Value to store
       * @param {Object} [options={}] - Storage options
       * @returns {Promise<boolean>} Success status
       */
      static async save(key, value, options = {}) {
        if (value === undefined || value === null) {
          return this.remove(key);
        }
        
        const { 
          persistent = true,
          sensitive = false,
          serialize = true,
          preferredStorage = null,
          transaction = null  // For batch operations
        } = options;
        
        // Initialize if needed
        if (!this._idbDatabase && this.hasIndexedDB()) {
          await this._initializeIndexedDB().catch(console.error);
        }
        
        // Serialize for storage if needed
        let serialized = value;
        if (serialize) {
          try {
            serialized = JSON.stringify(value);
          } catch (e) {
            console.error('Failed to serialize data:', e);
            return false;
          }
        }
        
        // Encrypt if sensitive
        if (sensitive && serialized) {
          serialized = await SecurityManager.encrypt(serialized);
        }
        
        // Try specific storage if requested
        if (preferredStorage) {
          let success = false;
          
          switch (preferredStorage) {
            case 'indexeddb':
              if (this.hasIndexedDB()) {
                success = await this._saveToIndexedDB(key, serialized, { transaction });
                if (success) return true;
              }
              break;
            case 'localstorage':
              if (this.hasLocalStorage()) {
                try {
                  localStorage.setItem(key, serialized);
                  return true;
                } catch (e) {
                  console.warn('localStorage save failed, falling back:', e);
                }
              }
              break;
            case 'sessionstorage':
              if (this.hasSessionStorage()) {
                try {
                  sessionStorage.setItem(key, serialized);
                  return true;
                } catch (e) {
                  console.warn('sessionStorage save failed, falling back:', e);
                }
              }
              break;
            case 'opfs':
              if (this.hasOriginPrivateFileSystem()) {
                success = await this._saveToOPFS(key, serialized);
                if (success) return true;
              }
              break;
          }
        }
        
        // Try different storage methods in order of preference
        try {
          // For persistent storage
          if (persistent) {
            // Try IndexedDB (best for large data)
            if (this.hasIndexedDB()) {
              const success = await this._saveToIndexedDB(key, serialized, { transaction });
              if (success) return true;
            }
            
            // Try Origin Private File System
            if (this.hasOriginPrivateFileSystem()) {
              const success = await this._saveToOPFS(key, serialized);
              if (success) return true;
            }
            
            // Fall back to localStorage
            if (this.hasLocalStorage()) {
              try {
                localStorage.setItem(key, serialized);
                return true;
              } catch (e) {
                console.warn('localStorage save failed, falling back:', e);
              }
            }
          }
          
          // For non-persistent or fallback
          if (this.hasSessionStorage()) {
            try {
              sessionStorage.setItem(key, serialized);
              return true;
            } catch (e) {
              console.warn('sessionStorage save failed, falling back:', e);
            }
          }
          
          // Memory-only storage as last resort
          window.__memoryStorage = window.__memoryStorage || new Map();
          window.__memoryStorage.set(key, serialized);
          return true;
        } catch (e) {
          console.error('Failed to save to storage:', e);
          
          // Last resort memory-only storage
          try {
            window.__memoryStorage = window.__memoryStorage || new Map();
            window.__memoryStorage.set(key, serialized);
            return true;
          } catch (innerError) {
            console.error('Memory storage failed:', innerError);
            return false;
          }
        }
      }
      
      /**
       * Load data from storage with tiered fallback strategy
       * @param {string} key - Storage key
       * @param {*} defaultValue - Default value if not found
       * @param {Object} [options={}] - Storage options
       * @returns {Promise<*>} Retrieved value or default
       */
      static async load(key, defaultValue = null, options = {}) {
        const {
          persistent = true,
          sensitive = false,
          parse = true,
          preferredStorage = null,
          transaction = null  // For batch operations
        } = options;
        
        // Initialize if needed
        if (!this._idbDatabase && this.hasIndexedDB()) {
          await this._initializeIndexedDB().catch(console.error);
        }
        
        let data = null;
        
        // Try specific storage if requested
        if (preferredStorage) {
          switch (preferredStorage) {
            case 'indexeddb':
              if (this.hasIndexedDB()) {
                data = await this._loadFromIndexedDB(key, { transaction });
                if (data !== null) break;
              }
              break;
            case 'localstorage':
              if (this.hasLocalStorage()) {
                data = localStorage.getItem(key);
                if (data !== null) break;
              }
              break;
            case 'sessionstorage':
              if (this.hasSessionStorage()) {
                data = sessionStorage.getItem(key);
                if (data !== null) break;
              }
              break;
            case 'opfs':
              if (this.hasOriginPrivateFileSystem()) {
                data = await this._loadFromOPFS(key);
                if (data !== null) break;
              }
              break;
          }
        }
        
        // Try different storage methods in order of preference if not found
        if (data === null) {
          try {
            // For persistent storage
            if (persistent) {
              // Try IndexedDB first
              if (this.hasIndexedDB()) {
                data = await this._loadFromIndexedDB(key, { transaction });
              }
              
              // Try Origin Private File System if not in IndexedDB
              if (data === null && this.hasOriginPrivateFileSystem()) {
                data = await this._loadFromOPFS(key);
              }
              
              // Fall back to localStorage if still not found
              if (data === null && this.hasLocalStorage()) {
                data = localStorage.getItem(key);
              }
            }
            
            // For non-persistent or fallback
            if (data === null && this.hasSessionStorage()) {
              data = sessionStorage.getItem(key);
            }
            
            // Memory-only storage as last resort
            if (data === null && window.__memoryStorage && window.__memoryStorage.has(key)) {
              data = window.__memoryStorage.get(key);
            }
          } catch (e) {
            console.error('Failed to load from storage:', e);
          }
        }
        
        // If still not found, return default
        if (data === null) {
          return defaultValue;
        }
        
        // Decrypt if sensitive
        if (sensitive && data) {
          data = await SecurityManager.decrypt(data);
        }
        
        // Parse if requested
        if (parse && data) {
          try {
            return JSON.parse(data);
          } catch (parseError) {
            console.warn(`Failed to parse data for key ${key}:`, parseError);
            return data; // Return raw data if parsing fails
          }
        }
        
        return data;
      }
      
      /**
       * Remove data from all storage backends
       * @param {string} key - Storage key to clear
       * @returns {Promise<boolean>} Success status
       */
      static async remove(key) {
        let success = false;
        
        try {
          // Clear from all possible storage locations
          if (this.hasLocalStorage()) {
            try {
              localStorage.removeItem(key);
              success = true;
            } catch (e) {
              console.warn('localStorage remove failed:', e);
            }
          }
          
          if (this.hasSessionStorage()) {
            try {
              sessionStorage.removeItem(key);
              success = true;
            } catch (e) {
              console.warn('sessionStorage remove failed:', e);
            }
          }
          
          if (this.hasIndexedDB()) {
            const indexedDBSuccess = await this._removeFromIndexedDB(key);
            success = success || indexedDBSuccess;
          }
          
          if (this.hasOriginPrivateFileSystem()) {
            const opfsSuccess = await this._removeFromOPFS(key);
            success = success || opfsSuccess;
          }
          
          // Clear from memory storage
          if (window.__memoryStorage && window.__memoryStorage.has(key)) {
            window.__memoryStorage.delete(key);
            success = true;
          }
          
          return success;
        } catch (e) {
          console.error('Failed to remove from storage:', e);
          return false;
        }
      }
      
      /**
       * Save data to IndexedDB
       * @param {string} key - Storage key
       * @param {*} value - Value to store
       * @param {Object} [options={}] - Options object
       * @returns {Promise<boolean>} Success status
       * @private
       */
      static _saveToIndexedDB(key, value, options = {}) {
        if (!this._idbDatabase) {
          return Promise.resolve(false);
        }
        
        const { transaction: existingTransaction = null } = options;
        
        return new Promise((resolve) => {
          try {
            // Use provided transaction or create a new one
            const transaction = existingTransaction || 
              this._idbDatabase.transaction('settings', 'readwrite');
              
            const store = transaction.objectStore('settings');
            
            const storeRequest = store.put(value, key);
            
            storeRequest.onsuccess = () => resolve(true);
            storeRequest.onerror = (event) => {
              console.error('IndexedDB store error:', event.target.error);
              resolve(false);
            };
            
            // Only complete transaction if we created it
            if (!existingTransaction) {
              transaction.oncomplete = () => resolve(true);
              transaction.onerror = (event) => {
                console.error('IndexedDB transaction error:', event.target.error);
                resolve(false);
              };
            }
          } catch (e) {
            console.error('IndexedDB operation error:', e);
            resolve(false);
          }
        });
      }
      
      /**
       * Load data from IndexedDB
       * @param {string} key - Storage key
       * @param {Object} [options={}] - Options object
       * @returns {Promise<*>} Retrieved value or null
       * @private
       */
      static _loadFromIndexedDB(key, options = {}) {
        if (!this._idbDatabase) {
          return Promise.resolve(null);
        }
        
        const { transaction: existingTransaction = null } = options;
        
        return new Promise((resolve) => {
          try {
            // Use provided transaction or create a new one
            const transaction = existingTransaction || 
              this._idbDatabase.transaction('settings', 'readonly');
              
            const store = transaction.objectStore('settings');
            
            const getRequest = store.get(key);
            
            getRequest.onsuccess = () => resolve(getRequest.result || null);
            getRequest.onerror = (event) => {
              console.error('IndexedDB get error:', event.target.error);
              resolve(null);
            };
          } catch (e) {
            console.error('IndexedDB operation error:', e);
            resolve(null);
          }
        });
      }
      
      /**
       * Remove data from IndexedDB
       * @param {string} key - Storage key
       * @returns {Promise<boolean>} Success status
       * @private
       */
      static _removeFromIndexedDB(key) {
        if (!this._idbDatabase) {
          return Promise.resolve(false);
        }
        
        return new Promise((resolve) => {
          try {
            const transaction = this._idbDatabase.transaction('settings', 'readwrite');
            const store = transaction.objectStore('settings');
            
            const deleteRequest = store.delete(key);
            
            deleteRequest.onsuccess = () => resolve(true);
            deleteRequest.onerror = (event) => {
              console.error('IndexedDB delete error:', event.target.error);
              resolve(false);
            };
          } catch (e) {
            console.error('IndexedDB operation error:', e);
            resolve(false);
          }
        });
      }
      
      /**
       * Save data to Origin Private File System
       * @param {string} key - Storage key
       * @param {*} value - Value to store
       * @returns {Promise<boolean>} Success status
       * @private
       */
      static async _saveToOPFS(key, value) {
        if (!this._opfsRoot) {
          try {
            this._opfsRoot = await navigator.storage.getDirectory();
          } catch (e) {
            console.error('Failed to get OPFS root directory:', e);
            return false;
          }
        }
        
        try {
          // Sanitize key for file system use
          const safeKey = key.replace(/[^a-z0-9_-]/gi, '_') + '.json';
          
          // Create file
          const fileHandle = await this._opfsRoot.getFileHandle(safeKey, { create: true });
          const writable = await fileHandle.createWritable();
          
          // Write data
          await writable.write(value);
          await writable.close();
          
          return true;
        } catch (e) {
          console.error('OPFS write failed:', e);
          return false;
        }
      }
      
      /**
       * Load data from Origin Private File System
       * @param {string} key - Storage key
       * @returns {Promise<*>} Retrieved value or null
       * @private
       */
      static async _loadFromOPFS(key) {
        if (!this._opfsRoot) {
          try {
            this._opfsRoot = await navigator.storage.getDirectory();
          } catch (e) {
            console.error('Failed to get OPFS root directory:', e);
            return null;
          }
        }
        
        try {
          // Sanitize key for file system use
          const safeKey = key.replace(/[^a-z0-9_-]/gi, '_') + '.json';
          
          // Get file
          const fileHandle = await this._opfsRoot.getFileHandle(safeKey);
          const file = await fileHandle.getFile();
          
          // Read data
          return await file.text();
        } catch (e) {
          // File not found or other error
          if (e.name !== 'NotFoundError') {
            console.error('OPFS read failed:', e);
          }
          return null;
        }
      }
      
      /**
       * Remove data from Origin Private File System
       * @param {string} key - Storage key
       * @returns {Promise<boolean>} Success status
       * @private
       */
      static async _removeFromOPFS(key) {
        if (!this._opfsRoot) {
          try {
            this._opfsRoot = await navigator.storage.getDirectory();
          } catch (e) {
            console.error('Failed to get OPFS root directory:', e);
            return false;
          }
        }
        
        try {
          // Sanitize key for file system use
          const safeKey = key.replace(/[^a-z0-9_-]/gi, '_') + '.json';
          
          // Remove file
          await this._opfsRoot.removeEntry(safeKey);
          return true;
        } catch (e) {
          // File not found is OK
          if (e.name === 'NotFoundError') {
            return true;
          }
          console.error('OPFS remove failed:', e);
          return false;
        }
      }
      
      /**
       * Create a backup of settings
       * @param {Object} settings - Settings to backup
       * @param {string} type - Backup type/reason
       * @returns {Promise<boolean>} Success status
       */
      static async createBackup(settings, type = 'manual') {
        if (!this._idbDatabase) {
          await this._initializeIndexedDB().catch(console.error);
        }
        
        if (!this._idbDatabase) {
          return false;
        }
        
        try {
          const backup = {
            timestamp: Date.now(),
            date: new Date().toISOString(),
            type,
            settings: JSON.parse(JSON.stringify(settings)), // Deep copy
            version: settings.version || '3.0.0'
          };
          
          // Remove sensitive data
          for (const key in backup.settings) {
            if (SETTINGS_SCHEMA[key]?.sensitive) {
              backup.settings[key] = true; // Just indicate it exists
            }
          }
          
          const transaction = this._idbDatabase.transaction('backups', 'readwrite');
          const store = transaction.objectStore('backups');
          
          await new Promise((resolve, reject) => {
            const request = store.add(backup);
            request.onsuccess = resolve;
            request.onerror = reject;
          });
          
          // Prune old backups (keep last 10)
          await this._pruneBackups();
          
          return true;
        } catch (e) {
          console.error('Failed to create backup:', e);
          return false;
        }
      }
      
      /**
       * Get list of available backups
       * @param {string} [type] - Optional backup type filter
       * @returns {Promise<Array>} List of backups
       */
      static async getBackups(type = null) {
        if (!this._idbDatabase) {
          await this._initializeIndexedDB().catch(console.error);
        }
        
        if (!this._idbDatabase) {
          return [];
        }
        
        try {
          const transaction = this._idbDatabase.transaction('backups', 'readonly');
          const store = transaction.objectStore('backups');
          
          let request;
          if (type) {
            const index = store.index('byType');
            request = index.getAll(type);
          } else {
            request = store.getAll();
          }
          
          return await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = reject;
          });
        } catch (e) {
          console.error('Failed to get backups:', e);
          return [];
        }
      }
      
      /**
       * Restore settings from a backup
       * @param {number} timestamp - Backup timestamp to restore
       * @returns {Promise<Object|null>} Restored settings or null if failed
       */
      static async restoreBackup(timestamp) {
        if (!this._idbDatabase) {
          await this._initializeIndexedDB().catch(console.error);
        }
        
        if (!this._idbDatabase) {
          return null;
        }
        
        try {
          const transaction = this._idbDatabase.transaction('backups', 'readonly');
          const store = transaction.objectStore('backups');
          
          const backup = await new Promise((resolve, reject) => {
            const request = store.get(timestamp);
            request.onsuccess = () => resolve(request.result);
            request.onerror = reject;
          });
          
          if (!backup) {
            console.error('Backup not found:', timestamp);
            return null;
          }
          
          return backup.settings;
        } catch (e) {
          console.error('Failed to restore backup:', e);
          return null;
        }
      }
      
      /**
       * Prune old backups, keeping only the latest ones
       * @param {number} [keepCount=10] - Number of backups to keep
       * @returns {Promise<boolean>} Success status
       * @private
       */
      static async _pruneBackups(keepCount = 10) {
        if (!this._idbDatabase) {
          return false;
        }
        
        try {
          const transaction = this._idbDatabase.transaction('backups', 'readwrite');
          const store = transaction.objectStore('backups');
          
          // Get all backups
          const backups = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = reject;
          });
          
          // Sort by timestamp (newest first)
          backups.sort((a, b) => b.timestamp - a.timestamp);
          
          // Delete oldest backups
          if (backups.length > keepCount) {
            const toDelete = backups.slice(keepCount);
            
            for (const backup of toDelete) {
              await new Promise((resolve, reject) => {
                const request = store.delete(backup.timestamp);
                request.onsuccess = resolve;
                request.onerror = reject;
              });
            }
          }
          
          return true;
        } catch (e) {
          console.error('Failed to prune backups:', e);
          return false;
        }
      }
      
      /**
       * Start a batch operation (transaction)
       * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
       * @returns {Promise<Object>} Transaction object
       */
      static async startBatch(mode = 'readwrite') {
        if (!this._idbDatabase) {
          await this._initializeIndexedDB().catch(console.error);
        }
        
        if (!this._idbDatabase) {
          throw new Error('IndexedDB not available');
        }
        
        try {
          const transaction = this._idbDatabase.transaction('settings', mode);
          const store = transaction.objectStore('settings');
          
          // Return a transaction wrapper for batch operations
          return {
            transaction,
            store,
            
            // Save method
            async save(key, value, options = {}) {
              return StorageManager._saveToIndexedDB(key, value, { 
                ...options, 
                transaction 
              });
            },
            
            // Load method
            async load(key, defaultValue, options = {}) {
              return StorageManager._loadFromIndexedDB(key, { 
                ...options, 
                transaction 
              });
            },
            
            // Method to complete the transaction
            async complete() {
              return new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = (e) => reject(e.target.error);
                transaction.onabort = () => reject(new Error('Transaction aborted'));
              });
            },
            
            // Method to abort the transaction
            abort() {
              transaction.abort();
            }
          };
        } catch (e) {
          console.error('Failed to start batch operation:', e);
          throw e;
        }
      }
    }
    
    // ===============================================================
    // Event System
    // ===============================================================
    
    /**
     * Enhanced event emitter with additional features
     */
    class EventEmitter {
      constructor() {
        this.events = new Map();
        this.onceEvents = new WeakMap();
        this._lastEvents = new Map(); // For replay of last event
      }
      
      /**
       * Subscribe to an event
       * @param {string} event - Event name
       * @param {Function} listener - Event callback
       * @param {Object} [options={}] - Subscription options
       * @returns {Function} Unsubscribe function
       */
      on(event, listener, options = {}) {
        const {
          replay = false, // Replay last event immediately
          priority = 0,   // Higher priority gets called first
          once = false    // Remove after first execution
        } = options;
        
        // Create event array if it doesn't exist
        if (!this.events.has(event)) {
          this.events.set(event, []);
        }
        
        // Store listener with metadata
        const subscription = { listener, priority };
        this.events.get(event).push(subscription);
        
        // Sort by priority (higher numbers first)
        this.events.get(event).sort((a, b) => b.priority - a.priority);
        
        // Mark as once event if requested
        if (once) {
          this.onceEvents.set(listener, event);
        }
        
        // Replay last event if requested and available
        if (replay && this._lastEvents.has(event)) {
          try {
            listener(this._lastEvents.get(event));
          } catch (error) {
            console.error(`Error replaying event "${event}":`, error);
          }
        }
        
        // Return unsubscribe function
        return () => this.off(event, listener);
      }
      
      /**
       * Subscribe to an event once
       * @param {string} event - Event name
       * @param {Function} listener - Event callback
       * @param {Object} [options={}] - Subscription options
       * @returns {Function} Unsubscribe function
       */
      once(event, listener, options = {}) {
        return this.on(event, listener, { ...options, once: true });
      }
      
      /**
       * Unsubscribe from an event
       * @param {string} event - Event name
       * @param {Function} listener - Event callback to remove
       */
      off(event, listener) {
        if (!this.events.has(event)) return;
        
        const eventListeners = this.events.get(event);
        const index = eventListeners.findIndex(sub => sub.listener === listener);
        
        if (index !== -1) {
          eventListeners.splice(index, 1);
          
          // Clean up empty arrays
          if (eventListeners.length === 0) {
            this.events.delete(event);
          }
          
          // Clean up once events mapping
          if (this.onceEvents.has(listener)) {
            this.onceEvents.delete(listener);
          }
        }
      }
      
      /**
       * Emit an event with error handling
       * @param {string} event - Event name
       * @param {*} data - Event data
       * @returns {Promise<boolean>} Whether event had listeners
       */
      async emit(event, data) {
        // Store last event for potential replay
        this._lastEvents.set(event, data);
        
        const eventListeners = this.events.get(event) || [];
        const wildcardListeners = this.events.get('*') || [];
        
        // Exit early if no handlers
        if (eventListeners.length === 0 && wildcardListeners.length === 0) {
          return false;
        }
        
        // Track listeners to remove (once events)
        const onceListeners = [];
        
        // Execute specific event handlers
        if (eventListeners.length > 0) {
          const promises = eventListeners.map(subscription => {
            const { listener } = subscription;
            
            try {
              const result = listener(data);
              
              // Check if this is a once listener
              if (this.onceEvents.has(listener) && this.onceEvents.get(listener) === event) {
                onceListeners.push(listener);
              }
              
              // Handle promise-returning listeners
              if (result instanceof Promise) {
                return result.catch(error => {
                  console.error(`Error in async event listener for "${event}":`, error);
                });
              }
              
              return Promise.resolve();
            } catch (error) {
              console.error(`Error in event listener for "${event}":`, error);
              return Promise.resolve();
            }
          });
          
          // Wait for all async handlers to complete
          await Promise.all(promises);
        }
        
        // Execute wildcard handlers
        if (wildcardListeners.length > 0) {
          const promises = wildcardListeners.map(subscription => {
            const { listener } = subscription;
            
            try {
              const result = listener(event, data);
              
              // Check if this is a once listener
              if (this.onceEvents.has(listener) && this.onceEvents.get(listener) === '*') {
                onceListeners.push(listener);
              }
              
              // Handle promise-returning listeners
              if (result instanceof Promise) {
                return result.catch(error => {
                  console.error(`Error in async wildcard event listener for "${event}":`, error);
                });
              }
              
              return Promise.resolve();
            } catch (error) {
              console.error(`Error in wildcard event listener for "${event}":`, error);
              return Promise.resolve();
            }
          });
          
          // Wait for all async handlers to complete
          await Promise.all(promises);
        }
        
        // Clean up any once listeners
        for (const listener of onceListeners) {
          const eventName = this.onceEvents.get(listener);
          this.off(eventName, listener);
        }
        
        return true;
      }
      
      /**
       * Check if event has listeners
       * @param {string} event - Event name
       * @returns {boolean} Has listeners
       */
      hasListeners(event) {
        return this.events.has(event) && this.events.get(event).length > 0;
      }
      
      /**
       * Get count of listeners for an event
       * @param {string} event - Event name
       * @returns {number} Listener count
       */
      listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
      }
      
      /**
       * Remove all listeners for an event or all events
       * @param {string} [event] - Optional event name (omit to clear all)
       */
      removeAllListeners(event) {
        if (event) {
          this.events.delete(event);
          
          // Clean up matching once events
          for (const [listener, eventName] of this.onceEvents.entries()) {
            if (eventName === event) {
              this.onceEvents.delete(listener);
            }
          }
        } else {
          this.events.clear();
          this.onceEvents = new WeakMap();
        }
      }
    }
    
    // ===============================================================
    // DOM Utilities
    // ===============================================================
    
    /**
     * Enhanced DOM utilities for efficient element manipulation
     */
    class DOMUtils {
      // Element cache for performance
      static _elementCache = new Map();
      static _resizeObservers = new Map();
      static _intersectionObservers = new Map();
      static _mutationObservers = new Map();
      
      /**
       * Get element by ID from cache or DOM
       * @param {string} id - Element ID
       * @param {boolean} [forceRefresh=false] - Whether to bypass cache
       * @returns {HTMLElement|null} Found element or null
       */
      static getElement(id, forceRefresh = false) {
        // Return from cache if available and not forcing refresh
        if (!forceRefresh && this._elementCache.has(id)) {
          return this._elementCache.get(id);
        }
        
        // Find in DOM
        const element = document.getElementById(id);
        if (element) {
          this._elementCache.set(id, element);
        } else if (this._elementCache.has(id)) {
          // Remove from cache if no longer in DOM
          this._elementCache.delete(id);
        }
        
        return element;
      }
      
      /**
       * Get elements by selector and cache them with key
       * @param {string} selector - CSS selector
       * @param {string} [cacheKey=null] - Cache key
       * @param {HTMLElement|Document} [context=document] - Search context
       * @param {boolean} [forceRefresh=false] - Whether to bypass cache
       * @returns {NodeList} Elements matching selector
       */
      static getElements(selector, cacheKey = null, context = document, forceRefresh = false) {
        if (cacheKey && !forceRefresh && this._elementCache.has(cacheKey)) {
          return this._elementCache.get(cacheKey);
        }
        
        const elements = context.querySelectorAll(selector);
        
        if (cacheKey) {
          this._elementCache.set(cacheKey, elements);
        }
        
        return elements;
      }
      
      /**
       * Find first element matching selector
       * @param {string} selector - CSS selector
       * @param {HTMLElement|Document} [context=document] - Search context
       * @returns {HTMLElement|null} Found element or null
       */
      static findElement(selector, context = document) {
        return context.querySelector(selector);
      }
      
      /**
       * Clear element cache
       * @param {string} [key] - Specific cache key to clear, or all if omitted
       */
      static clearCache(key) {
        if (key) {
          this._elementCache.delete(key);
        } else {
          this._elementCache.clear();
        }
      }
      
      /**
       * Create element with attributes and properties
       * @param {string} tagName - Element tag name
       * @param {Object} [attributes={}] - HTML attributes
       * @param {Object} [properties={}] - Element properties
       * @param {string|Array|Node} [children] - Child elements or text
       * @returns {HTMLElement} Created element
       */
      static createElement(tagName, attributes = {}, properties = {}, children = null) {
        const element = document.createElement(tagName);
        
        // Set attributes
        Object.entries(attributes).forEach(([name, value]) => {
          if (value === null || value === undefined) {
            element.removeAttribute(name);
          } else if (value === true) {
            element.setAttribute(name, '');
          } else if (value !== false) {
            element.setAttribute(name, value);
          }
        });
        
        // Set properties
        Object.entries(properties).forEach(([name, value]) => {
          if (name in element) {
            element[name] = value;
          }
        });
        
        // Add children
        if (children !== null) {
          if (Array.isArray(children)) {
            children.forEach(child => {
              if (child instanceof Node) {
                element.appendChild(child);
              } else if (child !== null && child !== undefined) {
                element.appendChild(document.createTextNode(String(child)));
              }
            });
          } else if (children instanceof Node) {
            element.appendChild(children);
          } else if (typeof children === 'string') {
            element.textContent = children;
          }
        }
        
        return element;
      }
      
      /**
       * Create element from HTML string
       * @param {string} html - HTML string
       * @returns {DocumentFragment} Document fragment with created elements
       */
      static createElementFromHTML(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.cloneNode(true);
      }
      
      /**
       * Add multiple classes to an element
       * @param {HTMLElement} element - Target element
       * @param {...string} classes - Classes to add
       */
      static addClasses(element, ...classes) {
        if (!element || !element.classList) return;
        const filteredClasses = classes.filter(Boolean);
        if (filteredClasses.length > 0) {
          element.classList.add(...filteredClasses);
        }
      }
      
      /**
       * Remove multiple classes from an element
       * @param {HTMLElement} element - Target element
       * @param {...string} classes - Classes to remove
       */
      static removeClasses(element, ...classes) {
        if (!element || !element.classList) return;
        const filteredClasses = classes.filter(Boolean);
        if (filteredClasses.length > 0) {
          element.classList.remove(...filteredClasses);
        }
      }
      
      /**
       * Toggle multiple classes on an element
       * @param {HTMLElement} element - Target element
       * @param {Object} classMap - Map of class names to boolean conditions
       */
      static toggleClasses(element, classMap) {
        if (!element || !element.classList) return;
        
        Object.entries(classMap).forEach(([className, condition]) => {
          element.classList.toggle(className, Boolean(condition));
        });
      }
      
      /**
       * Set attributes on an element
       * @param {HTMLElement} element - Target element
       * @param {Object} attributes - Attributes to set
       */
      static setAttributes(element, attributes) {
        if (!element) return;
        
        Object.entries(attributes).forEach(([attr, value]) => {
          if (value === null || value === undefined) {
            element.removeAttribute(attr);
          } else if (value === true) {
            element.setAttribute(attr, '');
          } else if (value !== false) {
            element.setAttribute(attr, value);
          }
        });
      }
      
      /**
       * Set element content safely
       * @param {HTMLElement} element - Target element
       * @param {string|HTMLElement|DocumentFragment} content - Content to set
       * @param {Object} [options={}] - Options
       */
      static setContent(element, content, options = {}) {
        if (!element) return;
        
        const { append = false, html = false } = options;
        
        if (!append) {
          // Clear existing content using more performant textContent
          element.textContent = '';
        }
        
        if (content instanceof Node) {
          element.appendChild(content);
        } else if (html) {
          // Set as HTML
          const position = append ? 'beforeend' : 'afterbegin';
          element.insertAdjacentHTML(position, String(content));
        } else {
          // Set as text (avoids XSS)
          const textNode = document.createTextNode(String(content));
          element.appendChild(textNode);
        }
      }
      
      /**
       * Create a debounced function
       * @param {Function} func - Function to debounce
       * @param {number} wait - Debounce wait time in ms
       * @param {Object} [options={}] - Options object
       * @returns {Function} Debounced function
       */
      static debounce(func, wait = 300, options = {}) {
        const { leading = false, trailing = true, maxWait = null } = options;
        let timeout;
        let lastCallTime = 0;
        let lastInvokeTime = 0;
        let result;
        
        function invokeFunc(time) {
          lastInvokeTime = time;
          result = func();
          return result;
        }
        
        function shouldInvoke(time) {
          const timeSinceLastCall = time - lastCallTime;
          const timeSinceLastInvoke = time - lastInvokeTime;
          
          return (
            lastCallTime === 0 || // First call
            timeSinceLastCall >= wait || // Regular debounce condition
            timeSinceLastCall < 0 || // System time adjusted backwards
            (maxWait !== null && timeSinceLastInvoke >= maxWait) // maxWait exceeded
          );
        }
        
        function timerExpired() {
          const time = Date.now();
          
          if (shouldInvoke(time)) {
            return trailingEdge(time);
          }
          
          // Restart timer
          const timeWaiting = wait - (time - lastCallTime);
          const maxTimeWaiting = maxWait !== null ? 
            Math.min(maxWait - (time - lastInvokeTime), timeWaiting) : 
            timeWaiting;
            
          timeout = setTimeout(timerExpired, maxTimeWaiting);
        }
        
        function leadingEdge(time) {
          lastInvokeTime = time;
          
          // Start trailing edge timer
          timeout = setTimeout(timerExpired, wait);
          
          // Invoke immediately for leading edge
          return leading ? invokeFunc(time) : result;
        }
        
        function trailingEdge(time) {
          timeout = undefined;
          
          // Invoke if trailing edge is enabled
          if (trailing && lastCallTime !== 0) {
            return invokeFunc(time);
          }
          
          // Reset for next debounce cycle
          lastCallTime = 0;
          return result;
        }
        
        function cancel() {
          if (timeout !== undefined) {
            clearTimeout(timeout);
          }
          lastInvokeTime = 0;
          lastCallTime = 0;
          timeout = undefined;
        }
        
        function flush() {
          return timeout === undefined ? result : trailingEdge(Date.now());
        }
        
        function debounced(...args) {
          const time = Date.now();
          const isInvoking = shouldInvoke(time);
          
          // Store latest call time
          lastCallTime = time;
          
          if (isInvoking) {
            // No active timer, start new timer
            if (timeout === undefined) {
              return leadingEdge(time);
            }
            
            // Handle maxWait case
            if (maxWait !== null) {
              // Clear current timer
              clearTimeout(timeout);
              // Start new timer
              timeout = setTimeout(timerExpired, wait);
              // Invoke function
              return invokeFunc(time);
            }
          }
          
          // Start timer if it doesn't exist
          if (timeout === undefined) {
            timeout = setTimeout(timerExpired, wait);
          }
          
          return result;
        }
        
        // Add control methods
        debounced.cancel = cancel;
        debounced.flush = flush;
        
        return debounced;
      }
      
      /**
       * Create a throttled function
       * @param {Function} func - Function to throttle
       * @param {number} wait - Throttle wait time
       * @param {Object} [options={}] - Options object
       * @returns {Function} Throttled function
       */
      static throttle(func, wait = 300, options = {}) {
        const { leading = true, trailing = true } = options;
        
        // Use debounce with maxWait equal to wait
        return this.debounce(func, wait, {
          leading,
          trailing,
          maxWait: wait
        });
      }
      
      /**
       * Observe element resizes
       * @param {HTMLElement} element - Element to observe
       * @param {Function} callback - Resize callback
       * @param {Object} [options={}] - ResizeObserver options
       * @returns {Function} Unobserve function
       */
      static observeResize(element, callback, options = {}) {
        if (!element) return () => {};
        
        try {
          // Create a unique key for the observer based on the callback
          const observerKey = callback.toString().slice(0, 100);
          
          // Create observer if not exists
          if (!this._resizeObservers.has(observerKey)) {
            const observer = new ResizeObserver(entries => {
              for (const entry of entries) {
                callback(entry.target, entry.contentRect);
              }
            });
            
            this._resizeObservers.set(observerKey, observer);
          }
          
          const observer = this._resizeObservers.get(observerKey);
          observer.observe(element, options);
          
          // Return unobserve function
          return () => {
            if (observer) {
              observer.unobserve(element);
              
              // Check if observer has any targets left
              const targets = observer.targets || [];
              if (targets.length === 0) {
                observer.disconnect();
                this._resizeObservers.delete(observerKey);
              }
            }
          };
        } catch (e) {
          console.warn('ResizeObserver not supported:', e);
          return () => {};
        }
      }
      
      /**
       * Observe element visibility
       * @param {HTMLElement} element - Element to observe
       * @param {Function} callback - Visibility callback
       * @param {Object} [options={}] - IntersectionObserver options
       * @returns {Function} Unobserve function
       */
      static observeVisibility(element, callback, options = {}) {
        if (!element) return () => {};
        
        try {
          const observerKey = JSON.stringify(options);
          
          // Create observer if not exists
          if (!this._intersectionObservers.has(observerKey)) {
            const observer = new IntersectionObserver(entries => {
              for (const entry of entries) {
                const visibilityCallback = entry.target._visibilityCallback;
                if (visibilityCallback) {
                  visibilityCallback(entry.isIntersecting, entry);
                }
              }
            }, options);
            
            this._intersectionObservers.set(observerKey, observer);
          }
          
          const observer = this._intersectionObservers.get(observerKey);
          
          // Store callback on element using WeakMap to prevent memory leaks
          const callbackStore = new WeakMap();
          callbackStore.set(element, callback);
          element._visibilityCallback = (isIntersecting, entry) => {
            const cb = callbackStore.get(element);
            if (cb) cb(isIntersecting, entry);
          };
          
          // Start observing
          observer.observe(element);
          
          // Return unobserve function
          return () => {
            if (observer) {
              observer.unobserve(element);
              
              // Clean up callback
              delete element._visibilityCallback;
              callbackStore.delete(element);
              
              // Check if observer has any targets left
              if (observer.takeRecords().length === 0) {
                observer.disconnect();
                this._intersectionObservers.delete(observerKey);
              }
            }
          };
        } catch (e) {
          console.warn('IntersectionObserver not supported:', e);
          return () => {};
        }
      }
      
      /**
       * Observe DOM mutations
       * @param {HTMLElement} element - Element to observe
       * @param {Function} callback - Mutation callback
       * @param {Object} [options={}] - MutationObserver options
       * @returns {Function} Unobserve function
       */
      static observeMutations(element, callback, options = {}) {
        if (!element) return () => {};
        
        const defaultOptions = {
          childList: true,
          subtree: true,
          attributes: false,
          characterData: false
        };
        
        const observerOptions = { ...defaultOptions, ...options };
        
        try {
          // Create a unique key for the observer
          const observerKey = element.id || element.className || Math.random().toString(36).substring(2, 10);
          
          // Create observer if not exists
          if (!this._mutationObservers.has(observerKey)) {
            const observer = new MutationObserver(mutations => {
              callback(mutations, observer);
            });
            
            this._mutationObservers.set(observerKey, observer);
          }
          
          const observer = this._mutationObservers.get(observerKey);
          observer.observe(element, observerOptions);
          
          // Return unobserve function
          return () => {
            if (observer) {
              observer.disconnect();
              this._mutationObservers.delete(observerKey);
            }
          };
        } catch (e) {
          console.warn('MutationObserver not supported:', e);
          return () => {};
        }
      }
      
      /**
       * Animate an element with CSS transitions
       * @param {HTMLElement} element - Element to animate
       * @param {Object} properties - CSS properties to animate
       * @param {Object} [options={}] - Animation options
       * @returns {Promise} Promise that resolves when animation completes
       */
      static animate(element, properties, options = {}) {
        if (!element) return Promise.resolve();
        
        const {
          duration = 300,
          easing = 'ease',
          delay = 0,
          cleanup = true,
          additionalClasses = []
        } = options;
        
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion && options.respectReducedMotion !== false) {
          // Apply final state immediately without animation
          Object.entries(properties).forEach(([prop, value]) => {
            element.style[prop] = value;
          });
          
          // Add classes without animation
          if (additionalClasses.length) {
            this.addClasses(element, ...additionalClasses);
          }
          
          return Promise.resolve();
        }
        
        return new Promise(resolve => {
          // Store original properties for cleanup
          const originalProperties = {};
          const transitionProperties = [];
          
          // Add transition property for smooth animation
          element.style.transition = `all ${duration}ms ${easing} ${delay}ms`;
          
          // Add animation classes if any
          if (additionalClasses.length) {
            this.addClasses(element, ...additionalClasses);
          }
          
          // Force browser to acknowledge the transition setup before changing properties
          // This prevents transitioning from default state
          void element.offsetWidth;
          
          // Store original values and prepare transition properties
          Object.entries(properties).forEach(([prop, value]) => {
            originalProperties[prop] = element.style[prop];
            transitionProperties.push(prop);
            
            // Apply the new value
            element.style[prop] = value;
          });
          
          // Listen for transition end
          const onTransitionEnd = (e) => {
            if (e.target !== element) return;
            
            // If we have multiple properties, only complete when the last one finishes
            if (e.propertyName && !transitionProperties.includes(e.propertyName)) {
              return;
            }
            
            // Remove event listener
            element.removeEventListener('transitionend', onTransitionEnd);
            
            // Clean up transition
            element.style.transition = '';
            
            // Clean up properties if requested
            if (cleanup) {
              transitionProperties.forEach(prop => {
                element.style[prop] = '';
              });
            }
            
            // Remove animation classes if any
            if (additionalClasses.length && cleanup) {
              this.removeClasses(element, ...additionalClasses);
            }
            
            // Resolve promise
            resolve();
          };
          
          // Add transition end listener
          element.addEventListener('transitionend', onTransitionEnd, { once: true });
          
          // Fallback if transition doesn't trigger
          setTimeout(() => {
            if (element.style.transition) {
              onTransitionEnd({ target: element });
            }
          }, duration + delay + 50);
        });
      }
      
      /**
       * Fade in an element
       * @param {HTMLElement} element - Element to fade
       * @param {Object} [options={}] - Animation options
       * @returns {Promise} Promise that resolves when animation completes
       */
      static fadeIn(element, options = {}) {
        if (!element) return Promise.resolve();
        
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion && options.respectReducedMotion !== false) {
          // Apply final state immediately without animation
          element.style.opacity = '1';
          element.style.display = options.display || 'block';
          element.style.visibility = 'visible';
          return Promise.resolve();
        }
        
        // Save original display and visibility
        const originalDisplay = element.style.display;
        const originalVisibility = element.style.visibility;
        
        // Set initial state
        element.style.opacity = '0';
        element.style.display = options.display || (originalDisplay && originalDisplay !== 'none' ? originalDisplay : 'block');
        element.style.visibility = 'visible';
        
        // Ensure display change is processed before animation
        return new Promise(resolve => {
          requestAnimationFrame(() => {
            this.animate(element, { opacity: '1' }, {
              ...options,
              cleanup: false,
              additionalClasses: ['fade-in-active', ...(options.additionalClasses || [])]
            }).then(resolve);
          });
        });
      }
      
      /**
       * Fade out an element
       * @param {HTMLElement} element - Element to fade
       * @param {Object} [options={}] - Animation options
       * @returns {Promise} Promise that resolves when animation completes
       */
      static fadeOut(element, options = {}) {
        if (!element) return Promise.resolve();
        
        // Only animate if element is visible
        if (element.style.display === 'none' || getComputedStyle(element).display === 'none') {
          return Promise.resolve();
        }
        
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion && options.respectReducedMotion !== false) {
          // Apply final state immediately without animation
          element.style.opacity = '0';
          element.style.display = 'none';
          return Promise.resolve();
        }
        
        return this.animate(element, { opacity: '0' }, {
          ...options,
          cleanup: false,
          additionalClasses: ['fade-out-active', ...(options.additionalClasses || [])]
        }).then(() => {
          // Hide element after animation
          element.style.display = 'none';
          
          // Don't clean up opacity if specified
          if (!options.preserveStyles) {
            element.style.opacity = '';
          }
        });
      }
      
      /**
       * Slide down an element
       * @param {HTMLElement} element - Element to slide
       * @param {Object} [options={}] - Animation options
       * @returns {Promise} Promise that resolves when animation completes
       */
      static slideDown(element, options = {}) {
        if (!element) return Promise.resolve();
        
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion && options.respectReducedMotion !== false) {
          // Apply final state immediately without animation
          element.style.height = '';
          element.style.display = options.display || 'block';
          element.style.overflow = '';
          return Promise.resolve();
        }
        
        // Save original height and padding
        const originalHeight = element.style.height;
        const originalOverflow = element.style.overflow;
        
        // Set initial state
        element.style.display = options.display || 'block';
        element.style.overflow = 'hidden';
        element.style.height = '0';
        element.style.paddingTop = '0';
        element.style.paddingBottom = '0';
        element.style.marginTop = '0';
        element.style.marginBottom = '0';
        
        // Calculate target values
        const targetHeight = `${element.scrollHeight}px`;
        
        // Get computed style values for padding and margin
        const computedStyle = getComputedStyle(element);
        const targetPaddingTop = computedStyle.paddingTop;
        const targetPaddingBottom = computedStyle.paddingBottom;
        const targetMarginTop = computedStyle.marginTop;
        const targetMarginBottom = computedStyle.marginBottom;
        
        // Ensure display change is processed before animation
        return new Promise(resolve => {
          requestAnimationFrame(() => {
            this.animate(element, { 
              height: targetHeight,
              paddingTop: targetPaddingTop,
              paddingBottom: targetPaddingBottom,
              marginTop: targetMarginTop,
              marginBottom: targetMarginBottom
            }, {
              ...options,
              cleanup: true,
              additionalClasses: ['slide-down-active', ...(options.additionalClasses || [])]
            }).then(() => {
              // Reset height to allow resizing
              element.style.height = originalHeight || '';
              element.style.overflow = originalOverflow || '';
              element.style.paddingTop = '';
              element.style.paddingBottom = '';
              element.style.marginTop = '';
              element.style.marginBottom = '';
              resolve();
            });
          });
        });
      }
      
      /**
       * Slide up an element
       * @param {HTMLElement} element - Element to slide
       * @param {Object} [options={}] - Animation options
       * @returns {Promise} Promise that resolves when animation completes
       */
      static slideUp(element, options = {}) {
        if (!element) return Promise.resolve();
        
        // Only animate if element is visible
        if (element.style.display === 'none' || getComputedStyle(element).display === 'none') {
          return Promise.resolve();
        }
        
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion && options.respectReducedMotion !== false) {
          // Apply final state immediately without animation
          element.style.display = 'none';
          return Promise.resolve();
        }
        
        // Save original state
        const originalOverflow = element.style.overflow;
        
        // Set initial state to current height
        element.style.overflow = 'hidden';
        element.style.height = `${element.scrollHeight}px`;
        
        return new Promise(resolve => {
          requestAnimationFrame(() => {
            this.animate(element, { 
              height: '0',
              paddingTop: '0',
              paddingBottom: '0',
              marginTop: '0',
              marginBottom: '0'
            }, {
              ...options,
              cleanup: false,
              additionalClasses: ['slide-up-active', ...(options.additionalClasses || [])]
            }).then(() => {
              // Hide element after animation
              element.style.display = 'none';
              element.style.height = '';
              element.style.overflow = originalOverflow;
              element.style.paddingTop = '';
              element.style.paddingBottom = '';
              element.style.marginTop = '';
              element.style.marginBottom = '';
              resolve();
            });
          });
        });
      }
      
      /**
       * Check if an element is in the viewport
       * @param {HTMLElement} element - Element to check
       * @param {Object} [options={}] - Options
       * @returns {boolean} Whether element is in viewport
       */
      static isInViewport(element, options = {}) {
        if (!element) return false;
        
        const { offset = 0 } = options;
        
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        
        return (
          rect.bottom >= 0 - offset &&
          rect.right >= 0 - offset &&
          rect.top <= windowHeight + offset &&
          rect.left <= windowWidth + offset
        );
      }
      
      /**
       * Focus an element with enhanced accessibility
       * @param {HTMLElement} element - Element to focus
       * @param {Object} [options={}] - Focus options
       */
      static focusElement(element, options = {}) {
        if (!element) return;
        
        const { 
          preventScroll = false, 
          focusVisible = true,
          announce = false,
          announceMessage = ''
        } = options;
        
        // Focus the element
        element.focus({ preventScroll });
        
        // Add focus-visible class if requested
        if (focusVisible) {
          element.classList.add('focus-visible');
          
          // Set up one-time blur handler to remove class
          const blurHandler = () => {
            element.classList.remove('focus-visible');
            element.removeEventListener('blur', blurHandler);
          };
          
          element.addEventListener('blur', blurHandler);
        }
        
        // Announce to screen readers if requested
        if (announce) {
          this.announceToScreenReader(announceMessage || element.textContent);
        }
      }
      
      /**
       * Announce a message to screen readers
       * @param {string} message - Message to announce
       * @param {Object} [options={}] - Announcement options
       */
      static announceToScreenReader(message, options = {}) {
        const { 
          politeness = 'polite', // 'polite' or 'assertive'
          timeout = 50 
        } = options;
        
        // Find or create live region
        let liveRegion = document.getElementById('sr-live-region');
        
        if (!liveRegion) {
          liveRegion = document.createElement('div');
          liveRegion.id = 'sr-live-region';
          liveRegion.setAttribute('aria-live', politeness);
          liveRegion.setAttribute('aria-relevant', 'additions');
          liveRegion.setAttribute('aria-atomic', 'true');
          liveRegion.className = 'sr-only';
          document.body.appendChild(liveRegion);
        } else {
          // Update politeness
          liveRegion.setAttribute('aria-live', politeness);
        }
        
        // Clear any existing content
        liveRegion.textContent = '';
        
        // Announce after a small delay to ensure it's read
        setTimeout(() => {
          liveRegion.textContent = message;
        }, timeout);
      }
    }
    
    // ===============================================================
    // Toast Notification System
    // ===============================================================
    
    /**
     * Enhanced toast notification system
     */
    class ToastManager {
      // Container element for toasts
      static container = null;
      
      // Queue for managing multiple toasts
      static queue = [];
      
      // Track active toasts
      static activeToasts = new Map();
      
      // Maximum number of concurrent toasts
      static maxToasts = 3;
      
      // Default configuration
      static defaultConfig = {
        position: 'top-right',  // 'top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center'
        newestOnTop: true,
        pauseOnHover: true,
        closeOnClick: false,
        showProgressBar: true,
        theme: 'light'  // 'light', 'dark', 'colored', 'auto'
      };
      
      // Current configuration
      static config = { ...ToastManager.defaultConfig };
      
      /**
       * Configure toast system
       * @param {Object} options - Configuration options
       */
      static configure(options = {}) {
        this.config = { ...this.defaultConfig, ...options };
        
        // Update container if it exists
        if (this.container) {
          this.container.className = `toast-container toast-${this.config.position}`;
          this.container.dataset.theme = this.config.theme;
          this.container.dataset.newestOnTop = this.config.newestOnTop;
        }
      }
      
      /**
       * Initialize toast container
       * @private
       */
      static _initContainer() {
        if (this.container) return;
        
        // Check for existing container
        this.container = document.getElementById('toastContainer');
        
        if (!this.container) {
          // Create new container if needed
          this.container = document.createElement('div');
          this.container.id = 'toastContainer';
          this.container.className = `toast-container toast-${this.config.position}`;
          this.container.dataset.theme = this.config.theme;
          this.container.dataset.newestOnTop = this.config.newestOnTop;
          this.container.setAttribute('role', 'region');
          this.container.setAttribute('aria-label', 'Notifications');
          document.body.appendChild(this.container);
        }
        
        // Add to ARIA live region
        if (!this.container.hasAttribute('aria-live')) {
          this.container.setAttribute('aria-live', 'polite');
          this.container.setAttribute('aria-atomic', 'false');
          this.container.setAttribute('aria-relevant', 'additions removals');
        }
      }
      
      /**
       * Show a toast notification
       * @param {Object|string} options - Toast options or message string
       * @returns {Object} Toast control object
       */
      static show(options) {
        // Handle string input
        if (typeof options === 'string') {
          options = { message: options };
        }
        
        this._initContainer();
        
        // Parse options
        const {
          title = '',
          message = '',
          type = 'info',
          duration = 5000,
          closable = true,
          actions = [],
          onClose,
          onClick,
          pauseOnHover = this.config.pauseOnHover,
          closeOnClick = this.config.closeOnClick,
          showProgressBar = this.config.showProgressBar,
          id = `toast-${Date.now()}-${Math.floor(Math.random() * 10000)}`
        } = options;
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.id = id;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        
        // Add dismiss animation class on click
        const dismiss = () => this.dismiss(id);
        
        // Build toast content
        let contentHTML = '';
        
        if (title) {
          contentHTML += `<div class="toast-header">
            <div class="toast-title">${title}</div>
            ${closable ? `<button class="toast-close" aria-label="Close">&times;</button>` : ''}
          </div>`;
        }
        
        contentHTML += `<div class="toast-body">${message}</div>`;
        
        if (actions.length > 0) {
          contentHTML += `<div class="toast-actions">
            ${actions.map((action, index) => 
              `<button class="toast-action ${action.className || ''}" data-action-index="${index}">${action.label}</button>`
            ).join('')}
          </div>`;
        }
        
        // Add progress bar if needed
        if (showProgressBar && duration !== Infinity) {
          contentHTML += `<div class="toast-progress-container">
            <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
          </div>`;
        }
        
        toast.innerHTML = contentHTML;
        
        // Set up event handlers
        if (closable) {
          const closeButton = toast.querySelector('.toast-close');
          if (closeButton) {
            closeButton.addEventListener('click', (e) => {
              e.stopPropagation();
              dismiss();
            });
          }
        }
        
        // Set up action handlers
        actions.forEach((action, index) => {
          const actionButton = toast.querySelector(`[data-action-index="${index}"]`);
          if (actionButton && action.onClick) {
            actionButton.addEventListener('click', (e) => {
              e.stopPropagation();
              action.onClick(e);
              if (action.closeOnClick !== false) {
                dismiss();
              }
            });
          }
        });
        
        // Add click handler to entire toast if needed
        if (onClick || closeOnClick) {
          toast.addEventListener('click', (e) => {
            // Don't trigger on buttons
            if (e.target.tagName !== 'BUTTON') {
              if (onClick) onClick(e);
              if (closeOnClick) dismiss();
            }
          });
        }
        
        // Add hover handlers for pausing
        let progressBar = null;
        if (pauseOnHover && duration !== Infinity) {
          progressBar = toast.querySelector('.toast-progress');
          
          toast.addEventListener('mouseenter', () => {
            if (progressBar) {
              progressBar.style.animationPlayState = 'paused';
            }
            
            // Pause the timer
            const toastData = this.activeToasts.get(id);
            if (toastData && toastData.timerId) {
              clearTimeout(toastData.timerId);
              toastData.remainingTime = toastData.expireAt - Date.now();
            }
          });
          
          toast.addEventListener('mouseleave', () => {
            if (progressBar) {
              progressBar.style.animationPlayState = 'running';
            }
            
            // Resume the timer with remaining time
            const toastData = this.activeToasts.get(id);
            if (toastData && toastData.remainingTime) {
              toastData.timerId = setTimeout(() => {
                this.dismiss(id);
              }, toastData.remainingTime);
              toastData.expireAt = Date.now() + toastData.remainingTime;
            }
          });
        }
        
        // Add to queue
        const toastItem = { 
          id, 
          element: toast, 
          onClose, 
          duration,
          timerId: null,
          expireAt: 0,
          remainingTime: 0
        };
        
        this.queue.push(toastItem);
        this._processQueue();
        
        // Return control object
        return {
          id,
          dismiss: () => this.dismiss(id),
          update: (newOptions) => this.update(id, newOptions)
        };
      }
      
      /**
       * Process the toast queue
       * @private
       */
      static _processQueue() {
        // Check if we can show more toasts
        while (this.queue.length > 0 && this.activeToasts.size < this.maxToasts) {
          const toastItem = this.queue.shift();
          this._showToast(toastItem);
        }
      }
      
      /**
       * Show a toast element
       * @param {Object} toastItem - Toast item object
       * @private
       */
      static _showToast(toastItem) {
        const { id, element, duration } = toastItem;
        
        // Add to DOM at beginning or end based on config
        if (this.config.newestOnTop) {
          this.container.prepend(element);
        } else {
          this.container.appendChild(element);
        }
        
        // Reset animation for progress bar
        const progressBar = element.querySelector('.toast-progress');
        if (progressBar) {
          progressBar.style.animation = 'none';
          void element.offsetWidth; // Force reflow
          progressBar.style.animation = '';
        }
        
        // Track active toast
        const expireAt = duration !== Infinity ? Date.now() + duration : Infinity;
        
        this.activeToasts.set(id, {
          element,
          timerId: null,
          onClose: toastItem.onClose,
          expireAt,
          remainingTime: duration
        });
        
        // Force browser reflow
        void element.offsetWidth;
        
        // Add visible class to start animation
        element.classList.add('visible');
        
        // Set timeout for auto-dismiss
        if (duration !== Infinity) {
          const timerId = setTimeout(() => {
            this.dismiss(id);
          }, duration);
          
          // Store timer ID for potential cancellation
          this.activeToasts.get(id).timerId = timerId;
        }
      }
      
      /**
       * Update an active toast
       * @param {string} id - Toast ID
       * @param {Object} options - New options
       */
      static update(id, options) {
        const activeToast = this.activeToasts.get(id);
        if (!activeToast) return;
        
        const { element, timerId } = activeToast;
        const {
          title,
          message,
          type,
          duration,
          actions
        } = options;
        
        // Update type class
        if (type) {
          element.className = element.className.replace(/toast-(?:info|success|warning|error)/g, '');
          element.classList.add(`toast-${type}`);
        }
        
        // Update title
        if (title !== undefined) {
          const titleElement = element.querySelector('.toast-title');
          if (titleElement) {
            titleElement.textContent = title;
          }
        }
        
        // Update message
        if (message !== undefined) {
          const bodyElement = element.querySelector('.toast-body');
          if (bodyElement) {
            bodyElement.textContent = message;
          }
        }
        
        // Update actions
        if (actions) {
          const actionsContainer = element.querySelector('.toast-actions');
          if (actionsContainer) {
            // Remove existing actions
            actionsContainer.innerHTML = '';
            
            // Add new actions
            actions.forEach((action, index) => {
              const button = document.createElement('button');
              button.className = `toast-action ${action.className || ''}`;
              button.dataset.actionIndex = index;
              button.textContent = action.label;
              
              button.addEventListener('click', (e) => {
                e.stopPropagation();
                if (action.onClick) action.onClick(e);
                if (action.closeOnClick !== false) {
                  this.dismiss(id);
                }
              });
              
              actionsContainer.appendChild(button);
            });
          }
        }
        
        // Update duration
        if (duration !== undefined) {
          // Clear existing timer
          if (timerId) {
            clearTimeout(timerId);
          }
          
          // Update progress bar
          const progressBar = element.querySelector('.toast-progress');
          if (progressBar) {
            progressBar.style.animationDuration = `${duration}ms`;
            
            // Reset animation
            progressBar.style.animation = 'none';
            void element.offsetWidth; // Force reflow
            progressBar.style.animation = '';
          }
          
          // Set new timer
          if (duration !== Infinity) {
            const newTimerId = setTimeout(() => {
              this.dismiss(id);
            }, duration);
            
            activeToast.timerId = newTimerId;
            activeToast.expireAt = Date.now() + duration;
            activeToast.remainingTime = duration;
          } else {
            activeToast.timerId = null;
            activeToast.expireAt = Infinity;
            activeToast.remainingTime = Infinity;
          }
        }
      }
      
      /**
       * Dismiss a toast
       * @param {string} id - Toast ID
       */
      static dismiss(id) {
        const activeToast = this.activeToasts.get(id);
        if (!activeToast) return;
        
        const { element, timerId, onClose } = activeToast;
        
        // Clear timeout if exists
        if (timerId) {
          clearTimeout(timerId);
        }
        
        // Start dismiss animation
        element.classList.remove('visible');
        element.classList.add('dismissing');
        
        // Remove after animation finishes
        setTimeout(() => {
          // Call onClose callback if provided
          if (typeof onClose === 'function') {
            onClose();
          }
          
          // Remove element
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
          
          // Remove from active toasts
          this.activeToasts.delete(id);
          
          // Process next in queue
          this._processQueue();
        }, 300);
      }
      
      /**
       * Dismiss all active toasts
       * @param {Object} [options={}] - Dismiss options
       */
      static dismissAll(options = {}) {
        const { animate = true } = options;
        
        // Get all IDs to avoid modification during iteration
        const toastIds = [...this.activeToasts.keys()];
        
        if (!animate) {
          // Immediately remove all toasts
          toastIds.forEach(id => {
            const activeToast = this.activeToasts.get(id);
            if (activeToast) {
              if (activeToast.timerId) {
                clearTimeout(activeToast.timerId);
              }
              
              if (activeToast.element.parentNode) {
                activeToast.element.parentNode.removeChild(activeToast.element);
              }
              
              // Call onClose callback if provided
              if (typeof activeToast.onClose === 'function') {
                activeToast.onClose();
              }
            }
          });
          
          // Clear active toasts
          this.activeToasts.clear();
        } else {
          // Dismiss each toast with animation
          toastIds.forEach(id => this.dismiss(id));
        }
        
        // Clear the queue
        this.queue = [];
      }
      
      /**
       * Show a success toast
       * @param {string} title - Toast title
       * @param {string} message - Toast message
       * @param {Object} [options={}] - Additional options
       * @returns {Object} Toast control object
       */
      static success(title, message, options = {}) {
        return this.show({
          title,
          message,
          type: 'success',
          duration: 4000,
          ...options
        });
      }
      
      /**
       * Show an error toast
       * @param {string} title - Toast title
       * @param {string} message - Toast message
       * @param {Object} [options={}] - Additional options
       * @returns {Object} Toast control object
       */
      static error(title, message, options = {}) {
        return this.show({
          title,
          message,
          type: 'error',
          duration: 6000, // Errors show longer by default
          ...options
        });
      }
      
      /**
       * Show a warning toast
       * @param {string} title - Toast title
       * @param {string} message - Toast message
       * @param {Object} [options={}] - Additional options
       * @returns {Object} Toast control object
       */
      static warning(title, message, options = {}) {
        return this.show({
          title,
          message,
          type: 'warning',
          duration: 5000,
          ...options
        });
      }
      
      /**
       * Show an info toast
       * @param {string} title - Toast title
       * @param {string} message - Toast message
       * @param {Object} [options={}] - Additional options
       * @returns {Object} Toast control object
       */
      static info(title, message, options = {}) {
        return this.show({
          title,
          message,
          type: 'info',
          duration: 4000,
          ...options
        });
      }
    }
    
    // ===============================================================
    // Settings Manager
    // ===============================================================
    
    /**
     * Advanced settings manager with schema validation and reactive updates
     */
    class SettingsManager {
      /**
       * Create a new settings manager instance
       */
      constructor() {
        // Configuration
        this.version = '3.1.0';
        this.schema = SETTINGS_SCHEMA;
        this.presets = SETTINGS_PRESETS;
        this.categories = SETTINGS_CATEGORIES;
        
        // State
        this.settings = null;
        this.events = new EventEmitter();
        this.elements = new Map();
        this.initialized = false;
        this.pendingChanges = new Map();
        this.hasUnsavedChanges = false;
        this.observers = new Map();
        this.changeHistory = [];
        this.historyMaxSize = 20;
        this.historyPosition = 0; // For undo/redo
        this.lastSave = 0;
        
        // Credential management state
        this.credentialsAvailable = SecurityManager.isCredentialStorageAvailable();
        
        // Bind event handlers to prevent memory leaks
        this._boundHandleThemePrefChange = this._handleThemePreferenceChange.bind(this);
        this._boundHandleReducedMotionChange = this._handleReducedMotionChange.bind(this);
        this._boundHandleHighContrastChange = this._handleHighContrastChange.bind(this);
        this._boundHandleVisibilityChange = this._handleVisibilityChange.bind(this);
        this._boundHandleOnlineStatusChange = this._handleOnlineStatusChange.bind(this);
        
        // Debounced methods
        this.debouncedSave = DOMUtils.debounce(this._saveSettings.bind(this), 500);
        this.previewSetting = DOMUtils.debounce(this._previewSetting.bind(this), 50);
        
        // Performance tracking
        this._perfMetrics = {
          initTime: 0,
          loadTime: 0,
          saveTime: 0,
          lastOperation: null
        };
      }
      
      /**
       * Initialize settings manager
       * @param {Object} [options={}] - Initialization options
       * @returns {Promise<SettingsManager>} Initialized instance
       */
      async init(options = {}) {
        if (this.initialized) return this;
        
        const startTime = performance.now();
        
        try {
          console.log('🔧 Initializing Settings Manager...');
          
          // Initialize storage subsystems
          await StorageManager.initialize();
          
          // Check for storage availability
          const storageAvailable = StorageManager.hasLocalStorage() || 
                                   StorageManager.hasSessionStorage() || 
                                   StorageManager.hasIndexedDB();
          
          if (!storageAvailable) {
            console.warn('⚠️ Local storage is not available. Settings will not persist.');
          }
          
          // Load settings from storage
          await this._loadSettings();
          
          // Apply options (overrides stored settings)
          if (options.settings) {
            this.settings = {...this.settings, ...options.settings};
          }
          
          // Validate and migrate settings
          await this._validateAndMigrate();
          
          // Initialize DOM elements
          this._initializeDOM();
          
          // Initialize theme based on settings
          this._initializeTheme();
          
          // Initialize accessibility settings
          this._initializeAccessibility();
          
          // Set up listeners
          this._setupListeners();
          
          // Set up observers
          this._setupObservers();
          
          // Create automatic backup if necessary
          const lastBackupTime = await StorageManager.load('claude:settings:last-backup-time', 0);
          const backupFrequency = this.settings.backupFrequency;
          
          if (backupFrequency !== 'never') {
            const now = Date.now();
            let backupDue = false;
            
            if (backupFrequency === 'daily' && (now - lastBackupTime > 86400000)) {
              backupDue = true;
            } else if (backupFrequency === 'weekly' && (now - lastBackupTime > 604800000)) {
              backupDue = true;
            } else if (backupFrequency === 'monthly' && (now - lastBackupTime > 2592000000)) {
              backupDue = true;
            }
            
            if (backupDue) {
              await StorageManager.createBackup(this.settings, 'auto');
              await StorageManager.save('claude:settings:last-backup-time', now);
            }
          }
          
          // Mark as initialized
          this.initialized = true;
          this._perfMetrics.initTime = performance.now() - startTime;
          
          // Emit initialized event
          await this.events.emit('initialized', { 
            settings: this.getPublicSettings(),
            categories: this.categories,
            performance: this._perfMetrics
          });
          
          // Check if API key is set, if not, prompt to configure
          if (!this.settings.apiKey) {
            setTimeout(() => {
              this.events.emit('missing-api-key');
            }, 500);
          }
          
          console.log(`✅ Settings Manager initialized in ${this._perfMetrics.initTime.toFixed(2)}ms`);
          return this;
        } catch (error) {
          console.error('❌ Failed to initialize settings:', error);
          
          // Reset to defaults as fallback
          this.settings = this._getDefaultSettings();
          await this._saveSettings(this.settings);
          
          // Emit error event
          await this.events.emit('error', { 
            message: 'Failed to initialize settings',
            error
          });
          
          throw error;
        }
      }
      
      /**
       * Clean up resources and listeners
       */
      destroy() {
        // Clean up media query listeners
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeMediaQuery.removeEventListener('change', this._boundHandleThemePrefChange);
        
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotionQuery.removeEventListener('change', this._boundHandleReducedMotionChange);
        
        const highContrastQuery = window.matchMedia('(prefers-contrast: more)');
        highContrastQuery.removeEventListener('change', this._boundHandleHighContrastChange);
        
        // Clean up document listeners
        document.removeEventListener('visibilitychange', this._boundHandleVisibilityChange);
        window.removeEventListener('online', this._boundHandleOnlineStatusChange);
        window.removeEventListener('offline', this._boundHandleOnlineStatusChange);
        
        // Clean up all other observers
        this.observers.forEach((observer, element) => {
          if (observer.cleanup && typeof observer.cleanup === 'function') {
            observer.cleanup();
          }
        });
        
        // Clear state
        this.observers.clear();
        this.elements.clear();
        this.pendingChanges.clear();
        this.initialized = false;
        
        // Remove all event listeners
        this.events.removeAllListeners();
      }
      
      /**
       * Load settings from storage
       * @returns {Promise<Object>} Loaded settings
       * @private
       */
      async _loadSettings() {
        const loadStartTime = performance.now();
        
        try {
          // Try to load all settings in a batch for performance
          const batch = await StorageManager.startBatch('readonly');
          
          // Load regular settings
          const storedSettings = await batch.load(
            STORAGE_KEYS.SETTINGS, 
            null
          );
          
          // Load sensitive settings
          const sensitiveSettings = await batch.load(
            STORAGE_KEYS.SENSITIVE,
            null,
            { sensitive: true }
          );
          
          // Complete the batch
          await batch.complete();
          
          if (storedSettings) {
            this.settings = storedSettings;
            
            // Add sensitive settings if available
            if (sensitiveSettings) {
              Object.keys(sensitiveSettings).forEach(key => {
                // Only use if schema exists and marks as sensitive
                if (this.schema[key] && this.schema[key].sensitive) {
                  this.settings[key] = sensitiveSettings[key];
                }
              });
            }
            
            // Load from credential store if available
            if (this.credentialsAvailable) {
              const credentialPromises = [];
              
              for (const [key, schema] of Object.entries(this.schema)) {
                if (schema.sensitive && schema.credentialStorage) {
                  const promise = (async () => {
                    const value = await SecurityManager.getCredential(key);
                    if (value) {
                      this.settings[key] = value;
                    }
                  })();
                  
                  credentialPromises.push(promise);
                }
              }
              
              // Wait for all credential loads to complete
              await Promise.allSettled(credentialPromises);
            }
          } else {
            // Use defaults if nothing stored
            this.settings = this._getDefaultSettings();
            
            // Save defaults
            await this._saveSettings(this.settings);
          }
          
          // Load history
          this.changeHistory = await StorageManager.load(
            STORAGE_KEYS.HISTORY,
            []
          );
          
          this._perfMetrics.loadTime = performance.now() - loadStartTime;
          return this.settings;
        } catch (error) {
          console.error('Failed to load settings:', error);
          
          // Fallback to loading settings individually
          console.log('Trying fallback loading method...');
          
          // Load from storage
          const storedSettings = await StorageManager.load(
            STORAGE_KEYS.SETTINGS, 
            null, 
            { persistent: true, parse: true }
          );
          
          // Load sensitive settings separately
          const sensitiveSettings = await StorageManager.load(
            STORAGE_KEYS.SENSITIVE,
            null,
            { persistent: true, sensitive: true, parse: true }
          );
          
          if (storedSettings) {
            this.settings = storedSettings;
            
            // Add sensitive settings if available
            if (sensitiveSettings) {
              Object.keys(sensitiveSettings).forEach(key => {
                // Only use if schema exists and marks as sensitive
                if (this.schema[key] && this.schema[key].sensitive) {
                  this.settings[key] = sensitiveSettings[key];
                }
              });
            }
          } else {
            // Use defaults if nothing stored
            this.settings = this._getDefaultSettings();
          }
          
          this._perfMetrics.loadTime = performance.now() - loadStartTime;
          return this.settings;
        }
      }
      
      /**
       * Get default settings
       * @returns {Object} Default settings object
       * @private
       */
      _getDefaultSettings() {
        const defaults = {};
        
        // Extract defaults from schema
        for (const [key, schema] of Object.entries(this.schema)) {
          defaults[key] = schema.default;
        }
        
        return defaults;
      }
      
      /**
       * Save settings to storage
       * @param {Object} settings - Settings to save
       * @returns {Promise<boolean>} Success status
       * @private
       */
      async _saveSettings(settings = this.settings) {
        if (!settings) return false;
        
        const saveStartTime = performance.now();
        this.lastSave = Date.now();
        
        try {
          // Try to save all settings in a batch for performance
          const batch = await StorageManager.startBatch('readwrite');
          
          // Separate sensitive data
          const regularSettings = {};
          const sensitiveSettings = {};
          
          for (const [key, value] of Object.entries(settings)) {
            const schema = this.schema[key];
            
            // Skip unknown keys
            if (!schema) continue;
            
            if (schema.sensitive) {
              // Store sensitive data separately
              sensitiveSettings[key] = value;
              
              // For regular settings, just store a boolean indicating presence
              regularSettings[key] = !!value;
              
              // Store in credential manager if supported
              if (this.credentialsAvailable && schema.credentialStorage && value) {
                try {
                  await SecurityManager.storeCredential(key, value);
                } catch (e) {
                  console.warn(`Failed to store credential for ${key}:`, e);
                }
              }
            } else {
              regularSettings[key] = value;
            }
          }
          
          // Save regular settings
          await batch.save(
            STORAGE_KEYS.SETTINGS,
            regularSettings
          );
          
          // Save sensitive settings with encryption
          await StorageManager.save(
            STORAGE_KEYS.SENSITIVE,
            sensitiveSettings,
            { persistent: true, sensitive: true }
          );
          
          // Complete the batch
          await batch.complete();
          
          // Add to history
          this._addToHistory(settings);
          
          this.hasUnsavedChanges = false;
          this._perfMetrics.saveTime = performance.now() - saveStartTime;
          
          await this.events.emit('settings-saved', { 
            settings: this.getPublicSettings(),
            performance: {
              saveTime: this._perfMetrics.saveTime
            }
          });
          
          return true;
        } catch (error) {
          console.error('Failed to save settings:', error);
          
          // Try fallback save method
          try {
            // Separate sensitive data
            const regularSettings = {};
            const sensitiveSettings = {};
            
            for (const [key, value] of Object.entries(settings)) {
              const schema = this.schema[key];
              
              // Skip unknown keys
              if (!schema) continue;
              
              if (schema.sensitive) {
                // Store sensitive data separately
                sensitiveSettings[key] = value;
                
                // For regular settings, just store a boolean indicating presence
                regularSettings[key] = !!value;
              } else {
                regularSettings[key] = value;
              }
            }
            
            // Save regular settings
            await StorageManager.save(
              STORAGE_KEYS.SETTINGS,
              regularSettings,
              { persistent: true }
            );
            
            // Save sensitive settings
            await StorageManager.save(
              STORAGE_KEYS.SENSITIVE,
              sensitiveSettings,
              { persistent: true, sensitive: true }
            );
            
            this.hasUnsavedChanges = false;
            this._perfMetrics.saveTime = performance.now() - saveStartTime;
            
            // Add to history
            this._addToHistory(settings);
            
            await this.events.emit('settings-saved', { 
              settings: this.getPublicSettings(),
              performance: {
                saveTime: this._perfMetrics.saveTime
              }
            });
            
            return true;
          } catch (e) {
            console.error('Fallback save also failed:', e);
            return false;
          }
        }
      }
      
      /**
       * Add current settings to history
       * @param {Object} settings - Settings object
       * @private
       */
      _addToHistory(settings) {
        // Create history entry
        const entry = {
          timestamp: Date.now(),
          settings: JSON.parse(JSON.stringify(settings)),
          hash: Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
        };
        
        // Remove sensitive data for history
        for (const [key, schema] of Object.entries(this.schema)) {
          if (schema.sensitive && entry.settings[key]) {
            entry.settings[key] = true; // Just record that it exists
          }
        }
        
        // If we've used undo and then make a new change, truncate the future history
        if (this.historyPosition > 0) {
          this.changeHistory = this.changeHistory.slice(this.historyPosition);
          this.historyPosition = 0;
        }
        
        // Add to history
        this.changeHistory.unshift(entry);
        
        // Limit history size
        if (this.changeHistory.length > this.historyMaxSize) {
          this.changeHistory = this.changeHistory.slice(0, this.historyMaxSize);
        }
        
        // Persist history
        StorageManager.save(
          STORAGE_KEYS.HISTORY,
          this.changeHistory,
          { persistent: true }
        );
      }
      
      /**
       * Validate and migrate settings if needed
       * @returns {Promise<void>}
       * @private
       */
      async _validateAndMigrate() {
        const newSettings = { ...this.settings };
        let needsUpdate = false;
        
        // Check version for migrations
        const storedVersion = await StorageManager.load(STORAGE_KEYS.VERSION, null);
        
        // Process version migration if needed
        if (storedVersion && storedVersion !== this.version) {
          await this._migrateFromVersion(storedVersion, newSettings);
          needsUpdate = true;
        }
        
        // Store current version
        await StorageManager.save(STORAGE_KEYS.VERSION, this.version);
        
        // Validate each setting against schema
        for (const [key, schema] of Object.entries(this.schema)) {
          // Check if key exists
          if (!(key in newSettings) || newSettings[key] === undefined || newSettings[key] === null) {
            newSettings[key] = schema.default;
            needsUpdate = true;
            continue;
          }
          
          // Validate value
          const value = newSettings[key];
          
          if (schema.validate && !schema.validate(value)) {
            try {
              // Try to sanitize if available
              if (schema.sanitize) {
                newSettings[key] = schema.sanitize(value);
              } else {
                // Fall back to default
                newSettings[key] = schema.default;
              }
              needsUpdate = true;
            } catch (e) {
              // Sanitization failed, use default
              console.warn(`Failed to sanitize ${key}, using default:`, e);
              newSettings[key] = schema.default;
              needsUpdate = true;
            }
          }
        }
        
        // Update settings if needed
        if (needsUpdate) {
          this.settings = newSettings;
          await this._saveSettings(newSettings);
        }
      }
      
      /**
       * Migrate settings from a previous version
       * @param {string} fromVersion - Previous version
       * @param {Object} settings - Settings to migrate
       * @returns {Promise<void>}
       * @private
       */
      async _migrateFromVersion(fromVersion, settings) {
        console.log(`Migrating settings from version ${fromVersion} to ${this.version}`);
        
        // v3.0.0 to v3.1.0
        if (fromVersion === '3.0.0') {
          // Add new settings with defaults
          if (!('topK' in settings)) {
            settings.topK = this.schema.topK.default;
          }
          
          if (!('frequencyPenalty' in settings)) {
            settings.frequencyPenalty = this.schema.frequencyPenalty.default;
          }
          
          if (!('presencePenalty' in settings)) {
            settings.presencePenalty = this.schema.presencePenalty.default;
          }
          
          if (!('fontFamily' in settings)) {
            settings.fontFamily = this.schema.fontFamily.default;
          }
          
          if (!('highContrast' in settings)) {
            settings.highContrast = this.schema.highContrast.default;
          }
          
          if (!('syncInterval' in settings)) {
            settings.syncInterval = this.schema.syncInterval.default;
          }
          
          if (!('backupLocation' in settings)) {
            settings.backupLocation = this.schema.backupLocation.default;
          }
          
          if (!('contextRetention' in settings)) {
            settings.contextRetention = this.schema.contextRetention.default;
          }
          
          if (!('autoFormatting' in settings)) {
            settings.autoFormatting = this.schema.autoFormatting.default;
          }
          
          if (!('markdownLevel' in settings)) {
            settings.markdownLevel = this.schema.markdownLevel.default;
          }
          
          if (!('defaultLanguage' in settings)) {
            settings.defaultLanguage = this.schema.defaultLanguage.default;
          }
          
          // Update code theme options to include light/dark variants
          if (settings.codeTheme === 'github') {
            settings.codeTheme = 'github-light';
          }
          
          // Update theme options to include new options
          if (!['light', 'dark', 'system', 'high-contrast', 'sepia', 'night-shift'].includes(settings.theme)) {
            settings.theme = this.schema.theme.default;
          }
          
          // Convert any numeric strings to actual numbers
          for (const [key, schema] of Object.entries(this.schema)) {
            if (schema.type === 'number' && typeof settings[key] === 'string') {
              settings[key] = parseFloat(settings[key]);
            }
          }
        }
        
        // v2.0.0 to v3.0.0 (already handled in previous version)
        if (fromVersion === '2.0.0') {
          // Already handled in v3.0.0
        }
        
        // Store new version
        await StorageManager.save(STORAGE_KEYS.VERSION, this.version);
      }
      
      /**
       * Initialize DOM elements
       * @private
       */
      _initializeDOM() {
        // Primary controls
        ['settingsButton', 'sidebarSettingsBtn', 'closeSettings', 'saveSettings', 
         'settingsPanel', 'overlay', 'presetSelector', 'advancedToggle'].forEach(id => {
          this.elements.set(id, DOMUtils.getElement(id));
        });
        
        // Settings sections
        const settingsPanel = this.elements.get('settingsPanel');
        if (settingsPanel) {
          // Get all sections
          const sections = {};
          
          this.categories.forEach(category => {
            const section = settingsPanel.querySelector(`[data-settings-section="${category.id}"]`);
            if (section) {
              sections[category.id] = section;
            }
          });
          
          this.elements.set('sections', sections);
          
          // Get tabs if they exist
          const tabsList = settingsPanel.querySelector('.settings-tabs');
          if (tabsList) {
            this.elements.set('tabsList', tabsList);
            this.elements.set('tabs', Array.from(tabsList.querySelectorAll('[data-tab]')));
          }
        }
        
        // Settings inputs
        for (const [key, schema] of Object.entries(this.schema)) {
          // Look for input with matching ID
          const element = DOMUtils.getElement(key) || 
                         DOMUtils.getElement(`setting-${key}`);
                         
          if (element) {
            this.elements.set(key, element);
            
            // Add data attributes for validation
            if (schema.type) {
              element.dataset.settingType = schema.type;
            }
            
            if (schema.required) {
              element.setAttribute('required', 'required');
            }
          }
          
          // Special cases for some settings
          if (key === 'apiKey') {
            this.elements.set('togglePassword', DOMUtils.getElement('togglePassword'));
            
            if (this.elements.get('togglePassword')) {
              this.elements.set(
                'showPasswordIcon', 
                this.elements.get('togglePassword').querySelector('.show-password')
              );
              this.elements.set(
                'hidePasswordIcon',
                this.elements.get('togglePassword').querySelector('.hide-password')
              );
            }
          }
          
          // Get associated output/display elements
          const displayEl = DOMUtils.getElement(`${key}Display`) || 
                           DOMUtils.getElement(`${key}Value`);
                           
          if (displayEl) {
            this.elements.set(`${key}Display`, displayEl);
          }
        }
        
        // Additional elements
        this.elements.set('usageInfo', DOMUtils.getElement('usageInfo'));
        this.elements.set('exportSettingsBtn', DOMUtils.getElement('exportSettingsBtn'));
        this.elements.set('importSettingsBtn', DOMUtils.getElement('importSettingsBtn'));
        this.elements.set('resetSettingsBtn', DOMUtils.getElement('resetSettingsBtn'));
        this.elements.set('undoSettingsBtn', DOMUtils.getElement('undoSettingsBtn'));
        this.elements.set('redoSettingsBtn', DOMUtils.getElement('redoSettingsBtn'));
        this.elements.set('settingsSearch', DOMUtils.getElement('settingsSearch'));
        this.elements.set('backupsBtn', DOMUtils.getElement('backupsBtn'));
        
        // Initialize UI
        this._updateUIFromSettings();
      }
      
      /**
       * Set up event listeners
       * @private
       */
      _setupListeners() {
        // Listen for system theme changes
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeMediaQuery.addEventListener('change', this._boundHandleThemePrefChange);
        
        // Listen for reduced motion preference
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotionQuery.addEventListener('change', this._boundHandleReducedMotionChange);
        
        // Listen for high contrast preference
        const highContrastQuery = window.matchMedia('(prefers-contrast: more)');
        highContrastQuery.addEventListener('change', this._boundHandleHighContrastChange);
        
        // Listen for visibility changes to save pending changes
        document.addEventListener('visibilitychange', this._boundHandleVisibilityChange);
        
        // Listen for online/offline status
        window.addEventListener('online', this._boundHandleOnlineStatusChange);
        window.addEventListener('offline', this._boundHandleOnlineStatusChange);
        
        // Settings button handling
        if (this.elements.get('settingsButton')) {
          this.elements.get('settingsButton').addEventListener('click', () => this.openSettings());
        }
        
        if (this.elements.get('sidebarSettingsBtn')) {
          this.elements.get('sidebarSettingsBtn').addEventListener('click', () => {
            this.openSettings();
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('open');
          });
        }
        
        if (this.elements.get('closeSettings')) {
          this.elements.get('closeSettings').addEventListener('click', () => this.closeSettings());
        }
        
        if (this.elements.get('overlay')) {
          this.elements.get('overlay').addEventListener('click', (e) => {
            // Only close if clicking the overlay directly
            if (e.target === this.elements.get('overlay')) {
              this.closeSettings();
            }
          });
        }
        
        // Save button
        if (this.elements.get('saveSettings')) {
          this.elements.get('saveSettings').addEventListener('click', () => this.saveSettingsFromUI());
        }
        
        // Tab switching if we have tabs
        if (this.elements.get('tabs')) {
          this.elements.get('tabs').forEach(tab => {
            tab.addEventListener('click', () => {
              this._switchToTab(tab.dataset.tab);
            });
          });
        }
        
        // Advanced toggle
        if (this.elements.get('advancedToggle')) {
          this.elements.get('advancedToggle').addEventListener('change', () => {
            const isAdvanced = this.elements.get('advancedToggle').checked;
            this._toggleAdvancedSettings(isAdvanced);
          });
        }
        
        // Set up preset selector
        if (this.elements.get('presetSelector')) {
          this.elements.get('presetSelector').addEventListener('change', (e) => {
            const preset = e.target.value;
            if (preset && this.presets[preset]) {
              this.applyPreset(preset);
            }
          });
        }
        
        // Import/export buttons
        if (this.elements.get('exportSettingsBtn')) {
          this.elements.get('exportSettingsBtn').addEventListener('click', () => this.exportSettings());
        }
        
        if (this.elements.get('importSettingsBtn')) {
          this.elements.get('importSettingsBtn').addEventListener('click', () => this.importSettings());
        }
        
        // Reset button
        if (this.elements.get('resetSettingsBtn')) {
          this.elements.get('resetSettingsBtn').addEventListener('click', () => this.resetSettings());
        }
        
        // History navigation
        if (this.elements.get('undoSettingsBtn')) {
          this.elements.get('undoSettingsBtn').addEventListener('click', () => this.undoSettings());
        }
        
        if (this.elements.get('redoSettingsBtn')) {
          this.elements.get('redoSettingsBtn').addEventListener('click', () => this.redoSettings());
        }
        
        // Settings search
        if (this.elements.get('settingsSearch')) {
          this.elements.get('settingsSearch').addEventListener('input', (e) => {
            this._filterSettings(e.target.value);
          });
        }
        
        // Backups button
        if (this.elements.get('backupsBtn')) {
          this.elements.get('backupsBtn').addEventListener('click', () => this._showBackupsDialog());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
          // Close settings panel with ESC
          if (e.key === 'Escape' && this.isSettingsPanelOpen()) {
            this.closeSettings();
          }
          
          // Open settings with Ctrl+, (common shortcut)
          if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.openSettings();
          }
          
          // Save settings with Ctrl+S while panel is open
          if (e.key === 's' && (e.ctrlKey || e.metaKey) && this.isSettingsPanelOpen()) {
            e.preventDefault();
            this.saveSettingsFromUI();
          }
          
          // Undo with Ctrl+Z while panel is open
          if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && this.isSettingsPanelOpen()) {
            e.preventDefault();
            this.undoSettings();
          }
          
          // Redo with Ctrl+Shift+Z or Ctrl+Y while panel is open
          if (((e.key === 'Z' || e.key === 'z') && e.shiftKey && e.ctrlKey) || 
              (e.key === 'y' && e.ctrlKey) && 
              this.isSettingsPanelOpen()) {
            e.preventDefault();
            this.redoSettings();
          }
        });
      }
      
      /**
       * Handle visibility change (document hidden/visible)
       * @private
       */
      _handleVisibilityChange() {
        // When document becomes hidden, save any pending changes
        if (document.hidden && this.hasUnsavedChanges) {
          this.debouncedSave.flush();
        }
      }
      
      /**
       * Handle online/offline status change
       * @param {Event} event - Online/offline event
       * @private
       */
      _handleOnlineStatusChange(event) {
        const isOnline = event.type === 'online';
        
        // Notify about status change
        this.events.emit('online-status-changed', { isOnline });
        
        // If we're online and have cloud sync enabled, trigger a sync
        if (isOnline && this.settings.enableSync) {
          this.events.emit('cloud-sync-needed');
        }
      }
      
      /**
       * Set up input event handlers for auto-save and validation
       * @private
       */
      _setupObservers() {
        // Set up observers for form inputs
        for (const [key, element] of this.elements.entries()) {
          // Skip non-schema elements and sections/tabs
          if (!this.schema[key] || !element || key === 'sections' || key === 'tabs') {
            continue;
          }
          
          const schema = this.schema[key];
          
          // Set up event handler based on element type
          if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
            let eventType = 'input';
            
            // Use change event for checkboxes and selects
            if (element.type === 'checkbox' || element.type === 'radio' || element.tagName === 'SELECT') {
              eventType = 'change';
            }
            
            // Add event listener
            const handler = () => {
              this._handleInputChange(key, element, schema);
            };
            
            element.addEventListener(eventType, handler);
            
            // Store handler reference for cleanup
            this.observers.set(element, {
              eventType,
              handler,
              cleanup: () => element.removeEventListener(eventType, handler)
            });
          }
        }
        
        // Set up API key field with password toggle
        if (this.elements.get('apiKey') && this.elements.get('togglePassword')) {
          const toggleHandler = () => {
            const apiKeyInput = this.elements.get('apiKey');
            const showIcon = this.elements.get('showPasswordIcon');
            const hideIcon = this.elements.get('hidePasswordIcon');
            
            if (apiKeyInput.type === 'password') {
              apiKeyInput.type = 'text';
              if (showIcon) showIcon.style.display = 'none';
              if (hideIcon) hideIcon.style.display = 'inline';
            } else {
              apiKeyInput.type = 'password';
              if (showIcon) showIcon.style.display = 'inline';
              if (hideIcon) hideIcon.style.display = 'none';
            }
            
            // Focus the field
            apiKeyInput.focus();
          };
          
          this.elements.get('togglePassword').addEventListener('click', toggleHandler);
          
          // Store for cleanup
          this.observers.set(this.elements.get('togglePassword'), {
            eventType: 'click',
            handler: toggleHandler,
            cleanup: () => this.elements.get('togglePassword').removeEventListener('click', toggleHandler)
          });
        }
        
        // Set up conditional display for settings
        for (const [key, schema] of Object.entries(this.schema)) {
          // Check if this setting has conditional display
          if (schema.conditionalDisplay) {
            // Find the controlling element(s)
            const controllingKeys = this._getControllingKeys(schema.conditionalDisplay);
            
            // Set up observers for controlling elements
            controllingKeys.forEach(controlKey => {
              const controlElement = this.elements.get(controlKey);
              if (controlElement) {
                // Find the setting element
                const settingElement = this.elements.get(key);
                if (!settingElement) return;
                
                // Get the container element (typically the .settings-field div)
                const container = settingElement.closest('.settings-field');
                if (!container) return;
                
                // Initial visibility check
                this._updateConditionalVisibility(key, schema, container);
                
                // Add listener to update visibility when control changes
                const handler = () => {
                  this._updateConditionalVisibility(key, schema, container);
                };
                
                controlElement.addEventListener('change', handler);
                
                // Store handler reference for cleanup
                this.observers.set(container, {
                  eventType: 'conditionalVisibility',
                  handler,
                  controlElement,
                  cleanup: () => controlElement.removeEventListener('change', handler)
                });
              }
            });
          }
        }
      }
      
      /**
       * Handle input change events
       * @param {string} key - Setting key
       * @param {HTMLElement} element - Input element
       * @param {Object} schema - Setting schema
       * @private
       */
      _handleInputChange(key, element, schema) {
        let value;
        
        // Extract value based on input type
        if (element.type === 'checkbox') {
          value = element.checked;
        } else if (schema.type === 'number') {
          // Parse number and apply constraints
          value = parseFloat(element.value);
          if (isNaN(value)) value = 0;
          
          // Apply min/max constraints
          if (schema.min !== undefined) value = Math.max(schema.min, value);
          if (schema.max !== undefined) value = Math.min(schema.max, value);
        } else {
          value = element.value;
        }
        
        // Sanitize if needed
        if (schema.sanitize) {
          try {
            value = schema.sanitize(value);
          } catch (e) {
            console.warn(`Failed to sanitize ${key}:`, e);
          }
        }
        
        // Validate
        if (schema.validate && !schema.validate(value)) {
          this._showValidationError(key, value);
          return;
        }
        
        // Update display elements if any
        this._updateDisplayElements(key, value);
        
        // Preview the setting
        this.previewSetting(key, value);
        
        // Add to pending changes
        this.pendingChanges.set(key, value);
        this.hasUnsavedChanges = true;
        
        // Update save button state
        this._updateSaveButtonState();
      }
      
      /**
       * Get keys of settings that control a conditional display
       * @param {Function} conditionalFn - Conditional display function
       * @returns {string[]} Controlling keys
       * @private
       */
      _getControllingKeys(conditionalFn) {
        if (!conditionalFn) return [];
        
        // Convert function to string to analyze
        const fnStr = conditionalFn.toString();
        const keys = [];
        
        // Look for "settings.key" pattern
        const regex = /settings\.(\w+)/g;
        let match;
        
        while ((match = regex.exec(fnStr)) !== null) {
          keys.push(match[1]);
        }
        
        return keys;
      }
      
      /**
       * Update conditional visibility of a setting
       * @param {string} key - Setting key
       * @param {Object} schema - Setting schema
       * @param {HTMLElement} container - Setting container element
       * @private
       */
      _updateConditionalVisibility(key, schema, container) {
        if (!schema.conditionalDisplay || !container) return;
        
        // Get current visibility
        const isVisible = schema.conditionalDisplay(this.settings);
        
        // Update visibility
        if (isVisible) {
          container.style.display = '';
          container.classList.remove('hidden-setting');
          container.removeAttribute('aria-hidden');
        } else {
          container.style.display = 'none';
          container.classList.add('hidden-setting');
          container.setAttribute('aria-hidden', 'true');
        }
      }
      
      /**
       * Update display elements for a setting
       * @param {string} key - Setting key
       * @param {*} value - Setting value
       * @private
       */
      _updateDisplayElements(key, value) {
        // Get display element if exists
        const displayEl = this.elements.get(`${key}Display`);
        if (!displayEl) return;
        
        const schema = this.schema[key];
        
        if (schema.type === 'number') {
          // For number types, format nicely
          if (key === 'temperature' || key === 'topP' || key === 'frequencyPenalty' || key === 'presencePenalty') {
            displayEl.textContent = value.toFixed(1);
          } else {
            displayEl.textContent = new Intl.NumberFormat().format(value);
          }
        } else if (schema.options) {
          // For options, show the label
          const option = schema.options.find(opt => opt.value === value);
          if (option) {
            displayEl.textContent = option.label;
          } else {
            displayEl.textContent = value;
          }
        } else {
          // Default display
          displayEl.textContent = value;
        }
      }
      
      /**
       * Initialize theme based on settings
       * @private
       */
      _initializeTheme() {
        const theme = this.settings.theme || 'system';
        this._updateTheme(theme);
      }
      
      /**
       * Initialize accessibility settings
       * @private
       */
      _initializeAccessibility() {
        // Apply reduced motion setting
        this._updateReducedMotion(this.settings.reducedMotion || 'system');
        
        // Apply high contrast setting
        this._updateHighContrast(this.settings.highContrast || 'system');
        
        // Apply font size
        this._updateFontSize(this.settings.fontSize || 'medium');
        
        // Apply font family
        this._updateFontFamily(this.settings.fontFamily || 'system');
        
        // Apply display mode
        this._updateDisplayMode(this.settings.displayMode || 'compact');
      }
      
      /**
       * Update theme based on setting
       * @param {string} themeSetting - Theme setting (light, dark, system, etc.)
       * @private
       */
      _updateTheme(themeSetting) {
        const html = document.documentElement;
        const body = document.body;
        
        // Remove existing theme classes
        DOMUtils.removeClasses(
          body, 
          'light-theme', 
          'dark-theme', 
          'high-contrast-theme',
          'sepia-theme',
          'night-shift-theme'
        );
        
        let appliedTheme;
        
        if (themeSetting === 'system') {
          // Use system preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          appliedTheme = prefersDark ? 'dark' : 'light';
          DOMUtils.addClasses(body, `${appliedTheme}-theme`);
        } else {
          // Specific theme
          appliedTheme = themeSetting;
          DOMUtils.addClasses(body, `${themeSetting}-theme`);
        }
        
        // Set data attribute on html element
        html.setAttribute('data-theme', appliedTheme);
        
        // Emit theme change event
        this.events.emit('theme-changed', { theme: appliedTheme });
      }
      
      /**
       * Update reduced motion setting
       * @param {string} setting - Reduced motion setting (enabled, disabled, system)
       * @private
       */
      _updateReducedMotion(setting) {
        const html = document.documentElement;
        
        if (setting === 'system') {
          // Use system preference
          const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          html.setAttribute('data-reduced-motion', prefersReducedMotion ? 'true' : 'false');
        } else {
          // Specific setting
          html.setAttribute('data-reduced-motion', setting === 'enabled' ? 'true' : 'false');
        }
        
        // Emit event
        this.events.emit('accessibility-changed', { 
          feature: 'reducedMotion', 
          value: html.getAttribute('data-reduced-motion')
        });
      }
      
      /**
       * Update high contrast setting
       * @param {string} setting - High contrast setting (enabled, disabled, system)
       * @private
       */
      _updateHighContrast(setting) {
        const html = document.documentElement;
        
        if (setting === 'system') {
          // Use system preference
          const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches;
          html.setAttribute('data-high-contrast', prefersHighContrast ? 'true' : 'false');
        } else {
          // Specific setting
          html.setAttribute('data-high-contrast', setting === 'enabled' ? 'true' : 'false');
        }
        
        // Emit event
        this.events.emit('accessibility-changed', { 
          feature: 'highContrast', 
          value: html.getAttribute('data-high-contrast')
        });
      }
      
      /**
       * Handle system theme preference change
       * @param {MediaQueryListEvent} e - Media query change event
       * @private
       */
      _handleThemePreferenceChange(e) {
        // Only apply if theme is set to 'system'
        if (this.settings.theme === 'system') {
          const newTheme = e.matches ? 'dark' : 'light';
          
          // Update html data attribute
          document.documentElement.setAttribute('data-theme', newTheme);
          
          // Update body class
          const body = document.body;
          DOMUtils.removeClasses(body, 'light-theme', 'dark-theme');
          DOMUtils.addClasses(body, `${newTheme}-theme`);
          
          // Emit theme changed event
          this.events.emit('theme-changed', { theme: newTheme });
        }
      }
      
      /**
       * Handle system reduced motion preference change
       * @param {MediaQueryListEvent} e - Media query change event
       * @private
       */
      _handleReducedMotionChange(e) {
        // Only apply if reduced motion is set to 'system'
        if (this.settings.reducedMotion === 'system') {
          document.documentElement.setAttribute('data-reduced-motion', e.matches ? 'true' : 'false');
          
          // Emit accessibility changed event
          this.events.emit('accessibility-changed', { 
            feature: 'reducedMotion', 
            value: e.matches ? 'true' : 'false' 
          });
        }
      }
      
      /**
       * Handle system high contrast preference change
       * @param {MediaQueryListEvent} e - Media query change event
       * @private
       */
      _handleHighContrastChange(e) {
        // Only apply if high contrast is set to 'system'
        if (this.settings.highContrast === 'system') {
          document.documentElement.setAttribute('data-high-contrast', e.matches ? 'true' : 'false');
          
          // Emit accessibility changed event
          this.events.emit('accessibility-changed', { 
            feature: 'highContrast', 
            value: e.matches ? 'true' : 'false' 
          });
        }
      }
      
      /**
       * Update UI elements from settings
       * @private
       */
      _updateUIFromSettings() {
        for (const [key, value] of Object.entries(this.settings)) {
          const element = this.elements.get(key);
          if (!element) continue;
          
          const schema = this.schema[key];
          if (!schema) continue;
          
          // Handle different input types
          if (element.type === 'checkbox') {
            element.checked = !!value;
          } else if (key === 'apiKey' && schema.sensitive) {
            // For API key, only show dots if there's a value
            if (value) {
              element.type = 'password';
              element.value = value;
              
              // Update toggle button state if it exists
              if (this.elements.get('showPasswordIcon') && this.elements.get('hidePasswordIcon')) {
                this.elements.get('showPasswordIcon').style.display = 'inline';
                this.elements.get('hidePasswordIcon').style.display = 'none';
              }
            } else {
              element.value = '';
            }
          } else if (schema.type === 'number') {
            // For numbers, ensure we're using an actual number
            element.value = Number(value);
          } else {
            element.value = value;
          }
          
          // Update associated display elements
          this._updateDisplayElements(key, value);
        }
        
        // Update conditional visibility for all settings
        for (const [key, schema] of Object.entries(this.schema)) {
          if (schema.conditionalDisplay) {
            const element = this.elements.get(key);
            if (!element) continue;
            
            const container = element.closest('.settings-field');
            if (container) {
              this._updateConditionalVisibility(key, schema, container);
            }
          }
        }
        
        // Show/hide advanced settings based on toggle
        if (this.elements.get('advancedToggle')) {
          const showAdvanced = this.elements.get('advancedToggle').checked;
          this._toggleAdvancedSettings(showAdvanced);
        }
        
        // Additional UI updates
        if (this.elements.get('usageInfo') && this.settings.thinkingBudget) {
          this._updateUsageInfo(this.settings.thinkingBudget);
        }
        
        // Reset pending changes
        this.pendingChanges.clear();
        this.hasUnsavedChanges = false;
        this._updateSaveButtonState();
      }
      
      /**
       * Toggle advanced settings visibility
       * @param {boolean} show - Whether to show advanced settings
       * @private
       */
      _toggleAdvancedSettings(show) {
        const settingsPanel = this.elements.get('settingsPanel');
        if (!settingsPanel) return;
        
        // Find all advanced settings
        const advancedFields = settingsPanel.querySelectorAll('.settings-field[data-advanced="true"]');
        
        advancedFields.forEach(field => {
          if (show) {
            field.style.display = '';
            field.classList.remove('hidden-setting');
            field.removeAttribute('aria-hidden');
          } else {
            field.style.display = 'none';
            field.classList.add('hidden-setting');
            field.setAttribute('aria-hidden', 'true');
          }
        });
        
        // Update localStorage preference
        localStorage.setItem('claude:settings:show-advanced', show ? 'true' : 'false');
      }
      
      /**
       * Filter settings based on search term
       * @param {string} searchTerm - Search term
       * @private
       */
      _filterSettings(searchTerm) {
        const settingsPanel = this.elements.get('settingsPanel');
        if (!settingsPanel) return;
        
        if (!searchTerm) {
          // Show all sections and fields
          settingsPanel.querySelectorAll('.settings-field').forEach(field => {
            field.style.display = '';
            field.classList.remove('search-hidden');
          });
          
          // Restore advanced settings visibility based on toggle
          const showAdvanced = this.elements.get('advancedToggle')?.checked || false;
          this._toggleAdvancedSettings(showAdvanced);
          
          // Restore conditional display
          for (const [key, schema] of Object.entries(this.schema)) {
            if (schema.conditionalDisplay) {
              const element = this.elements.get(key);
              if (!element) continue;
              
              const container = element.closest('.settings-field');
              if (container) {
                this._updateConditionalVisibility(key, schema, container);
              }
            }
          }
          
          // Show all section headers
          settingsPanel.querySelectorAll('.settings-section-header').forEach(header => {
            header.style.display = '';
          });
          
          // If using tabs, set active tab
          if (this.elements.get('tabs')) {
            const activeTab = this.elements.get('tabs').find(tab => 
              tab.classList.contains('active')
            );
            
            if (activeTab) {
              this._switchToTab(activeTab.dataset.tab);
            }
          }
          
          return;
        }
        
        const normalizedSearch = searchTerm.toLowerCase();
        let matchCount = 0;
        
        // Show/hide fields based on match
        settingsPanel.querySelectorAll('.settings-field').forEach(field => {
          // Extract setting information
          const settingKey = field.querySelector('[data-setting-key]')?.dataset.settingKey ||
                             field.querySelector('input, select, textarea')?.id;
                             
          const schema = settingKey ? this.schema[settingKey] : null;
          
          // Search in label, description, and key
          const label = field.querySelector('label')?.textContent || '';
          const description = field.querySelector('.setting-description')?.textContent || '';
          
          const matches = 
            label.toLowerCase().includes(normalizedSearch) ||
            description.toLowerCase().includes(normalizedSearch) ||
            (settingKey && settingKey.toLowerCase().includes(normalizedSearch)) ||
            (schema?.category && this.categories.find(c => c.id === schema.category)?.label.toLowerCase().includes(normalizedSearch));
          
          if (matches) {
            field.style.display = '';
            field.classList.remove('search-hidden');
            matchCount++;
            
            // Highlight the matching text
            const labelEl = field.querySelector('label');
            const descEl = field.querySelector('.setting-description');
            
            if (labelEl && label.toLowerCase().includes(normalizedSearch)) {
              this._highlightText(labelEl, normalizedSearch);
            }
            
            if (descEl && description.toLowerCase().includes(normalizedSearch)) {
              this._highlightText(descEl, normalizedSearch);
            }
          } else {
            field.style.display = 'none';
            field.classList.add('search-hidden');
          }
        });
        
        // Show all sections when searching
        for (const section of Object.values(this.elements.get('sections') || {})) {
          if (section) section.style.display = 'block';
        }
        
        // Show/hide section headers based on whether they have any visible fields
        settingsPanel.querySelectorAll('.settings-section-header').forEach(header => {
          const section = header.nextElementSibling;
          const hasVisibleFields = section && 
            Array.from(section.querySelectorAll('.settings-field')).some(
              field => !field.classList.contains('search-hidden')
            );
            
          header.style.display = hasVisibleFields ? '' : 'none';
        });
        
        // Show no results message if needed
        let noResultsEl = settingsPanel.querySelector('.settings-no-results');
        
        if (matchCount === 0) {
          if (!noResultsEl) {
            noResultsEl = document.createElement('div');
            noResultsEl.className = 'settings-no-results';
            noResultsEl.textContent = `No settings found matching "${searchTerm}"`;
            settingsPanel.appendChild(noResultsEl);
          } else {
            noResultsEl.textContent = `No settings found matching "${searchTerm}"`;
            noResultsEl.style.display = '';
          }
        } else if (noResultsEl) {
          noResultsEl.style.display = 'none';
        }
      }
      
      /**
       * Highlight matching text in an element
       * @param {HTMLElement} element - Element containing text
       * @param {string} searchTerm - Search term to highlight
       * @private
       */
      _highlightText(element, searchTerm) {
        const originalText = element.textContent;
        const lowerText = originalText.toLowerCase();
        const searchLength = searchTerm.length;
        
        // Find all matches
        const matches = [];
        let index = 0;
        
        while ((index = lowerText.indexOf(searchTerm, index)) !== -1) {
          matches.push(index);
          index += searchLength;
        }
        
        if (matches.length === 0) return;
        
        // Build highlighted HTML
        let html = '';
        let lastIndex = 0;
        
        matches.forEach(matchIndex => {
          // Add text before match
          html += originalText.substring(lastIndex, matchIndex);
          
          // Add highlighted match
          html += `<mark>${originalText.substring(matchIndex, matchIndex + searchLength)}</mark>`;
          
          // Update lastIndex
          lastIndex = matchIndex + searchLength;
        });
        
        // Add remaining text
        html += originalText.substring(lastIndex);
        
        // Apply highlighting
        element.innerHTML = html;
      }
      
      /**
       * Switch to a different settings tab
       * @param {string} tabId - Tab ID to switch to
       * @private
       */
      _switchToTab(tabId) {
        if (!this.elements.get('tabs') || !this.elements.get('sections')) return;
        
        // Update tab buttons
        this.elements.get('tabs').forEach(tab => {
          const isActive = tab.dataset.tab === tabId;
          
          tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
          
          if (isActive) {
            DOMUtils.addClasses(tab, 'active');
          } else {
            DOMUtils.removeClasses(tab, 'active');
          }
        });
        
        // Update sections
        const sections = this.elements.get('sections');
        
        Object.entries(sections).forEach(([sectionId, section]) => {
          if (sectionId === tabId) {
            section.style.display = 'block';
            section.setAttribute('aria-hidden', 'false');
          } else {
            section.style.display = 'none';
            section.setAttribute('aria-hidden', 'true');
          }
        });
        
        // Save active tab for future sessions
        localStorage.setItem('claude:settings:active-tab', tabId);
      }
      
      /**
       * Preview a setting change without saving
       * @param {string} key - Setting key
       * @param {*} value - New value
       * @private
       */
      _previewSetting(key, value) {
        // Emit preview event for UI updates
        this.events.emit('setting-preview', { 
          key, 
          value, 
          previousValue: this.settings[key]
        });
        
        // Special handling for certain settings
        switch (key) {
          case 'theme':
            this._updateTheme(value);
            break;
          case 'thinkingBudget':
            if (this.elements.get('usageInfo')) {
              this._updateUsageInfo(value);
            }
            break;
          case 'fontSize':
            this._updateFontSize(value);
            break;
          case 'fontFamily':
            this._updateFontFamily(value);
            break;
          case 'displayMode':
            this._updateDisplayMode(value);
            break;
          case 'reducedMotion':
            this._updateReducedMotion(value);
            break;
          case 'highContrast':
            this._updateHighContrast(value);
            break;
        }
      }
      
      /**
       * Update usage info display
       * @param {number} budget - Thinking budget in tokens
       * @private
       */
      _updateUsageInfo(budget) {
        if (!this.elements.get('usageInfo')) return;
        
        // Format number with commas
        const formattedBudget = new Intl.NumberFormat().format(budget);
        this.elements.get('usageInfo').textContent = `Thinking Budget: ${formattedBudget} tokens`;
        
        // Update color coding
        DOMUtils.removeClasses(this.elements.get('usageInfo'), 'high-budget', 'medium-budget', 'low-budget');
        
        if (budget > 20000) {
          DOMUtils.addClasses(this.elements.get('usageInfo'), 'high-budget');
        } else if (budget < 5000) {
          DOMUtils.addClasses(this.elements.get('usageInfo'), 'low-budget');
        } else {
          DOMUtils.addClasses(this.elements.get('usageInfo'), 'medium-budget');
        }
      }
      
      /**
       * Update font size
       * @param {string} size - Font size setting
       * @private
       */
      _updateFontSize(size) {
        const html = document.documentElement;
        
        // Remove existing classes
        DOMUtils.removeClasses(html, 'font-small', 'font-medium', 'font-large', 'font-x-large');
        
        // Add appropriate class
        if (size && size !== 'medium') {
          DOMUtils.addClasses(html, `font-${size}`);
        }
        
        // Update accessibility info
        this.events.emit('accessibility-changed', { 
          feature: 'fontSize', 
          value: size
        });
      }
      
      /**
       * Update font family
       * @param {string} family - Font family setting
       * @private
       */
      _updateFontFamily(family) {
        const html = document.documentElement;
        
        // Remove existing classes
        DOMUtils.removeClasses(
          html, 
          'font-system', 
          'font-serif', 
          'font-sans-serif', 
          'font-monospace',
          'font-dyslexic'
        );
        
        // Add appropriate class
        if (family && family !== 'system') {
          DOMUtils.addClasses(html, `font-${family}`);
        }
        
        // Update accessibility info
        this.events.emit('accessibility-changed', { 
          feature: 'fontFamily', 
          value: family
        });
      }
      
      /**
       * Update display mode
       * @param {string} mode - Display mode
       * @private
       */
      _updateDisplayMode(mode) {
        const html = document.documentElement;
        
        // Remove existing classes
        DOMUtils.removeClasses(html, 'display-compact', 'display-comfortable', 'display-spacious');
        
        // Add appropriate class
        if (mode) {
          DOMUtils.addClasses(html, `display-${mode}`);
        }
        
        // Update accessibility info
        this.events.emit('accessibility-changed', { 
          feature: 'displayMode', 
          value: mode
        });
      }
      
      /**
       * Update save button state based on changes
       * @private
       */
      _updateSaveButtonState() {
        if (!this.elements.get('saveSettings')) return;
        
        this.elements.get('saveSettings').disabled = !this.hasUnsavedChanges;
        
        DOMUtils.toggleClasses(this.elements.get('saveSettings'), {
          'btn-primary': this.hasUnsavedChanges,
          'btn-disabled': !this.hasUnsavedChanges
        });
        
        // Also update undo/redo buttons if present
        if (this.elements.get('undoSettingsBtn')) {
          this.elements.get('undoSettingsBtn').disabled = this.changeHistory.length <= 1;
        }
        
        if (this.elements.get('redoSettingsBtn')) {
          this.elements.get('redoSettingsBtn').disabled = this.historyPosition <= 0;
        }
      }
      
      /**
       * Show validation error for a setting
       * @param {string} key - Setting key
       * @param {*} value - Invalid value
       * @private
       */
      _showValidationError(key, value) {
        const schema = this.schema[key];
        const element = this.elements.get(key);
        
        if (!schema || !element) return;
        
        let message = `Invalid value for ${schema.label || key}`;
        
        // Create specific error message
        if (schema.type === 'number') {
          if (schema.min !== undefined && schema.max !== undefined) {
            message = `${schema.label} must be between ${schema.min} and ${schema.max}`;
          } else if (schema.min !== undefined) {
            message = `${schema.label} must be at least ${schema.min}`;
          } else if (schema.max !== undefined) {
            message = `${schema.label} must be at most ${schema.max}`;
          }
        } else if (schema.options) {
          message = `${schema.label} must be one of the available options`;
        }
        
        // Show error via toast
        ToastManager.error('Invalid Setting', message);
        
        // Add error class to input
        DOMUtils.addClasses(element, 'error');
        
        // Add shake animation
        DOMUtils.addClasses(element, 'shake');
        
        // Focus the element
        element.focus();
        
        // Remove error animation after animation completes
        setTimeout(() => {
          DOMUtils.removeClasses(element, 'shake');
        }, 820); // Matches CSS animation duration
        
        // Remove error class after a bit longer
        setTimeout(() => {
          DOMUtils.removeClasses(element, 'error');
        }, 3000);
      }
      
      /**
       * Show backups dialog
       * @private
       */
      async _showBackupsDialog() {
        // Get list of backups
        const backups = await StorageManager.getBackups();
        
        if (backups.length === 0) {
          ToastManager.info('No Backups', 'No settings backups are available.');
          return;
        }
        
        // Create dialog content
        const dialog = document.createElement('div');
        dialog.className = 'dialog backups-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'backups-dialog-title');
        
        // Build dialog content
        dialog.innerHTML = `
          <div class="dialog-content">
            <div class="dialog-header">
              <h3 id="backups-dialog-title" class="dialog-title">Settings Backups</h3>
              <button class="dialog-close" aria-label="Close">&times;</button>
            </div>
            <div class="dialog-body">
              <p>Select a backup to restore:</p>
              <div class="backups-list">
                ${backups.map(backup => `
                  <div class="backup-item" data-timestamp="${backup.timestamp}">
                    <div class="backup-info">
                      <div class="backup-date">${new Date(backup.timestamp).toLocaleString()}</div>
                      <div class="backup-type">${backup.type === 'auto' ? 'Automatic' : 'Manual'}</div>
                    </div>
                    <button class="btn btn-outline btn-sm backup-restore-btn">Restore</button>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="dialog-footer">
              <button class="btn btn-outline" id="backups-create-btn">Create Backup</button>
              <button class="btn btn-text" id="backups-close-btn">Close</button>
            </div>
          </div>
        `;
        
        // Add dialog to page
        document.body.appendChild(dialog);
        
        // Set up event handlers
        dialog.querySelector('.dialog-close').addEventListener('click', () => {
          dialog.remove();
        });
        
        dialog.querySelector('#backups-close-btn').addEventListener('click', () => {
          dialog.remove();
        });
        
        // Create backup button
        dialog.querySelector('#backups-create-btn').addEventListener('click', async () => {
          const success = await StorageManager.createBackup(this.settings, 'manual');
          if (success) {
            ToastManager.success('Backup Created', 'Settings backup created successfully.');
            dialog.remove();
            // Refresh the dialog to show the new backup
            setTimeout(() => this._showBackupsDialog(), 300);
          } else {
            ToastManager.error('Backup Failed', 'Failed to create settings backup.');
          }
        });
        
        // Restore buttons
        dialog.querySelectorAll('.backup-restore-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const timestamp = parseInt(btn.closest('.backup-item').dataset.timestamp);
            const backup = backups.find(b => b.timestamp === timestamp);
            
            if (!backup) {
              ToastManager.error('Restore Failed', 'Could not find the selected backup.');
              return;
            }
            
            // Confirm restore
            const confirmDialog = await this._showConfirmationDialog({
              title: 'Restore Backup',
              message: `Are you sure you want to restore settings from ${new Date(backup.timestamp).toLocaleString()}? This will overwrite your current settings.`,
              confirmText: 'Restore',
              cancelText: 'Cancel'
            });
            
            if (!confirmDialog) return;
            
            // Restore the backup
            const settings = await StorageManager.restoreBackup(timestamp);
            
            if (settings) {
              // Create a new backup of current settings before restoring
              await StorageManager.createBackup(this.settings, 'pre-restore');
              
              // Restore sensitive data if available
              for (const [key, schema] of Object.entries(this.schema)) {
                if (schema.sensitive && this.settings[key] && settings[key] === true) {
                  settings[key] = this.settings[key];
                }
              }
              
              // Apply the restored settings
              const success = await this.updateSettings(settings, {
                notify: false
              });
              
              if (success) {
                ToastManager.success(
                  'Backup Restored', 
                  'Settings have been restored from backup.',
                  {
                    actions: [
                      {
                        label: 'Undo',
                        onClick: () => this.undoSettings()
                      }
                    ]
                  }
                );
                dialog.remove();
              } else {
                ToastManager.error('Restore Failed', 'Failed to restore settings from backup.');
              }
            } else {
              ToastManager.error('Restore Failed', 'Failed to retrieve backup data.');
            }
          });
        });
        
        // Add keyboard handling
        dialog.addEventListener('keydown', e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            dialog.remove();
          }
        });
        
        // Focus first item
        setTimeout(() => {
          const firstButton = dialog.querySelector('.backup-restore-btn');
          if (firstButton) firstButton.focus();
        }, 100);
      }
      
      // ===============================================================
      // Public API Methods
      // ===============================================================
      
      /**
       * Get current settings (full copy)
       * @returns {Object} Current settings
       */
      getSettings() {
        return { ...this.settings };
      }
      
      /**
       * Get public version of settings (omitting sensitive data)
       * @returns {Object} Settings without sensitive data
       */
      getPublicSettings() {
        const publicSettings = { ...this.settings };
        
        // Remove sensitive data
        for (const [key, schema] of Object.entries(this.schema)) {
          if (schema.sensitive && publicSettings[key]) {
            publicSettings[key] = true; // Just indicate value exists
          }
        }
        
        return publicSettings;
      }
      
      /**
       * Update settings
       * @param {Object} newSettings - New settings object
       * @param {Object} [options={}] - Update options
       * @returns {Promise<boolean>} Success status
       */
      async updateSettings(newSettings, options = {}) {
        const {
          save = true,
          validate = true,
          notify = true,
          trackHistory = true
        } = options;
        
        // Validate settings
        const validatedSettings = validate ? 
          this._validateSettingsObject(newSettings) : 
          newSettings;
          
        // Update settings object
        const oldSettings = { ...this.settings };
        Object.assign(this.settings, validatedSettings);
        
        // Track changed keys
        const changedKeys = Object.keys(validatedSettings).filter(
          key => JSON.stringify(validatedSettings[key]) !== JSON.stringify(oldSettings[key])
        );
        
        // Save to storage if requested and we have changes
        if (save && changedKeys.length > 0) {
          await this._saveSettings(this.settings);
          
          // Add to history if requested
          if (trackHistory) {
            this._addToHistory(this.settings);
          }
        }
        
        // Apply runtime changes
        changedKeys.forEach(key => {
          // Preview each changed setting
          this._previewSetting(key, this.settings[key]);
        });
        
        // Emit change events
        if (changedKeys.length > 0) {
          // Individual setting changes
          for (const key of changedKeys) {
            await this.events.emit('setting-changed', {
              key,
              value: this.settings[key],
              previousValue: oldSettings[key]
            });
          }
          
          // General settings changed event
          await this.events.emit('settings-changed', {
            settings: this.getPublicSettings(),
            changedKeys,
            oldSettings: { ...oldSettings }
          });
          
          // Show notification if requested
          if (notify && changedKeys.length > 0) {
            ToastManager.success(
              'Settings Updated',
              `Updated ${changedKeys.length} setting${changedKeys.length !== 1 ? 's' : ''}`
            );
          }
        }
        
        return changedKeys.length > 0;
      }
      
      /**
       * Update a single setting
       * @param {string} key - Setting key
       * @param {*} value - New value
       * @param {Object} [options={}] - Update options
       * @returns {Promise<boolean>} Success status
       */
      async updateSetting(key, value, options = {}) {
        // Check if key exists in schema
        if (!this.schema[key]) {
          console.warn(`Attempt to update unknown setting: ${key}`);
          return false;
        }
        
        // Use updateSettings for consistent behavior and validation
        const update = { [key]: value };
        return this.updateSettings(update, options);
      }
      
      /**
       * Validate a settings object against schema
       * @param {Object} settings - Settings to validate
       * @returns {Object} Validated settings object
       * @private
       */
      _validateSettingsObject(settings) {
        const validated = {};
        const errors = [];
        
        for (const [key, value] of Object.entries(settings)) {
          const schema = this.schema[key];
          
          // Skip unknown keys
          if (!schema) {
            console.warn(`Skipping unknown setting: ${key}`);
            continue;
          }
          
          try {
            // Sanitize if needed
            let processedValue = value;
            if (schema.sanitize) {
              processedValue = schema.sanitize(value);
            }
            
            // Validate
            if (schema.validate && !schema.validate(processedValue)) {
              errors.push(`Invalid value for ${schema.label || key}`);
              continue;
            }
            
            // Add to validated settings
            validated[key] = processedValue;
          } catch (e) {
            errors.push(`Error processing ${key}: ${e.message}`);
          }
        }
        
        // If any validation errors occurred, throw error
        if (errors.length > 0) {
          throw new Error(`Settings validation failed:\n${errors.join('\n')}`);
        }
        
        return validated;
      }
      
      /**
       * Get a specific setting
       * @param {string} key - Setting key
       * @param {*} [defaultValue] - Default value if not found
       * @returns {*} Setting value
       */
      getSetting(key, defaultValue) {
        return key in this.settings ? this.settings[key] : defaultValue;
      }
      
      /**
       * Open settings panel
       * @param {Object} [options={}] - Options for opening
       */
      openSettings(options = {}) {
        const {
          section = null,
          focusOnField = null,
          animate = true
        } = options;
        
        if (!this.elements.get('settingsPanel') || !this.elements.get('overlay')) {
          console.error('Settings panel elements not found');
          return;
        }
        
        // Reset pending changes
        this.pendingChanges.clear();
        this.hasUnsavedChanges = false;
        
        // Update UI with current settings
        this._updateUIFromSettings();
        
        // Show panel with animation
        DOMUtils.addClasses(this.elements.get('overlay'), 'active');
        
        // Check for reduced motion preference
        const prefersReducedMotion = 
          this.settings.reducedMotion === 'enabled' || 
          (this.settings.reducedMotion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        
        if (animate && !prefersReducedMotion) {
          // Use animation utils for smooth transitions
          DOMUtils.fadeIn(this.elements.get('overlay'), { duration: 150 });
          DOMUtils.addClasses(this.elements.get('settingsPanel'), 'opening');
          
          setTimeout(() => {
            DOMUtils.addClasses(this.elements.get('settingsPanel'), 'open');
            // Focus on first input after animation
            this._focusFirstInput(focusOnField);
          }, 50);
        } else {
          // Skip animation
          DOMUtils.addClasses(this.elements.get('settingsPanel'), 'open');
          // Focus on first input
          this._focusFirstInput(focusOnField);
        }
        
        // Check for section or restore previous tab
        let targetSection = section;
        
        if (!targetSection && this.elements.get('tabs')) {
          targetSection = localStorage.getItem('claude:settings:active-tab') || 
                         this.elements.get('tabs')[0]?.dataset.tab;
        }
        
        // Switch to specific section if requested
        if (targetSection && this.elements.get('tabs')) {
          this._switchToTab(targetSection);
        }
        
        // Check for search if provided
        if (options.search && this.elements.get('settingsSearch')) {
          this.elements.get('settingsSearch').value = options.search;
          this._filterSettings(options.search);
        }
        
        // Emit event
        this.events.emit('settings-opened');
      }
      
      /**
       * Focus first input in settings panel
       * @param {string} [preferredField=null] - Field to focus if available
       * @private
       */
      _focusFirstInput(preferredField = null) {
        // Respect delay for animation completion
        setTimeout(() => {
          // Try to focus on preferred field if specified
          if (preferredField && this.elements.get(preferredField)) {
            this.elements.get(preferredField).focus();
            return;
          }
          
          // Focus on API key if empty (as it's required)
          if (this.elements.get('apiKey') && !this.settings.apiKey) {
            this.elements.get('apiKey').focus();
            return;
          }
          
          // Otherwise focus on first form element
          const settingsPanel = this.elements.get('settingsPanel');
          if (settingsPanel) {
            const firstInput = settingsPanel.querySelector('input:not([type="hidden"]), select, textarea, button:not([disabled])');
            if (firstInput) {
              firstInput.focus();
            }
          }
        }, 100);
      }
      
      /**
       * Close settings panel
       * @param {Object} [options={}] - Options for closing
       * @returns {Promise<boolean>} Whether the panel was closed
       */
      async closeSettings(options = {}) {
        const {
          skipConfirm = false,
          animate = true,
          save = false
        } = options;
        
        if (!this.elements.get('settingsPanel') || !this.elements.get('overlay')) {
          return false;
        }
        
        // Check for unsaved changes
        if (!skipConfirm && this.hasUnsavedChanges) {
          const result = await this._showUnsavedChangesDialog();
          
          if (result === 'save') {
            await this.saveSettingsFromUI();
          } else if (result === 'cancel') {
            return false;
          }
          // 'discard' continues with closing
        }
        
        // Save before closing if requested
        if (save && this.hasUnsavedChanges) {
          await this.saveSettingsFromUI();
        }
        
        // Check for reduced motion preference
        const prefersReducedMotion = 
          this.settings.reducedMotion === 'enabled' || 
          (this.settings.reducedMotion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        
        if (animate && !prefersReducedMotion) {
          // Animated close
          DOMUtils.removeClasses(this.elements.get('settingsPanel'), 'open');
          DOMUtils.addClasses(this.elements.get('settingsPanel'), 'closing');
          
          await DOMUtils.fadeOut(this.elements.get('overlay'), { duration: 200 });
          
          // Clean up classes
          DOMUtils.removeClasses(this.elements.get('overlay'), 'active');
          DOMUtils.removeClasses(this.elements.get('settingsPanel'), 'closing');
        } else {
          // Immediate close
          DOMUtils.removeClasses(this.elements.get('settingsPanel'), 'open');
          DOMUtils.removeClasses(this.elements.get('overlay'), 'active');
        }
        
        // Reset pending changes
        this.pendingChanges.clear();
        this.hasUnsavedChanges = false;
        
        // Clear search if active
        const searchEl = this.elements.get('settingsSearch');
        if (searchEl && searchEl.value) {
          searchEl.value = '';
          this._filterSettings('');
        }
        
        // Return focus to previous element
        if (document.activeElement) {
          document.activeElement.blur();
        }
        
        // Focus on the element that opened settings
        setTimeout(() => {
          const openerBtn = this.elements.get('settingsButton') || this.elements.get('sidebarSettingsBtn');
          if (openerBtn) {
            openerBtn.focus();
          }
        }, 100);
        
        // Emit event
        this.events.emit('settings-closed');
        
        return true;
      }
      
      /**
       * Show unsaved changes confirmation dialog
       * @returns {Promise<string>} User choice: 'save', 'discard', or 'cancel'
       * @private
       */
      _showUnsavedChangesDialog() {
        return new Promise((resolve) => {
          // Create dialog content
          const content = `
            <div class="unsaved-dialog-content">
              <p>You have unsaved changes. What would you like to do?</p>
              <div class="dialog-actions">
                <button class="btn btn-primary js-save-action">Save Changes</button>
                <button class="btn btn-outline js-discard-action">Discard Changes</button>
                <button class="btn btn-text js-cancel-action">Cancel</button>
              </div>
            </div>
          `;
          
          // Show dialog with custom buttons
          const dialog = document.createElement('div');
          dialog.className = 'dialog settings-unsaved-dialog';
          dialog.setAttribute('role', 'dialog');
          dialog.setAttribute('aria-modal', 'true');
          dialog.setAttribute('aria-labelledby', 'dialog-title');
          
          // Add content
          dialog.innerHTML = `
            <div class="dialog-content">
              <h3 id="dialog-title" class="dialog-title">Unsaved Changes</h3>
              ${content}
            </div>
          `;
          
          // Add event handlers
          const saveBtn = dialog.querySelector('.js-save-action');
          const discardBtn = dialog.querySelector('.js-discard-action');
          const cancelBtn = dialog.querySelector('.js-cancel-action');
          
          saveBtn.addEventListener('click', () => {
            dialog.remove();
            resolve('save');
          });
          
          discardBtn.addEventListener('click', () => {
            dialog.remove();
            resolve('discard');
          });
          
          cancelBtn.addEventListener('click', () => {
            dialog.remove();
            resolve('cancel');
          });
          
          // Add keyboard navigation
          dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              dialog.remove();
              resolve('cancel');
            } else if (e.key === 'Enter' && document.activeElement === saveBtn) {
              dialog.remove();
              resolve('save');
            } else if (e.key === 'Enter' && document.activeElement === discardBtn) {
              dialog.remove();
              resolve('discard');
            } else if (e.key === 'Enter' && document.activeElement === cancelBtn) {
              dialog.remove();
              resolve('cancel');
            } else if (e.key === 'Tab') {
              // Trap focus within dialog
              const focusableElements = dialog.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
              const firstElement = focusableElements[0];
              const lastElement = focusableElements[focusableElements.length - 1];
              
              if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          });
          
          // Add an overlay
          const overlay = document.createElement('div');
          overlay.className = 'dialog-overlay';
          
          // Add to DOM
          document.body.appendChild(overlay);
          document.body.appendChild(dialog);
          
          // Focus on save button
          saveBtn.focus();
        });
      }
      
      /**
       * Check if settings panel is open
       * @returns {boolean} Whether panel is open
       */
      isSettingsPanelOpen() {
        return this.elements.get('settingsPanel')?.classList.contains('open') || false;
      }
      
      /**
       * Save settings from UI inputs
       * @returns {Promise<boolean>} Success status
       */
      async saveSettingsFromUI() {
        // Extract values from UI
        const newSettings = {};
        let validationErrors = [];
        
        // Process each field with schema
        for (const [key, schema] of Object.entries(this.schema)) {
          const element = this.elements.get(key);
          if (!element) continue;
          
          try {
            let value;
            
            // Extract value based on input type
            if (element.type === 'checkbox') {
              value = element.checked;
            } else if (schema.type === 'number') {
              value = parseFloat(element.value);
              
              // Apply min/max constraints
              if (schema.min !== undefined) value = Math.max(schema.min, value);
              if (schema.max !== undefined) value = Math.min(schema.max, value);
            } else {
              value = element.value;
            }
            
            // Sanitize if needed
            if (schema.sanitize) {
              value = schema.sanitize(value);
            }
            
            // Validate
            if (schema.validate && !schema.validate(value)) {
              validationErrors.push({
                key,
                label: schema.label || key,
                message: `Invalid value for ${schema.label || key}`
              });
              continue;
            }
            
            // Add to new settings
            newSettings[key] = value;
          } catch (e) {
            validationErrors.push({
              key,
              label: schema.label || key,
              message: `Error processing ${schema.label || key}: ${e.message}`
            });
          }
        }
        
        // If validation errors occurred, show errors and don't save
        if (validationErrors.length > 0) {
          this._showValidationErrors(validationErrors);
          return false;
        }
        
        // Update settings
        const success = await this.updateSettings(newSettings, {
          notify: false // We'll show our own notification
        });
        
        if (success) {
          // Reset pending changes
          this.pendingChanges.clear();
          this.hasUnsavedChanges = false;
          this._updateSaveButtonState();
          
          // Show success message
          ToastManager.success(
            'Settings Saved',
            'Your preferences have been updated successfully.'
          );
        } else {
          ToastManager.error(
            'Save Failed',
            'There was an error saving your settings. Please try again.'
          );
        }
        
        return success;
      }
      
      /**
       * Show validation errors for multiple fields
       * @param {Array} errors - List of validation errors
       * @private
       */
      _showValidationErrors(errors) {
        // Focus on first error field
        if (errors.length > 0 && this.elements.get(errors[0].key)) {
          const element = this.elements.get(errors[0].key);
          
          // Add error class
          DOMUtils.addClasses(element, 'error');
          
          // Add shake animation
          DOMUtils.addClasses(element, 'shake');
          
          // Scroll to and focus the element
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
          
          // Remove error animation after animation completes
          setTimeout(() => {
            DOMUtils.removeClasses(element, 'shake');
          }, 820); // Matches CSS animation duration
          
          // Remove error class after a bit longer
          setTimeout(() => {
            DOMUtils.removeClasses(element, 'error');
          }, 3000);
        }
        
        // Show toast with validation errors
        if (errors.length === 1) {
          // Single error
          ToastManager.error('Validation Error', errors[0].message);
        } else {
          // Multiple errors
          ToastManager.error(
            'Validation Errors',
            `${errors.length} settings have invalid values. Please correct them and try again.`,
            {
              actions: [
                {
                  label: 'Show Details',
                  onClick: () => {
                    // Show detailed error dialog
                    this._showErrorDetailsDialog(errors);
                  }
                }
              ]
            }
          );
        }
      }
      
      /**
       * Show a dialog with detailed error information
       * @param {Array} errors - List of validation errors
       * @private
       */
      _showErrorDetailsDialog(errors) {
        const dialog = document.createElement('div');
        dialog.className = 'dialog error-details-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'error-dialog-title');
        
        // Build dialog content
        const errorDetails = errors.map(error => `
          <div class="error-item">
            <strong>${error.label}:</strong> ${error.message}
          </div>
        `).join('');
        
        dialog.innerHTML = `
          <div class="dialog-content">
            <div class="dialog-header">
              <h3 id="error-dialog-title" class="dialog-title">Validation Errors</h3>
              <button class="dialog-close" aria-label="Close">&times;</button>
            </div>
            <div class="dialog-body">
              <div class="error-list">
                ${errorDetails}
              </div>
            </div>
            <div class="dialog-footer">
              <button class="btn btn-primary dialog-ok">OK</button>
            </div>
          </div>
        `;
        
        // Add dialog to page
        document.body.appendChild(dialog);
        
        // Set up event handlers
        const closeBtn = dialog.querySelector('.dialog-close');
        const okBtn = dialog.querySelector('.dialog-ok');
        
        const closeDialog = () => {
          dialog.remove();
        };
        
        closeBtn.addEventListener('click', closeDialog);
        okBtn.addEventListener('click', closeDialog);
        
        // Add keyboard handling
        dialog.addEventListener('keydown', e => {
          if (e.key === 'Escape' || e.key === 'Enter') {
            e.preventDefault();
            closeDialog();
          }
        });
        
        // Focus the OK button
        setTimeout(() => okBtn.focus(), 100);
      }
      
      /**
       * Apply a settings preset
       * @param {string} presetName - Name of the preset
       * @param {Object} [options={}] - Options for applying preset
       * @returns {Promise<boolean>} Success status
       */
      async applyPreset(presetName, options = {}) {
        const {
          saveImmediately = false,
          notify = true
        } = options;
        
        // Find preset
        const preset = this.presets[presetName];
        if (!preset) {
          console.warn(`Preset "${presetName}" not found`);
          return false;
        }
        
        // Create preset updates
        const presetUpdates = {};
        
        // Process preset values
        for (const [key, value] of Object.entries(preset)) {
          // Skip non-schema keys except description
          if (key === 'description') continue;
          if (!this.schema[key]) continue;
          
          // Use preset value
          presetUpdates[key] = value;
        }
        
        if (Object.keys(presetUpdates).length === 0) {
          return false;
        }
        
        // Apply immediately or just update UI
        if (saveImmediately) {
          const success = await this.updateSettings(presetUpdates, {
            notify: false // We'll show our own notification
          });
          
          if (success && notify) {
            ToastManager.success(
              'Preset Applied',
              `Applied the "${presetName}" preset: ${preset.description}`,
              {
                duration: 4000,
                actions: [
                  {
                    label: 'Undo',
                    onClick: () => this.undoSettings()
                  }
                ]
              }
            );
          }
          
          return success;
        } else {
          // Update UI only
          for (const [key, value] of Object.entries(presetUpdates)) {
            const element = this.elements.get(key);
            if (!element) continue;
            
            // Update element
            if (element.type === 'checkbox') {
              element.checked = !!value;
            } else if (element.type === 'number') {
              element.value = value;
            } else {
              element.value = value;
            }
            
            // Update display elements
            this._updateDisplayElements(key, value);
            
            // Add to pending changes
            this.pendingChanges.set(key, value);
            
            // Preview each setting
            this._previewSetting(key, value);
          }
          
          // Mark as having unsaved changes
          this.hasUnsavedChanges = true;
          this._updateSaveButtonState();
          
          if (notify) {
            ToastManager.info(
              'Preset Ready',
              `Applied the "${presetName}" preset: ${preset.description}. Save changes to keep these settings.`,
              {
                duration: 4000,
                actions: [
                  {
                    label: 'Save Now',
                    onClick: () => this.saveSettingsFromUI()
                  }
                ]
              }
            );
          }
          
          return true;
        }
      }
      
      /**
       * Reset settings to defaults
       * @param {Object} [options={}] - Reset options
       * @returns {Promise<boolean>} Success status
       */
      async resetSettings(options = {}) {
        const {
          confirmReset = true,
          preserveApiKey = true,
          notify = true
        } = options;
        
        // Confirm reset if needed
        if (confirmReset) {
          const confirmed = await this._showConfirmationDialog({
            title: 'Reset Settings',
            message: 'Are you sure you want to reset all settings to defaults? This cannot be undone.',
            confirmText: 'Reset Settings',
            cancelText: 'Cancel',
            destructive: true
          });
          
          if (!confirmed) return false;
        }
        
        // Get default settings
        const defaultSettings = this._getDefaultSettings();
        
        // Preserve API key if requested
        if (preserveApiKey && this.settings.apiKey) {
          defaultSettings.apiKey = this.settings.apiKey;
        }
        
        // Apply defaults
        const success = await this.updateSettings(defaultSettings, {
          notify: false // Handle notification ourselves
        });
        
        if (success) {
          // Update UI
          this._updateUIFromSettings();
          
          if (notify) {
            ToastManager.info(
              'Settings Reset',
              'All settings have been reset to default values.',
              {
                duration: 5000,
                actions: [
                  {
                    label: 'Undo',
                    onClick: () => this.undoSettings()
                  }
                ]
              }
            );
          }
        }
        
        return success;
      }
      
      /**
       * Show a confirmation dialog
       * @param {Object} options - Dialog options
       * @returns {Promise<boolean>} Whether confirmed
       * @private
       */
      _showConfirmationDialog(options) {
        const {
          title = 'Confirm',
          message = 'Are you sure?',
          confirmText = 'Confirm',
          cancelText = 'Cancel',
          destructive = false
        } = options;
        
        return new Promise((resolve) => {
          // Create dialog
          const dialog = document.createElement('div');
          dialog.className = 'dialog confirmation-dialog';
          dialog.setAttribute('role', 'dialog');
          dialog.setAttribute('aria-modal', 'true');
          dialog.setAttribute('aria-labelledby', 'dialog-title');
          
          // Set content
          dialog.innerHTML = `
            <div class="dialog-content">
              <h3 id="dialog-title" class="dialog-title">${title}</h3>
              <div class="dialog-body">
                <p class="dialog-message">${message}</p>
              </div>
              <div class="dialog-footer">
                <button class="btn btn-outline dialog-cancel">${cancelText}</button>
                <button class="btn ${destructive ? 'btn-danger' : 'btn-primary'} dialog-confirm">${confirmText}</button>
              </div>
            </div>
          `;
          
          // Create overlay
          const overlay = document.createElement('div');
          overlay.className = 'dialog-overlay active';
          
          // Add to DOM
          document.body.appendChild(overlay);
          document.body.appendChild(dialog);
          
          // Add event listeners
          const confirmBtn = dialog.querySelector('.dialog-confirm');
          const cancelBtn = dialog.querySelector('.dialog-cancel');
          
          // Handle confirm
          confirmBtn.addEventListener('click', () => {
            cleanup();
            resolve(true);
          });
          
          // Handle cancel
          cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(false);
          });
          
          // Handle overlay click
          overlay.addEventListener('click', () => {
            cleanup();
            resolve(false);
          });
          
          // Handle Escape key
          dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cleanup();
              resolve(false);
            } else if (e.key === 'Enter' && document.activeElement === confirmBtn) {
              e.preventDefault();
              cleanup();
              resolve(true);
            } else if (e.key === 'Enter' && document.activeElement === cancelBtn) {
              e.preventDefault();
              cleanup();
              resolve(false);
            } else if (e.key === 'Tab') {
              // Trap focus within dialog
              const focusableElements = dialog.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
              const firstElement = focusableElements[0];
              const lastElement = focusableElements[focusableElements.length - 1];
              
              if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          });
          
          // Focus confirm button
          setTimeout(() => confirmBtn.focus(), 100);
          
          // Cleanup function
          function cleanup() {
            overlay.remove();
            dialog.remove();
          }
        });
      }
      
      /**
       * Export settings to JSON file
       * @param {Object} [options={}] - Export options
       * @returns {Promise<boolean>} Success status
       */
      async exportSettings(options = {}) {
        const {
          includeSensitive = false,
          format = 'json',
          filename = `claude-settings-${new Date().toISOString().slice(0, 10)}.json`,
          createSignature = true
        } = options;
        
        try {
          // Create a clean copy of settings
          const exportData = {
            settings: { ...this.settings },
            version: this.version,
            timestamp: new Date().toISOString(),
            platform: this._getPlatformInfo()
          };
          
          // Remove sensitive data unless explicitly included
          if (!includeSensitive) {
            for (const [key, schema] of Object.entries(this.schema)) {
              if (schema.sensitive && exportData.settings[key]) {
                exportData.settings[key] = ''; // Remove value
              }
            }
          }
          
          // Add cryptographic signature if requested
          if (createSignature && SecurityManager.isEncryptionAvailable()) {
            exportData.signature = {
              algorithm: 'hmac-sha256',
              value: await SecurityManager.generateSignature(exportData.settings)
            };
          }
          
          // Format data based on requested format
          let content;
          let mimeType;
          
          if (format === 'json') {
            // Pretty print JSON with 2-space indentation
            content = JSON.stringify(exportData, null, 2);
            mimeType = 'application/json';
          } else if (format === 'yaml' || format === 'yml') {
            // Convert to YAML
            content = this._convertToYaml(exportData);
            mimeType = 'application/yaml';
          } else {
            // Default to JSON
            content = JSON.stringify(exportData);
            mimeType = 'application/json';
          }
          
          // Create download
          const blob = new Blob([content], { type: mimeType });
          
          // Use newer File System Access API if available
          if (window.showSaveFilePicker) {
            try {
              const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                  description: 'Settings File',
                  accept: { [mimeType]: [`.${format}`] }
                }]
              });
              
              const writable = await handle.createWritable();
              await writable.write(blob);
              await writable.close();
              
              ToastManager.success(
                'Settings Exported',
                'Your settings have been exported successfully.'
              );
              
              return true;
            } catch (e) {
              // User cancelled or API error, fall back to traditional method
              if (e.name !== 'AbortError') {
                console.warn('File System Access API failed, falling back:', e);
              }
            }
          }
          
          // Fall back to traditional download approach
          const url = URL.createObjectURL(blob);
          
          // Create link and trigger download
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.style.display = 'none';
          
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          
          ToastManager.success(
            'Settings Exported',
            'Your settings have been exported successfully.'
          );
          
          return true;
        } catch (error) {
          console.error('Failed to export settings:', error);
          
          ToastManager.error(
            'Export Failed',
            `Could not export settings: ${error.message}`
          );
          
          return false;
        }
      }
      
      /**
       * Convert object to YAML string
       * @param {Object} data - Data to convert
       * @returns {string} YAML representation
       * @private
       */
      _convertToYaml(data) {
        // Simple YAML conversion for basic objects
        // For a real implementation, use a library like js-yaml
        
        function indent(level) {
          return '  '.repeat(level);
        }
        
        function convertValue(value, level) {
          if (value === null || value === undefined) {
            return 'null';
          } else if (typeof value === 'string') {
            // Escape special characters and quote strings with special chars
            if (value.includes('\n') || value.includes('"') || value.match(/[:{}\[\],&*#?|<>=!%@`]/)) {
              return '|-\n' + value.split('\n').map(line => indent(level + 1) + line).join('\n');
            }
            return value.includes(' ') ? `"${value}"` : value;
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
          } else if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            return '\n' + value.map(item => indent(level + 1) + '- ' + convertValue(item, level + 1)).join('\n');
          } else if (typeof value === 'object') {
            if (Object.keys(value).length === 0) return '{}';
            return '\n' + Object.entries(value).map(([k, v]) => 
              indent(level + 1) + k + ': ' + convertValue(v, level + 1)
            ).join('\n');
          }
          return String(value);
        }
        
        return Object.entries(data).map(([key, value]) => 
          key + ': ' + convertValue(value, 0)
        ).join('\n');
      }
      
      /**
       * Import settings from JSON file
       * @returns {Promise<boolean>} Success status
       */
      async importSettings() {
        try {
          let fileContent;
          
          // Try to use the File System Access API if available
          if (window.showOpenFilePicker) {
            try {
              const [fileHandle] = await window.showOpenFilePicker({
                types: [
                  {
                    description: 'Settings Files',
                    accept: {
                      'application/json': ['.json'],
                      'application/yaml': ['.yaml', '.yml']
                    }
                  }
                ],
                excludeAcceptAllOption: false,
                multiple: false
              });
              
              const file = await fileHandle.getFile();
              fileContent = await file.text();
            } catch (e) {
              // User cancelled or API error, fall back to traditional method
              if (e.name !== 'AbortError') {
                console.warn('File System Access API failed, falling back:', e);
              }
            }
          }
          
          // Fall back to traditional file input if needed
          if (!fileContent) {
            fileContent = await this._showFileInputDialog({
              accept: '.json,.yaml,.yml',
              title: 'Import Settings',
              message: 'Select a settings file to import:'
            });
          }
          
          if (!fileContent) {
            return false; // User cancelled
          }
          
          // Parse file content based on format
          let importData;
          
          if (fileContent.trim().startsWith('{')) {
            // JSON format
            importData = JSON.parse(fileContent);
          } else {
            // Assume YAML format
            ToastManager.error(
              'Import Failed',
              'YAML parsing is not implemented in this version. Please use JSON format.'
            );
            return false;
          }
          
          // Process the imported settings
          return await this._processImportedSettings(importData);
        } catch (error) {
          console.error('Failed to import settings:', error);
          
          ToastManager.error(
            'Import Failed',
            `Could not import settings: ${error.message}`
          );
          
          return false;
        }
      }
      
      /**
       * Show file input dialog for importing
       * @param {Object} options - Dialog options
       * @returns {Promise<string|null>} File content or null if cancelled
       * @private
       */
      _showFileInputDialog(options) {
        const {
          accept = '.json',
          title = 'Select File',
          message = 'Please select a file:'
        } = options;
        
        return new Promise((resolve) => {
          // Create file input dialog
          const dialog = document.createElement('div');
          dialog.className = 'dialog file-import-dialog';
          dialog.setAttribute('role', 'dialog');
          dialog.setAttribute('aria-modal', 'true');
          dialog.setAttribute('aria-labelledby', 'file-dialog-title');
          
          dialog.innerHTML = `
            <div class="dialog-content">
              <h3 id="file-dialog-title" class="dialog-title">${title}</h3>
              <div class="dialog-body">
                <p>${message}</p>
                <label class="file-input-container">
                  <input type="file" accept="${accept}" class="file-input" />
                  <span class="file-input-button">Choose File</span>
                  <span class="file-input-name">No file selected</span>
                </label>
                <div class="file-input-error" style="display: none; color: red;"></div>
              </div>
              <div class="dialog-footer">
                <button class="btn btn-outline dialog-cancel">Cancel</button>
                <button class="btn btn-primary dialog-import" disabled>Import</button>
              </div>
            </div>
          `;
          
          // Create overlay
          const overlay = document.createElement('div');
          overlay.className = 'dialog-overlay active';
          
          // Add to DOM
          document.body.appendChild(overlay);
          document.body.appendChild(dialog);
          
          // Get elements
          const fileInput = dialog.querySelector('.file-input');
          const fileInputName = dialog.querySelector('.file-input-name');
          const fileInputError = dialog.querySelector('.file-input-error');
          const importBtn = dialog.querySelector('.dialog-import');
          const cancelBtn = dialog.querySelector('.dialog-cancel');
          
          // File selection change
          fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
              const file = fileInput.files[0];
              fileInputName.textContent = file.name;
              importBtn.disabled = false;
              fileInputError.style.display = 'none';
            } else {
              fileInputName.textContent = 'No file selected';
              importBtn.disabled = true;
            }
          });
          
          // Import button click
          importBtn.addEventListener('click', async () => {
            if (!fileInput.files || !fileInput.files[0]) {
              return;
            }
            
            try {
              const file = fileInput.files[0];
              const reader = new FileReader();
              
              reader.onload = (e) => {
                cleanup();
                resolve(e.target.result);
              };
              
              reader.onerror = () => {
                fileInputError.textContent = 'Failed to read file';
                fileInputError.style.display = 'block';
              };
              
              reader.readAsText(file);
            } catch (e) {
              fileInputError.textContent = `Error: ${e.message}`;
              fileInputError.style.display = 'block';
            }
          });
          
          // Cancel button click
          cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(null);
          });
          
          // Cancel on overlay click
          overlay.addEventListener('click', () => {
            cleanup();
            resolve(null);
          });
          
          // Handle Escape key
          dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cleanup();
              resolve(null);
            }
          });
          
          // Focus the file input button
          setTimeout(() => dialog.querySelector('.file-input-button').focus(), 100);
          
          // Cleanup function
          function cleanup() {
            overlay.remove();
            dialog.remove();
          }
        });
      }
      
      /**
       * Process imported settings
       * @param {Object} importData - Imported data
       * @returns {Promise<boolean>} Success status
       * @private
       */
      async _processImportedSettings(importData) {
        // Extract settings
        const importedSettings = importData.settings;
        if (!importedSettings || typeof importedSettings !== 'object') {
          throw new Error('Invalid settings format');
        }
        
        // Verify signature if present
        if (importData.signature && SecurityManager.isEncryptionAvailable()) {
          try {
            const isValid = await SecurityManager.verifySignature(
              importedSettings,
              importData.signature.value
            );
            
            if (!isValid) {
              const proceed = await this._showConfirmationDialog({
                title: 'Invalid Signature',
                message: 'The signature of this settings file could not be verified. This could mean the file has been tampered with. Import anyway?',
                confirmText: 'Import Anyway',
                cancelText: 'Cancel',
                destructive: true
              });
              
              if (!proceed) return false;
            }
          } catch (e) {
            console.warn('Signature verification failed:', e);
          }
        }
        
        // Check version compatibility
        if (importData.version) {
          const importVersion = this._parseVersion(importData.version);
          const currentVersion = this._parseVersion(this.version);
          
          // Show warning for newer version imports
          if (importVersion.major > currentVersion.major) {
            const proceed = await this._showConfirmationDialog({
              title: 'Version Warning',
              message: `This settings file was created with a newer version (${importData.version}). Importing may cause compatibility issues. Continue anyway?`,
              confirmText: 'Import Anyway',
              cancelText: 'Cancel'
            });
            
            if (!proceed) return false;
          }
        }
        
        // Validate settings against schema
        const newSettings = {};
        let changedSettingsCount = 0;
        const errors = [];
        
        // Process each setting
        for (const [key, value] of Object.entries(importedSettings)) {
          const schema = this.schema[key];
          
          // Skip if not in schema
          if (!schema) continue;
          
          // Skip sensitive fields that are empty
          if (schema.sensitive && !value) continue;
          
          try {
            // Process value
            let processedValue = value;
            
            // Try to sanitize if needed
            if (schema.sanitize) {
              processedValue = schema.sanitize(value);
            }
            
            // Validate
            if (schema.validate && !schema.validate(processedValue)) {
              errors.push(`Invalid value for ${schema.label || key}`);
              continue;
            }
            
            // Check if different from current
            if (JSON.stringify(this.settings[key]) !== JSON.stringify(processedValue)) {
              newSettings[key] = processedValue;
              changedSettingsCount++;
            }
          } catch (e) {
            errors.push(`Failed to import ${key}: ${e.message}`);
          }
        }
        
        // If validation errors occurred, show warning
        if (errors.length > 0) {
          ToastManager.warning(
            'Partial Import',
            `Imported with ${errors.length} validation errors. Some settings were skipped.`,
            { 
              duration: 6000,
              actions: [
                {
                  label: 'Show Details',
                  onClick: () => {
                    // Show detailed error dialog
                    this._showErrorDetailsDialog(errors.map(error => ({
                      label: error.split(':')[0],
                      message: error
                    })));
                  }
                }
              ]
            }
          );
        }
        
        // If no valid changes, exit
        if (changedSettingsCount === 0) {
          ToastManager.info('No Changes', 'The imported settings are identical to current settings.');
          return true;
        }
        
        // Confirm changes before applying
        const changesMessage = `This will update ${changedSettingsCount} setting${changedSettingsCount !== 1 ? 's' : ''}. Continue?`;
        
        const confirmed = await this._showConfirmationDialog({
          title: 'Apply Imported Settings',
          message: changesMessage,
          confirmText: 'Apply Settings',
          cancelText: 'Cancel'
        });
        
        if (!confirmed) return false;
        
        // Create backup before applying
        await StorageManager.createBackup(this.settings, 'pre-import');
        
        // Apply settings
        const success = await this.updateSettings(newSettings, {
          notify: false // We'll show our own notification
        });
        
        if (success) {
          ToastManager.success(
            'Settings Imported',
            `Successfully applied ${changedSettingsCount} setting${changedSettingsCount !== 1 ? 's' : ''}.`,
            {
              duration: 5000,
              actions: [
                {
                  label: 'Undo',
                  onClick: () => this.undoSettings()
                }
              ]
            }
          );
          
          // Update UI
          this._updateUIFromSettings();
        } else {
          ToastManager.error(
            'Import Failed',
            'Failed to apply imported settings.'
          );
        }
        
        return success;
      }
      
      /**
       * Parse a version string into components
       * @param {string} version - Version string (e.g., "3.0.0")
       * @returns {Object} Version components
       * @private
       */
      _parseVersion(version) {
        const parts = version.split('.');
        return {
          major: parseInt(parts[0]) || 0,
          minor: parseInt(parts[1]) || 0,
          patch: parseInt(parts[2]) || 0,
          raw: version
        };
      }
      
      /**
       * Get platform information
       * @returns {Object} Platform info
       * @private
       */
      _getPlatformInfo() {
        return {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          cookiesEnabled: navigator.cookieEnabled,
          screenSize: {
            width: window.screen.width,
            height: window.screen.height,
            pixelRatio: window.devicePixelRatio
          },
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timestamp: new Date().toISOString()
        };
      }
      
      /**
       * Undo last settings change
       * @returns {Promise<boolean>} Success status
       */
      async undoSettings() {
        // Check if we have history
        if (this.changeHistory.length <= 1) {
          ToastManager.info('Nothing to Undo', 'No previous settings state available.');
          return false;
        }
        
        if (this.historyPosition >= this.changeHistory.length - 1) {
          ToastManager.info('Nothing to Undo', 'Already at oldest settings state.');
          return false;
        }
        
        // Update history position
        this.historyPosition += 1;
        
        // Get previous settings
        const previousEntry = this.changeHistory[this.historyPosition];
        if (!previousEntry || !previousEntry.settings) {
          return false;
        }
        
        // Apply previous settings
        const success = await this.updateSettings(previousEntry.settings, {
          notify: false, // We'll show our own notification
          trackHistory: false // Don't add this to history
        });
        
        if (success) {
          // Update UI
          this._updateUIFromSettings();
          
          // Show notification
          ToastManager.success(
            'Settings Restored',
            'Previous settings have been restored.',
            {
              duration: 4000,
              actions: [
                {
                  label: 'Redo',
                  onClick: () => this.redoSettings()
                }
              ]
            }
          );
          
          // Update button states
          this._updateSaveButtonState();
        } else {
          ToastManager.error(
            'Undo Failed',
            'Could not restore previous settings.'
          );
        }
        
        return success;
      }
      
      /**
       * Redo settings change
       * @returns {Promise<boolean>} Success status
       */
      async redoSettings() {
        // Check if we have history to redo
        if (this.historyPosition <= 0) {
          ToastManager.info('Nothing to Redo', 'Already at newest settings state.');
          return false;
        }
        
        // Update history position
        this.historyPosition -= 1;
        
        // Get next settings
        const nextEntry = this.changeHistory[this.historyPosition];
        if (!nextEntry || !nextEntry.settings) {
          return false;
        }
        
        // Apply next settings
        const success = await this.updateSettings(nextEntry.settings, {
          notify: false, // We'll show our own notification
          trackHistory: false // Don't add this to history
        });
        
        if (success) {
          // Update UI
          this._updateUIFromSettings();
          
          // Show notification
          ToastManager.success(
            'Settings Restored',
            'Next settings state has been restored.',
            {
              duration: 4000,
              actions: [
                {
                  label: 'Undo',
                  onClick: () => this.undoSettings()
                }
              ]
            }
          );
          
          // Update button states
          this._updateSaveButtonState();
        } else {
          ToastManager.error(
            'Redo Failed',
            'Could not restore next settings state.'
          );
        }
        
        return success;
      }
      
      /**
       * Register a settings change listener
       * @param {string} event - Event name
       * @param {Function} callback - Event handler
       * @param {Object} [options={}] - Listener options
       * @returns {Function} Unsubscribe function
       */
      on(event, callback, options = {}) {
        return this.events.on(event, callback, options);
      }
      
      /**
       * Register a one-time settings change listener
       * @param {string} event - Event name
       * @param {Function} callback - Event handler
       * @param {Object} [options={}] - Listener options
       * @returns {Function} Unsubscribe function
       */
      once(event, callback, options = {}) {
        return this.events.once(event, callback, options);
      }
      
      /**
       * Check if settings manager has been initialized
       * @returns {boolean} Initialization status
       */
      isInitialized() {
        return this.initialized;
      }
      
      /**
       * Check if required settings are configured
       * @returns {boolean} Whether setup is complete
       */
      isSetupComplete() {
        // Check for API key as minimum requirement
        return Boolean(this.settings?.apiKey);
      }
      
      /**
       * Get all available settings categories
       * @returns {Array} Settings categories
       */
      getCategories() {
        return [...this.categories];
      }
      
      /**
       * Get settings schema
       * @returns {Object} Settings schema definition
       */
      getSchema() {
        return { ...this.schema };
      }
      
      /**
       * Get available presets
       * @returns {Object} Settings presets
       */
      getPresets() {
        return { ...this.presets };
      }
      
      /**
       * Get settings grouped by category
       * @returns {Object} Settings by category
       */
      getSettingsByCategory() {
        const result = {};
        
        // Initialize categories
        for (const category of this.categories) {
          result[category.id] = [];
        }
        
        // Add settings to categories
        for (const [key, schema] of Object.entries(this.schema)) {
          if (schema.category && result[schema.category]) {
            result[schema.category].push({
              key,
              ...schema,
              value: this.settings[key]
            });
          }
        }
        
        // Sort by order property if available
        for (const categoryId in result) {
          result[categoryId].sort((a, b) => 
            (a.order || 999) - (b.order || 999)
          );
        }
        
        return result;
      }
      
      /**
       * Get performance metrics
       * @returns {Object} Performance metrics
       */
      getPerformanceMetrics() {
        return { ...this._perfMetrics };
      }
    }
    
    // ===============================================================
    // Create and Export Settings Manager Instance
    // ===============================================================
    
    // Create singleton instance
    const settingsManager = new SettingsManager();
    
    // ===============================================================
    // Legacy Functions for Backward Compatibility
    // ===============================================================
    
    /**
     * Initialize settings system
     * @param {Object} [options={}] - Init options
     * @returns {Promise<Object>} Settings instance
     */
    async function initSettings(options = {}) {
      try {
        await settingsManager.init(options);
        
        // Legacy event bridging
        settingsManager.on('settings-changed', (data) => {
          if (typeof window.onSettingsChanged === 'function') {
            window.onSettingsChanged(data.settings, data.changedKeys);
          }
        });
        
        settingsManager.on('theme-changed', (data) => {
          if (typeof window.onThemeChanged === 'function') {
            window.onThemeChanged(data.theme);
          }
        });
        
        return settingsManager;
      } catch (error) {
        console.error('Failed to initialize settings:', error);
        throw error;
      }
    }
    
    /**
     * Get current settings
     * @returns {Object} Current settings
     */
    function getSettings() {
      return settingsManager.getSettings();
    }
    
    /**
     * Update settings
     * @param {Object} newSettings - New settings object
     * @returns {Promise<boolean>} Success status
     */
    async function saveSettings(newSettings) {
      return settingsManager.updateSettings(newSettings);
    }
    
    /**
     * Open settings panel
     * @param {Object} [options={}] - Options
     */
    function openSettings(options = {}) {
      settingsManager.openSettings(options);
    }
    
    /**
     * Close settings panel
     * @param {Object} [options={}] - Options
     * @returns {Promise<boolean>} Whether panel was closed
     */
    function closeSettings(options = {}) {
      return settingsManager.closeSettings(options);
    }
    
    /**
     * Check if settings panel is open
     * @returns {boolean} Whether panel is open
     */
    function isSettingsPanelOpen() {
      return settingsManager.isSettingsPanelOpen();
    }
    
    /**
     * Get a setting
     * @param {string} key - Setting key
     * @param {*} [defaultValue] - Default value
     * @returns {*} Setting value
     */
    function getSetting(key, defaultValue) {
      return settingsManager.getSetting(key, defaultValue);
    }
    
    // Initialize automatic storage
    StorageManager.initialize().catch(err => {
      console.warn('Storage system initialization failed:', err);
    });
    
    // Export both modern and legacy APIs
    return {
      // Modern API
      settingsManager,
      
      // Constants
      SETTINGS_SCHEMA,
      SETTINGS_CATEGORIES,
      SETTINGS_PRESETS,
      
      // Legacy functions
      initSettings,
      getSettings,
      saveSettings,
      openSettings,
      closeSettings,
      isSettingsPanelOpen,
      getSetting,
      
      // Utility classes
      SecurityManager,
      StorageManager,
      ToastManager,
      DOMUtils
    };
  })();
  
  // Make settingsManager globally available
  window.SettingsManager = SettingsSystem.settingsManager;
  
  // Initialize settings automatically when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    SettingsSystem.initSettings().catch(err => {
      console.error('Failed to auto-initialize settings:', err);
    });
  });
  
  // Default export for modern ES modules
  export default SettingsSystem.settingsManager;
  
  // Also export the full system for advanced usage
  export const SettingsUtils = SettingsSystem;