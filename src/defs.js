const PORT = 9238;
const CHUNKSIZE = 2097152;
const HEADER_END = '\n\n';
const STATE = {
  ERR_FILE_SYSTEM: "ERR_FILE_SYSTEM",
  ERR_NETWORK: "ERR_NETWORK",
  ERR_ID: "ERR_ID",
  ERR_IP: "ERR_IP",
  INITING: "INITING",
  IDLE: "IDLE",

  SEND_WAIT: "SEND_WAIT",
  SEND: "SEND",
  SEND_REJECT: "SEND_REJECT",
  SEND_COMPLETE: "SEND_COMPLETE",
  SENDER_PAUSE: "SENDER_PAUSE",
  SENDER_END: "SENDER_END",

  RECV_WAIT: "RECV_WAIT",
  RECV: "RECV",
  RECV_COMPLETE: "RECV_COMPLETE",
  RECVER_PAUSE: "RECVER_PAUSE",
  RECVER_END: "RECVER_END"
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
  return size + ' B';
}
module.exports = { PORT, CHUNKSIZE, HEADER_END, STATE, OS, VERSION, SCANTIMEOUT, MAX_NUM_JOBS, printSize };