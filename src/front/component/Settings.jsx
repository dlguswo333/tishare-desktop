import {useEffect, useState} from 'react';
import Blind from './Blind';
import SettingsIcon from '../icons/Settings.svg?react';
import style from '../style/Settings.module.scss';
import ThemeButton from './ThemeButton';

/*
  Settings could have been inside Nav component because Settings is positioned fixed,
  but because of backdrop-filter properties on Nav, Settings is positioned to Nav component, not root component.
  Take a look at the link below for details.
  https://stackoverflow.com/questions/52937708/why-does-applying-a-css-filter-on-the-parent-break-the-child-positioning
*/

/**
 * @param {object} props
 * @param {Function} props.setShowSettings
 */
function Settings ({setShowSettings}) {
  const [tmpRecvDir, setTmpRecvDir] = useState(null);
  const [tmpMyId, setTmpMyId] = useState(null);
  const [IdEmptyWarn, setIdEmptyWarn] = useState(false);
  const [recvDirEmptyWarn, setRecvDirEmptyWarn] = useState(false);

  const resetWarns = () => {
    setIdEmptyWarn(false);
    setRecvDirEmptyWarn(false);
  };

  const save = () => {
    resetWarns();
    if (!tmpMyId) {
      setIdEmptyWarn(true);
      return;
    }
    window.localStorage.setItem('myId', tmpMyId);
    if (!tmpRecvDir) {
      setRecvDirEmptyWarn(true);
      return;
    }
    window.localStorage.setItem('recvDir', tmpRecvDir);
    setShowSettings(false);
  };

  useEffect(() => {
    let tmp = window.localStorage.getItem('myId');
    if (tmp)
      setTmpMyId(tmp);
    tmp = window.localStorage.getItem('recvDir');
    if (tmp)
      setTmpRecvDir(tmp);
  }, []);

  return (
    <>
      <Blind />
      <div className={style.Settings}>
        <div className={style.SettingsHead}>
          <SettingsIcon />
          Settings
        </div>
        <div className={style.SettingsBody}>
          <div className={style.SettingsElement}>
            <div className={style.Head}>
              ID
              {IdEmptyWarn && <span className={style.Warn}>Type your ID.</span>}
            </div>
            <input type='text'
              className={style.Body}
              placeholder={tmpMyId}
              maxLength={10}
              onChange={(e) => { setTmpMyId(e.target.value); }}
            />
          </div>
          <div className={style.SettingsElement}>
            <div className={style.Head}>
              Receive Directory
              {recvDirEmptyWarn && <span className={style.Warn}>Set your Receive Path.</span>}
            </div>
            <input type='text'
              readOnly
              className={style.Body}
              value={tmpRecvDir || ''}
              onChange={(e) => { setTmpRecvDir(e.target.value); }}
            />
            <button
              onClick={async () => {
                const ret = await window.ipcRenderer.setRecvDir();
                if (ret)
                  setTmpRecvDir(ret);
              }}
            >
              Find
            </button>
          </div>
        </div>
        <div className={style.SettingsFoot}>
          <button className={style.Negative} onClick={() => {
            setShowSettings(false);
          }}>
            Cancel
          </button>
          <ThemeButton onClick={save}>
            Save
          </ThemeButton>
        </div>
      </div>
    </>
  );
}

export default Settings;
