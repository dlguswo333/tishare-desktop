const dgram = require('dgram');
const net = require('net');
const Requestee = require('./Requestee');
const Sender = require('./Sender');
const Receiver = require('./Receiver');
const {PORT, VERSION, STATE} = require('../defs');
const {OS} = require('./defs');
const {_getBroadcastIp} = require('./Network');
const {splitHeader, MAX_HEADER_LEN, createItemArray, HEADER_END} = require('./Common');

class Server {
  /**
   * @param {import('./Indexer')} indexer
   * @param {Function} sendState
   */
  constructor (indexer, sendState) {
    /** @type {import('./Indexer')} */
    this._indexer = indexer;
    /** @type {Function} */
    this._sendState = sendState;
    this._state = STATE.IDLE;
    /** @type {string} */
    this.myId = '';
    /** @type {dgram.Socket} */
    this._scannee = null;
    /** @type {net.Server} */
    this._serverSocket = null;
    /** @type {Object.<number, (Sender|Receiver|Requestee)>} */
    this.jobs = {};
    this.deleteJob = this.deleteJob.bind(this);
  }

  /**
   * Set Server's ID.
   * @param {string} id
   * @returns {boolean} The result of the execution.
   */
  setMyId (id) {
    if (id) {
      this.myId = id;
      return true;
    }
    return false;
  }

  /**
   * Open myself to the network.
   * @param {string} ip
   * @param {string} netmask
   * @returns {boolean} The result of the execution.
   */
  open (ip, netmask) {
    if (!this.myId) {
      this._state = STATE.ERR_ID;
      return false;
    }
    if (!ip) {
      this._state = STATE.ERR_IP;
      return false;
    }
    this._initScannee(ip, _getBroadcastIp(ip, netmask));
    if (this._serverSocket)
      return true;
    this._serverSocket = net.createServer();
    this._serverSocket.on('connection', async (socket) => {
      const ind = this._getNextInd();
      if (ind < 0 || this._state.startsWith('ERR')) {
        // Do not accept more than limit or Server is in error state.
        socket.destroy();
        return;
      }
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
        _recvBuf = ret.buf;
        switch (recvHeader.class) {
        case 'send-request':
          if (!this._validateRequestHeader(recvHeader)) {
            // Abort and ignore this suspicious connection.
            this._handleNetworkErr(ind);
            return;
          }
          this.jobs[ind] = new Requestee(ind, STATE.RQE_SEND_REQUEST, socket, recvHeader, this._sendState);
          break;
        case 'recv-request':
          if (!this._validateRequestHeader(recvHeader)) {
            // Abort and ignore this suspicious connection.
            this._handleNetworkErr(ind);
            return;
          }
          this.jobs[ind] = new Requestee(ind, STATE.RQE_RECV_REQUEST, socket, recvHeader, this._sendState);
          break;
        case 'end':
          if (this.jobs[ind])
            this.jobs[ind].setState(STATE.RQE_CANCEL);
          socket.end();
          break;
        default:
          // Abort and ignore this suspicious connection.
          this._handleNetworkErr(ind);
        }
      });
      socket.on('close', () => {
        if (this.jobs[ind]) {
          if (this.jobs[ind].getState().state === STATE.RQE_CANCEL || this.jobs[ind].getRejectFlag()) {
            if (this.jobs[ind].getRejectFlag())
              this.deleteJob(ind);
            else
              this.jobs[ind].setState(STATE.RQE_CANCEL);
          }
          else
            this._handleNetworkErr(ind);
        }
        // If this socket was not registered, do nothing.
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
   * Close myself in the network and also close the server socket.
   * @returns {boolean} Always true.
   */
  close () {
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
  getState (ind) {
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
   * @param {string} broadcastIp
   */
  _initScannee (ip, broadcastIp) {
    this._scannee = dgram.createSocket('udp4');
    // If OS is linux, bind to broadcast IP address.
    this._scannee.bind(PORT, (OS === 'linux' ? broadcastIp : ip), () => {
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
          app: 'tiShare',
          version: VERSION,
          class: 'scan',
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
  isOpen () {
    return this._serverSocket && this._serverSocket.listening;
  }

  _destoryScannee () {
    if (this._scannee) {
      this._scannee.close();
      this._scannee = null;
    }
  }

  _getNextInd () {
    return this._indexer.getInd();
  }

  _validateRequestHeader (header) {
    if (!header)
      return false;
    if (header.app !== 'tiShare')
      return false;
    // if (header.version !== VERSION)
    // return false;
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
  acceptSendRequest (ind, recvDir) {
    if (this.jobs[ind]) {
      const receiver = new Receiver(ind, this.jobs[ind]._socket, this.jobs[ind].getId(), recvDir, this.jobs[ind].getNumItems(), this.deleteJob, this._sendState);
      this.jobs[ind] = receiver;
      receiver._writeOnSocket();
    }
  }

  /**
   * Accept receive request.
   * @param {number} ind
   * @param {import('./Common').item} items
   */
  async acceptRecvRequest (ind, items) {
    if (this.jobs[ind]) {
      const socket = this.jobs[ind]._socket;
      const itemArray = await createItemArray(items);
      const sender = new Sender(ind, this.jobs[ind]._socket, this.jobs[ind].getId(), itemArray, this.deleteJob, this._sendState);
      this.jobs[ind] = sender;
      socket.write(JSON.stringify({class: 'ok', numItems: itemArray.length}) + HEADER_END, 'utf-8');
    }
  }

  /**
   * Reject send request.
   * @param {number} ind
   */
  rejectRequest (ind) {
    if (this.jobs[ind]) {
      this.jobs[ind].reject();
    }
  }

  /**
   * End a Job.
   * @param {number} ind
   * @returns {boolean} Whether the execution has been successful.
   */
  endJob (ind) {
    if (this.jobs[ind]) {
      return this.jobs[ind].end();
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

  /**
   * Handle network error on Requestee.
   */
  _handleNetworkErr (ind) {
    if (this.jobs[ind]) {
      this.jobs[ind]._socket.destroy();
      this.jobs[ind].setState(STATE.ERR_NETWORK);
    }
  }
}

module.exports = Server;
