import React, { useState, useEffect } from 'react';
import './style/App.scss';
// Below lines are importing modules from window object.
// Look at 'preload.js' for more understanding.
// const networking = window.networking;
const ipcRenderer = window.ipcRenderer;

function App() {
  const [fileList, setFileList] = useState([]);
  const [myId, setMyId] = useState("");
  const [myIp, setMyIp] = useState("");
  const [myNetmask, setMyNetmask] = useState("");
  /** @type {[{name:string, ip:string, netmask:string}[], Function]} */
  const [networks, setNetworks] = useState([]);
  const [isServerOpen, setIsServerOpen] = useState(false);

  // Select local files.
  const openFile = async () => {
    /** @type {any[]} */
    var ret = await ipcRenderer.openFile();
    if (ret.length > 0)
      setFileList([...fileList, ...ret]);
  };

  // Select local directories.
  const openDirectory = async () => {
    /** @type {any[]} */
    var ret = await ipcRenderer.openDirectory();
    if (ret.length > 0)
      setFileList([...fileList, ...ret]);
  };

  const listFiles = fileList.map((file) => {
    return <div className="FileElement">{file}</div>;
  });

  const getNetworks = async () => {
    const ret = await ipcRenderer.getNetworks();
    if (ret)
      setNetworks(ret);
  }

  const listNetworks = networks.map((network) => {
    return <option key={network.ip} value={network.ip + '|' + network.netmask} > {network.name} | {network.ip}</option >;
  });

  const openServer = async () => {
    ipcRenderer.openServer(myIp);
  }

  const closeServer = async () => {
    ipcRenderer.closeServer();
  }

  useEffect(() => {
    getNetworks();
  }, []);

  useEffect(() => {
    if (networks.length > 0) {
      setMyIp(networks[0].ip);
      setMyNetmask(networks[0].netmask);
    }
  }, [networks]);


  return (
    <div className="App">
      <div className="Head">
        <select className="Networks"
          onChange={(e) => {
            const [ip, netmask] = e.target.value.split('|');
            setMyIp(ip);
            setMyNetmask(netmask);
          }}
        >
          {listNetworks}
        </select>
        <span className="Item">
          My IP: {myIp}
        </span>
        <span className="Item">
          My ID: {myId}
        </span>
      </div>
      <div className="Box1">
        <button onClick={openFile}>Open File</button>
        <button onClick={openDirectory}>Open Directory</button>
        <button onClick={openServer}>Open Server</button>
        <button onClick={closeServer}>Close Server</button>
        <div className={isServerOpen ? "ServerStatOpen" : "ServerStatClose"} />
      </div>
      <div className="FileList">
        {listFiles}
      </div>
    </div>
  );
};

export default App;
