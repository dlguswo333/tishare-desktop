import React from 'react';
import { STATE, printSize } from '../defs';
import style from './style/JobView.module.scss';
const ipcRenderer = window.ipcRenderer;

/**
 * @param {object} props 
 * @param {object} props.state
 * @param {string} props.state.state
 * @param {number} props.state.speed
 * @param {number} props.state.progress
 * @param {string} props.state.itemName
 * @param {string} props.state.totalProgress
 * @param {string} props.state.id
 * @param {number} props.ind
 */
function SenderView({ state, ind }) {
  const showBody = () => {
    if (state.state === STATE.WAITING)
      return (
        'Waiting to be accepted...'
      )
    if (state.state === STATE.SENDING)
      return (
        <>
          <div className={style.Element} title={state.itemName}>
            <span>{state.itemName}</span>
          </div>
          <div className={style.Element}>
            <progress value={state.progress} max={100}></progress>
            {`${printSize(state.speed)}/S`}
          </div>
          <div className={style.Element}>
            {state.totalProgress}
          </div>
        </>
      )
    if (state.state === STATE.COMPLETE)
      return (
        <>
          <div className={style.Element}>
            Sending has been complete.
          </div>
        </>
      )
    if (state.state === STATE.MY_END)
      return (
        <>
          <div className={style.Element}>
            Sending has been canceled.
          </div>
        </>
      )
    if (state.state === STATE.OTHER_END)
      return (
        <>
          <div className={style.Element}>
            {state.id} has canceled receiving.
          </div>
        </>
      )
  }

  const showFoot = () => {
    if (state.state === STATE.WAITING)
      return (
        <button className={style.Neg}
          onClick={() => {
            ipcRenderer.endSender(ind);
          }}
        >CANCEL</button>
      )
    if (state.state === STATE.SENDING)
      return (
        <>
          <button className={style.Neg}
            onClick={() => {
              ipcRenderer.endSender(ind);
            }}
          >CANCEL</button>
        </>
      )
    if (state.state === STATE.COMPLETE)
      return (
        <button className={style.Pos}
          onClick={() => {
            ipcRenderer.deleteSender(ind);
          }}
        >OK</button>
      )
    if (state.state === STATE.MY_END)
      return (
        <button className={style.Pos}
          onClick={() => {
            ipcRenderer.deleteSender(ind);
          }}
        >OK</button>
      )
    if (state.state === STATE.OTHER_END)
      return (
        <button className={style.Pos}
          onClick={() => {
            ipcRenderer.deleteSender(ind);
          }}
        >OK</button>
      )
  }

  return (
    <div className={style.JobView}>
      <div className={style.Head}>
        Sending to {state.id}
      </div>
      <div className={style.Body}>
        {showBody()}
      </div>
      <div className={style.Foot}>
        {showFoot()}
      </div>
    </div >
  );
}

export default SenderView;