import React from 'react';
import style from './style/JobView.module.scss';

/**
 * @param {object} props 
 * @param {object} props.state
 * @param {string} props.state.state
 * @param {string} props.state.speed
 * @param {string} props.state.progress
 * @param {string} props.state.id
 */
function ReceiverView({ state }) {
  return (
    <div className={style.JobView}>
      <div className={style.Head}>
        Receiving from {state.id}
      </div>
      <div className={style.body}>

      </div>
      <div className={style.foot}>

      </div>
    </div>
  );
}

export default ReceiverView;