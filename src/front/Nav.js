import React, { useEffect, useState } from 'react';
import SendView from './SendView';
import RecvView from './RecvView';
import { ReactComponent as MenuIcon } from './icons/Menu.svg';
import { ReactComponent as SettingsIcon } from './icons/Settings.svg';
// import { MAX_NUM_JOBS } from '../defs';
import './style/Nav.scss';
const ipcRenderer = window.ipcRenderer;

let hover = false;
/**
 * @param {object} props 
 * @param {Function} props.toggleSettings 
 * @returns 
 */
function Nav({ toggleSettings }) {
  const [grow, setGrow] = useState(false);
  const [noti, setNoti] = useState(false);
  const [senders, setSenders] = useState({});
  const [receivers, setReceivers] = useState({});

  const showSenders = () => {
    let ret = [];
    for (const key in senders) {
      ret.push(
        <SendView state={senders[key]} ind={key} key={key} />
      )
    }
    return ret;
  }

  const showReceivers = () => {
    let ret = [];
    for (const key in receivers) {
      ret.push(
        <RecvView state={receivers[key]} ind={key} key={key} />
      )
    }
    return ret;
  }

  useEffect(() => {
    if (grow)
      setNoti(false);
  }, [grow]);

  useEffect(() => {
    const timer = setInterval(async () => {
      let ret = await ipcRenderer.getClientState();
      console.log(ret);
      if (ret)
        setSenders(ret);
      else
        setSenders({});
      ret = await ipcRenderer.getServerState();
      console.log(ret);
      if (ret)
        setReceivers(ret);
      else
        setReceivers({});
    }, 900);
    return () => { clearInterval(timer); };
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

        <SendView state={{ state: 'SENDING', speed: 1, progress: 50, id: 'opponent', itemName: 'dajfklajlfajdskfj.jpg' }} />
        <RecvView state={{ state: 'WAITING', speed: 1, progress: 100, id: 'opponent', itemName: 'dajfklajlfajdskfj.jpg' }} />
        <RecvView state={{ state: 'RECVING', speed: 1, progress: 100, id: 'opponent', itemName: 'dajfklajlfajdskfj.jpg' }} />

        {showSenders()}
        {showReceivers()}
      </div>
    </nav>
  )
}

export default Nav;
