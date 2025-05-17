# ScrapyPilot

A desktop application for managing and controlling Scrapybara VM instances. Built with Electron and TypeScript. 

![Screen Shot 2025-05-16 at 10 13 39 PM](https://github.com/user-attachments/assets/54825720-fa0c-4e5a-9688-8867f8d59f11)

## Features

- **Manage Multiple VM Instances**  
  Create, control, and monitor multiple Scrapybara virtual machine instances seamlessly from the desktop app.

- **Interactive Console**  
  Send commands and interact directly with each VM in real-time through an intuitive console interface.

- **Modern & Responsive UI**  
  Clean, minimalistic, and responsive design for smooth and pleasant user experience.

## Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/scrapypilot.git
cd scrapypilot
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration:
Create a new file named `.env` in the root directory and add the following configuration:

```ini
# Scrapybara API Configuration
SCRAPYBARA_API_KEY=scrapybara_key
ANTHROPIC_API_KEY=anthropic_key # optional

# Application Settings
APP_ENV=development
DEBUG=false

# VM Instance Settings
MAX_VM_INSTANCES=5
```

Adjust these values according to your needs and Scrapybara account settings.

## Development

### Starting the Development Server

Run the development server with hot reload:
```bash
npm run dev
```

This will:
- Compile TypeScript in watch mode
- Start Electron with hot reload enabled
- Open DevTools automatically for debugging

### Building the Project

Compile TypeScript files:
```bash
npm run build
```

### Creating Production Builds

Package the application for distribution:
```bash
npm run package
```

This will create platform-specific installers in the `build` directory:
- Windows: NSIS installer (.exe)
- macOS: DMG installer (.dmg)
- Linux: AppImage (.AppImage)

## Project Structure

```
scrapypilot/
├── src/
│   ├── main/           # Main process code (Electron)
    |   ├── main.ts     # Electron Logic
│   ├── renderer/       # Renderer process code (UI)
│   │   ├── manager.ts     # Manager window logic
│   │   ├── manager.html   # Manager window UI
│   │   ├── vm-instance.ts # VM instance window logic
│   │   └── vm-instance.html # VM instance window UI
│   ├── api/           # API integration and services
│   ├── styles/         # CSS stylesheets
│   │   ├── main.css      # Global styles
│   │   └── manager.css   # Manager-specific styles
│   └── shared/         # Shared utilities and types
├── dist/              # Compiled JavaScript output
├── build/             # Production builds and installers
└── package.json       # Project configuration and scripts
```

## Scripts

- `npm run start`: Start the application in production mode
- `npm run dev`: Start in development mode with hot reload
- `npm run build`: Compile TypeScript files
- `npm run package`: Create production installers
- `npm run test`: Run Jest tests (to be implemented)
