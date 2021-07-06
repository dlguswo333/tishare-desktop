// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const network = require('./Network');
const isDev = require('electron-is-dev');
const Server = require('./Server');
const Client = require('./Client');

/** @type {BrowserWindow} */
var mainWindow = null;
const server = new Server();
const client = new Client();

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
      let size = (await fs.stat(item)).size;
      ret[path.basename(item)] = { path: item, name: path.basename(item), dir: '.', type: 'file', size: size };
    } catch (err) {
      // Maybe No permission or file system error. Skip it.
    }
  }
  return ret;
})

ipcMain.handle('openDirectory', async () => {
  /**
   * Sub item will be added to the parameter item Object recursively.
   * @param {{ path: string, name:string, dir: string }} item 
   */
  async function addSubItems(item) {
    try {
      let itemStat = await fs.stat(item.path);
      if (itemStat.isDirectory()) {
        item.type = 'directory';
        item.items = {};
        for (let subItem of (await fs.readdir(item.path))) {
          item.items[subItem] = { path: path.join(item.path, subItem), name: subItem, dir: path.join(item.dir, item.name) };
          await addSubItems(item.items[subItem]);
        }
      }
      else {
        item.type = 'file';
        item.size = (await fs.stat(item.path)).size;
      }
    } catch (err) {
      // Maybe No permission or file system error. Skip it.
    }
    return;
  }
  let tmp = dialog.showOpenDialogSync(mainWindow, {
    title: "Open Directory(s)",
    properties: ["openDirectory", "multiSelections"]
  });
  let ret = {};
  if (!tmp)
    return ret;
  for (let item of tmp) {
    ret[path.basename(item)] = { path: item, name: path.basename(item), dir: '.', type: 'directory', items: {} };
    await addSubItems(ret[path.basename(item)]);
  }
  return ret;
})

ipcMain.handle('getNetworks', () => {
  return network.getNetworks();
})

ipcMain.handle('openServer', (event, myIp) => {
  if (server.isOpen()) {
    return true;
  }
  return server.open(myIp);
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

ipcMain.handle('send', (event, items, ip, id) => {
  if (client) {
    client.send(items, ip, id);
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

ipcMain.handle('endSender', (_, ind) => {
  if (client) {
    return client.endSender(ind);
  }
  return false;
})

ipcMain.handle('deleteSender', (_, ind) => {
  if (client) {
    return client.deleteSender(ind);
  }
  return false;
})

ipcMain.handle('endRecver', (_, ind) => {
  if (server) {
    return server.endRecver(ind);
  }
  return false;
})

ipcMain.handle('deleteRecver', (_, ind) => {
  if (server) {
    return server.deleteRecver(ind);
  }
  return false;
})

ipcMain.handle('acceptRecv', (_, ind, recvDir) => {
  if (server) {
    server.acceptRecv(ind, (recvDir ? recvDir : app.getPath('downloads')));
  }
})

ipcMain.handle('rejectRecv', (_, ind) => {
  if (server) {
    server.rejectRecv(ind);
  }
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
  dialog.showMessageBoxSync(mainWindow, { title: 'SendDone-Desktop', message: message });
})