import { app, BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import { isDev } from '../shared/constants';

// represents a vm window instance, this is detached from the main manager window
interface VMWindow {
  window: BrowserWindow;
  id: string;
}

class ScrapyPilotApp {

  // main window instance (only one exists at any given time, iff this exists, vm windows can exist)
  private managerWindow: BrowserWindow | null = null;

  // store list of vm windows instances
  private vmWindows: VMWindow[] = [];

  constructor() {
    this.initializeApp();
  }

  private initializeApp() {
    require('@electron/remote/main').initialize();

    app.on('ready', () => {
      this.createManagerWindow();
      
      // check if in dev mode and watch for changes in the dist and src folders
      if (isDev) {
        const watchPaths = [
          path.join(__dirname, '..', '..', 'dist'),
          path.join(__dirname, '..', '..', 'src')
        ];

        console.log('Watching for changes in:', watchPaths);

        watchPaths.forEach(watchPath => {
          if (fs.existsSync(watchPath)) {
            fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
              if (filename) {
                console.log(`File changed: ${filename}`);
                if (this.managerWindow && !this.managerWindow.isDestroyed()) {
                  console.log('Reloading manager window...');
                  this.managerWindow.reload();
                }
                this.vmWindows.forEach(vm => {
                  if (!vm.window.isDestroyed()) {
                    console.log(`Reloading VM window: ${vm.id}`);
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
      console.log('All windows closed, quitting application...');
      app.quit();
    });

    // ensure all windows are closed before quitting
    app.on('before-quit', () => {
      console.log('Application is quitting...');
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

  private createManagerWindow() {
    console.log('Creating manager window...');
    if (this.managerWindow) {
      console.log('Manager window exists, showing it...');
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
        spellcheck: false
      },
      autoHideMenuBar: true,
      icon: path.join(__dirname, '..', '..', 'src', 'renderer', 'assets', 'icon.png')
    });

    const htmlPath = path.join(__dirname, '..', '..', 'src', 'renderer', 'manager.html');
    console.log('Loading manager HTML from:', htmlPath);
    this.managerWindow.loadFile(htmlPath);

    require('@electron/remote/main').enable(this.managerWindow.webContents);

    if (isDev) {
      this.managerWindow.webContents.openDevTools();
    }

    this.managerWindow.on('close', () => {
      console.log('Manager window closing...');
      app.quit();
    });

    // debugging shit
    this.managerWindow.webContents.on('did-finish-load', () => {
      console.log('Manager window loaded successfully');
    });

    this.managerWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      console.error('Manager window failed to load:', errorCode, errorDescription);
    });
  }

  private createVMInstance(vmId: string) {
    console.log('Creating VM instance with ID:', vmId);
    const vmWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      autoHideMenuBar: true
    });

    const htmlPath = path.join(__dirname, '..', '..', 'src', 'renderer', 'vm-instance.html');
    console.log('Loading VM instance HTML from:', htmlPath);
    vmWindow.loadFile(htmlPath);

    require('@electron/remote/main').enable(vmWindow.webContents);

    const vmInstance: VMWindow = {
      window: vmWindow,
      id: vmId
    };

    this.vmWindows.push(vmInstance);
    this.updateInstanceCount();

    vmWindow.on('closed', () => {
      console.log('VM instance closed:', vmId);
      const index = this.vmWindows.findIndex(vm => vm.id === vmId);
      if (index !== -1) {
        this.vmWindows.splice(index, 1);
        this.updateInstanceCount();

        if (this.vmWindows.length === 0 && this.managerWindow) {
          this.managerWindow.show();
        }
      }
    });

    // Send VM ID to the renderer
    vmWindow.webContents.on('did-finish-load', () => {
      console.log('VM instance loaded, sending ID:', vmId);
      vmWindow.webContents.send('vm-id', vmId);
    });

    // Debug window loading
    vmWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      console.error('VM instance failed to load:', errorCode, errorDescription);
    });
  }

  private updateInstanceCount() {
    if (this.managerWindow && !this.managerWindow.isDestroyed()) {
      this.managerWindow.webContents.send('update-instance-count', this.vmWindows.length);
    }
  }

  private setupIpcHandlers() {
    console.log('Setting up IPC handlers...');
    
    ipcMain.on('create-vm-instance', (_, vmId: string) => {
      console.log('Received create-vm-instance event with ID:', vmId);
      this.createVMInstance(vmId);
    });

    ipcMain.on('open-manager-window', () => {
      console.log('Received open-manager-window event');
      if (!this.managerWindow) {
        this.createManagerWindow();
      } else {
        this.managerWindow.show();
      }
    });

    // Add handlers for VM control
    ipcMain.on('vm-command', (_, { vmId, command, data }) => {
      console.log('Received vm-command:', { vmId, command, data });
      const vmWindow = this.vmWindows.find(vm => vm.id === vmId);
      if (vmWindow) {
        vmWindow.window.webContents.send('vm-command-response', {
          command,
          data,
          timestamp: new Date().toISOString()
        });
      }
    });
  }
}

new ScrapyPilotApp();