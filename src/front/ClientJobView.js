import React from 'react';
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
function ClientJobView({ state, ind }) {
  const showHead = () => {
    switch (state.state) {
      case STATE.RQR_SEND_REQUEST:
      case STATE.RQR_RECV_REQUEST:
        return `Waiting`
      case STATE.RQR_SEND_REJECT:
      case STATE.RQR_RECV_REJECT:
        return `Request Rejected`
      case STATE.RQR_CANCEL:
        return `Request Cancelled`
      case STATE.MY_END:
      case STATE.OTHER_END:
        return `Process Cancelled`
      case STATE.SENDING:
        return `Sending To ${state.id}`
      case STATE.RECVING:
        return `Receiving From ${state.id}`
      case STATE.SEND_COMPLETE:
        return `Send Complete`
      case STATE.RECV_COMPLETE:
        return `Receive Complete`
      case STATE.ERR_NETWORK:
      case STATE.ERR_FILE_SYSTEM:
        return `Error`
      default:
        return null
    }
  }

  const showBody = () => {
    switch (state.state) {
      case STATE.RQR_SEND_REQUEST:
      case STATE.RQR_RECV_REQUEST:
        return (
          <>
            <div className={style.Element}>
              {`Waiting for ${state.id}...`}
            </div>
          </>
        )
      case STATE.RQR_SEND_REJECT:
      case STATE.RQR_RECV_REJECT:
        return (
          <>
            <div className={style.Element}>
              {`${state.id} rejected your request.`}
            </div>
          </>
        )
      case STATE.RQR_CANCEL:
        return (
          <>
            <div className={style.Element}>
              {`You cancelled the request to ${state.id}`}
            </div>
          </>
        )
      case STATE.MY_END:
        return (
          <>
            <div className={style.Element}>
              {`You cancelled the process with ${state.id}.`}
            </div>
          </>
        )
      case STATE.OTHER_END:
        return (
          <>
            <div className={style.Element}>
              {`${state.id} cancelled the process.`}
            </div>
          </>
        )
      case STATE.SENDING:
      case STATE.RECVING:
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
      case STATE.SEND_COMPLETE:
        return (
          <>
            <div className={style.Element}>
              {`Sending to ${state.id} has been completed.`}
            </div>
          </>
        )
      case STATE.RECV_COMPLETE:
        return (
          <>
            <div className={style.Element}>
              {`Receiving from ${state.id} has been completed.`}
            </div>
          </>
        )
      case STATE.ERR_FILE_SYSTEM:
        return (
          <>
            <div className={style.Element}>
              Network Error
            </div>
          </>
        )
      case STATE.ERR_NETWORK:
        return (
          <>
            <div className={style.Element}>
              Network Error
            </div>
          </>
        )
      default:
        return null;
    }
  }

  const showFoot = () => {
    switch (state.state) {
      case STATE.RQR_SEND_REQUEST:
      case STATE.RQR_RECV_REQUEST:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.endClientJob(ind);
              }}
            >CANCEL</button>
          </>
        )
      case STATE.RQR_SEND_REJECT:
      case STATE.RQR_RECV_REJECT:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.deleteClientJob(ind);
              }}
            >OK</button>
          </>
        )
      case STATE.RQR_CANCEL:
        return (
          <>
            <button className={style.Pos}
              onClick={() => {
                ipcRenderer.deleteClientJob(ind);
              }}
            >OK</button>
          </>
        )
      case STATE.MY_END:
      case STATE.OTHER_END:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.deleteClientJob(ind);
              }}
            >OK</button>
          </>
        )
      case STATE.SENDING:
      case STATE.RECVING:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.endClientJob(ind);
              }}
            >OK</button>
          </>
        )
      case STATE.SEND_COMPLETE:
      case STATE.RECV_COMPLETE:
      case STATE.ERR_NETWORK:
      case STATE.ERR_FILE_SYSTEM:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.deleteClientJob(ind);
              }}
            >OK</button>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className={style.JobView + ' ' + style.JobView}>
      <div className={style.Head}>
        {showHead()}
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

export default ClientJobView;