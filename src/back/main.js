// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const network = require('./Network');
const { Sender } = require('./Sender');
const { Receiver } = require('./Receiver');
const isDev = require('electron-is-dev');

/**
 * @type {BrowserWindow}
 */
var mainWindow = null;
/**
 * @type {Sender}
 */
var sender = null;
/**
 * @type {Receiver}
 */
var receiver = new Receiver();

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: 'SendDone Desktop',
    minWidth: 800,
    minHeight: 600,
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
      nodeIntegration: false,
      contextIsolation: false
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
    console.log('Running in production');
    // removeMenu will remove debugger menu too. Comment the below line if not wanted.
    mainWindow.removeMenu();
    // When in production, run react build first.
    // The main electron window will load the react built packs like below.
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
  mainWindow.once('ready-to-show', () => {
    // Show the window only after fully loaded.
    mainWindow.show();
  })

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
  if (receiver && receiver.isOpen())
    receiver.closeServerSocket();
  if (process.platform !== 'darwin') {
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

ipcMain.handle('get-networks', () => {
  return network.getMyNetworks();
})

ipcMain.handle('openServerSocket', (event, myIp) => {
  if (receiver.isOpen()) {
    receiver.closeServerSocket();
  }
  receiver.openServerSocket(myIp);
  return true;
})

ipcMain.handle('closeServerSocket', () => {
  if (receiver) {
    receiver.closeServerSocket();
    return true;
  }
  return false;
})

ipcMain.handle('is-server-open', () => {
  return receiver && receiver.isOpen();
})

ipcMain.handle('set-id', (event, myId) => {
  if (myId)
    receiver.setMyId(myId);
})

ipcMain.handle('send', (event, ip, items, myId) => {
  // set receiver busy.
  receiver.setStateBusy();
  if (!sender) {
    sender = new Sender(myId);
    sender.send(items, ip);
  }
})

ipcMain.handle('setReceiverBusy', () => {
  receiver.setStateBusy();
})

ipcMain.handle('setReceiverIdle', () => {
  receiver.setStateIdle();
})

ipcMain.handle('getSendState', () => {
  if (sender) {
    return sender.getState();
  }
  return undefined;
})

ipcMain.handle('endSend', () => {
  if (sender) {
    sender.end();
    sender = null;
  }
})

ipcMain.handle('getRecvState', () => {
  const state = receiver.getState();
  return state;
})

ipcMain.handle('endRecv', () => {
  receiver.end();
})

ipcMain.handle('acceptRecv', (event, downloadDirectory) => {
  if (receiver) {
    receiver.acceptRecv(downloadDirectory ? downloadDirectory : app.getPath('downloads'));
  }
})

ipcMain.handle('rejectRecv', () => {
  if (receiver) {
    receiver.rejectRecv();
  }
})

ipcMain.handle('scan', (event, myIp, netmask, myId) => {
  network.scan(myIp, netmask, myId, (deviceIp, deviceVersion, deviceId, deviceOs) => {
    mainWindow.webContents.send('scannedDevice', deviceIp, deviceVersion, deviceId, deviceOs);
  });
})

ipcMain.handle('setDownloadDirectory', () => {
  let ret = dialog.showOpenDialogSync(mainWindow, {
    title: "Set Download Directory",
    properties: ["openDirectory"]
  });
  if (ret)
    return ret[0];
  return '';
})

ipcMain.handle('setMyId', (event, myId) => {
  receiver.setMyId(myId);
})

ipcMain.handle('showMessage', (event, message) => {
  dialog.showMessageBoxSync(mainWindow, { title: 'SendDone-Desktop', message: message });
})