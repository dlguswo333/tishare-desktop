// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const existsSync = require('fs').existsSync;
const path = require('path');
const isDev = require('electron-is-dev');

var mainWindow = null;
var numCopied = 0;
var numTotal = -1;

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: 'Sync Folder',
    minWidth: 600,
    minHeight: 450,
    width: 600,
    height: 450,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Since Electron 12, the default value is true.
      // To use preload, must set it false.
      contextIsolation: false
    }
  });
  mainWindow.removeMenu();

  if (isDev) {
    console.log('Running in development');
    mainWindow.loadURL('http://localhost:3000');
  }
  else {
    console.log('Running in production');
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-path', async () => {
  const path = dialog.showOpenDialogSync({
    properties: ['openDirectory']
  });
  return path;
});

ipcMain.handle('sync-folder', async (event, ...args) => {
  const path1 = args[0];
  const path2 = args[1];
  if (!path1 || !path2) {
    dialog.showErrorBox('Handed path value is empty!');
    return;
  }
  sync(path1, path2);
});

ipcMain.handle('ERROR', (arg) => {
  dialog.showErrorBox(arg);
});

ipcMain.on('progress', (event, arg) => {
  event.reply('progress', { numCopied: numCopied, numTotal: numTotal });
});

const sync = async (path1, path2) => {
  // Main part of the app.
  numTotal = 0;
  if (!existsSync(path1) || !existsSync(path2)) {
    if (!existsSync(path1)) {
      dialog.showErrorBox('ERROR', path1 + ' does not exist!');
    }
    if (!existsSync(path2)) {
      dialog.showErrorBox('ERROR', path2 + ' does not exist!');
    }
    return;
  }
  // Call loopDir for two folders.
  // For each item, copy to the other folder.
  var list1 = null, list2 = null;
  list1 = await loopDir(path1);
  if (!list1) {
    dialog.showErrorBox('ERROR', 'Could not read files from ' + path1);
    return;
  }
  list2 = await loopDir(path2);
  if (!list2) {
    dialog.showErrorBox('ERROR', 'Could not read files from ' + path2);
    return;
  }

  numCopied = 0;
  numTotal = list1.length + list2.length;

  // Now start copying using file lists.
  await copyDir(list1, path1, path2);
  await copyDir(list2, path2, path1);
  mainWindow.setProgressBar(-1);
}

const loopDir = async (directory) => {
  // Returns a list of files including directories and sub-files.
  // Must return a promise.
  let fileList = [];
  try {
    fileList = await fs.readdir(directory, { withFileTypes: false });
    const len = fileList.length;
    for (let i = 0; i < len; ++i) {
      fileList[i] = { name: fileList[i], dir: false };
      if ((await fs.stat(path.join(directory, fileList[i].name))).isDirectory()) {
        // This is a sub-directory.
        // Loop the directory and append the result.
        fileList[i].dir = true;
        let subFileList = await loopDir(path.join(directory, fileList[i].name));
        for (let j = 0; j < subFileList.length; ++j) {
          subFileList[j].name = path.join(fileList[i].name, subFileList[j].name);
        }
        fileList = fileList.concat(subFileList);
      }
    }
    return fileList;
  } catch (err) {
    // dialog.showErrorBox('ERROR', 'Could not loop ' + directory);
    console.error(err);
    return undefined;
  }
}

const copyDir = async (srcFileList, srcPath, dstPath) => {
  // Copy directory using file list.
  // dst is absolute directory, and file list is relative.
  for (const f of srcFileList) {
    const thisDstPath = path.join(dstPath, f.name);
    if (!existsSync(thisDstPath)) {
      try {
        if (f.dir) {
          // console.log('mkdir ' + thisDstPath);
          await fs.mkdir(thisDstPath);
        }
        else {
          // console.log('copy ' + path.join(srcPath, f.name) + ' ' + thisDstPath);
          await fs.copyFile(path.join(srcPath, f.name), thisDstPath);
        }
      } catch {
        // TODO Print failed file list to user.
        console.log('Copying ' + f.name + ' failed!');
      }
    }
    ++numCopied;
    mainWindow.setProgressBar(numCopied / numTotal);
  }
}