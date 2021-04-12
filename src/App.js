import React, { useState } from 'react';
import './App.css';
// Below lines are importing modules from window object.
// Look at 'preload.js' for more understanding.
const networking = window.networking;
console.log(networking);
const ipcRenderer = window.ipcRenderer;

function App() {
  const [fileList, setFileList] = useState([]);
  const [myIp, setMyIp] = useState(null);
  // Select local files.
  const openFile = async () => {
    var ret = await ipcRenderer.invoke('open-file');
    if (ret)
      setFileList([...fileList, ...ret]);
  };

  const openFolder = async () => {
    var ret = await ipcRenderer.invoke('open-folder');
    if (ret)
      setFileList([...fileList, ...ret]);
  };

  const listFiles = fileList.map((file) => {
    return <div className="FileElement">{file}</div>;
  });

  const listNetworks = networking.getMyNetwork().map((network) => {
    return <div>{network.name} {network.ip} {network.netmask}</div>;
  });

  return (
    <div className="App">
      <div className="Head">
        {listNetworks}
      </div>
      <div className="Box1">
        <button onClick={openFile}>Open File</button>
        <button onClick={openFolder}>Open Folder</button>
        <button onClick={() => { networking.initServerSocket(myIp); }}>Open Server</button>
      </div>
      <div className="FileList">
        {listFiles}
      </div>
    </div>
  );
};

export default App;
