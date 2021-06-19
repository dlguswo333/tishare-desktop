import React, { useState, useEffect } from 'react';
import Nav from './Nav';
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

  const changeMyId = (id) => {
    if (id) {
      setMyId(id);
      ipcRenderer.setServerId(id);
    }
  }

  const getNetworks = async () => {
    const ret = await ipcRenderer.getNetworks();
    if (ret)
      setNetworks(ret);
  }

  const listNetworks = networks.map((network) => {
    return <option key={network.ip} value={network.ip + '|' + network.netmask} >  {network.ip} ({network.name})</option >;
  });

  const openServer = async () => {
    const ret = await ipcRenderer.openServer(myIp);
    if (!ret)
      console.error('tried to open server but returned false');
  }

  const closeServer = async () => {
    const ret = await ipcRenderer.closeServer();
    if (!ret)
      console.error('tried to open server but returned false');
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

  useEffect(() => {
    const timer = setInterval(async () => {
      const ret = await ipcRenderer.isServerOpen();
      console.log(ret);
      setIsServerOpen((await ipcRenderer.isServerOpen()));
    }, 1000);

    const id = window.localStorage.getItem('myId');
    if (!id)
      changeMyId('12345');
    else
      changeMyId(id);

    return () => {
      clearInterval(timer);
    }
  }, []);


  return (
    <div className="App">
      <div className="NavGhost" />
      <div className="Main">
        <div className="Head">
          <span className="Item">
            {"My IP: "}
            <select className="Networks"
              onChange={(e) => {
                const [ip, netmask] = e.target.value.split('|');
                setMyIp(ip);
                setMyNetmask(netmask);
              }}
            >
              {listNetworks}
            </select>
          </span>
          <span className="Item">
            My ID: {myId}
          </span>
          {isServerOpen ?
            <button className="ServerButton"
              onClick={closeServer}
            >
              Close me <span className="Open"></span>
            </button>
            :
            <button className="ServerButton"
              onClick={openServer}
            >
              Open me <span className="Close"></span>
            </button>
          }
        </div>
        <div className="Box1">
          <button onClick={openFile}>Open File</button>
          <button onClick={openDirectory}>Open Directory</button>
        </div>
        <div className="FileList">
          {listFiles}
        </div>
      </div>
      <Nav />
    </div>
  );
};

export default App;
