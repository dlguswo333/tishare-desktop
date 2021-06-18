import React, { useEffect, useState } from 'react';
import './style/Nav.scss';


function Nav() {
  let hover = false;
  const [grow, setGrow] = useState(false);


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
        }, 400);
      }}
    >

    </nav>
  )
}

export default Nav;
