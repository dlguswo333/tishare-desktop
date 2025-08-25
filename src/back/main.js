// @ts-check
// Modules to control application life and create native browser window
import {app, BrowserWindow, ipcMain, dialog, protocol, net, nativeImage} from 'electron';
import fs from 'fs/promises';
import path from 'path';
import * as network from './Network.js';
import Server from './Server.js';
import Client from './Client.js';
import Indexer from './Indexer.js';
import {OS} from './defs.js';

/**
 * @typedef {import('../types').IpcRendererApis} IpcRendererApis
 */

const isDev = !app.isPackaged;

/** @type {null | BrowserWindow} */
let mainWindow = null;

/**
 * Send state to renderer process.
 * @param {import('../types').TiJob} state
 */
const sendState = (state) => {
  mainWindow?.webContents.send('jobState', state);
};

/**
 * Tell front to delete the job with ind.
 * @param {number} ind
 */
const deleteJobState = (ind) => {
  mainWindow?.webContents.send('deleteJobState', ind);
};

const indexer = new Indexer((numJobs) => {
  mainWindow?.webContents.send('numJobs', numJobs);
}, deleteJobState);

const server = new Server(indexer, sendState);
const client = new Client(indexer, sendState);

function createMainWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: 'tiShare',
    minWidth: 800,
    minHeight: 600,
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  if (isDev) {
    // When in development, run react start first.
    // Then load the url from the main electron window.
    console.log('Running in development');
    // It seems like .icon is not supported in linux; it can't load image from the path.
    // Use .icon file on win32 only.
    const iconPath = nativeImage.createFromPath(path.join(
      import.meta.dirname, OS === 'win32' ? '../../public/icon.ico' : '../../public/icon.png'
    ));
    mainWindow.setIcon(iconPath);
    mainWindow.loadURL('http://localhost:3000');
  }
  else {
    // removeMenu will remove debugger menu too. Comment the below line if not wanted.
    mainWindow.removeMenu();
    // When in production, run react build first.
    // The main electron window will load the react built packs like below.
    mainWindow.loadFile(path.join(import.meta.dirname, '../../build/index.html')).catch(() => {
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
    mainWindow?.show();
  });

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });

  protocol.handle('app', (req) => {
    // Send local files as they are.
    return net.fetch('file:' + req.url.slice('app:'.length));
  }
  );
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
});

/**
 * @param {string} itemPath
 * @param {Object<string, import('../types').TiItem>} ret
 */
async function addDirectory (itemPath, ret) {
  try {
    const {mtime} = await fs.stat(itemPath);
    const size = (await fs.readdir(itemPath)).length;
    ret[path.basename(itemPath)] = {
      path: itemPath,
      name: path.basename(itemPath),
      dir: '.',
      type: 'directory',
      size,
      mtime,
    };
  } catch (err) {
    // Do nothing.
  }
  return;
}

/**
 * @param {string} itemPath
 * @param {Object<string, import('../types').TiItem>} ret
 */
async function addFile (itemPath, ret) {
  try {
    const {size, mtime} = await fs.stat(itemPath);
    ret[path.basename(itemPath)] = {
      path: itemPath,
      name: path.basename(itemPath),
      dir: '.',
      type: 'file',
      size,
      mtime,
    };
  } catch (err) {
    // Do nothing.
  }
  return;
}

/** @type {IpcRendererApis['openFile']} */
const openFile = async () => {
  /** @type {Object<string, any>} */
  let ret = {};
  if (!mainWindow) {
    return ret;
  }
  let tmp = dialog.showOpenDialogSync(mainWindow, {
    title: 'Open File(s)',
    properties: ['openFile', 'multiSelections']
  });
  if (!tmp)
    return ret;
  for (const item of tmp) {
    await addFile(item, ret);
  }
  return ret;
};
ipcMain.handle('openFile', openFile);

/** @type {IpcRendererApis['openDirectory']} */
const openDirectory = async () => {
  /** @type {Object<string, any>} */
  let ret = {};
  if (!mainWindow) {
    return ret;
  }
  let tmp = dialog.showOpenDialogSync(mainWindow, {
    title: 'Open Directory(s)',
    properties: ['openDirectory', 'multiSelections']
  });
  if (!tmp)
    return ret;
  for (let item of tmp) {
    await addDirectory(item, ret);
  }
  return ret;
};
ipcMain.handle('openDirectory', openDirectory);

/** @type {IpcRendererApis['dragAndDrop']} */
const dragAndDrop = async (paths) => {
  /** @type {Object<string, any>} */
  let ret = {};
  for (let itemPath of paths) {
    const stat = await fs.stat(itemPath);
    if (stat.isFile()) {
      await addFile(itemPath, ret);
    }
    else if (stat.isDirectory()) {
      await addDirectory(itemPath, ret);
    }
  }
  return ret;
};
ipcMain.handle('dragAndDrop', (_, paths) => dragAndDrop(paths));

