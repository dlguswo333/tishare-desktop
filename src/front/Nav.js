import React, { useState } from 'react';
import './style/Nav.scss';

function Nav() {
  const [hover, setHover] = useState(false);
  return (
    <nav className={hover ? "Nav Grow" : "Nav"}
      onMouseEnter={() => {
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
    >


    </nav>
  )
}

export default Nav;
