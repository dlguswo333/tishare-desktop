// import attributes 'with' works over chromium 123 and node 20.10.0 .
// So with electron 33 this should be fine, but eslint still does not understand it.
// https://github.com/eslint/eslint/issues/19014
import packageJson from '../package.json' with {type: 'json'};
const PORT = 9238;
const CHUNKSIZE = 2097152;
const {version: VERSION} = packageJson;
const SCANTIMEOUT = 3000;
const SOCKET_TIMEOUT = 5000;
const STATE_INTERVAL = 1000;
const MAX_NUM_JOBS = 4;
/** Each member should is lower case string for simplicity. */
const WELL_KNOWN_IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'jfif', 'png', 'webp', 'bmp', 'gif', 'svg', 'apng', 'avif'];
const STATE = {
  // For Server, Client, Sender and Receiver
  ERR_FILE_SYSTEM: 'ERR_FILE_SYSTEM',
  ERR_NETWORK: 'ERR_NETWORK',
  ERR_ID: 'ERR_ID',
  ERR_IP: 'ERR_IP',

  // For Server and Client
  // NOTE Maybe we don't need these at all.
  INITING: 'INITING',
  IDLE: 'IDLE',

  // For Requester
  RQR_SEND_REQUEST: 'RQR_SEND_REQUEST',
  RQR_RECV_REQUEST: 'RQR_RECV_REQUEST',
  RQR_SEND_REJECT: 'RQR_SEND_REJECT',
  RQR_RECV_REJECT: 'RQR_RECV_REJECT',
  RQR_PRE_RECV_REQUEST: 'RQR_PRE_RECV_REQUEST',

  // For Requestee
  RQE_SEND_REQUEST: 'RQE_SEND_REQUEST',
  RQE_RECV_REQUEST: 'RQE_RECV_REQUEST',
  RQE_CANCEL: 'RQE_CANCEL',

  // For Receiver and Sender
  OTHER_END: 'OTHER_END',

  // For Sender
  SENDING: 'SENDING',
  SEND_COMPLETE: 'SEND_COMPLETE',

  // For Receiver
  RECVING: 'RECVING',
  RECV_COMPLETE: 'RECV_COMPLETE',
};

/**
 * Print file size in pretty.
 * @param {number} size
 * @returns {string}
 */
const printSize = (size) => {
  if (size >= 1024) {
    size /= 1024;
    if (size >= 1024) {
      size /= 1024;
      if (size >= 1024) {
        size /= 1024;
        return size.toFixed(2) + ' GB';
      }
      return size.toFixed(2) + ' MB';
    }
    return size.toFixed(2) + ' KB';
  }
  return size.toFixed(2) + ' B';
};

export {PORT, CHUNKSIZE, STATE, VERSION, SCANTIMEOUT, SOCKET_TIMEOUT, STATE_INTERVAL, MAX_NUM_JOBS, printSize, WELL_KNOWN_IMAGE_EXTENSIONS};