/** @type {IpcRendererApis['getNetworks']} */
const getNetworks = async () => {
  return network.getNetworks();
};
ipcMain.handle('getNetworks', getNetworks);

/** @type {IpcRendererApis['openServer']} */
const openServer = async (myIp, netmask) => {
  if (server.isOpen()) {
    return true;
  }
  return server.open(myIp, netmask);
};
ipcMain.handle('openServer', (_, myIp, netmask) => openServer(myIp, netmask));

/** @type {IpcRendererApis['closeServer']} */
const closeServer = async () => {
  let ret = server.close();
  if (ret)
    return ret;
  return false;
};
ipcMain.handle('closeServer', closeServer);

/** @type {IpcRendererApis['isServerOpen']} */
const isServerOpen = async () => {
  return server && server.isOpen();
};
ipcMain.handle('isServerOpen', isServerOpen);

/** @type {IpcRendererApis['scan']} */
const scan = (myIp, netmask, myId) => {
  network.scan(myIp, netmask, myId, (deviceIp, deviceVersion, deviceId, deviceOs) => {
    mainWindow?.webContents.send('scannedDevice', deviceIp, deviceVersion, deviceId, deviceOs);
  });
};
ipcMain.handle('scan', (_, myIp, netmask, myId) => scan(myIp, netmask, myId));

/** @type {IpcRendererApis['setMyId']} */
const setMyId = async (myId) => {
  if (myId) {
    server.setMyId(myId);
    client.setMyId(myId);
    return true;
  }
  return false;
};
ipcMain.handle('setMyId', (_, myId) => setMyId(myId));

/** @type {IpcRendererApis['sendRequest']} */
const sendRequest = (items, ip, id) => {
  client.sendRequest(items, ip, id);
};
ipcMain.handle('sendRequest', (_, items, ip, id) => sendRequest(items, ip, id));

/** @type {IpcRendererApis['preRecvRequest']} */
const preRecvRequest = (ip, id) => {
  client.preRecvRequest(ip, id);
};
ipcMain.handle('preRecvRequest', (_, ip, id) => preRecvRequest(ip, id));

/** @type {IpcRendererApis['recvRequest']} */
const recvRequest = (ind, recvDir) => {
  client.recvRequest(ind, recvDir);
};
ipcMain.handle('recvRequest', (_, ind, recvDir) => recvRequest(ind, recvDir));

/** @type {IpcRendererApis['endJob']} */
const endJob = async (ind) => {
  let ret = await server.endJob(ind);
  if (ret)
    return ret;
  ret = client.endJob(ind);
  if (ret)
    return ret;
  return false;
};
ipcMain.handle('endJob', (_, ind) => endJob(ind));

/** @type {IpcRendererApis['deleteJob']} */
const deleteJob = async (ind) => {
  let ret = server.deleteJob(ind);
  if (ret)
    return ret;
  ret = client.deleteJob(ind);
  if (ret)
    return ret;
  return false;
};
ipcMain.handle('deleteJob', (_, ind) => deleteJob(ind));

/** @type {IpcRendererApis['acceptSendRequest']} */
const acceptSendRequest = (ind, recvDir) => {
  server.acceptSendRequest(ind, recvDir);
};
ipcMain.handle('acceptSendRequest', (_, ind, recvDir) => acceptSendRequest(ind, recvDir));

/** @type {IpcRendererApis['acceptRecvRequest']} */
const acceptRecvRequest = (ind, items) => {
  server.acceptRecvRequest(ind, items);
};
ipcMain.handle('acceptRecvRequest', (_, ind, items) => acceptRecvRequest(ind, items));

/** @type {IpcRendererApis['rejectRequest']} */
const rejectRequest = (ind) => {
  server.rejectRequest(ind);
};
ipcMain.handle('rejectRequest', (_, ind) => rejectRequest(ind));

/** @type {IpcRendererApis['setRecvDir']} */
const setRecvDir = async () => {
  if (!mainWindow) {
    return null;
  }
  let ret = dialog.showOpenDialogSync(mainWindow, {
    title: 'Set Receive Directory',
    properties: ['openDirectory']
  });
  if (ret)
    return ret[0];
  return null;
};
ipcMain.handle('setRecvDir', setRecvDir);

/** @type {IpcRendererApis['showMessage']} */
const showMessage = (message) => {
  if (!mainWindow) {
    return;
  }
  dialog.showMessageBox(mainWindow, {title: 'tiShare', message: message});
};
ipcMain.handle('showMessage', (_, message) => showMessage(message));
