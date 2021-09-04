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
      ipcRenderer.on('scannedDevice', callback);
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
      ipcRenderer.invoke('endJob', ind);
    },
    deleteJob: (ind) => {
      ipcRenderer.invoke('deleteJob', ind);
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
      ipcRenderer.on('numJobs', callback);
    },
    removeNumJobsCallback: () => {
      ipcRenderer.removeAllListeners('numJobs');
    },
    onJobState: (callback) => {
      ipcRenderer.on('jobState', callback);
    },
    removeJobStateCallback: () => {
      ipcRenderer.removeAllListeners('jobState');
    },
    onDeleteJobState: (callback) => {
      ipcRenderer.on('deleteJobState', callback);
    },
    removeDeleteJobStateCallback: () => {
      ipcRenderer.removeAllListeners('deleteJobState');
    }
  }
)