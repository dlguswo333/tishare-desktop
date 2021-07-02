const { PORT, OS, STATE, MAX_NUM_JOBS } = require('../defs');
const { Sender } = require('./Sender');

class Client {
  constructor() {
    /** @type {string} */
    this.myId = '';
    /** @type {Object.<number, Sender>} */
    this.jobs = {};
    /** @type {number} */
    this._nextInd = 1;
  }

  /**
   * Set Client's ID.
   * @param {string} id
   * @returns {boolean} The result of the execution. 
   */
  setMyId(id) {
    if (id) {
      this.myId = id;
      return true;
    }
    return false;
  }

  /**
   * Return State of Senders or a Sender with the index.
   * @param {number} ind 
   */
  getState(ind) {
    if (ind === undefined) {
      let ret = {};
      for (const sender in this.jobs) {
        ret[sender] = this.jobs[sender].getState();
      }
      return ret;
    }
    if (this.jobs[ind]) {
      return this.jobs[ind].getState();
    }
    return undefined;
  }
  /**
   * Create a Sender.
   * @param {Object.<string, {dir:string, path:string, type:string, size:number}>} items
   * @param {string} receiverIp 
   * @param {string} receiverId 
   * @returns {boolean} Index value of the Sender or false.
   */
  send(items, receiverIp, receiverId) {
    if (Object.keys(this.jobs).length >= MAX_NUM_JOBS)
      return false;
    const ind = ++this._nextInd;
    const sender = new Sender(this.myId);
    this.jobs[ind] = sender;
    sender.send(items, receiverIp, receiverId);
    return ind;
  }
  /**
   * End sending.
   * Call this while the state is 'WAITING', 'SENDING'.
   * @param {number} ind 
   * @returns {boolean} Whether the execution has been successful.
   */
  endSender(ind) {
    if (this.jobs[ind]) {
      return this.jobs[ind].end();
    }
    return false;
  }

  /**
   * Delete a Sender from jobs.
   * @param {number} ind 
   * @returns {boolean} Whether the execution has been successful.
   */
  deleteSender(ind) {
    if (this.jobs[ind]) {
      delete this.jobs[ind];
      return true;
    }
    return false;
  }
}

module.exports = Client;