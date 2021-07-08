const dgram = require('dgram');
const net = require('net');
const Requestee = require('./Requestee');
const Sender = require('./Sender');
const Receiver = require('./Receiver');
const { PORT, OS, VERSION, STATE, MAX_NUM_JOBS } = require('../defs');
const { splitHeader, HEADER_END } = require('./Common');

class Server {
  constructor() {
    this._state = STATE.IDLE;
    /** @type {string} */
    this.myId = '';
    /** @type {dgram.Socket} */
    this._scannee = null;
    /** @type {net.Server} */
    this._serverSocket = null;
    /** @type {Object.<number, (Receiver|Requestee)>} */
    this.jobs = {};
    /** @type {number} */
    this._nextInd = 1;
  }

  /**
   * Set Server's ID.
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
   * Open myself to the network.
   * @param {string} ip
   * @returns {boolean} The result of the execution.
   */
  open(ip) {
    if (!this.myId) {
      this._state = STATE.ERR_ID;
      return false;
    }
    if (!ip) {
      this._state = STATE.ERR_IP;
      return false;
    }
    this._initScannee(ip);
    if (this._serverSocket)
      return true;
    this._serverSocket = net.createServer();
    this._serverSocket.on('connection', (socket) => {
      if (Object.keys(this.jobs).length >= MAX_NUM_JOBS || this._state.startsWith('ERR')) {
        // Do not accept more than limit or Server is in error state.
        socket.destroy();
        return;
      }
      const ind = this._getNextInd();
      let _recvBuf = Buffer.from([]);
      socket.on('data', (data) => {
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
          // Abort and ignore this suspicious connection.
          this._handleNetworkErr(ind);
          return;
        }
        switch (recvHeader.class) {
          case 'send-request':
            if (!this._validateRequestHeader(recvHeader)) {
              // Abort and ignore this suspicious connection.
              this._handleNetworkErr(ind);
              return;
            }
            this.jobs[ind] = new Requestee(STATE.RQE_RECV_REQUEST, socket, recvHeader.id);
            break;
          case 'recv-request':
            if (!this._validateRequestHeader(recvHeader)) {
              // Abort and ignore this suspicious connection.
              this._handleNetworkErr(ind);
              return;
            }
            this.jobs[ind] = new Requestee(STATE.RQE_SEND_REQUEST, socket, recvHeader.id);
            break;
          case 'end':
            if (this.jobs[ind])
              this.jobs[ind].setState(STATE.RQE_CANCEL);
            socket.end();
          default:
            // Abort and ignore this suspicious connection.
            this._handleNetworkErr(ind);
        }
      });
    });

    this._serverSocket.on('error', (err) => {
      console.error(err.message);
      this._state = STATE.ERR_NETWORK;
      this.close();
    });

    this._serverSocket.listen(PORT, ip);
    this._state = STATE.IDLE;
    return true;
  }

  /**
   * Close myself in the network and also close the server sockets.
   * @returns {boolean} Always true.
   */
  close() {
    if (this._serverSocket) {
      this._serverSocket.close((err) => {
        if (err)
          console.error(err);
      });
      this._serverSocket = null;
    }
    if (this._scannee) {
      this._scannee.close();
      this._scannee = null;
    }
    return true;
  }

  /**
   * Return State of Receivers or a Receiver with the index.
   * @param {number} ind 
   */
  getState(ind) {
    if (ind === undefined) {
      let ret = {};
      for (const job in this.jobs) {
        ret[job] = this.jobs[job].getState();
      }
      return ret;
    }
    if (this.jobs[ind]) {
      return this.jobs[ind].getState();
    }
    return undefined;
  }

  /**
   * Initialize an udp socket which responds to scans.
   * @param {string} ip 
   */
  _initScannee(ip) {
    this._scannee = dgram.createSocket('udp4');
    this._scannee.bind(PORT, ip, () => {
      this._scannee.on('message', (msg, rinfo) => {
        let recvHeader = null;
        try {
          recvHeader = JSON.parse(msg.toString('utf-8'));
          if (!(recvHeader.version && recvHeader.id && recvHeader.os))
            throw new Error('header not valid');
        } catch {
          // Abort if parsing failed or header is not valid.
          return;
        }

        const sendHeader = {
          app: "tiShare",
          version: VERSION,
          class: "scan",
          id: this.myId,
          os: OS
        };
        this._scannee.send(JSON.stringify(sendHeader), rinfo.port, rinfo.address);
      });
    });
  }

  /**
   * Get whether Server is open.
   * @returns {boolean}
   */
  isOpen() {
    return this._serverSocket && this._serverSocket.listening;
  }

  _destoryScannee() {
    if (this._scannee) {
      this._scannee.close();
      this._scannee = null;
    }
  }

  _getNextInd() {
    return (this._nextInd)++;
  }

  _validateRequestHeader(header) {
    if (!header)
      return false;
    if (header.app !== 'tiShare')
      return false;
    if (header.version !== VERSION)
      return false;
    if (!header.id)
      return false;
    if (!(header.class === 'send-request' || header.class === 'recv-request'))
      return false;
    return true;
  }

  /**
   * Accept send request.
   * @param {number} ind 
   * @param {string} recvDir 
   */
  acceptSendRequest(ind, recvDir) {
    if (this.jobs[ind]) {
      const receiver = new Receiver(this.jobs[ind]._socket, this.jobs[ind]._opponentId, recvDir);
      this.jobs[ind] = receiver;
      receiver._writeOnSocket();
    }
  }

  /**
   * Accept receive request.
   * @param {number} ind 
   * @param {import('./Common').item} items 
   */
  acceptRecvRequest(ind, items) {
    if (this.jobs[ind]) {
      const socket = this.jobs[ind]._socket;
      const sender = new Sender(this.jobs[ind]._socket, this.jobs[ind]._opponentId, items);
      this.jobs[ind] = sender;
      socket.write(JSON.stringify({ class: 'ok' }), 'utf-8');
    }
  }

  /**
   * Reject send request.
   * @param {number} ind 
   */
  rejectRequest(ind) {
    if (this.jobs[ind]) {
      this.jobs[ind].reject();
    }
  }

  /**
   * End receiving.
   * Call this while the state is 'WAITING', 'RECVING'.
   * @param {number} ind
   * @returns {boolean} Whether the execution has been successful.
   */
  endJob(ind) {
    if (this.jobs[ind]) {
      return this.jobs[ind].end();
    }
    return false;
  }
  /**
   * Delete a Receiver from jobs.
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

  /**
   * Handle network error on Requestee.
   */
  _handleNetworkErr(ind) {
    if (this.jobs[ind]) {
      this.jobs[ind]._socket.destroy();
    }
  }
}

module.exports = Server;