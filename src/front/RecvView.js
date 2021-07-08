import React, { useState } from 'react';
import { STATE, printSize } from '../defs';
import style from './style/JobView.module.scss';
const ipcRenderer = window.ipcRenderer;

/**
 * @param {object} props 
 * @param {object} props.state
 * @param {string} props.state.state
 * @param {string} props.state.speed
 * @param {string} props.state.progress
 * @param {string} props.state.totalProgress
 * @param {string} props.state.id
 * @param {number} props.ind
 */
function RecvView({ state, ind }) {
  const [recvDir, setRecvDir] = useState(localStorage.getItem('recvDir'));

  const showBody = () => {
    if (state.state === STATE.WAITING)
      return (
        <>
          <div className={style.Element}>
            {`${state.id} wants to send you files.`}
          </div>
          <div className={style.Element}>
            {`📁`}
            <input type='text'
              readOnly
              value={recvDir}
            />
            <button
              onClick={async () => {
                const ret = await window.ipcRenderer.setRecvDir();
                if (ret)
                  setRecvDir(ret);
              }}
            >Find</button>
          </div>
        </>
      )
    if (state.state === STATE.RECVING)
      return (
        <>
          <div className={style.Element} title={state.itemName}>
            <span>{state.itemName}</span>
          </div>
          <div className={style.Element}>
            <progress value={state.progress} max={100}></progress>
          </div>
          <div className={style.Element}>
            <span className={style.Left}>{state.totalProgress}</span>
            <span className={style.Right}>{`${printSize(state.speed)}/S`}</span>
          </div>
        </>
      )
    if (state.state === STATE.COMPLETE)
      return (
        <>
          <div className={style.Element}>
            Receiving has been complete.
          </div>
        </>
      )
    if (state.state === STATE.MY_END)
      return (
        <>
          <div className={style.Element}>
            Receiving has been canceled.
          </div>
        </>
      )
    if (state.state === STATE.OTHER_END)
      return (
        <>
          <div className={style.Element}>
            {state.id} has canceled sending.
          </div>
        </>
      )
    if (state.state === STATE.ERR_FILE_SYSTEM)
      return (
        <>
          <div className={style.Element}>
            File System Error
          </div>
        </>
      )
    if (state.state === STATE.ERR_NETWORK)
      return (
        <>
          <div className={style.Element}>
            Network Error
          </div>
        </>
      )
    if (state.state === STATE.MY_REJECT)
      return (
        <>
          <div className={style.Element}>
            Successfully Rejected.
          </div>
        </>
      )
  }

  const showFoot = () => {
    if (state.state === STATE.WAITING)
      return (
        <>
          <button className={style.Neg}
            onClick={() => {
              ipcRenderer.rejectSend(ind);
            }}
          >REJECT</button>
          <button className={style.Pos}
            onClick={() => {
              if (!recvDir) {
                // Prevent receiving if recvDir is empty.
                ipcRenderer.showMessage('Set your receive directory.');
                return;
              }
              ipcRenderer.acceptSend(ind, recvDir);
            }}
          >ACCEPT</button>
        </>
      )
    if (state.state === STATE.RECVING)
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
            ipcRenderer.deleteRecver(ind);
          }}
        >OK</button>
      )
    if (state.state === STATE.MY_END)
      return (
        <button className={style.Pos}
          onClick={() => {
            ipcRenderer.deleteRecver(ind);
          }}
        >OK</button>
      )
    if (state.state === STATE.OTHER_END)
      return (
        <button className={style.Pos}
          onClick={() => {
            ipcRenderer.deleteRecver(ind);
          }}
        >OK</button>
      )
    if (state.state === STATE.ERR_FILE_SYSTEM)
      return (
        <>
          <button className={style.Neg}
            onClick={() => {
              ipcRenderer.deleteRecver(ind);
            }}
          >OK</button>
        </>
      )
    if (state.state === STATE.ERR_NETWORK)
      return (
        <>
          <button className={style.Neg}
            onClick={() => {
              ipcRenderer.deleteRecver(ind);
            }}
          >OK</button>
        </>
      )
    if (state.state === STATE.MY_REJECT)
      return (
        <>
          <button className={style.Neg}
            onClick={() => {
              ipcRenderer.deleteRecver(ind);
            }}
          >OK</button>
        </>
      )
  }

  return (
    <div className={style.JobView + ' ' + style.RecvView}>
      <div className={style.Head}>
        Receiving from {state.id}
      </div>
      <div className={style.Body}>
        {showBody()}
      </div>
      <div className={style.Foot}>
        {showFoot()}
      </div>
    </div>
  );
}

export default RecvView;