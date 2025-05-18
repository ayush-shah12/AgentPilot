import { ipcRenderer } from 'electron';
import { VMInfo } from '../shared/constants';

/**
 * ManagerWindow class for the manager window
 */
class ManagerWindow {
  private elements: {
    vmList: HTMLElement;
    createButton: HTMLElement;
    vmNameInput: HTMLInputElement;
    instanceCount: HTMLElement;
    connectionStatus: HTMLElement;
    apiVersion: HTMLElement;
  };

  /**
   * Constructor for the ManagerWindow class
   */
  constructor() {
    console.log('ManagerWindow initializing...');
    this.elements = {
      vmList: document.getElementById('vm-list')!,
      createButton: document.getElementById('create-vm')!,
      vmNameInput: document.getElementById('vm-name') as HTMLInputElement,
      instanceCount: document.getElementById('instance-count')!,
      connectionStatus: document.getElementById('connection-status')!,
      apiVersion: document.getElementById('api-version')!,
    };

    this.initializeEventListeners();

    // Request initial VM list from main process
    ipcRenderer.send('get-vm-instances');
  }

  /**
   * Initializes event listeners for the manager window
   */
  private initializeEventListeners() {
    console.log('Initializing event listeners...');

    this.elements.createButton.addEventListener('click', () => {
      console.log('Create button clicked!');
      const vmName = this.elements.vmNameInput.value.trim();
      if (!vmName) {
        this.showError('Please enter a VM name');
        return;
      }

      // send to main process
      ipcRenderer.send('request-create-vm', { name: vmName });

      this.elements.vmNameInput.value = '';
    });

    // event listener for vm list update (creation, deletion, etc)
    ipcRenderer.on('vm-list-update', (_, vmList: VMInfo[]) => {
      this.renderVMList(vmList);
    });

    // event listener for instance count update
    ipcRenderer.on('update-instance-count', (_, count: number) => {
      console.log('Received instance count update:', count);
      this.updateInstanceCount(count);
    });

    // event listener for vm status update
    ipcRenderer.on('vm-status-update', (_, data: { vmId: string; status: string }) => {
      console.log('Received VM status update:', data);
      this.updateVMStatus(data.vmId, data.status);
    });
  }

  /**
   * Renders the VM list
   * @param vmList - The list of VMs to render
   */
  private renderVMList(vmList: VMInfo[]) {
    this.elements.vmList.innerHTML = '';

    vmList.forEach(vm => {
      this.addVMToList(vm);
    });
  }

  /**
   * Adds a VM to the list
   * @param vm - The VM to add
   */
  private addVMToList(vm: VMInfo) {
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
      button.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action;
        const vmId = target.dataset.vmId;

        if (action && vmId) {
          ipcRenderer.send('vm-action', {
            vmId: vmId,
            action: action,
            data: null, // null for these buttons
          });
        }
      });
    });

    this.elements.vmList.appendChild(vmElement);
  }

  /**
   * Updates the status of a VM
   * @param vmId - The ID of the VM to update
   * @param status - The new status of the VM
   */
  private updateVMStatus(vmId: string, status: string) {
    const statusElement = document.querySelector(`#vm-${vmId} .vm-status`);
    if (statusElement) {
      statusElement.className = `vm-status ${status}`;
      statusElement.textContent = status;
    }
  }

  /**
   * Updates the instance count
   * @param count - The new instance count
   */
  private updateInstanceCount(count: number) {
    this.elements.instanceCount.textContent = `VM Instances: ${count}`;
  }

  /**
   * Shows an error message
   * @param message - The message to show
   */
  private showError(message: string) {
    alert(message);
  }
}

console.log('Starting ManagerWindow initialization...');
new ManagerWindow();
