import React, { useEffect, useState } from 'react';
import ThemeButton from './ThemeButton';
import { ReactComponent as WindowsIcon } from './icons/Windows.svg';
import { ReactComponent as AndroidIcon } from './icons/Android.svg';
import { ReactComponent as LinuxIcon } from './icons/Linux.svg';
import './style/DeviceView.scss';
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
function DeviceView({ items, myIp, myNetmask, myId }) {
  const [devices, setDevices] = useState({});
  const [selectedIp, setSelectedIp] = useState(null);
  const [noDeviceWarn, setNoDeviceWarn] = useState(false);

  /** @param {string} _os */
  const showOs = (_os) => {
    const os = String(_os).toLowerCase();
    if (os.includes('win'))
      return (
        <WindowsIcon />
      )
    if (os.includes('and'))
      return (
        <AndroidIcon />
      )
    if (os.includes('linux'))
      return (
        <LinuxIcon />
      )
    return os;
  }

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
      )
    }
    return ret;
  }

  const scan = () => {
    setSelectedIp(null);
    setDevices({});
    ipcRenderer.scan(myIp, myNetmask, myId);
  }

  const sendRequest = () => {
    if (!selectedIp) {
      setNoDeviceWarn(true);
      return;
    }
    setNoDeviceWarn(false);
    ipcRenderer.sendRequest(items, selectedIp, devices[selectedIp].id);
  }

  const preRecvRequest = () => {
    if (!selectedIp) {
      setNoDeviceWarn(true);
      return;
    }
    setNoDeviceWarn(false);
    ipcRenderer.preRecvRequest(selectedIp, devices[selectedIp].id);
  }

  useEffect(() => {
    ipcRenderer.scanCallback((_, deviceIp, deviceVersion, deviceId, deviceOs) => {
      let tmp = {};
      tmp[deviceIp] = { ip: deviceIp, version: deviceVersion, id: deviceId, os: deviceOs };
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
          <ThemeButton onClick={scan} value='Scan' />
          <ThemeButton onClick={sendRequest} value='Send' />
          <ThemeButton onClick={preRecvRequest} value='Receive' />
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
  )
}

export default DeviceView;