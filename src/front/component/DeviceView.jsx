import {useEffect, useState} from 'react';
import ThemeButton from './ThemeButton';
import WindowsIcon from '../icons/Windows.svg?react';
import AndroidIcon from '../icons/Android.svg?react';
import LinuxIcon from '../icons/Linux.svg?react';
import Spinner from '@dlguswo333/react-simple-spinner';
import * as DEFS from '../../defs';
const {SCANTIMEOUT} = DEFS.default;
import '../style/DeviceView.scss';
const ipcRenderer = window.ipcRenderer;

/**
 *
 * @param {Object} props
 * @param {Object} props.items
 * @param {string} props.myIp
 * @param {string} props.myNetmask
 * @param {string} props.myId
 * @returns
 */
function DeviceView ({items, myIp, myNetmask, myId}) {
  const [devices, setDevices] = useState({});
  // const [devices, setDevices] = useState({ '10.221.151.210': { ip: '10.221.151.210', id: 'linuxmachine', os: 'linux', version: '0.2.0' }, '10.221.151.200': { ip: '10.221.151.200', id: 'my phone', os: 'android', version: '0.2.0' } });
  const [selectedIp, setSelectedIp] = useState(null);
  const [noDeviceWarn, setNoDeviceWarn] = useState(false);
  const [scanning, setScanning] = useState(false);


  /** @param {string} _os */
  const showOs = (_os) => {
    const os = String(_os).toLowerCase();
    if (os.includes('win'))
      return (
        <WindowsIcon />
      );
    if (os.includes('and'))
      return (
        <AndroidIcon />
      );
    if (os.includes('linux'))
      return (
        <LinuxIcon />
      );
    return os;
  };

  const showDevices = () => {
    const ret = [];
    for (let ip in devices) {
      const device = devices[ip];
      ret.push(
        <div className={'DeviceElement' + (selectedIp === ip ? ' Selected' : '')} key={ip}
          onClick={() => {
            setSelectedIp(ip);
          }}
        >
          <div className='DeviceOs'>
            {showOs(device.os)}
          </div>
          <div className='DeviceProperty'>
            <div className='DeviceId'>
              {device.id}
            </div>
            <div className='DeviceInfo'>
              {`IP: ${device.ip} Version: ${device.version}`}
            </div>
          </div>
        </div>
      );
    }
    return ret;
  };

  const scan = () => {
    setScanning(true);
    setTimeout(() => { setScanning(false); }, SCANTIMEOUT);
    setSelectedIp(null);
    setDevices({});
    ipcRenderer.scan(myIp, myNetmask, myId);
  };

  const sendRequest = () => {
    if (!selectedIp) {
      setNoDeviceWarn(true);
      return;
    }
    setNoDeviceWarn(false);
    ipcRenderer.sendRequest(items, selectedIp, devices[selectedIp].id);
  };

  const preRecvRequest = () => {
    if (!selectedIp) {
      setNoDeviceWarn(true);
      return;
    }
    setNoDeviceWarn(false);
    ipcRenderer.preRecvRequest(selectedIp, devices[selectedIp].id);
  };

  useEffect(() => {
    ipcRenderer.scanCallback((_, deviceIp, deviceVersion, deviceId, deviceOs) => {
      let tmp = {};
      tmp[deviceIp] = {ip: deviceIp, version: deviceVersion, id: deviceId, os: deviceOs};
      /**
       * NOTE
       * Here I Pass an arrow function inside setState.
       * The parameter is the most recent state value.
       * By passing the most recent state value to the function,
       * updating 'devices' using scan callback works as expected,
       * and unnecessary adding and removing callback is deleted.
       * Refer to the link: https://ko.reactjs.org/docs/hooks-faq.html#what-can-i-do-if-my-effect-dependencies-change-too-often
       */
      setDevices((devices) => Object.assign({}, devices, tmp));
    });
    return () => { ipcRenderer.removeScanCallback(); };
  }, []);

  return (
    <div className='DeviceView'>
      <div className='DeviceViewHead'>
        <div className='Buttons'>
          <ThemeButton
            onClick={() => {
              !scanning && scan();
            }}
            opaqueText={scanning}>
            <>
              {scanning && <span className='Overlay'>
                <Spinner fill={false} width='10' size='20px' colors={['#5bf', '#eee']} />
              </span>}
              Scan
            </>
          </ThemeButton>
          <ThemeButton onClick={sendRequest}>Send</ThemeButton>
          <ThemeButton onClick={preRecvRequest}>Receive</ThemeButton>
        </div>
      </div>
      <div className='DeviceViewBody'>
        <div className='Head'>
          Devices
          {noDeviceWarn && <span>Select a device first.</span>}
        </div>
        {showDevices()}
      </div>
    </div>
  );
}

export default DeviceView;
