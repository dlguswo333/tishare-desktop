import React, { useEffect, useState } from 'react';
import Blind from './Blind';
import style from './style/Settings.module.scss';

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
function Settings({ setShowSettings }) {
  const [tmpRecvPath, setTmpRecvPath] = useState(null);
  const [tmpMyId, setTmpMyId] = useState(null);
  const [IdEmptyWarn, setIdEmptyWarn] = useState(false);
  const [recvPathEmptyWarn, setRecvPathEmptyWarn] = useState(false);

  const resetWarns = () => {
    setIdEmptyWarn(false);
    setRecvPathEmptyWarn(false);
  }

  const save = () => {
    resetWarns();
    if (!tmpMyId) {
      setIdEmptyWarn(true);
      return;
    }
    window.localStorage.setItem('myId', tmpMyId);
    if (!tmpRecvPath) {
      setRecvPathEmptyWarn(true);
      return;
    }
    window.localStorage.setItem('recvPath', tmpRecvPath);
    setShowSettings(false);
  }

  useEffect(() => {
    let tmp = window.localStorage.getItem('myId');
    if (tmp)
      setTmpRecvPath(tmp);
    tmp = window.localStorage.getItem('recvPath');
    if (tmp)
      setTmpRecvPath(tmp);
  }, []);

  return (
    <div>
      <Blind />
      <div className={style.Settings}>
        <div className={style.SettingsHead}>
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
              Receive Path
              {recvPathEmptyWarn && <span className={style.Warn}>Set your Receive Path.</span>}
            </div>
            <input type='text'
              readOnly={true}
              className={style.Body}
              placeholder={tmpRecvPath}
              onChange={(e) => { setTmpRecvPath(e.target.value); }}
            />
            <button>Find</button>
          </div>
        </div>
        <div className={style.SettingsFoot}>
          <button onClick={() => {
            setShowSettings(false);
          }}> Cancel</button>
          <button onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default Settings;