import React, { useState, useEffect } from 'react';
import './App.css';
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
    var ret = await ipcRenderer.invoke('open-file');
    if (ret)
      setFileList([...fileList, ...ret]);
  };

  // Select local directories.
  const openDirectory = async () => {
    var ret = await ipcRenderer.invoke('open-directory');
    if (ret)
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

  // useEffect is something like componentDidMount in React class component.
  // Add something that needs to be called after loading this component such as getting the network list.
  useEffect(() => {
    const intervalFun = async () => {
      const ret = await ipcRenderer.invoke('is-server-open');
      setServerSocketOpen(ret);
      getNetworks();
    }
    intervalFun();
    const intervalHandler = setInterval(() => { intervalFun(); }, 1000);
    return () => clearInterval(intervalHandler);
  }, []);

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
