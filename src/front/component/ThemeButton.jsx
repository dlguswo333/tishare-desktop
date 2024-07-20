import style from '../style/ThemeButton.module.scss';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {Function} props.onClick
 * @param {boolean} props.opaqueText
 * @param {boolean} [props.disabled]
 */
function ThemeButton ({children, onClick, opaqueText, disabled}) {
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
