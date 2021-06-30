import React from 'react';
import style from './style/ThemeButton.module.scss';

/**
 * @param {Object} props 
 * @param {string} props.value
 * @param {Function} props.onClick
 */
function ThemeButton({ value, onClick }) {
  return (
    <button
      className={style.ThemeButton}
      onClick={onClick}
    >
      {value}
    </button>
  )
}

export default ThemeButton;