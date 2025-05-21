# AgentPilot

A powerful Electron-based desktop app for orchestrating virtual machines running computer use agents, enabling real-time task dispatching, monitoring, and control. Built on top of Scrapybara VM infrastructure.

![image](https://github.com/user-attachments/assets/a9d0083d-36a7-4521-b404-7d28b241814f)

*UI: Manager Tab (Center), VM Instance Tabs (Left, Right).*

## Features

- **Orchestrate Multiple VM Instances**  
  Launch, manage, and monitor multiple virtual machines running computer use agents effortlessly, all from a single desktop interface. Built to scale with the Batch Execution Mode (more on that below).

- **Live Interactive Console**  
  Actively send new tasks, fine-tune behavior, or troubleshoot in real-time through a built-in terminal connected to each agent’s VM.

- **Real-Time Agent Overlay & Console History**  
  Visual overlay displays the agent's actions and live feedback as it navigates, paired with a scrollable console that logs the full interaction history for each session.

- **Sleek & Responsive UI**  
  Minimal, modern design focused on speed, usability, and clarity.

- **Flexible Model & Provider Support**  
  Choose from multiple AI computer use models across providers like OpenAI and Anthropic — switch easily depending on the task.

![2025-05-2019-52-19-ezgif com-video-to-gif-converter](https://github.com/user-attachments/assets/cbfe163c-8586-4ad8-a765-21d1a595eb0c)

*Spinning up 2 VMs using AgentPilot to conduct market analysis of 2 stocks in parallel, one agent researches NVDA, the other AMD.*

## Batch Execution

AgentPilot also supports **Batch Mode** – enabling you to spin up a fleet of browser instances — each assigned its own unique task — all with a single click.

### How It Works

You define a list of tasks — each with a name and a prompt — and AgentPilot automatically spins up a VM for each one, running a dedicated computer use agent of your choice, to execute the task.
```json
[
  {
    "name": "Explore Apple Products",
    "prompt": "Go to apple.com and browse the latest product releases and features for each product."
  }
  {
    "name": "Browse TechCrunch",
    "prompt": "Go to techcrunch.com and scroll through the latest articles on startups and technology. Open a few interesting stories and skim through them."
  },
  {
    "name": "Search Amazon for Mechanical Keyboards",
    "prompt": "Go to amazon.com and search for 'mechanical keyboards'. Scroll through the listings, open a product with RGB lighting, and scroll through images and reviews."
  },
  {
    "name": "Explore Airbnb Listings",
    "prompt": "Go to airbnb.com and scroll through the listings. Click on a few to view photos and details like pricing and amenities."
  },
  {
    "name": "Compare Laptops on Newegg",
    "prompt": "Go to newegg.com and search for 'laptops'. Scroll through the product list and open a few products to view details, reccommend a laptop."
  }
]
```

### In Action
![final-ezgif com-video-to-gif-converter (2)](https://github.com/user-attachments/assets/79944f4e-ad97-4a45-a32d-fd7bc34d7ac4)


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
APP_ENV=development # 'development' to output debug logs
```

The rest of configurations (api keys, max vm instances, etc...) are configured through the settings page of the application. These are cached and only stored locally through electron-store. 

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

## Scripts

- `npm run start`: Start the application in production mode
- `npm run dev`: Start in development mode with hot reload
- `npm run build`: Compile TypeScript files
- `npm run package`: Create production installers
- `npm run format`: Normalize code formatting
- `npm run test`: Run Jest tests (to be implemented)
