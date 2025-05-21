import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { app, BrowserWindow, ipcMain } from 'electron';

import { AgentPilot } from '../api/agentpilot';

import Store from 'electron-store';
import { VMInfo } from '../shared/constants';
import { debug, isDev } from '../shared/utils';

// Initialize settings store
const settingsStore = new Store({
  name: 'settings',
  defaults: {
    scrapybaraKey: '',
    anthropicKey: '',
    openaiKey: '',
    maxVmInstances: 25,
  },
});

interface VMWindow {
  /**
   * The Electron window instance
   */
  window: BrowserWindow;

  /**
   * Internal ID for identification
   */
  internal_id: string;

  /**
   * AgentPilot instance ID
   */
  instance_id: string | null;

  /**
   * AgentPilot instance
   */
  pilot: AgentPilot;

  /**
   * VM information used for display and communication
   */
  info: VMInfo;
}

/**
 * Main application class for AgentPilot Application
 */
class AgentPilotApp {
  private managerWindow: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;

  private vmWindows: VMWindow[] = [];

  constructor() {
    this.initializeApp();
  }

  /*
   * Initializes the application by creating the manager window,
   * setting up event listeners, and establishing IPC handlers
   */
  private initializeApp() {
    require('@electron/remote/main').initialize();

    app.on('ready', () => {
      this.createManagerWindow();

      // check if in dev mode and watch for changes in the dist and src folders
      if (isDev) {
        const watchPaths = [
          path.join(__dirname, '..', '..', 'dist'),
          path.join(__dirname, '..', '..', 'src'),
        ];

        debug.log('Watching for changes in:', watchPaths);

        watchPaths.forEach(watchPath => {
          if (fs.existsSync(watchPath)) {
            fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
              if (filename) {
                debug.log(`File changed: ${filename}`);
                if (this.managerWindow && !this.managerWindow.isDestroyed()) {
                  debug.log('Reloading manager window...');
                  this.managerWindow.reload();
                }
                this.vmWindows.forEach(vm => {
                  if (!vm.window.isDestroyed()) {
                    debug.log(`Reloading VM window: ${vm.internal_id}`);
                    vm.window.reload();
                  }
                });
              }
            });
          }
        });
      }
    });

    // all windows closed case
    app.on('window-all-closed', () => {
      debug.log('All windows closed, quitting application...');
      app.quit();
    });

    // ensure all windows are closed before quitting
    app.on('before-quit', () => {
      debug.log('Application is quitting...');
      // Close all VM windows
      this.vmWindows.forEach(vm => {
        if (!vm.window.isDestroyed()) {
          vm.window.destroy();
        }
      });

      // clear tray
      this.vmWindows = [];
      if (this.managerWindow && !this.managerWindow.isDestroyed()) {
        this.managerWindow.destroy();
      }
    });

    this.setupIpcHandlers();
  }

  /*
   * Creates and configures the main manager window
   * Shows existing window if already created
   */
  private createManagerWindow() {
    debug.log('Creating manager window...');
    if (this.managerWindow) {
      debug.log('Manager window exists, showing it...');
      this.managerWindow.show();
      return;
    }

    this.managerWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false, // required?
        defaultEncoding: 'utf8',
        webSecurity: false, // temp
        spellcheck: false,
      },
      autoHideMenuBar: true,
      icon: path.join(__dirname, '..', '..', 'src', 'renderer', 'assets', 'icon.png'),
    });

    const htmlPath = path.join(__dirname, '..', '..', 'src', 'renderer', 'manager.html');
    debug.log('Loading manager HTML from:', htmlPath);
    this.managerWindow.loadFile(htmlPath);

    require('@electron/remote/main').enable(this.managerWindow.webContents);

    if (isDev) {
      this.managerWindow.webContents.openDevTools();
    }

    this.managerWindow.on('close', () => {
      debug.log('Manager window closing...');
      app.quit();
    });

    // debugging shit
    this.managerWindow.webContents.on('did-finish-load', () => {
      debug.log('Manager window loaded successfully');
    });

    this.managerWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      debug.error('Manager window failed to load:', errorCode, errorDescription);
    });
  }

  /*
   * Creates and configures the settings window
   * Shows existing window if already created
   */
  private createSettingsWindow() {
    debug.log('Creating settings window...');
    if (this.settingsWindow) {
      debug.log('Settings window exists, showing it...');
      this.settingsWindow.show();
      return;
    }

    this.settingsWindow = new BrowserWindow({
      width: 600,
      height: 500,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        defaultEncoding: 'utf8',
        webSecurity: false,
        spellcheck: false,
      },
      frame: false,
      autoHideMenuBar: true,
      icon: path.join(__dirname, '..', '..', 'src', 'renderer', 'assets', 'icon.png'),
    });

    const htmlPath = path.join(__dirname, '..', '..', 'src', 'renderer', 'settings.html');
    debug.log('Loading settings HTML from:', htmlPath);
    this.settingsWindow.loadFile(htmlPath);

    require('@electron/remote/main').enable(this.settingsWindow.webContents);

    if (isDev) {
      this.settingsWindow.webContents.openDevTools();
    }

    this.settingsWindow.on('close', () => {
      debug.log('Settings window closing...');
      this.settingsWindow = null;
    });
  }

  /*
   * Creates a new VM instance with the specified name
   * Initializes AgentPilot, opens window, and establishes communication
   */
  private async createVMInstance(name: string, modelConfig?: any, initialPrompt?: string) {
    try {
      debug.log('Creating VM instance with name:', name);
      debug.log('Using model configuration:', modelConfig);
      if (initialPrompt) {
        debug.log('Initial prompt:', initialPrompt);
      }

      const settings = settingsStore.store;
      if (!settings.scrapybaraKey) {
        this.sendToManager('error', 'Scrapybara API key is required. Please set it in Settings.');
        return;
      }

      // Check if we've reached the max VM instances limit
      const maxInstances = settings.maxVmInstances || 25;
      if (this.vmWindows.length >= maxInstances) {
        this.sendToManager('error', `Cannot create more VM instances. Maximum limit of ${maxInstances} reached.`);
        return;
      }

    
      // demo purposes
      // const layouts = [
      //   // Top row
      //   { x: 0,     y: 0, width: 640, height: 540 },    // [1]
      //   { x: 640,   y: 0, width: 640, height: 540 },    // [2]
      //   { x: 1280,  y: 0, width: 640, height: 540 },    // [3]
      
      //   // Bottom row
      //   { x: 0,     y: 540, width: 960, height: 540 },  // [4]
      //   { x: 960,   y: 540, width: 960, height: 540 },  // [5]
      // ];
      

      const vmWindow = new BrowserWindow({
        // ...layouts[this.vmWindows.length],  // demo purposes
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
        autoHideMenuBar: true,
        title: name
      });

      const htmlPath = path.join(__dirname, '..', '..', 'src', 'renderer', 'vm-instance.html');
      debug.log('Loading VM instance HTML from:', htmlPath);
      vmWindow.loadFile(htmlPath);

      require('@electron/remote/main').enable(vmWindow.webContents);

      const pilot = new AgentPilot(modelConfig, {
        scrapybaraKey: settings.scrapybaraKey,
        anthropicKey: settings.anthropicKey,
        openaiKey: settings.openaiKey,
      });

      // Set up the onStep callback to relay step information to the VM UI
      pilot.setOnStep(step => {
        if (vmWindow && !vmWindow.isDestroyed()) {
          this.sendToVM(vmId, 'step-update', {
            step: step,
            actInProgress: true,
          });
        }
      });

      const vmId = uuidv4();

      const vmInstance: VMWindow = {
        window: vmWindow,
        internal_id: vmId,
        instance_id: pilot.getInstanceId() || null,
        pilot: pilot,
        info: {
          id: vmId,
          name: name,
          status: 'running',
          createdAt: new Date(),
        },
      };

      this.vmWindows.push(vmInstance);


      const streamURL = await pilot.init();

      if (!streamURL) {
        throw new Error('Failed to get stream URL');
      }

      // update the instance count and vm list
      this.updateInstanceCount();
      this.updateVMList();

      // send the instance to the vm instance window for rendering
      if (vmWindow && !vmWindow.isDestroyed()) {
        const vmData = {
          id: vmId,
          name: name,
          streamURL: streamURL,
          status: 'running',
        };
        this.sendToVM(vmId, 'render-vm-instance', vmData);

        if (initialPrompt) {
          // Send command to VM
          pilot.act(initialPrompt);

          // Also log to console
          this.sendToVM(vmId, 'command-response', {
            success: true,
            result: `Executing initial prompt: ${initialPrompt}`,
          });
        }
      }

      // handle the closing of the vm instance window
      vmWindow.on('closed', () => {
        debug.log('VM instance closed:', vmId);
        const index = this.vmWindows.findIndex(vm => vm.internal_id === vmId);
        this.vmWindows[index].pilot.cleanup();
        if (index !== -1) {
          this.vmWindows.splice(index, 1);
          this.updateInstanceCount();
          this.updateVMList();

          if (this.vmWindows.length === 0 && this.managerWindow) {
            this.managerWindow.show();
          }
        }
      });
    } catch (error) {
      debug.error('Error creating VM instance:', error);
    }
  }

  /*
   * Updates the instance count in the manager window
   */
  private updateInstanceCount() {
    if (this.managerWindow && !this.managerWindow.isDestroyed()) {
      this.managerWindow.webContents.send('update-instance-count', this.vmWindows.length);
    }
  }

  /*
   * Updates the status of a specific VM instance
   */
  private updateInstanceStatus(vmId: string, status: 'running' | 'paused' | 'stopped' | 'error') {
    const vmWindow = this.vmWindows.find(vm => vm.internal_id === vmId);
    if (vmWindow) {
      vmWindow.info.status = status;
      this.updateVMList();
    }
  }

  /*
   * Establishes all IPC communication channels between
   * main process and renderer processes
   */
  private async setupIpcHandlers() {
    debug.log('Setting up IPC handlers...');

    // create a new VM instance
    ipcMain.on('request-create-vm', (_, data) => {
      const vmName = typeof data === 'object' && data.name ? data.name : String(data);
      const modelConfig = typeof data === 'object' && data.modelConfig ? data.modelConfig : undefined;
      const initialPrompt = typeof data === 'object' && data.initialPrompt ? data.initialPrompt : undefined;
      this.createVMInstance(vmName, modelConfig, initialPrompt);
    });

    // open the manager window (from a VM instance window)
    ipcMain.on('open-manager-window', () => {
      debug.log('Received open-manager-window event');
      if (!this.managerWindow) {
        this.createManagerWindow();
      } else {
        this.managerWindow.show();
      }
    });

    // open settings window
    ipcMain.on('open-settings-window', () => {
      debug.log('Received open-settings-window event');
      this.createSettingsWindow();
    });

    // handle vm commands (stop, pause, resume, prompt)
    ipcMain.on('vm-command', async (_, { vmId, command, data }) => {
      debug.log('Received vm-command:', { vmId, command, data });
      const vmWindow = this.vmWindows.find(vm => vm.internal_id === vmId);
      if (!vmWindow) {
        debug.error('VM window not found');
        return;
      }
      if (vmWindow) {
        switch (command) {
          case 'act':
            debug.log('Sending command to VM:', data);
            try {
              this.sendToVM(vmId, 'act-status-update', { actInProgress: true });

              await vmWindow.pilot.act(data.command);

              this.sendToVM(vmId, 'act-status-update', { actInProgress: false });
            } catch (error) {
              debug.error('Error sending command to VM:', error);
              this.sendToVM(vmId, 'act-error', { error: error });
              this.sendToVM(vmId, 'act-status-update', { actInProgress: false });
            }
            break;
          case 'pause':
            await vmWindow.pilot.pause();
            this.updateInstanceStatus(vmId, 'paused');
            break;
          case 'resume':
            await vmWindow.pilot.resume();
            this.updateInstanceStatus(vmId, 'running');
            break;
          case 'stop': // stop is equivalent to deleting the VM instance
            await vmWindow.window.destroy();
            this.updateInstanceStatus(vmId, 'stopped');
            break;
        }
      }
    });

    // Get settings
    ipcMain.handle('get-settings', () => {
      return settingsStore.store;
    });

    // Save settings
    ipcMain.handle('save-settings', (_, settings) => {
      settingsStore.store = settings;
      return true;
    });

    // Clear settings
    ipcMain.handle('clear-settings', () => {
      debug.log('Clearing settings...');
      settingsStore.clear();
      return true;
    });
  }

  /**
   * Send message to manager window
   */
  private sendToManager(channel: string, data: any) {
    if (this.managerWindow && !this.managerWindow.isDestroyed()) {
      debug.log(`Sending to manager (${channel}):`, data);
      this.managerWindow.webContents.send(channel, data);
    }
  }

  /**
   * Send message to a specific VM instance
   */
  private sendToVM(vmId: string, channel: string, data: any) {
    const vmInstance = this.vmWindows.find(vm => vm.internal_id === vmId);
    if (vmInstance && !vmInstance.window.isDestroyed()) {
      debug.log(`Sending to VM ${vmId} (${channel}):`, data);
      vmInstance.window.webContents.send(channel, data);
    }
  }

  /**
   * Send message to all VM instances
   */
  private broadcastToVMs(channel: string, data: any) {
    for (const vm of this.vmWindows) {
      if (!vm.window.isDestroyed()) {
        debug.log(`Broadcasting to VM ${vm.internal_id} (${channel})`);
        vm.window.webContents.send(channel, data);
      }
    }
  }

  /**
   * Update VM list in manager
   */
  private updateVMList() {
    const list = this.vmWindows.map(vm => ({
      id: vm.internal_id,
      name: vm.info.name,
      status: vm.info.status,
    }));
    this.sendToManager('vm-list-update', list);
  }
}

new AgentPilotApp();
