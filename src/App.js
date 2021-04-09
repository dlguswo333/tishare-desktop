import React, { useState } from 'react';
import './App.css';
// Look at 'preload.js'.
const remote = window.remote;
const networking = window.networking;


function App() {
  const [fileList, setFileList] = useState([]);

  // Select local files.
  const openFile = () => {
    var ret = remote.dialog.showOpenDialogSync({
      title: "Open File(s)",
      properties: ["openFile", "multiSelections"]
    });
    if (ret)
      setFileList([...fileList, ...ret]);
  };

  const openFolder = () => {
    var ret = remote.dialog.showOpenDialogSync({
      title: "Open Folder(s)",
      properties: ["openDirectory", "multiSelections"]
    });
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
      </div>
      <div className="FileList">
        {listFiles}
      </div>
    </div>
  );
};

export default App;
