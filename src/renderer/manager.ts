import { ipcRenderer } from 'electron';
import { v4 as uuidv4 } from 'uuid';

// id should correspond to the vm id in the scrapybara api ideally
interface VMInstance {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  createdAt: Date;
}

// manager window class, this is the main window that manages the vm instances
class ManagerWindow {
  private vmInstances: Map<string, VMInstance> = new Map();
  private elements: {
    vmList: HTMLElement;
    createButton: HTMLElement;
    vmNameInput: HTMLInputElement;
    instanceCount: HTMLElement;
    connectionStatus: HTMLElement;
    apiVersion: HTMLElement;
  };

  constructor() {
    console.log('ManagerWindow initializing...');
    this.elements = {
      vmList: document.getElementById('vm-list')!,
      createButton: document.getElementById('create-vm')!,
      vmNameInput: document.getElementById('vm-name') as HTMLInputElement,
      instanceCount: document.getElementById('instance-count')!,
      connectionStatus: document.getElementById('connection-status')!,
      apiVersion: document.getElementById('api-version')!
    };

    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    console.log('Initializing event listeners...');
    this.elements.createButton.addEventListener('click', () => {
      console.log('Create button clicked!');
      this.createVMInstance();
    });
    
    ipcRenderer.on('update-instance-count', (_, count: number) => {
      console.log('Received instance count update:', count);
      this.updateInstanceCount(count);
    });

    ipcRenderer.on('vm-status-update', (_, data: { vmId: string; status: string }) => {
      console.log('Received VM status update:', data);
      this.updateVMStatus(data.vmId, data.status as VMInstance['status']);
    });
  }

  private createVMInstance() {
    console.log('Creating VM instance...');
    const vmName = this.elements.vmNameInput.value.trim();
    if (!vmName) {
      this.showError('Please enter a VM name');
      return;
    }

    // temporarily using random uuids
    const vmId = uuidv4();
    console.log('Generated VM ID:', vmId);
    
    const vmInstance: VMInstance = {
      id: vmId,
      name: vmName,
      status: 'running',
      createdAt: new Date()
    };

    this.vmInstances.set(vmId, vmInstance);
    this.addVMToList(vmInstance);
    console.log('Sending create-vm-instance event to main process with ID:', vmId);
    ipcRenderer.send('create-vm-instance', vmId);
    
    // Clear input
    this.elements.vmNameInput.value = '';
  }

  // TODO: add a better way to displayu instances more deterministically
  private addVMToList(vm: VMInstance) {
    const vmElement = document.createElement('div');
    vmElement.className = 'vm-instance';
    vmElement.id = `vm-${vm.id}`;
    vmElement.innerHTML = `
      <div class="vm-info">
        <h3>${vm.name}</h3>
        <span class="vm-status ${vm.status}">${vm.status}</span>
      </div>
      <div class="vm-controls">
        <button class="btn btn-secondary vm-action" data-action="start">Start</button>
        <button class="btn btn-secondary vm-action" data-action="stop">Stop</button>
        <button class="btn btn-danger vm-action" data-action="delete">Delete</button>
      </div>
    `;

    // not working
    const controls = vmElement.querySelectorAll('.vm-action');
    controls.forEach(control => {
      control.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action;
        if (action) {
          this.handleVMAction(vm.id, action);
        }
      });
    });

    this.elements.vmList.appendChild(vmElement);
  }

  private handleVMAction(vmId: string, action: string) {
    ipcRenderer.send('vm-command', {
      vmId,
      command: action,
      data: {}
    });
  }

  private updateVMStatus(vmId: string, status: VMInstance['status']) {
    const vmInstance = this.vmInstances.get(vmId);
    if (vmInstance) {
      vmInstance.status = status;
      const statusElement = document.querySelector(`#vm-${vmId} .vm-status`);
      if (statusElement) {
        statusElement.className = `vm-status ${status}`;
        statusElement.textContent = status;
      }
    }
  }

  private updateInstanceCount(count: number) {
    this.elements.instanceCount.textContent = `VM Instances: ${count}`;
  }

  private showError(message: string) {
    alert(message);
  }
}

console.log('Starting ManagerWindow initialization...');
new ManagerWindow(); 