import React, { useEffect, useState } from 'react';
import ClientJobView from './ClientJobView';
import ServerJobView from './ServerJobView';
import { ReactComponent as MenuIcon } from './icons/Menu.svg';
import { ReactComponent as SettingsIcon } from './icons/Settings.svg';
import { ReactComponent as PinIcon } from './icons/Pin.svg';
import { ReactComponent as SendArrow } from './icons/SendArrow.svg';
import { ReactComponent as RecvArrow } from './icons/RecvArrow.svg';
import { STATE, MAX_NUM_JOBS } from '../defs';
import './style/Nav.scss';
const ipcRenderer = window.ipcRenderer;

let hover = false;
/**
 * @param {object} props 
 * @param {Function} props.toggleSettings 
 * @param {object} props.items 
 * @returns 
 */
function Nav({ toggleSettings, items }) {
  const [grow, setGrow] = useState(false);
  const [pin, setPin] = useState(false);
  const [noti, setNoti] = useState(false);
  const [senders, setSenders] = useState({});
  const [receivers, setReceivers] = useState({});

  const showClientJobs = () => {
    let ret = [];
    for (const key in senders) {
      ret.push(
        <ClientJobView state={senders[key]} ind={key} key={key} />
      )
    }
    return ret;
  }

  const showServerJobs = () => {
    let ret = [];
    for (const key in receivers) {
      ret.push(
        <ServerJobView state={receivers[key]} ind={key} items={items} key={key} />
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
      if (ret)
        setSenders(ret);
      else
        setSenders({});
      ret = await ipcRenderer.getServerState();
      if (ret)
        setReceivers(ret);
      else
        setReceivers({});
    }, 800);
    return () => { clearInterval(timer); };
  }, []);

  return (
    <nav className={(pin || grow) ? "Nav Grow" : "Nav"}
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
        <div className='Element'>
          <div className="Settings"
            onClick={toggleSettings}
          >
            <SettingsIcon />
          </div>
          <div className={pin ? "Pin Active" : "Pin"}
            onClick={() => { setPin((value) => !value); }}
          >
            <PinIcon />
          </div>
        </div>
        <div className='Element'>
          <div className={Object.keys(senders).length === MAX_NUM_JOBS ? 'NumJobs Full' : 'NumJobs'}><SendArrow />{`${Object.keys(senders).length}/${MAX_NUM_JOBS}`}</div>
          <div className={Object.keys(receivers).length === MAX_NUM_JOBS ? 'NumJobs Full' : 'NumJobs'}><RecvArrow />{`${Object.keys(receivers).length}/${MAX_NUM_JOBS}`}</div>
        </div>
        <div className='Element'>
          <div className="Menu">
            <MenuIcon />
            {noti && <div className="Circle" />}
          </div>
        </div>
      </div>
      <div className="Body">

        {/* <ServerJobView state={{ state: STATE.RQE_RECV_REQUEST, speed: 483344, progress: 50, id: 'july', itemName: 'files_that_has_too_long_file_name_and_this_is_going_to_be_trimmed.jpg', totalProgress: '1/2' }} />
        <ClientJobView state={{ state: STATE.RQR_RECV_REQUEST, speed: 110203, progress: 100, id: 'mason', itemName: 'files_that_has_too_long_file_name.jpg' }} />
        <ClientJobView state={{ state: STATE.SENDING, speed: 11033403, progress: 60, id: 'july', itemName: 'report about theme ui.docx', totalProgress: '1/2' }} /> */}

        {showClientJobs()}
        {showServerJobs()}
      </div>
    </nav>
  )
}

export default Nav;
