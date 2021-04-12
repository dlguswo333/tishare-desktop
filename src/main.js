// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const existsSync = require('fs').existsSync;
const path = require('path');
const networking = require('./networking');
const isDev = require('electron-is-dev');
// Enable remote module to make life easier.

var mainWindow = null;

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: 'SendDone',
    minWidth: 800,
    minHeight: 450,
    width: 900,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
      nodeIntegration: false,
      contextIsolation: false
    }
  });
  // removeMenu will remove debugger menu too. Comment the below line if not wanted.
  // mainWindow.removeMenu();

  if (isDev) {
    console.log('Running in development');
    // When in development, run react start first.
    // The main electron window will load the react webpage like below.
    mainWindow.loadURL('http://localhost:3000');
  }
  else {
    console.log('Running in production');
    // When in production, run react build first.
    // The mian electron window will load the react built packs like below.
    mainWindow.loadFile(path.join(__dirname, '../build/index.html')).then(() => {
      console.log('Loaded index.html');
    }).catch(() => {
      console.log('Loading index.html failed');
    });
  }
  return mainWindow;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  mainWindow = createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  })
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (networking.isServerSocketListening())
    networking.closeServerSocket();
  if (process.platform !== 'darwin') {
    app.quit();
  }
})

// Handle inter process communications with renderer processes.
ipcMain.handle('open-file', () => {
  return dialog.showOpenDialogSync({
    title: "Open File(s)",
    properties: ["openFile", "multiSelections"]
  });
})

ipcMain.handle('open-directory', () => {
  return dialog.showOpenDialogSync({
    title: "Open Directory(s)",
    properties: ["openDirectory", "multiSelections"]
  });
})

ipcMain.handle('get-networks', () => {
  return networking.getMyNetworks();
})

ipcMain.handle('init-server-socket', (event, arg) => {
  const ip = arg;
  networking.initServerSocket(ip);
})

ipcMain.handle('close-server-socket', () => {
  networking.closeServerSocket();
})

ipcMain.handle('is-server-socket-open', () => {
  return networking.isServerSocketListening();
})