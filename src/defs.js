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

  // For Receiver and Sender
  WAITING: "WAITING",
  MY_STOP: "MY_STOP",
  MY_END: "MY_END",
  OTHER_STOP: "OTHER_STOP",
  OTHER_END: "OTHER_END",
  COMPLETE: "COMPLETE",

  // For Receiver and Sender
  SENDING: "SENDING",
  SEND_REJECT: "SEND_REJECT",
  SEND_WAIT: "SEND_WAIT", // Will be deprecated
  SEND_COMPLETE: "SEND_COMPLETE", // Will be deprecated
  SENDER_PAUSE: "SENDER_PAUSE", // Will be deprecated
  SENDER_END: "SENDER_END", // Will be deprecated

  // For Receiver
  RECVING: "RECVING",
  RECV_WAIT: "RECV_WAIT", // Will be deprecated
  RECV_COMPLETE: "RECV_COMPLETE", // Will be deprecated
  RECVER_PAUSE: "RECVER_PAUSE", // Will be deprecated
  RECVER_END: "RECVER_END" // Will be deprecated
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