import WindowsIcon from '../icons/Windows.svg?react';
import AndroidIcon from '../icons/Android.svg?react';
import LinuxIcon from '../icons/Linux.svg?react';

/**
 * @param {Object} props
 * @param {string} props.os
 */
const OsIcon = ({os}) => {
  os = String(os).toLowerCase();
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

/**
 *
 * @param {Object} props
 * @param {{os: string; ip: string; version: string;}} props.device
 * @param {boolean} props.isSelected
 * @param {Function} props.setSelectedIp
 */
const Device = ({device, isSelected, setSelectedIp}) => {
  return <div
    key={device.ip}
    className={'DeviceElement' + (isSelected ? ' Selected' : '')}
    onClick={() => {
      setSelectedIp(device.ip);
    }}
  >
    <div className='DeviceOs'>
      <OsIcon os={device.os} />
    </div>
    <div className='DeviceProperty'>
      <div className='DeviceId'>
        {device.id}
      </div>
      <div className='DeviceInfo'>
        {`IP: ${device.ip} Version: ${device.version}`}
      </div>
    </div>
  </div>;
};

export default Device;
