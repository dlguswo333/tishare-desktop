import WindowsIcon from '../icons/Windows.svg?react';
import AndroidIcon from '../icons/Android.svg?react';
import LinuxIcon from '../icons/Linux.svg?react';
import {TiDevice} from '../../types';
import semverValid from 'semver/functions/valid';
import semverLt from 'semver/functions/lt';
import {MIN_COMPATIBLE_VERSION} from '../../defs';

type OsIconProps = {
  os: string;
};

const ipcRenderer = window.ipcRenderer;

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
  device: TiDevice;
  isSelected: boolean;
  setSelectedIp: (_: string) => unknown;
};

const Device = ({device, isSelected, setSelectedIp}: Props) => {
  const isIncompatibleVersion = !semverValid(device.version) || semverLt(device.version, MIN_COMPATIBLE_VERSION);
  return <div
    key={device.ip}
    className={'DeviceElement' + (isSelected ? ' Selected' : '')}
    onClick={() => {
      if (isIncompatibleVersion) {
        ipcRenderer.showMessage('An incompatible version of the app is installed on this device.');
        return;
      }
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
        {`IP: ${device.ip} Version: ${device.version}${isIncompatibleVersion ? ' ⚠️' : ''}`}
      </div>
    </div>
  </div>;
};

export default Device;
