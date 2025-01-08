import { app, BrowserWindow, ipcMain, IpcMainEvent } from 'electron';


let windows: BrowserWindow[] = [];

app.on('ready', () => {

  const managerWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  managerWindow.loadFile('scrapypilot/renderer/index.html');

  ipcMain.on('create-instance', (event: IpcMainEvent, instanceId: string) => {
    const newWindow = new BrowserWindow({
      width: 600,
      height: 400,
      title: `VM Instance ${instanceId}`,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    newWindow.loadFile('scrapypilot/renderer/vmInstance.html');
    windows.push(newWindow);

    newWindow.webContents.once('did-finish-load', () => {
      newWindow.webContents.send('initialize-instance', { instanceId });
    });
  });

  ipcMain.on('close-instance', (event: IpcMainEvent, windowId: number) => {
    const win = windows[windowId];
    if (win) {
      win.close();
      windows.splice(windowId, 1);
    }
  });
});
