const { PORT, OS, STATE, MAX_NUM_JOBS } = require('../defs');
const { HEADER_END, splitHeader, MAX_HEADER_LEN, createItemArray } = require('./Common');
const net = require('net');
const Sender = require('./Sender');
const Requester = require('./Requester');

class Client {
  constructor() {
    /** @type {string} */
    this.myId = '';
    /** @type {Object.<number, (Sender|Requester)>} */
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
   * Request to send to opponent Server.
   * NOTE that it does not embed itemArray.
   * @param {Object.<string, {dir:string, path:string, type:string, size:number}>} items
   * @param {string} receiverIp 
   * @param {string} receiverId 
   * @returns {boolean} Index value of the Sender or false.
   */
  sendRequest(items, receiverIp, receiverId) {
    if (Object.keys(this.jobs).length >= MAX_NUM_JOBS)
      return false;
    /** @type {Buffer} */
    let _recvBuf = Buffer.from([]);
    const ind = ++this._nextInd;
    const socket = net.createConnection(PORT, receiverIp);

    this.jobs[ind] = new Sender(STATE.SEND_REQUEST, receiverId);

    socket.once('connect', async () => {
      console.log('sendRequest: connected to ' + this._socket.remoteAddress);
      const sendRequestHeader = this._createSendRequestHeader(items);
      socket.write(JSON.stringify(sendRequestHeader) + HEADER_END, 'utf-8', this._onWriteError);
    });

    socket.on('data', async (data) => {
      let recvHeader = null;
      _recvBuf = Buffer.concat([_recvBuf, data]);
      const ret = splitHeader(_recvBuf);
      if (!ret) {
        if (_recvBuf.length > MAX_HEADER_LEN) {
          // Abort this suspicious connection.
          socket.destroy();
          this._handleNetworkErr(ind)
        }
        // Has not received header yet. just exit the function here for more data by return.
        return;
      }
      try {
        recvHeader = JSON.parse(ret.header);
      } catch (err) {
        // HEADER_END is met but is not JSON format.
        // Abort this suspicious connection.
        socket.destroy();
        this._handleNetworkErr(ind);
        return;
      }
      switch (recvHeader.class) {
        case 'ok':
          this.jobs[ind] = new Sender(socket, createItemArray(items));
          break;
        case 'no':
          this.jobs[ind].setState(STATE.SEND_REJECTED);
          break;
      }
    });

    socket.on('error', (err) => {
      if (err) {
        socket.destroy();
        this._handleNetworkErr(ind);
      }
    });

    return ind;
  }

  /**
   * Create and return send request header.
   * Return null on Any Error.
   * @returns {{app:string, version: string, class: string, id: string}}
   */
  _createSendRequestHeader() {
    let header = { app: 'SendDone', version: VERSION, class: 'send-request', id: this._myId };
    return header;
  }
  /**
   * request to receive to opponent Server.
   * @param {string} receiverIp 
   * @param {string} receiverId 
   * @returns {boolean} Index value of the Sender or false.
   */
  recvRequest(senderIp, senderId) {
    if (Object.keys(this.jobs).length >= MAX_NUM_JOBS)
      return false;
    const ind = ++this._nextInd;

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

  _onWriteError = (err) => {
    if (err) {
      console.error('Sender: Error Occurred during writing to Socket.');
      console.error(err);
      this._socket.destroy();
      this._state = STATE.ERR_NETWORK;
    }
  }
  /**
   * Handle network error on Requester.
   */
  _handleNetworkErr(ind) {
    if (this.jobs[ind])
      this.jobs[ind] = STATE.ERR_NETWORK;
  }
}

module.exports = Client;