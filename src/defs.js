const PORT = 9238;
const CHUNKSIZE = 2097152;
const HEADER_END = '\n\n';
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
  RQR_MY_CANCEL: "RQR_MY_CANCEL",

  // For Requestee
  RQE_SEND_REQUEST: "RQE_SEND_REQUEST",
  RQE_RECV_REQUEST: "RQE_RECV_REQUEST",
  RQE_SEND_REJECT: "RQE_SEND_REJECT",
  RQE_RECV_REJECT: "RQE_RECV_REJECT",
  RQE_CANCEL: "RQE_CANCEL",

  // For Receiver and Sender
  WAITING: "WAITING", // Deprecated it.
  MY_STOP: "MY_STOP",
  MY_END: "MY_END",
  OTHER_STOP: "OTHER_STOP",
  OTHER_END: "OTHER_END",
  MY_REJECT: "MY_REJECT",

  // For Sender
  SENDING: "SENDING",
  SENDER_PAUSE: "SENDER_PAUSE", // Will be deprecated
  SEND_COMPLETE: "SEND_COMPLETE",

  // For Receiver
  RECVING: "RECVING",
  RECVER_PAUSE: "RECVER_PAUSE", // Will be deprecated
  RECV_COMPLETE: "RECV_COMPLETE",
};
const OS = require('os').platform();
const { version: VERSION } = require('../package.json');
const SCANTIMEOUT = 3000;
const MAX_NUM_JOBS = 2;
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
module.exports = { PORT, CHUNKSIZE, HEADER_END, STATE, OS, VERSION, SCANTIMEOUT, MAX_NUM_JOBS, printSize };