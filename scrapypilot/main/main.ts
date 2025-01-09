/*
  Intended behavior (for now at least):
  - First the manager window is created and from there the user can create VM windows
  - When the manager window is closed:
    - If there ARE VM windows open, the manager window is hidden
    - If there ARE NOT VM windows open, the app quits
  - When a VM window is closed:
    - It is removed from the list of VM windows
      - If there are no more VM windows open and the manager window is hidden, the manager window is shown(back to above case)
      - If there ARE more VM windows open, the manager is still in the state the user left it (hidden or shown)
  - When user clicks "show manager window" from the VM window:
    - If the manager window doesn't exist, it is created(should never occur)
    - If the manager window is hidden, it is shown
  - When all windows are closed:
    - app quits regardless of platform

  An annoyance though:
  if a user closes the manager then all instances, itll reshow the manager window even tho its probably
  likely the user wants to quit the app.
*/


import { app, BrowserWindow, ipcMain } from 'electron';

let managerWindow: BrowserWindow | null = null;
let vmWindows: BrowserWindow[] = [];

function createManagerWindow() {
  if (managerWindow) {
    managerWindow.show();
    console.log('Manager window already exists');
    return;
  }

  console.log('Creating manager window');

  managerWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    icon: 'scrapypilot/renderer/assets/image.jpg',
  });

  managerWindow.loadFile('scrapypilot/renderer/index.html');

  managerWindow.on('close', (event) => {
    if (vmWindows.length > 0) {
      event.preventDefault();  // Prevent the window from closing
      managerWindow?.hide();  // Hide the window instead
      console.log('Hiding manager window');
    }
    else{
      managerWindow = null;  // Reset the manager window variable
      app.quit();  // Quit the app when the manager window is closed
    }
    
  })

  managerWindow.on('closed', () => {
    console.log("App closed");
  });
}

function createVMInstance() {
  console.log('Creating VM Instance');
  const vmWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true
  });


  vmWindow.loadFile('scrapypilot/renderer/vmInstance.html');

  vmWindows.push(vmWindow);

  if (managerWindow && !managerWindow.isDestroyed()) {
    managerWindow.webContents.send('update-instance-count', vmWindows.length);
  }

  vmWindow.on('closed', () => {
    const index = vmWindows.indexOf(vmWindow);
    if (index !== -1) {
      vmWindows.splice(index, 1);  // Remove closed VM window from the list

      if (managerWindow && !managerWindow.isDestroyed()) {
        managerWindow.webContents.send('update-instance-count', vmWindows.length);
      }

      // If all VM windows are closed and the manager window is not open, quit the app
      if (vmWindows.length === 0) {
        if(managerWindow){
          managerWindow.show();  // Show the manager window if it's hidden
        }
        else{
          app.quit();  // Quit the app if the manager window is not open
        }
        
      }
    }
  });
}

app.whenReady().then(() => {
  console.log('App is ready');
  createManagerWindow();
});

// Handle quitting the app if all windows are closed
app.on('window-all-closed', () => {
  
  if (vmWindows.length === 0 && managerWindow === null) {
        app.quit();  // Quit only if no windows are open (including hidden ones)
  }
});

ipcMain.on('create-vm-instance', () => {
  createVMInstance();
});

ipcMain.on('open-manager-window', () => {
  if (!managerWindow) {
    createManagerWindow();  // If the window doesn't exist, create it
  } else {
    managerWindow.show();  // If it's hidden, just show it again
  }
});
