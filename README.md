# AgentPilot

Electron app for orchestrating virtual machines running Computer Use Agents with real-time task dispatching, monitoring, and management. Powered through Scrapybara VM Instances.

![image](https://github.com/user-attachments/assets/01d61637-e56c-478e-ac3f-93e8cebc9801)

In the image above, I prompted two different instances to simultaneously complete 2 different tasks. One was summarize the stock market for the day, the other was summarizing a research topic!

## Features

- **Manage Multiple VM Instances**  
  Create, control, and monitor multiple virtual machine instances seamlessly from the desktop app.

- **Interactive Console**  
  Send commands and interact directly with each VM in real-time through an intuitive console interface.

- **Modern & Responsive UI**  
  Clean, minimalistic, and responsive design for smooth and pleasant user experience.

- **Multiple Providers & Models**  
  Choose from various models from providers such as OpenAI and Anthropic.

## Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/ayush-shah12/agentpilot.git
cd agentpilot
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
MAX_VM_INSTANCES=25
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
agentpilot/
├── src/
│   ├── main/
│   │   ├── main.ts
│   ├── renderer/
│   │   ├── manager.ts
│   │   ├── manager.html
│   │   ├── vm-instance.ts
│   │   └── vm-instance.html
│   ├── api/
│   │   ├── agentpilot.ts
│   ├── styles/
│   │   ├── main.css
│   │   ├── manager.css
│   │   └── vm-instance.css
│   └── shared/
├── dist/
├── build/
└── package.json
```

## Scripts

- `npm run start`: Start the application in production mode
- `npm run dev`: Start in development mode with hot reload
- `npm run build`: Compile TypeScript files
- `npm run package`: Create production installers
- `npm run test`: Run Jest tests (to be implemented)
