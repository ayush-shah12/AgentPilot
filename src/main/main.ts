import { app, BrowserWindow } from 'electron';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();


let mainWindow: BrowserWindow | null = null;

function createWindow() {

    mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true, 
      contextIsolation: false, 
    },
  });


if (process.env.NODE_ENV === 'development') {
    // In development, load index.html directly from the src/renderer folder
    mainWindow.loadFile('src/renderer/index.html');
  } else {
    // In production, after building the frontend, load index.html from dist/renderer
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
