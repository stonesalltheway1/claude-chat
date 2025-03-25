# Claude Chat

![Claude Chat Logo](assets/img/logo.svg)

A sophisticated, production-ready chat interface for interacting with Anthropic's Claude AI models. This application features a modern, accessible UI with advanced capabilities including thinking mode, streaming responses, virtual DOM rendering, and offline support.

## 🌟 Features

- **Enhanced Claude Integration**: Direct connection to Claude 3.7 and other Anthropic models
- **Thinking Mode**: See Claude's reasoning process for complex questions
- **Streaming Responses**: Real-time message generation for a natural conversation flow
- **Advanced UI Rendering**: Virtual DOM-like approach for performance with large conversations
- **Full Markdown & Code Support**: Syntax highlighting for over 20 programming languages
- **Accessibility-First Design**: WCAG AA compliant with keyboard navigation and screen reader support
- **Progressive Web App**: Installable with offline capabilities
- **Theme Support**: Dynamic light/dark mode with system preference detection
- **File Handling**: Upload, analyze and discuss files with Claude
- **Responsive Design**: Perfect experience on any device size

## 🏗️ Architecture

Claude Chat is built with vanilla JavaScript focusing on performance, maintainability, and progressive enhancement:

- **Modular Architecture**: IIFE pattern with clean separation of concerns
- **Event-Based Communication**: Custom event system for loose coupling between components
- **Virtual Rendering**: Efficient DOM updates with element recycling for large conversations
- **Service Worker**: Advanced caching strategies for assets and API responses
- **State Management**: Reactive state handling for UI updates

## 🚀 Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Anthropic API key ([Get one here](https://www.anthropic.com/))

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/stonesalltheway1/claude-chat.git
   cd claude-chat
   Serve locally using your preferred method:

Using npm:

bash
npm install -g http-server
http-server -p 3000
Or using Python:

bash
# Python 3
python -m http.server 3000
Open http://localhost:3000 in your browser

Configuration
Add your API key in the Settings panel or directly in the console:

JavaScript
window.localStorage.setItem('claude_api_key', 'your-api-key-here');
💻 Usage
Enter your API key in the Settings panel (gear icon)
Start a new chat with the "New Chat" button
Enable or disable Thinking Mode based on your needs
Type your message and press Enter or click the send button
View Claude's response with full markdown and code formatting
Upload files using the paperclip icon for Claude to analyze
📱 PWA Installation
Claude Chat can be installed as a Progressive Web App:

Visit the application in Chrome, Edge, or other compatible browser
Look for the install icon in the address bar or click the "Install" button in the app
Confirm installation
The app will now appear in your applications list and can work offline
🧩 Project Structure
Code
claude-chat/
├── assets/
│   ├── css/         # Stylesheets
│   ├── img/         # Images and icons
│   └── js/          # JavaScript modules
│       ├── api.js   # API communication layer
│       ├── app.js   # Core application logic
│       ├── ui.js    # UI rendering and management
│       ├── utils.js # Utility functions
│       ├── theme.js # Theme management
│       └── settings.js # Settings management
├── index.html       # Main HTML structure
├── manifest.json    # PWA manifest
└── service-worker.js # Service worker for offline capability
🔧 Browser Compatibility
Chrome/Edge (latest 2 versions)
Firefox (latest 2 versions)
Safari (latest 2 versions)
iOS Safari (latest 2 versions)
Android Chrome (latest 2 versions)
📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgements
Anthropic for the Claude AI model
Marked for Markdown parsing
highlight.js for code syntax highlighting
Workbox for service worker utilities


This README provides a comprehensive overview of the Claude Chat application, highlighting its features, architecture, and setup instructions. It's designed to be informative, visually appealing, and to showcase the sophisticated nature of the application.