// @ts-check
// Sandboxed preload scripts can't use ESM imports.
// https://www.electronjs.org/docs/latest/tutorial/esm#sandboxed-preload-scripts-cant-use-esm-imports
const {contextBridge, ipcRenderer, webUtils} = require('electron');

/** @type {import('../types').IpcRendererApis} */
const ipcRendererApis = {
  openFile: async () => {
    return (await ipcRenderer.invoke('openFile'));
  },
  openDirectory: async () => {
    return (await ipcRenderer.invoke('openDirectory'));
  },
  dragAndDrop: async (paths) => {
    return (await ipcRenderer.invoke('dragAndDrop', paths));
  },
  getNetworks: async () => {
    return (await ipcRenderer.invoke('getNetworks'));
  },
  openServer: async (myIp, myNetmask) => {
    return (await ipcRenderer.invoke('openServer', myIp, myNetmask));
  },
  closeServer: async () => {
    return (await ipcRenderer.invoke('closeServer'));
  },
  setMyId: async (myId) => {
    return (await ipcRenderer.invoke('setMyId', myId));
  },
  isServerOpen: async () => {
    return (await ipcRenderer.invoke('isServerOpen'));
  },
  scan: (myIp, netmask, myId) => {
    ipcRenderer.invoke('scan', myIp, netmask, myId);
  },
  scanCallback: (callback) => {
    ipcRenderer.on('scannedDevice', (_, deviceIp, deviceVersion, deviceId, deviceOs) => callback(deviceIp, deviceVersion, deviceId, deviceOs));
  },
  removeScanCallback: () => {
    ipcRenderer.removeAllListeners('scannedDevice');
  },
  sendRequest: (items, receiverIp, receiverId) => {
    ipcRenderer.invoke('sendRequest', items, receiverIp, receiverId);
  },
  preRecvRequest: (senderIp, senderId) => {
    ipcRenderer.invoke('preRecvRequest', senderIp, senderId);
  },
  recvRequest: (ind, recvDir) => {
    ipcRenderer.invoke('recvRequest', ind, recvDir);
  },
  endJob: (ind) => {
    return ipcRenderer.invoke('endJob', ind);
  },
  deleteJob: (ind) => {
    return ipcRenderer.invoke('deleteJob', ind);
  },
  acceptSendRequest: (ind, recvDir) => {
    ipcRenderer.invoke('acceptSendRequest', ind, recvDir);
  },
  acceptRecvRequest: (ind, items) => {
    ipcRenderer.invoke('acceptRecvRequest', ind, items);
  },
  rejectRequest: (ind) => {
    ipcRenderer.invoke('rejectRequest', ind);
  },
  setRecvDir: async () => {
    return (await ipcRenderer.invoke('setRecvDir'));
  },
  showMessage: (message) => {
    ipcRenderer.invoke('showMessage', message);
  },
  onNumJobs: (callback) => {
    ipcRenderer.on('numJobs', (_, numJobs) => callback(numJobs));
  },
  removeNumJobsCallback: () => {
    ipcRenderer.removeAllListeners('numJobs');
  },
  onJobState: (callback) => {
    ipcRenderer.on('jobState', (_, job) => callback(job));
  },
  removeJobStateCallback: () => {
    ipcRenderer.removeAllListeners('jobState');
  },
  onDeleteJobState: (callback) => {
    ipcRenderer.on('deleteJobState', (_, ind) => callback(ind));
  },
  removeDeleteJobStateCallback: () => {
    ipcRenderer.removeAllListeners('deleteJobState');
  },
  getFilePaths: (files) => {
    try {
      const paths = [];
      for (const file of files) {
        const path = webUtils.getPathForFile(file);
        paths.push(path);
      }
      return paths;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  },
};

contextBridge.exposeInMainWorld('ipcRenderer', ipcRendererApis);
