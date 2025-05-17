import { ipcRenderer } from 'electron';

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
  };

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
      openManager: document.getElementById('openManager')!
    };

    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    // event listeners
    ipcRenderer.on('vm-id', (_, id: string) => {
      this.vmId = id;
      this.elements.vmId.textContent = id;
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
  }


  private sendCommand() {
    const command = this.elements.commandInput.value.trim();
    if (!command) return;

    this.appendToConsole(`> ${command}`, 'command');
    ipcRenderer.send('vm-command', {
      vmId: this.vmId,
      command: 'execute',
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

  private updateStatus(status: string) {
    this.status = status;
    this.elements.status.textContent = status;
    this.elements.status.className = `status-badge ${status}`;
  }

  private updateResourceStats(stats: ResourceStats) {
    this.elements.cpuUsage.style.width = `${stats.cpu}%`;
    this.elements.cpuUsage.textContent = `${stats.cpu}%`;

    this.elements.memoryUsage.style.width = `${stats.memory}%`;
    this.elements.memoryUsage.textContent = `${stats.memory}%`;

    this.elements.networkIO.textContent = stats.networkIO;
  }

  private appendToConsole(message: string, type: 'command' | 'output' = 'output') {
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = message;
    this.elements.consoleOutput.appendChild(line);
    this.elements.consoleOutput.scrollTop = this.elements.consoleOutput.scrollHeight;
  }
}

// Initialize the VM instance window
new VMInstanceWindow(); 