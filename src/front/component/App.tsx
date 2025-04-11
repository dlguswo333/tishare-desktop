import {useState, useEffect} from 'react';
import Nav from './Nav';
import ItemView from './ItemView';
import DeviceView from './DeviceView';
import Settings from './Settings';
import Blind from './Blind';
import '../style/App.scss';
import useMountEffect from '../hook/useMountEffect';
import useDragDrop from '../hook/useDragDrop';
import useServer from '../hook/useServer';
import useNetworks from '../hook/useNetworks';
import useItems from '../hook/useItems';
import RefreshIcon from '../icons/Refresh.svg?react';
import ItemDetail from './ItemDetail';

export type Network = {name: string; ip: string; netmask: string;};

// Below lines are importing modules from window object.
// Look at 'preload.js' for more understanding.
const ipcRenderer = window.ipcRenderer;

function App () {
  const [showSettings, setShowSettings] = useState(false);
  const [myId, _setMyId] = useState('');
  const [myIp, setMyIp] = useState<string | null>('');
  const [myNetmask, setMyNetmask] = useState<string | null>('');
  const [networks, setNetworks] = useState<Network[]>([]);
  const [isServerOpen, setIsServerOpen] = useState(false);

  const {items, setItems, deleteChecked} = useItems();
  const {isDragging} = useDragDrop({setItems});
  const [itemDetail, setItemDetail] = useState(null);
  const {openServer, closeServer} = useServer({myIp, myNetmask});
  const {getNetworks} = useNetworks({isServerOpen, closeServer, setNetworks});

  // Select local files.
  const openFile = async () => {
    const ret: Record<string, any> = await ipcRenderer.openFile();
    setItems(Object.assign({}, ret, items));
  };

  // Select local directories.
  const openDirectory = async () => {
    const ret: Record<string, any> = await ipcRenderer.openDirectory();
    setItems(Object.assign({}, ret, items));
  };

  /**
   * Change ID in state and also server ID.
   */
  const setMyId = (id: string) => {
    if (id) {
      _setMyId(id);
      ipcRenderer.setMyId(id);
    }
  };

  const listNetworks = networks.map((network) => {
    return <option key={network.ip} value={network.ip + '|' + network.netmask} >  {network.ip} ({network.name})</option >;
  });

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  useMountEffect(() => {
    getNetworks();
  });

  useEffect(() => {
    if (networks.length > 0) {
      setMyIp(networks[0].ip);
      setMyNetmask(networks[0].netmask);
    }
    else {
      setMyIp(null);
      setMyNetmask(null);
    }
  }, [networks]);

  useEffect(() => {
    const timer = setInterval(async () => {
      setIsServerOpen((await ipcRenderer.isServerOpen()));
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const id = window.localStorage.getItem('myId');
    if (!id) {
      const tmp = Math.floor(Math.random() * (0xffff - 0x1000) + 0x1000).toString(16);
      setMyId(tmp);
    }
    else
      setMyId(id);
  }, [showSettings]);

  return (
    <div className='App'>
      <div className='NavGhost' />
      <div className='Main'>
        <div className='MainHead'>
          <span className='Item'>
            <span>My IP:</span>
            <select className='Networks'
              onChange={(e) => {
                const [ip, netmask] = e.target.value.split('|');
                setMyIp(ip);
                setMyNetmask(netmask);
                if (isServerOpen) {
                  // Close the server which is open to the previous IP.
                  closeServer();
                }
              }}
              value={`${myIp}|${myNetmask}`}
            >
              {listNetworks}
            </select>
            <button className='NetworkRefreshButton' onClick={getNetworks} title='Refresh'>
              <RefreshIcon />
            </button>
          </span>
          <span className='Item'>
            <span>My ID:</span>
            <span>{myId}</span>
          </span>
          {isServerOpen ?
            <button className='ServerButton ServerOpen'
              onClick={closeServer}
              title='Close this device from the network.'
            >
              Close me <span className='Open'></span>
            </button>
            :
            <button className='ServerButton ServerClose'
              onClick={openServer}
              title='Open this device to the network.'
            >
              Open me <span className='Close'></span>
            </button>
          }
        </div>
        <div className='MainBody'>
          <div className='ItemGrid'>
            <ItemView
              items={items}
              openFile={openFile}
              openDirectory={openDirectory}
              deleteChecked={deleteChecked}
              setItemDetail={setItemDetail}
            />
          </div>
          <div className='DeviceGrid'>
            <DeviceView
              items={items}
              myIp={myIp}
              myNetmask={myNetmask}
              myId={myId}
            />
          </div>
        </div>
      </div>
      <Nav toggleSettings={toggleSettings} items={items} />
      {showSettings && <Settings setShowSettings={setShowSettings} />}
      {isDragging &&
        <>
          <Blind>
            {'Drag and drop here!'}
          </Blind>
        </>}
      {!!itemDetail &&
        <>
          <Blind>
            <ItemDetail item={itemDetail} setItemDetail={setItemDetail} />
          </Blind>
        </>}
    </div>
  );
}

export default App;
