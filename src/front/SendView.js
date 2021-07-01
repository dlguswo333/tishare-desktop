import React from 'react';
import { STATE } from '../defs';
import style from './style/JobView.module.scss';

/**
 * @param {object} props 
 * @param {object} props.state
 * @param {string} props.state.state
 * @param {string} props.state.speed
 * @param {string} props.state.progress
 * @param {string} props.state.id
 */
function SenderView({ state }) {

  const showBody = () => {
    if (state.state === STATE.SEND_WAIT) {
      return (
        <div className={style.Body}>
          Waiting for Accept...
        </div>
      )
    }
  }

  const showButtons = () => {
    if (state.state === STATE.SEND_WAIT) {
      return (
        <div className={style.Foot}>
          <button>Cancel</button>
        </div>
      )
    }
  }

  return (
    <div className={style.JobView}>
      <div className={style.Head}>
        Sending to {state.id}
      </div>
      {showBody()}
      {showButtons()}
    </div>
  );
}

export default SenderView;