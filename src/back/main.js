// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const network = require('./Network');
const isDev = require('electron-is-dev');
const Server = require('./Server');
const Client = require('./Client');
const Indexer = require('./Indexer');

/** @type {BrowserWindow} */
var mainWindow = null;

const indexer = new Indexer((numJobs) => {
  mainWindow?.webContents.send('numJobs', numJobs);
});

/**
 * Send state to renderer process.
 */
const sendState = (state) => {
  mainWindow?.webContents.send('state', state);
}

const server = new Server(indexer, sendState);
const client = new Client(indexer, sendState);

function createMainWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: 'tiShare',
    minWidth: 800,
    minHeight: 600,
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  if (isDev) {
    console.log('Running in development');
    // When in development, run react start first.
    // The main electron window will load the react webpage like below.
    mainWindow.setIcon(path.join(__dirname, '../../public/icon.ico'))
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.maximize();
  }
  else {
    // removeMenu will remove debugger menu too. Comment the below line if not wanted.
    mainWindow.removeMenu();
    // When in production, run react build first.
    // The main electron window will load the react built packs like below.
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html')).catch(() => {
      console.log('Loading index.html failed');
    });
  }
  return mainWindow;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  mainWindow = createMainWindow();
  mainWindow.once('ready-to-show', () => {
    // Show the window only after fully loaded.
    mainWindow.show();
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  })
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (server && server.isOpen())
      server.close();
    app.quit();
  }
})

// Handle inter process communications with renderer processes.
ipcMain.handle('openFile', async () => {
  let tmp = dialog.showOpenDialogSync(mainWindow, {
    title: "Open File(s)",
    properties: ["openFile", "multiSelections"]
  });
  let ret = {};
  if (!tmp)
    return ret;
  for (item of tmp) {
    try {
      const size = (await fs.stat(item)).size;
      ret[path.basename(item)] = { path: item, name: path.basename(item), dir: '.', type: 'file', size: size };
    } catch (err) {
      // Maybe No permission or file system error. Skip it.
    }
  }
  return ret;
})

ipcMain.handle('openDirectory', async () => {
  let tmp = dialog.showOpenDialogSync(mainWindow, {
    title: "Open Directory(s)",
    properties: ["openDirectory", "multiSelections"]
  });
  let ret = {};
  if (!tmp)
    return ret;
  for (let item of tmp) {
    const size = (await fs.readdir(item)).length;
    ret[path.basename(item)] = { path: item, name: path.basename(item), dir: '.', type: 'directory', size: size };
  }
  return ret;
})

ipcMain.handle('getNetworks', () => {
  return network.getNetworks();
})

ipcMain.handle('openServer', (event, myIp, netmask) => {
  if (server.isOpen()) {
    return true;
  }
  return server.open(myIp, netmask);
})

ipcMain.handle('closeServer', () => {
  if (server) {
    server.close();
    return true;
  }
  return false;
})

ipcMain.handle('isServerOpen', () => {
  return server && server.isOpen();
})

ipcMain.handle('scan', (event, myIp, netmask, myId) => {
  network.scan(myIp, netmask, myId, (deviceIp, deviceVersion, deviceId, deviceOs) => {
    mainWindow.webContents.send('scannedDevice', deviceIp, deviceVersion, deviceId, deviceOs);
  });
})

ipcMain.handle('setMyId', (event, myId) => {
  if (myId) {
    server.setMyId(myId);
    client.setMyId(myId);
    return true;
  }
  return false;
})

ipcMain.handle('sendRequest', (_, items, ip, id) => {
  if (client) {
    client.sendRequest(items, ip, id);
  }
})

ipcMain.handle('preRecvRequest', (_, ip, id) => {
  if (client) {
    client.preRecvRequest(ip, id);
  }
})

ipcMain.handle('recvRequest', (_, ind, recvDir) => {
  if (client) {
    client.recvRequest(ind, recvDir);
  }
})

ipcMain.handle('getServerState', () => {
  if (server) {
    return server.getState();
  }
  return undefined;
})

ipcMain.handle('getClientState', () => {
  if (client) {
    return client.getState();
  }
  return undefined;
})

ipcMain.handle('endServerJob', (_, ind) => {
  if (server) {
    return server.endJob(ind);
  }
  return false;
})

ipcMain.handle('endClientJob', (_, ind) => {
  if (client) {
    return client.endJob(ind);
  }
  return false;
})

ipcMain.handle('deleteServerJob', (_, ind) => {
  if (server) {
    return server.deleteJob(ind);
  }
  return false;
})

ipcMain.handle('deleteClientJob', (_, ind) => {
  if (client) {
    return client.deleteJob(ind);
  }
  return false;
})

ipcMain.handle('acceptSendRequest', (_, ind, recvDir) => {
  if (server)
    server.acceptSendRequest(ind, recvDir);
})

ipcMain.handle('acceptRecvRequest', (_, ind, items) => {
  if (server)
    server.acceptRecvRequest(ind, items);
})

ipcMain.handle('rejectRequest', (_, ind) => {
  if (server)
    server.rejectRequest(ind);
})

ipcMain.handle('setRecvDir', () => {
  let ret = dialog.showOpenDialogSync(mainWindow, {
    title: "Set Receive Directory",
    properties: ["openDirectory"]
  });
  if (ret)
    return ret[0];
  return null;
})

ipcMain.handle('showMessage', (event, message) => {
  dialog.showMessageBox(mainWindow, { title: 'tiShare', message: message });
})
