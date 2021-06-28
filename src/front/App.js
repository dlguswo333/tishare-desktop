import React, { useState, useEffect } from 'react';
import Nav from './Nav';
import ItemView from './ItemView';
import DeviceView from './DeviceView';
import Settings from './Settings';
import './style/App.scss';

// Below lines are importing modules from window object.
// Look at 'preload.js' for more understanding.
const ipcRenderer = window.ipcRenderer;

function App() {
  const [items, setItems] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [myId, setMyId] = useState("");
  const [myIp, setMyIp] = useState("");
  const [myNetmask, setMyNetmask] = useState("");
  /** @type {[{name:string, ip:string, netmask:string}[], Function]} */
  const [networks, setNetworks] = useState([]);
  const [isServerOpen, setIsServerOpen] = useState(false);

  // Select local files.
  const openFile = async () => {
    /** @type {Object.<string, any>} */
    var ret = await ipcRenderer.openFile();
    setItems(Object.assign({}, ret, items));
  };

  // Select local directories.
  const openDirectory = async () => {
    /** @type {Object.<string, any>} */
    var ret = await ipcRenderer.openDirectory();
    setItems(Object.assign({}, ret, items));
  };

  /**
   * @param {Object.<string, bool>|undefined} checked
   */
  const deleteChecked = (checked) => {
    const ret = { ...items };
    if (checked === undefined) {
      setItems({});
    }
    else {
      for (let itemName in checked) {
        delete ret[itemName];
      }
      setItems(ret);
    }
  }

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

  const toggleSettings = () => {
    setShowSettings(!showSettings);
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
      setIsServerOpen((await ipcRenderer.isServerOpen()));
    }, 1000);

    const id = window.localStorage.getItem('myId');
    if (!id) {
      const tmp = Math.floor(Math.random() * (0xffff - 0x1000) + 0x1000).toString(16);
      changeMyId(tmp);
    }
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
        <div className="MainHead">
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
            <button className="ServerButton ServerOpen"
              onClick={closeServer}
              title='Close this device from the network.'
            >
              Close me <span className="Open"></span>
            </button>
            :
            <button className="ServerButton ServerClose"
              onClick={openServer}
              title='Open this device to the network.'
            >
              Open me <span className="Close"></span>
            </button>
          }
        </div>
        <div className="MainBody">
          <div className="ItemGrid">
            <ItemView
              items={items}
              openFile={openFile}
              openDirectory={openDirectory}
              deleteChecked={deleteChecked}
            />
          </div>
          <div className="DeviceGrid">
            <DeviceView
              myIp={myIp}
              myNetmask={myNetmask}
              myId={myId}
            />
          </div>
        </div>
      </div>
      <Nav toggleSettings={toggleSettings} />
      {showSettings && <Settings setShowSettings={setShowSettings} />}
    </div>
  );
};

export default App;
