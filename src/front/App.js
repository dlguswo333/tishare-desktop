import React, { useState, useEffect } from 'react';
import './style/App.scss';
// Below lines are importing modules from window object.
// Look at 'preload.js' for more understanding.
// const networking = window.networking;
const ipcRenderer = window.ipcRenderer;

function App() {
  const [fileList, setFileList] = useState([]);
  const [ip, setIp] = useState(null);
  const [networks, setNetworks] = useState([]);
  const [serverSocketOpen, setServerSocketOpen] = useState(false);

  // Select local files.
  const openFile = async () => {
    /** @type {any[]} */
    var ret = await ipcRenderer.invoke('openFile');
    if (ret.length > 0)
      setFileList([...fileList, ...ret]);
  };

  // Select local directories.
  const openDirectory = async () => {
    /** @type {any[]} */
    var ret = await ipcRenderer.invoke('openDirectory');
    if (ret.length > 0)
      setFileList([...fileList, ...ret]);
  };

  const listFiles = fileList.map((file) => {
    return <div className="FileElement">{file}</div>;
  });

  const getNetworks = async () => {
    const ret = await ipcRenderer.invoke('get-networks');
    if (ret)
      setNetworks([...ret]);
  }

  const listNetworks = networks.map((network) => {
    return <div key={network.ip}>{network.name} {network.ip} {network.netmask}</div>;
  });

  const initServerSocket = async () => {
    ipcRenderer.invoke('init-server-socket', networks[0].ip);
  }

  const closeServerSocket = async () => {
    ipcRenderer.invoke('close-server-socket');
  }


  return (
    <div className="App">
      <div className="Head">
        {listNetworks}
      </div>
      <div className="Box1">
        <button onClick={openFile}>Open File</button>
        <button onClick={openDirectory}>Open Directory</button>
        <button onClick={initServerSocket}>Open Server</button>
        <button onClick={closeServerSocket}>Close Server</button>
        <div className={serverSocketOpen ? "ServerStatOpen" : "ServerStatClose"} />
      </div>
      <div className="FileList">
        {listFiles}
      </div>
    </div>
  );
};

export default App;
