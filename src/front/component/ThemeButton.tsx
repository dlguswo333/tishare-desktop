import {MouseEventHandler, ReactNode} from 'react';
import style from '../style/ThemeButton.module.scss';

type Props = {
  children: ReactNode;
  onClick: MouseEventHandler;
  opaqueText?: boolean;
  disabled?: boolean;
}

function ThemeButton ({children, onClick, opaqueText, disabled}: Props) {
  return (
    <button
      className={style.ThemeButton + (opaqueText ? ' ' + style.OpaqueText : '')}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default ThemeButton;
