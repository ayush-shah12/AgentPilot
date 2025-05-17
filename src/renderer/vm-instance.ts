import { BrowserWindow, ipcRenderer } from 'electron';
import { ScrapyPilot } from '../api/scrapypilot';

interface ResourceStats {
  cpu: number;
  memory: number;
  networkIO: string;
}

class VMInstanceWindow {
  private vmId: string = '';
  private status: string = 'initializing';
  private startTime: Date | null = null;
  private uptimeInterval: NodeJS.Timeout | null = null;
  private elements: {
    vmId: HTMLElement;
    status: HTMLElement;
    uptime: HTMLElement;
    consoleOutput: HTMLElement;
    commandInput: HTMLInputElement;
    sendCommand: HTMLElement;
    cpuUsage: HTMLElement;
    memoryUsage: HTMLElement;
    networkIO: HTMLElement;
    openManager: HTMLElement;
    streamViewer: HTMLIFrameElement;
  };
  private pilot: ScrapyPilot | null = null;

  constructor() {
    this.elements = {
      vmId: document.getElementById('vm-id')!,
      status: document.getElementById('vm-status')!,
      uptime: document.getElementById('vm-uptime')!,
      consoleOutput: document.getElementById('console-output')!,
      commandInput: document.getElementById('command-input') as HTMLInputElement,
      sendCommand: document.getElementById('send-command')!,
      cpuUsage: document.getElementById('cpu-usage')!,
      memoryUsage: document.getElementById('memory-usage')!,
      networkIO: document.getElementById('network-io')!,
      openManager: document.getElementById('openManager')!,
      streamViewer: document.getElementById('stream-viewer') as HTMLIFrameElement,
    };

    this.initializeEventListeners();
  }

  private async initializeInstance() {
    try {
      console.log('Initializing instance...');
      this.pilot = new ScrapyPilot();
      const streamURL = await this.pilot.init();
      
      if (!streamURL) {
        throw new Error('Failed to get stream URL');
      }

      // log to console
      this.appendToConsole(`noVNC Viewer URL: ${streamURL}`, 'info');

      this.setupStreamViewer(streamURL);

      const scrapyPilotId = this.pilot.getInstanceId();
      
      ipcRenderer.send('scrapypilot-initialized', {
        vmId: this.vmId,
        instanceId: scrapyPilotId
      });

      this.updateStatus('running');
      this.startTime = new Date();
      this.startUptimeCounter();

    } catch (error) {
      console.error('Failed to initialize instance:', error);
      this.updateStatus('error');
      this.appendToConsole(`Error: ${error}`, 'error');
      throw error;
    }
  }

  private setupStreamViewer(streamURL: string) {
    try {
      
      this.elements.streamViewer.src = streamURL;
      
      this.elements.streamViewer.onload = () => {
        this.appendToConsole('noVNC viewer loaded successfully', 'info');
      };

      this.elements.streamViewer.onerror = (error) => {
        console.error('Stream viewer error:', error);
        this.appendToConsole('Failed to load noVNC viewer', 'error');
      };
    } catch (error) {
      console.error('Failed to setup stream viewer:', error);
      this.appendToConsole(`Failed to setup stream: ${error}`, 'error');
    }
  }

