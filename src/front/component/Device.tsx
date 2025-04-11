import WindowsIcon from '../icons/Windows.svg?react';
import AndroidIcon from '../icons/Android.svg?react';
import LinuxIcon from '../icons/Linux.svg?react';

type OsIconProps = {
  os: string;
};

const OsIcon = ({os}: OsIconProps) => {
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

type Props = {
  device: Device;
  isSelected: boolean;
  setSelectedIp: Function;
};

const Device = ({device, isSelected, setSelectedIp}: Props) => {
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
