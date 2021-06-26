const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipcRenderer',
  {
    openFile: async () => {
      return (await ipcRenderer.invoke('openFile'));
    },
    openDirectory: async () => {
      return (await ipcRenderer.invoke('openDirectory'));
    },
    getNetworks: async () => {
      return (await ipcRenderer.invoke('getNetworks'));
    },
    openServer: async (myIp) => {
      return (await ipcRenderer.invoke('openServer', myIp));
    },
    closeServer: async () => {
      return (await ipcRenderer.invoke('closeServer'));
    },
    setServerId: async (myId) => {
      return (await ipcRenderer.invoke('setServerId', myId));
    },
    isServerOpen: async () => {
      return (await ipcRenderer.invoke('isServerOpen'));
    },
    scan: (myIp, netmask, myId) => {
      ipcRenderer.invoke('scan', myIp, netmask, myId);
    },
    scanCallback: (callback) => {
      ipcRenderer.on('scannedDevice', callback);
    },
    removeScanCallback: () => {
      ipcRenderer.removeAllListeners('scannedDevice');
    }
  }
)