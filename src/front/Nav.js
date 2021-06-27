import React, { useEffect, useState } from 'react';
import { ReactComponent as MenuIcon } from './icons/Menu.svg';
import { ReactComponent as SettingsIcon } from './icons/Settings.svg';
import './style/Nav.scss';

/**
 * 
 * @param {object} props 
 * @param {Function} props.toggleSettings 
 * @returns 
 */
function Nav({ toggleSettings }) {
  let hover = false;
  const [grow, setGrow] = useState(false);
  const [noti, setNoti] = useState(false);

  useEffect(() => {
    if (grow)
      setNoti(false);
  }, [grow]);

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
      </div>
    </nav>
  )
}

export default Nav;
