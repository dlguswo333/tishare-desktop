import React, { useEffect, useState } from 'react';
import SenderView from './SenderView';
import ReceiverView from './ReceiverView';
import { ReactComponent as MenuIcon } from './icons/Menu.svg';
import { ReactComponent as SettingsIcon } from './icons/Settings.svg';
import './style/Nav.scss';
const ipcRenderer = window.ipcRenderer;

/**
 * @param {object} props 
 * @param {Function} props.toggleSettings 
 * @returns 
 */
function Nav({ toggleSettings }) {
  let hover = false;
  const [grow, setGrow] = useState(false);
  const [noti, setNoti] = useState(false);
  const [senders, setSenders] = useState({});
  const [receivers, setReceivers] = useState({});

  const showSenders = () => {
    let ret = [];
    for (const key in senders) {
      ret.push(
        <SenderView state={senders[key]} />
      )
    }
    return ret;
  }

  const showReceivers = () => {
    let ret = [];
    for (const key in receivers) {
      ret.push(
        <ReceiverView state={receivers[key]} />
      )
    }
    return ret;
  }

  useEffect(() => {
    if (grow)
      setNoti(false);
  }, [grow]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      let ret = await ipcRenderer.getServerState();
      if (ret)
        setSenders(ret);
      else
        setSenders({});
      ret = await ipcRenderer.getServerState();
      if (ret)
        setReceivers(ret);
      else
        setReceivers({});
    }, 900);
    return () => { clearTimeout(timer); };
  }, []);

  return (
    <nav className={grow ? "Nav Grow" : "Nav"}
      onMouseEnter={() => {
        hover = true;
        setGrow(true);
      }}
      onMouseLeave={() => {
        hover = false;
        setTimeout(() => {
          if (!hover)
            setGrow(false);
        }, 300);
      }}
    >
      <div className="Head">
        <div className="Settings"
          onClick={toggleSettings}
        >
          <SettingsIcon />
        </div>
        <div className="Menu">
          <MenuIcon />
          {noti && <div className="Circle" />}
        </div>
      </div>
      <div className="Body">
        {showSenders()}
        {showReceivers()}
      </div>
    </nav>
  )
}

export default Nav;
