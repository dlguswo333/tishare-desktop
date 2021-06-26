import React, { useEffect, useState } from 'react';
import './style/DeviceView.scss';
const ipcRenderer = window.ipcRenderer;

/**
 * 
 * @param {Object} props 
 * @param {string} props.myIp 
 * @param {string} props.myNetmask 
 * @param {string} props.myId 
 * @returns 
 */
function DeviceView({ myIp, myNetmask, myId }) {
  const [devices, setDevices] = useState({});
  const [selected, setSelected] = useState(null);

  const showDevices = () => {
    const ret = [];
    for (let ip in devices) {
      const device = devices[ip];
      ret.push(
        <div className={'DeviceElement' + (selected === ip ? ' Selected' : '')} key={ip}
          onClick={() => {
            setSelected(ip);
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
              {`IP: ${device.ip} version: ${device.version}`}
            </div>
          </div>
        </div>
      )
    }
    return ret;
  }

  const scan = () => {
    ipcRenderer.scan(myIp, myNetmask, myId);
  }

  useEffect(() => {
    ipcRenderer.scanCallback((event, deviceIp, deviceVersion, deviceId, deviceOs) => {
      let tmp = { ...devices };
      tmp[deviceIp] = { ip: deviceIp, version: deviceVersion, id: deviceId, os: deviceOs };
      setDevices(tmp);
    });
    return () => { ipcRenderer.removeScanCallback(); };
  }, []);

  useEffect(() => {
    console.log(devices);
  }, [devices]);

  return (
    <div className='DeviceView'>
      <div className='DeviceViewHead'>
        <div className='Buttons'>
          <button onClick={scan}>Scan</button>
          <button >Send</button>
        </div>
      </div>
      <div className='DeviceViewBody'>
        {showDevices()}
      </div>
    </div>
  )
}

export default DeviceView;