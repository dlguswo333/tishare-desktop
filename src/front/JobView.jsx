import React, { useState } from 'react';
import * as DEFS from '../defs';
import style from './style/JobView.module.scss';
const ipcRenderer = window.ipcRenderer;

const { STATE, printSize } = DEFS.default;

/**
 * @param {object} props
 * @param {object} props.state
 * @param {string} props.state.state
 * @param {string} props.state.speed
 * @param {string} props.state.progress
 * @param {string} props.state.totalProgress
 * @param {string} props.state.id
 * @param {number} props.ind
 * @param {object} props.items
 */
function JobView({ state, ind, items }) {
  const [recvDir, setRecvDir] = useState(localStorage.getItem('recvDir'));

  const showHead = () => {
    switch (state.state) {
      case STATE.RQE_SEND_REQUEST:
        return <>
          <span className={style.Title}>Send Request</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.RQE_RECV_REQUEST:
        return <>
          <span className={style.Title}>Receive Request</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.RQE_CANCEL:
        return <>
          <span className={style.Title}>Request Cancelled</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.RQR_SEND_REQUEST:
      case STATE.RQR_RECV_REQUEST:
        return <>
          <span className={style.Title}>Waiting</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.RQR_SEND_REJECT:
      case STATE.RQR_RECV_REJECT:
        return <>
          <span className={style.Title}>Request Rejected</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.RQR_PRE_RECV_REQUEST:
        return <>
          <span className={style.Title}>Select Receive Path</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.OTHER_END:
        return <>
          <span className={style.Title}>Process Cancelled</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.SENDING:
        return <>
          <span className={style.Title}>Sending</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.RECVING:
        return <>
          <span className={style.Title}>Receiving</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.SEND_COMPLETE:
        return <>
          <span className={style.Title}>Send Complete</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.RECV_COMPLETE:
        return <>
          <span className={style.Title}>Receive Complete</span>
          <span className={style.Id}>{state.id}</span>
        </>
      case STATE.ERR_NETWORK:
      case STATE.ERR_FILE_SYSTEM:
        return <>
          <span className={style.Title}>Error</span>
          <span className={style.Id}>{state.id}</span>
        </>
      default:
        return null
    }
  }

  const showBody = () => {
    switch (state.state) {
      case STATE.RQE_SEND_REQUEST:
        return (
          <>
            <div className={style.Element}>
              {`Opponent wants to send files to you.`}
            </div>
            <div className={style.Element}>
              {`📁`}
              <input type='text'
                readOnly
                value={recvDir}
              />
              <button
                onClick={async () => {
                  const ret = await ipcRenderer.setRecvDir();
                  if (ret)
                    setRecvDir(ret);
                }}
              >Find</button>
            </div>
          </>
        )
      case STATE.RQE_RECV_REQUEST:
        return (
          <>
            <div className={style.Element}>
              {`Opponent wants to receive files from you.`}
            </div>
          </>
        )
      case STATE.RQE_CANCEL:
        return (
          <>
            <div className={style.Element}>
              {`Opponent cancelled the request.`}
            </div>
          </>
        )
      case STATE.RQR_SEND_REQUEST:
      case STATE.RQR_RECV_REQUEST:
        return (
          <>
            <div className={style.Element}>
              {`Waiting for the opponent to accept...`}
            </div>
          </>
        )
      case STATE.RQR_SEND_REJECT:
      case STATE.RQR_RECV_REJECT:
        return (
          <>
            <div className={style.Element}>
              {`Opponent rejected your request.`}
            </div>
          </>
        )
      case STATE.RQR_PRE_RECV_REQUEST:
        return (
          <>
            <div className={style.Element}>
              {`📁`}
              <input type='text'
                readOnly
                value={recvDir}
              />
              <button
                onClick={async () => {
                  const ret = await ipcRenderer.setRecvDir();
                  if (ret)
                    setRecvDir(ret);
                }}
              >Find</button>
            </div>
          </>
        )
      case STATE.OTHER_END:
        return (
          <>
            <div className={style.Element}>
              {`Opponent cancelled the process.`}
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
              {`Sending has been completed.`}
            </div>
          </>
        )
      case STATE.RECV_COMPLETE:
        return (
          <>
            <div className={style.Element}>
              {`Receiving has been completed.`}
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
      case STATE.RQE_SEND_REQUEST:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.rejectRequest(ind);
              }}
            >REJECT</button>
            <button className={style.Pos}
              onClick={() => {
                if (!recvDir) {
                  // Prevent receiving if recvDir is empty.
                  ipcRenderer.showMessage('Set your receive directory.');
                  return;
                }
                ipcRenderer.acceptSendRequest(ind, recvDir);
              }}
            >ACCEPT</button>
          </>
        )
      case STATE.RQE_RECV_REQUEST:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.rejectRequest(ind);
              }}
            >REJECT</button>
            <button className={style.Pos}
              onClick={() => {
                ipcRenderer.acceptRecvRequest(ind, items);
              }}
            >ACCEPT</button>
          </>
        )
      case STATE.RQE_CANCEL:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.deleteJob(ind);
              }}
            >OK</button>
          </>
        )
      case STATE.RQR_SEND_REQUEST:
      case STATE.RQR_RECV_REQUEST:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.endJob(ind);
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
                ipcRenderer.deleteJob(ind);
              }}
            >OK</button>
          </>
        )
      case STATE.RQR_PRE_RECV_REQUEST:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.endJob(ind);
              }}
            >CANCEL</button>
            <button className={style.Pos}
              onClick={() => {
                if (!recvDir) {
                  // Prevent receiving if recvDir is empty.
                  ipcRenderer.showMessage('Set your receive directory.');
                  return;
                }
                ipcRenderer.recvRequest(ind, recvDir);
              }}
            >OK</button>
          </>
        )
      case STATE.OTHER_END:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.deleteJob(ind);
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
                ipcRenderer.endJob(ind);
              }}
            >CANCEL</button>
          </>
        )
      case STATE.SEND_COMPLETE:
      case STATE.RECV_COMPLETE:
        return (
          <>
            <button className={style.Pos}
              onClick={() => {
                ipcRenderer.deleteJob(ind);
              }}
            >OK</button>
          </>
        )
      case STATE.ERR_NETWORK:
      case STATE.ERR_FILE_SYSTEM:
        return (
          <>
            <button className={style.Neg}
              onClick={() => {
                ipcRenderer.deleteJob(ind);
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

export default JobView;
