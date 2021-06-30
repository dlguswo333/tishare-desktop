import React, { useEffect, useState } from 'react';
import ThemeButton from './ThemeButton';
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
            {device.os}
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

  const send = () => {
    if (!selectedIp) {
      setNoDeviceWarn(true);
      return;
    }
    setNoDeviceWarn(false);
    ipcRenderer.send(items, selectedIp, devices[selectedIp].id);
  }

  useEffect(() => {
    ipcRenderer.scanCallback((event, deviceIp, deviceVersion, deviceId, deviceOs) => {
      let tmp = {};
      tmp[deviceIp] = { ip: deviceIp, version: deviceVersion, id: deviceId, os: deviceOs };
      /**
       * Passing a function inside setState,
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
          <ThemeButton onClick={send} value='Send' />
        </div>
      </div>
      <div className='DeviceViewBody'>
        <div className='Head'>
          Devices
          {noDeviceWarn && <span>Select Device to send.</span>}
        </div>
        {showDevices()}
      </div>
    </div>
  )
}

export default DeviceView;