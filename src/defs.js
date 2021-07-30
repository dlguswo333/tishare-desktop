const PORT = 9238;
const CHUNKSIZE = 2097152;
const STATE = {
  // For Server, Client, Sender and Receiver
  ERR_FILE_SYSTEM: "ERR_FILE_SYSTEM",
  ERR_NETWORK: "ERR_NETWORK",
  ERR_ID: "ERR_ID",
  ERR_IP: "ERR_IP",

  // For Server and Client
  // NOTE Maybe we don't need these at all.
  INITING: "INITING",
  IDLE: "IDLE",

  // For Requester
  RQR_SEND_REQUEST: "RQR_SEND_REQUEST",
  RQR_RECV_REQUEST: "RQR_RECV_REQUEST",
  RQR_SEND_REJECT: "RQR_SEND_REJECT",
  RQR_RECV_REJECT: "RQR_RECV_REJECT",
  RQR_PRE_RECV_REQUEST: "RQR_PRE_RECV_REQUEST",

  // For Requestee
  RQE_SEND_REQUEST: "RQE_SEND_REQUEST",
  RQE_RECV_REQUEST: "RQE_RECV_REQUEST",
  RQE_CANCEL: "RQE_CANCEL",

  // For Receiver and Sender
  OTHER_END: "OTHER_END",

  // For Sender
  SENDING: "SENDING",
  SEND_COMPLETE: "SEND_COMPLETE",

  // For Receiver
  RECVING: "RECVING",
  RECV_COMPLETE: "RECV_COMPLETE",
};
const OS = require('os').platform();
const { version: VERSION } = require('../package.json');
const SCANTIMEOUT = 3000;
const MAX_NUM_JOBS = 4;
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
}
module.exports = { PORT, CHUNKSIZE, STATE, OS, VERSION, SCANTIMEOUT, MAX_NUM_JOBS, printSize };