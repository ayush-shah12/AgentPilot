import { ipcRenderer } from 'electron';
import { ResourceStats, VMInfo } from '../shared/constants';
import { debug } from '../shared/utils';

/**
 * VMInstanceWindow class for the VM instance window
 */
class VMInstanceWindow {
  private vmId: string = '';
  private vmName: string = '';
  private status: string = 'initializing';
  private startTime: Date | null = null;
  private uptimeInterval: NodeJS.Timeout | null = null;
  private actInProgress: boolean = false;
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

  /**
   * Constructor for the VMInstanceWindow class
   */
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

  /**
   * Sets up the stream viewer
   * @param streamURL - The URL of the stream to display
   * this is the noVNC viewer
   */
  private setupStreamViewer(streamURL: string) {
    try {
      this.elements.streamViewer.src = streamURL;

      this.elements.streamViewer.onload = () => {
        debug.log('noVNC viewer loaded successfully');
      };

      this.elements.streamViewer.onerror = error => {
        debug.error('Stream viewer error:', error);
      };
    } catch (error) {
      debug.error('Failed to setup stream viewer:', error);
    }
  }

  /**
   * Initializes event listeners for the VM instance window
   */
  private initializeEventListeners() {
    ipcRenderer.on('render-vm-instance', (_, data: VMInfo) => {
      debug.log('Received render-vm-instance event:', data);

      // Set VM data
      this.vmId = data.id;
      this.vmName = data.name;
      this.elements.vmId.textContent = data.id;
      if (this.elements.vmName) {
        this.elements.vmName.textContent = data.name;
      }

      this.setupStreamViewer(data.streamURL || '');
      this.updateStatus(data.status);

      this.startTime = new Date();
      this.startUptimeCounter();

      // logging to this instance's console
      this.appendToConsole(`VM Instance "${data.name}" initialized`, 'system');
      // this.appendToConsole(`Stream URL: ${data.streamURL}`, 'system');
    });

    ipcRenderer.on('command-response', (_, response: any) => {
      if (response.success) {
        this.appendToConsole(response.result || 'Command executed successfully', 'system');
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

    ipcRenderer.on('step-update', (_, data: any) => {
      const { step } = data;

      if (step.text) {
        // check final step (no tool calls and not waiting for more steps)
        const isFinalStep =
          (!step.toolCalls || step.toolCalls.length === 0) && step.finishReason === 'stop';

        this.appendToConsole(`${step.text}`, isFinalStep ? 'agent-final' : 'agent');
      }
    });

    ipcRenderer.on('act-status-update', (_, data: any) => {
      this.updateActStatus(data.actInProgress);
    });

    ipcRenderer.on('act-error', (_, data: any) => {
      this.appendToConsole(`Error: ${data.error}`, 'error');
    });

    this.elements.sendCommand.addEventListener('click', () => this.sendCommand());
    this.elements.commandInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.sendCommand();
      }
    });

    this.elements.openManager.addEventListener('click', () => {
      ipcRenderer.send('open-manager-window');
    });

    document.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', e => {
        const action = (e.target as HTMLElement).dataset.action;
        if (action) {
          this.sendVMCommand(action);
        }
      });
    });
  }

  /**
   * Updates the act in progress status and UI
   * @param inProgress - Whether an act is in progress
   */
  private updateActStatus(inProgress: boolean) {
    this.actInProgress = inProgress;

    if (inProgress) {
      this.elements.sendCommand.setAttribute('disabled', 'disabled');
      this.elements.sendCommand.classList.add('disabled');
      this.elements.commandInput.setAttribute('disabled', 'disabled');
      this.appendToConsole('Command processing in progress, please wait...', 'system');
    } else {
      this.elements.sendCommand.removeAttribute('disabled');
      this.elements.sendCommand.classList.remove('disabled');
      this.elements.commandInput.removeAttribute('disabled');
      this.appendToConsole('Ready for next command', 'system');
    }
  }

  /**
   * Sends a command to the VM instance
   */
  private sendCommand() {
    if (this.actInProgress) {
      this.appendToConsole(
        'Cannot send command: Another command is already being processed',
        'error'
      );
      return;
    }

    const command = this.elements.commandInput.value.trim();
    if (!command) return;

    this.appendToConsole(`${command}`, 'command');

    ipcRenderer.send('vm-command', {
      vmId: this.vmId,
      command: 'act',
      data: { command },
    });

    this.elements.commandInput.value = '';
  }

  /**
   * Sends a command to the VM instance
   * @param action - The action to send
   */
  private sendVMCommand(action: string) {
    ipcRenderer.send('vm-command', {
      vmId: this.vmId,
      command: action,
      data: {},
    });
  }

  /**
   * Updates the status of the VM instance
   * @param newStatus - The new status of the VM instance
   */
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

  /**
   * Updates the resource stats of the VM instance
   * @param stats - The resource stats of the VM instance
   */
  private updateResourceStats(stats: ResourceStats) {
    this.elements.cpuUsage.style.width = `${stats.cpu}%`;
    this.elements.cpuUsage.textContent = `${stats.cpu}%`;

    this.elements.memoryUsage.style.width = `${stats.memory}%`;
    this.elements.memoryUsage.textContent = `${stats.memory}%`;

    this.elements.networkIO.textContent = stats.networkIO;
  }

  /**
   * Appends a message to the console
   * @param message - The message to append
   * @param type - The type of message
   */
  private appendToConsole(
    message: string,
    type: 'command' | 'system' | 'agent' | 'agent-final' | 'error'
  ) {
    const messageElement = document.createElement('div');
    messageElement.className = `console-message ${type}`;

    // Add icons or prefixes to each line based on type
    let prefix = '';
    switch (type) {
      case 'system':
        prefix = '[SYSTEM] 🖥️ ';
        break;
      case 'command':
        prefix = '[USER] > ';
        break;
      case 'agent':
        prefix = '[AGENT] 🤖 ';
        break;
      case 'agent-final':
        prefix = '[AGENT ANSWER] ✅ ';
        break;
      case 'error':
        prefix = '[ERROR] ❌ ';
        break;
    }

    messageElement.textContent = prefix + message;
    this.elements.consoleOutput.appendChild(messageElement);
    this.elements.consoleOutput.scrollTop = this.elements.consoleOutput.scrollHeight;
  }

  /**
   * Starts the uptime counter
   */
  private startUptimeCounter() {
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
    }

    this.uptimeInterval = setInterval(() => {
      this.updateUptime();
    }, 1000);
  }

  /**
   * Updates the uptime
   */
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
