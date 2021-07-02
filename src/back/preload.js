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
    setMyId: async (myId) => {
      return (await ipcRenderer.invoke('setMyId', myId));
    },
    setRecvDir: async () => {
      return (await ipcRenderer.invoke('setRecvDir'));
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
    },
    send: (items, receiverIp, receiverId) => {
      ipcRenderer.invoke('send', items, receiverIp, receiverId);
    },
    getServerState: async () => {
      return (await ipcRenderer.invoke('getServerState'));
    },
    getClientState: async () => {
      return (await ipcRenderer.invoke('getClientState'));
    },
    endSender: (ind) => {
      ipcRenderer.invoke('endSender', ind);
    },
    deleteSender: (ind) => {
      ipcRenderer.invoke('deleteSender', ind);
    },
    endRecver: (ind) => {
      ipcRenderer.invoke('endRecver', ind);
    },
    deleteRecver: (ind) => {
      ipcRenderer.invoke('deleteRecver', ind);
    },
    acceptRecv: (ind, recvDir) => {
      ipcRenderer.invoke('acceptRecv', ind, recvDir);
    },
    rejectRecv: (ind) => {
      ipcRenderer.invoke('rejectRecv', ind);
    },
  }
)