  private initializeEventListeners() {
    // event listeners
    ipcRenderer.on('vm-id', async (_, id: string) => {
      this.vmId = id;
      this.elements.vmId.textContent = id;
      
      try {
        await this.initializeInstance();
      } catch (error) {
        console.error('Failed to initialize instance:', error);
        this.updateStatus('error');
      }
    });

    ipcRenderer.on('vm-command-response', (_, response: any) => {
      this.handleCommandResponse(response);
    });

    ipcRenderer.on('resource-update', (_, stats: ResourceStats) => {
      this.updateResourceStats(stats);
    });

    this.elements.sendCommand.addEventListener('click', () => this.sendCommand());
    this.elements.commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendCommand();
      }
    });

    this.elements.openManager.addEventListener('click', () => {
      ipcRenderer.send('open-manager-window');
    });

    document.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action;
        if (action) {
          this.sendVMCommand(action);
        }
      });
    });

    const createInstanceButton = document.getElementById('create-instance-button');
    createInstanceButton?.addEventListener('click', () => this.initializeInstance());
  }

  private async sendCommand() {
    const command = this.elements.commandInput.value.trim();
    if (!command) return;

    // First append to console
    this.appendToConsole(`> ${command}`, 'command');

    try {
        // call act() on every command (this doesn't work currently, must be another method)
        if (this.pilot) {
            await this.pilot.act(command);
            this.appendToConsole('Command executed successfully', 'info');
        } else {
            throw new Error('ScrapyPilot instance not initialized');
        }
    } catch (error) {
        console.error('Failed to execute command:', error);
        this.appendToConsole(`Error executing command: ${error}`, 'error');
    }

    this.elements.commandInput.value = '';
  }

  private sendVMCommand(action: string) {
    ipcRenderer.send('vm-command', {
      vmId: this.vmId,
      command: action,
      data: {}
    });
  }

  private handleCommandResponse(response: any) {
    const { command, data, timestamp } = response;
    
    switch (command) {
      case 'execute':
        this.appendToConsole(data.output);
        break;
      case 'status':
        this.updateStatus(data.status);
        break;
      default:
        console.log('Unknown command response:', response);
    }
  }

  private updateStatus(newStatus: string) {
    this.status = newStatus;
    this.elements.status.textContent = newStatus;
    this.elements.status.className = `status-badge ${newStatus}`;

    
    if (newStatus === 'stopped' || newStatus === 'error') {
      if (this.uptimeInterval) {
        clearInterval(this.uptimeInterval);
        this.uptimeInterval = null;
      }
    } else if (newStatus === 'running' && !this.uptimeInterval) {
      this.startUptimeCounter();
    }
  }

  private updateResourceStats(stats: ResourceStats) {
    this.elements.cpuUsage.style.width = `${stats.cpu}%`;
    this.elements.cpuUsage.textContent = `${stats.cpu}%`;

    this.elements.memoryUsage.style.width = `${stats.memory}%`;
    this.elements.memoryUsage.textContent = `${stats.memory}%`;

    this.elements.networkIO.textContent = stats.networkIO;
  }

  private appendToConsole(message: string, type: 'command' | 'info' | 'error' = 'info') {
    const messageElement = document.createElement('div');
    messageElement.className = `console-message ${type}`;
    messageElement.textContent = message;
    this.elements.consoleOutput.appendChild(messageElement);
    
    // Auto-scroll to bottom
    this.elements.consoleOutput.scrollTop = this.elements.consoleOutput.scrollHeight;
  }

  private startUptimeCounter() {
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
    }

    this.uptimeInterval = setInterval(() => {
      this.updateUptime();
    }, 1000);
  }

  private updateUptime() {
    if (!this.startTime) return;

    const now = new Date();
    const diff = now.getTime() - this.startTime.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');

    this.elements.uptime.textContent = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  }

  async cleanup() {
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
      this.uptimeInterval = null;
    }

    if (this.pilot) {
      await this.pilot.cleanup();
      this.pilot = null;
      this.vmId = '';
      this.updateStatus('stopped');
    }
  }
}

new VMInstanceWindow();

// main function to create a new instance
async function createNewInstance() {
  try {
    const pilot = new ScrapyPilot();
    const streamURL = await pilot.init();
    
    if (!streamURL) {
      throw new Error('Failed to get stream URL');
    }

    const window = new BrowserWindow({
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    await window.loadURL(streamURL);

    window.on('closed', () => {
      pilot.cleanup();
    });

    return window;
  } catch (error) {
    console.error('Failed to create instance:', error);
    throw error;
  }
}

ipcRenderer.on('create-new-instance', async () => {
  await createNewInstance();
});

window.addEventListener('beforeunload', () => {
  const vmInstance = new VMInstanceWindow();
  vmInstance.cleanup();
}); 