import { ipcRenderer } from 'electron';

// Simple type for UI representation only
interface VMDisplay {
  id: string;
  name: string;
  status: 'initializing' | 'running' | 'error' | 'stopped';
}

class ManagerWindow {
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
    
    // Request initial VM list from main process
    ipcRenderer.send('get-vm-instances');
  }

  private initializeEventListeners() {
    console.log('Initializing event listeners...');
    
    // Create button - just sends request to main
    this.elements.createButton.addEventListener('click', () => {
      console.log('Create button clicked!');
      const vmName = this.elements.vmNameInput.value.trim();
      if (!vmName) {
        this.showError('Please enter a VM name');
        return;
      }
      
      // Send request to main to create VM
      ipcRenderer.send('request-create-vm', { name: vmName });
      
      // Clear input
      this.elements.vmNameInput.value = '';
    });
    
    // Listen for VM list updates from main
    ipcRenderer.on('vm-list-update', (_, vmList: VMDisplay[]) => {
      this.renderVMList(vmList);
    });
    
    // Listen for instance count updates
    ipcRenderer.on('update-instance-count', (_, count: number) => {
      console.log('Received instance count update:', count);
      this.updateInstanceCount(count);
    });

    // Listen for individual VM updates
    ipcRenderer.on('vm-status-update', (_, data: { vmId: string; status: string }) => {
      console.log('Received VM status update:', data);
      this.updateVMStatus(data.vmId, data.status);
    });
  }

  private renderVMList(vmList: VMDisplay[]) {
    // Clear current list
    this.elements.vmList.innerHTML = '';
    
    // Add each VM to the list
    vmList.forEach(vm => {
      this.addVMToList(vm);
    });
  }

  private addVMToList(vm: VMDisplay) {
    console.log('Adding VM to list:', vm.name);
    const vmElement = document.createElement('div');
    vmElement.className = 'vm-instance';
    vmElement.id = `vm-${vm.id}`;
    vmElement.innerHTML = `
      <div class="vm-info">
        <h3>${vm.name}</h3>
        <span class="vm-status ${vm.status}">${vm.status}</span>
      </div>
      <div class="vm-controls">
        <button class="btn btn-secondary vm-action" data-action="pause" data-vm-id="${vm.id}">Pause</button>
        <button class="btn btn-secondary vm-action" data-action="resume" data-vm-id="${vm.id}">Resume</button>
        <button class="btn btn-secondary vm-action" data-action="stop" data-vm-id="${vm.id}">Stop</button>
      </div>
    `;

    // Add event listeners to buttons
    const actionButtons = vmElement.querySelectorAll('.vm-action');
    actionButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action;
        const vmId = target.dataset.vmId;
        
        if (action && vmId) {
          // Send command to main process
          ipcRenderer.send('vm-action', { 
            vmId: vmId, 
            action: action,
            data: null
          });
        }
      });
    });

    this.elements.vmList.appendChild(vmElement);
  }

  private updateVMStatus(vmId: string, status: string) {
    const statusElement = document.querySelector(`#vm-${vmId} .vm-status`);
    if (statusElement) {
      statusElement.className = `vm-status ${status}`;
      statusElement.textContent = status;
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