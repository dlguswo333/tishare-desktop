import React from 'react';
import style from '../style/ThemeButton.module.scss';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {Function} props.onClick
 * @param {boolean} props.opaqueText
 */
function ThemeButton({ children, onClick, opaqueText }) {
  return (
    <button
      className={style.ThemeButton + (opaqueText ? ' ' + style.OpaqueText : '')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default ThemeButton;
