const {PORT, VERSION, STATE} = require('../defs');
const {HEADER_END, splitHeader, MAX_HEADER_LEN, createItemArray} = require('./Common');
const net = require('net');
const Sender = require('./Sender');
const Requester = require('./Requester');
const Receiver = require('./Receiver');

class Client {
  /**
   * @param {import('./Indexer')} indexer
   * @param {Function} sendState
   */
  constructor (indexer, sendState) {
    /** @type {import('./Indexer')} */
    this._indexer = indexer;
    /** @type {Function} */
    this._sendState = sendState;
    /** @type {string} */
    this._myId = '';
    /** @type {Object.<number, (Sender|Receiver|Requester)>} */
    this.jobs = {};
    /** @type {number} */
    this._nextInd = 1;
    this.deleteJob = this.deleteJob.bind(this);
  }

  /**
   * Set Client's ID.
   * @param {string} id
   * @returns {boolean} The result of the execution.
   */
  setMyId (id) {
    if (id) {
      this._myId = id;
      return true;
    }
    return false;
  }

  /**
   * Return State of Senders or a Sender with the index.
   * @param {number} ind
   */
  getState (ind) {
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
   * @returns {Promise.<number|boolean>} Index value of the Sender or false.
   */
  async sendRequest (items, receiverIp, receiverId) {
    const ind = this._getNextInd();
    if (!this._myId || ind < 0)
      return false;
    /** @type {Buffser} */
    let _recvBuf = Buffer.from([]);
    const itemArray = await createItemArray(items);
    const socket = net.createConnection(PORT, receiverIp);

    this.jobs[ind] = new Requester(ind, STATE.RQR_SEND_REQUEST, socket, receiverId, this._sendState);

    socket.once('connect', async () => {
      console.log('sendRequest: connected to ' + socket.remoteAddress);
      const requestHeader = this._createSendRequestHeader(itemArray.length);
      socket.write(JSON.stringify(requestHeader) + HEADER_END, 'utf-8', (err) => { if (err) this._handleNetworkErr(ind); });
    });

    socket.on('data', async (data) => {
      let recvHeader = null;
      _recvBuf = Buffer.concat([_recvBuf, data]);
      const ret = splitHeader(_recvBuf);
      if (!ret) {
        if (_recvBuf.length > MAX_HEADER_LEN) {
          // Abort this suspicious connection.
          this._handleNetworkErr(ind);
        }
        // Has not received header yet. just exit the function here for more data by return.
        return;
      }
      try {
        recvHeader = JSON.parse(ret.header);
      } catch (err) {
        // HEADER_END is met but is not JSON format.
        // Abort this suspicious connection.
        this._handleNetworkErr(ind);
        return;
      }
      switch (recvHeader.class) {
      case 'ok':
        // Transform Requester into Sender.
        this.jobs[ind] = new Sender(ind, socket, receiverId, itemArray, this.deleteJob, this._sendState);
        this.jobs[ind].send();
        break;
      case 'no':
        this.jobs[ind].setState(STATE.RQR_SEND_REJECT);
        socket.end();
        break;
      default:
        this._handleNetworkErr(ind);
      }
    });

    socket.on('close', () => {
      if (this.jobs[ind]) {
        const state = this.jobs[ind].getState().state;
        if (state === STATE.RQR_SEND_REJECT || this.jobs[ind].getHaveWrittenEndFlag()) {
          if (this.jobs[ind].getHaveWrittenEndFlag())
            this.deleteJob(ind);
          return;
        }
      }
      this._handleNetworkErr(ind);
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
   * Prepare to request to receive from the opponent.
   * @param {number} ind
   * @returns {boolean}
   */
  preRecvRequest (senderIp, senderId) {
    const ind = this._getNextInd();
    if (!this._myId || ind < 0)
      return false;
    this.jobs[ind] = new Requester(ind, STATE.RQR_PRE_RECV_REQUEST, senderIp, senderId, this._sendState);
  }

  /**
   * Send Receive request to receive from the opponent.
   * @param {number} ind
   * @param {string} recvDir
   * @returns {number|boolean} Index value of the Receiver or false.
   */
  recvRequest (ind, recvDir) {
    /** @type {Buffer} */
    let _recvBuf = Buffer.from([]);
    const senderIp = this.jobs[ind]._socket;
    const senderId = this.jobs[ind]._opponentId;
    const socket = net.createConnection(PORT, senderIp);

    this.jobs[ind] = new Requester(ind, STATE.RQR_RECV_REQUEST, socket, senderId, this._sendState);

    socket.once('connect', async () => {
      console.log('recvRequest: connected to ' + socket.remoteAddress);
      const requestHeader = this._createRecvRequestHeader();
      socket.write(JSON.stringify(requestHeader) + HEADER_END, 'utf-8', (err) => { if (err) this._handleNetworkErr(ind); });
    });

    socket.on('data', async (data) => {
      let recvHeader = null;
      _recvBuf = Buffer.concat([_recvBuf, data]);
      const ret = splitHeader(_recvBuf);
      if (!ret) {
        if (_recvBuf.length > MAX_HEADER_LEN) {
          // Abort this suspicious connection.
          this._handleNetworkErr(ind);
        }
        // Has not received header yet. just exit the function here for more data by return.
        return;
      }
      try {
        recvHeader = JSON.parse(ret.header);
      } catch (err) {
        // HEADER_END is met but is not JSON format.
        // Abort this suspicious connection.
        this._handleNetworkErr(ind);
        return;
      }
      switch (recvHeader.class) {
      case 'ok':
        // Transform Requester into Sender.
        this.jobs[ind] = new Receiver(ind, socket, senderId, recvDir, recvHeader.numItems, this.deleteJob, this._sendState);
        // Send ok header explictly to notify it is ready to receive.
        this.jobs[ind]._writeOnSocket();
        break;
      case 'no':
        this.jobs[ind].setState(STATE.RQR_RECV_REJECT);
        socket.end();
        break;
      default:
        this._handleNetworkErr(ind);
      }
    });

    socket.on('close', () => {
      const state = this.jobs[ind].getState().state;
      if (!(state === STATE.RQR_RECV_REJECT || this.jobs[ind].getHaveWrittenEndFlag())) {
        this._handleNetworkErr(ind);
      }
      else if (this.jobs[ind].getHaveWrittenEndFlag()) {
        this.deleteJob(ind);
      }
    });

    socket.on('error', (err) => {
      if (err) {
        socket.destroy();
        this._handleNetworkErr(ind);
      }
    });
  }

  /**
   * Create and return send request header.
   * @param {number} _numItems
   * @returns {{app:string, version: string, class: string, id: string}}
   */
  _createSendRequestHeader (_numItems) {
    let header = {app: 'tiShare', version: VERSION, class: 'send-request', id: this._myId, numItems: _numItems};
    return header;
  }

  /**
   * Create and return recv request header.
   * @returns {{app:string, version: string, class: string, id: string}}
   */
  _createRecvRequestHeader () {
    let header = {app: 'tiShare', version: VERSION, class: 'recv-request', id: this._myId};
    return header;
  }

  /**
   * End a job with the ind.
   * @param {number} ind
   * @returns {boolean} Whether the execution has been successful.
   */
  endJob (ind) {
    if (this.jobs[ind]) {
      if (this.jobs[ind].getState().state === STATE.RQR_PRE_RECV_REQUEST)
        this.deleteJob(ind);
      else
        this.jobs[ind].end();
      return true;
    }
    return false;
  }

  /**
   * Delete a Job from jobs.
   * This function must be preceded by endJob.
   * @param {number} ind
   * @returns {boolean} Whether the execution has been successful.
   */
  deleteJob (ind) {
    if (this.jobs[ind]) {
      delete this.jobs[ind];
      this._indexer.returnInd(ind);
      return true;
    }
    return false;
  }

  _getNextInd () {
    return this._indexer.getInd();
  }

  /**
   * Handle network error on Requester.
   */
  _handleNetworkErr (ind) {
    if (this.jobs[ind]) {
      this.jobs[ind]._socket.destroy();
      this.jobs[ind].setState(STATE.ERR_NETWORK);
    }
  }
}

module.exports = Client;
