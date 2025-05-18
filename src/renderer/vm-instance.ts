import { ipcRenderer } from 'electron';
import { ResourceStats } from '../shared/constants';

interface VMData {
  id: string;
  name: string;
  streamURL: string;
  status: 'initializing' | 'running' | 'error' | 'stopped';
}

class VMInstanceWindow {
  private vmId: string = '';
  private vmName: string = '';
  private status: string = 'initializing';
  private startTime: Date | null = null;
  private uptimeInterval: NodeJS.Timeout | null = null;
  private elements: {
    vmId: HTMLElement;
    vmName: HTMLElement;
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

  constructor() {
    this.elements = {
      vmId: document.getElementById('vm-id')!,
      vmName: document.getElementById('vm-name') || document.createElement('span'),
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
    ipcRenderer.on('render-vm-instance', (_, data: VMData) => {
      console.log('Received render-vm-instance event:', data);
      
      // Set VM data
      this.vmId = data.id;
      this.vmName = data.name;
      this.elements.vmId.textContent = data.id;
      if (this.elements.vmName) {
        this.elements.vmName.textContent = data.name;
      }
      
      this.setupStreamViewer(data.streamURL);
      this.updateStatus(data.status);
      
      this.startTime = new Date();
      this.startUptimeCounter();
      
      this.appendToConsole(`VM Instance "${data.name}" initialized`, 'info');
      this.appendToConsole(`Stream URL: ${data.streamURL}`, 'info');
    });

    ipcRenderer.on('command-response', (_, response: any) => {
      if (response.success) {
        this.appendToConsole(response.result || 'Command executed successfully');
      } else {
        this.appendToConsole(`Error: ${response.error}`, 'error');
      }
    });

    ipcRenderer.on('resource-update', (_, stats: ResourceStats) => {
      this.updateResourceStats(stats);
    });
    
    ipcRenderer.on('status-update', (_, status: string) => {
      this.updateStatus(status);
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
  }

  private sendCommand() {
    const command = this.elements.commandInput.value.trim();
    if (!command) return;

    this.appendToConsole(`> ${command}`, 'command');

    ipcRenderer.send('vm-command', {
      vmId: this.vmId,
      command: 'act',
      data: { command }
    });

    this.elements.commandInput.value = '';
  }

  private sendVMCommand(action: string) {
    ipcRenderer.send('vm-command', {
      vmId: this.vmId,
      command: action,
      data: {}
    });
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
}

new VMInstanceWindow();