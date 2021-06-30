import React from 'react';
import style from './style/SenderView.module.scss';

/**
 * @param {object} props 
 * @param {object} props.state
 * @param {string} props.state.speed
 * @param {string} props.state.progress
 * @param {string} props.state.id
 */
function SenderView({ state }) {
  return (
    <div className={style.ReceiverView}>
      <div className={style.Head}>

      </div>
      <div className={style.body}>

      </div>
      <div className={style.foot}>

      </div>
    </div>
  );
}

export default SenderView;