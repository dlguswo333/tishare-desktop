const { PORT, VERSION, STATE, MAX_NUM_JOBS } = require('../defs');
const { HEADER_END, splitHeader, MAX_HEADER_LEN, createItemArray } = require('./Common');
const net = require('net');
const Sender = require('./Sender');
const Requester = require('./Requester');
const Receiver = require('./Receiver');

class Client {
  constructor() {
    /** @type {string} */
    this._myId = '';
    /** @type {Object.<number, (Sender|Receiver|Requester)>} */
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
      this._myId = id;
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
    const ind = this._getNextInd();
    const socket = net.createConnection(PORT, receiverIp);

    this.jobs[ind] = new Requester(STATE.RQR_SEND_REQUEST, socket, receiverId);

    socket.once('connect', async () => {
      console.log('sendRequest: connected to ' + socket.remoteAddress);
      const requestHeader = this._createSendRequestHeader();
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
          this.jobs[ind] = new Sender(socket, receiverId, createItemArray(items));
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

    socket.on('close', (err) => {
      if (err || this.jobs[ind].getState() !== STATE.RQR_SEND_REJECT) {
        socket.destroy();
        this._handleNetworkErr(ind);
      }
      socket.end();
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
   * request to receive from opponent Server.
   * @param {string} senderIp 
   * @param {string} senderId 
   * @returns {boolean} Index value of the Sender or false.
   */
  recvRequest(senderIp, senderId) {
    if (Object.keys(this.jobs).length >= MAX_NUM_JOBS)
      return false;
    /** @type {Buffer} */
    let _recvBuf = Buffer.from([]);
    const ind = this._getNextInd();
    const socket = net.createConnection(PORT, senderIp);

    this.jobs[ind] = new Requester(STATE.RQR_RECV_REQUEST, socket, senderId);

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
          this.jobs[ind] = new Receiver(socket);
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
  }

  /**
   * Create and return send request header.
   * @returns {{app:string, version: string, class: string, id: string}}
   */
  _createSendRequestHeader() {
    let header = { app: 'tiShare', version: VERSION, class: 'send-request', id: this._myId };
    return header;
  }

  /**
   * Create and return recv request header.
   * @returns {{app:string, version: string, class: string, id: string}}
   */
  _createRecvRequestHeader() {
    let header = { app: 'tiShare', version: VERSION, class: 'recv-request', id: this._myId };
    return header;
  }

  /**
   * End sending.
   * Call this while the state is 'WAITING', 'SENDING'.
   * @param {number} ind 
   * @returns {boolean} Whether the execution has been successful.
   */
  endJob(ind) {
    if (this.jobs[ind]) {
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
  deleteJob(ind) {
    if (this.jobs[ind]) {
      delete this.jobs[ind];
      return true;
    }
    return false;
  }

  _getNextInd() {
    return (this._nextInd)++;
  }

  /**
   * Handle network error on Requester.
   */
  _handleNetworkErr(ind) {
    if (this.jobs[ind]) {
      this.jobs[ind]._socket.destroy();
      this.jobs[ind].setState(STATE.ERR_NETWORK);
    }
  }
}

module.exports = Client;
