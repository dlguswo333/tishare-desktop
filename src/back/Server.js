// @ts-check
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
  /** @type {import('./Indexer')} */
  #indexer;
  /** @type {Function} */
  #sendState;
  /** @type {STATE[keyof STATE]} */
  #state;
  /** @type {dgram.Socket | null} */
  #scannee = null;
  /** @type {net.Server | null} */
  #serverSocket;
  /** @type {Object.<number, (Sender|Receiver|Requestee)>} */
  jobs;

  /**
   * @param {import('./Indexer')} indexer
   * @param {Function} sendState
   */
  constructor (indexer, sendState) {
    this.#indexer = indexer;
    this.#sendState = sendState;
    this.#state = STATE.IDLE;
    this.myId = '';
    this.#scannee = null;
    this.#serverSocket = null;
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
      this.#state = STATE.ERR_ID;
      return false;
    }
    if (!ip) {
      this.#state = STATE.ERR_IP;
      return false;
    }
    this.#initScannee(ip, _getBroadcastIp(ip, netmask));
    if (this.#serverSocket)
      return true;
    this.#serverSocket = net.createServer();

    this.#serverSocket.on('connection', async (socket) => {
      const ind = this.#getNextInd();
      if (ind < 0 || this.#state.startsWith('ERR')) {
        // Do not accept more than limit or Server is in error state.
        socket.destroy();
        return;
      }
      let recvBuf = Buffer.from([]);

      socket.on('data', (data) => {
        let recvHeader = null;
        recvBuf = Buffer.concat([recvBuf, data]);
        const ret = splitHeader(recvBuf);
        if (!ret) {
          if (recvBuf.length > MAX_HEADER_LEN) {
            // Abort this suspicious connection.
            this.#handleNetworkErr(ind);
          }
          // Has not received header yet. just exit the function here for more data by return.
          return;
        }
        try {
          recvHeader = JSON.parse(ret.header);
        } catch (err) {
          // HEADER_END is met but is not JSON format.
          // Abort and ignore this suspicious connection.
          this.#handleNetworkErr(ind);
          return;
        }
        recvBuf = ret.buf;
        switch (recvHeader.class) {
        case 'send-request':
          if (!this.#validateRequestHeader(recvHeader)) {
            // Abort and ignore this suspicious connection.
            this.#handleNetworkErr(ind);
            return;
          }
          this.jobs[ind] = new Requestee(ind, STATE.RQE_SEND_REQUEST, socket, recvHeader, this.#sendState);
          break;
        case 'recv-request':
          if (!this.#validateRequestHeader(recvHeader)) {
            // Abort and ignore this suspicious connection.
            this.#handleNetworkErr(ind);
            return;
          }
          this.jobs[ind] = new Requestee(ind, STATE.RQE_RECV_REQUEST, socket, recvHeader, this.#sendState);
          break;
        case 'end':
          if (this.jobs[ind] instanceof Requestee)
            this.jobs[ind].setState(STATE.RQE_CANCEL);
          socket.end();
          break;
        default:
          // Abort and ignore this suspicious connection.
          this.#handleNetworkErr(ind);
        }
      });
      socket.on('close', () => {
        if (this.jobs[ind] instanceof Requestee) {
          if (this.jobs[ind].getState().state === STATE.RQE_CANCEL || this.jobs[ind].getRejectFlag()) {
            if (this.jobs[ind].getRejectFlag())
              this.deleteJob(ind);
            else
              this.jobs[ind].setState(STATE.RQE_CANCEL);
          }
          else {
            this.#handleNetworkErr(ind);
          }
        }
        // If this socket was not registered, do nothing.
      });
    });

    this.#serverSocket.on('error', (err) => {
      console.error(err.message);
      this.#state = STATE.ERR_NETWORK;
      this.close();
    });

    this.#serverSocket.listen(PORT, ip);
    this.#state = STATE.IDLE;
    return true;
  }

  /**
   * Close myself in the network and also close the server socket.
   * @returns {boolean} Always true.
   */
  close () {
    if (this.#serverSocket) {
      this.#serverSocket.close((err) => {
        if (err)
          console.error(err);
      });
      this.#serverSocket = null;
    }
    if (this.#scannee) {
      this.#scannee.close();
      this.#scannee = null;
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
  #initScannee (ip, broadcastIp) {
    const scanneeSocket = dgram.createSocket('udp4');
    this.#scannee = scanneeSocket;
    // If OS is linux, bind to broadcast IP address.
    scanneeSocket.bind(PORT, (OS === 'linux' ? broadcastIp : ip), () => {
      scanneeSocket.on('message', (msg, rinfo) => {
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
        scanneeSocket.send(JSON.stringify(sendHeader), rinfo.port, rinfo.address);
      });
    });
  }

  /**
   * Get whether Server is open.
   * @returns {boolean}
   */
  isOpen () {
    return this.#serverSocket?.listening ?? false;
  }

  #getNextInd () {
    return this.#indexer.getInd();
  }

  #validateRequestHeader (header) {
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
    const requestee = this.jobs[ind];
    if (!(requestee instanceof Requestee)) {
      throw new Error(`Requestee expected but got ${this.jobs[ind]}`);
    }
    const receiver = new Receiver(ind, requestee.socket, requestee.getId(), recvDir, requestee.getNumItems(), this.deleteJob, this.#sendState);
    this.jobs[ind] = receiver;
    receiver.sendHeader();
  }

  /**
   * Accept receive request.
   * @param {number} ind
   * @param {Object.<string, import('./Common').Item>} items
   */
  async acceptRecvRequest (ind, items) {
    const requestee = this.jobs[ind];
    if (!(requestee instanceof Requestee)) {
      throw new Error(`Requestee expected but got ${this.jobs[ind]}`);
    }
    const socket = requestee.socket;
    const itemArray = await createItemArray(items);
    const sender = new Sender(ind, requestee.socket, requestee.getId(), itemArray, this.deleteJob, this.#sendState);
    this.jobs[ind] = sender;
    socket.write(JSON.stringify({class: 'ok', numItems: itemArray.length}) + HEADER_END, 'utf-8');
  }

  /**
   * Reject send request.
   * @param {number} ind
   */
  rejectRequest (ind) {
    if (this.jobs[ind] && 'reject' in this.jobs[ind]) {
      this.jobs[ind].reject();
    }
  }

  /**
   * End a Job.
   * @param {number} ind
   * @returns {boolean | Promise<boolean>} Whether the execution has been successful.
   */
  endJob (ind) {
    if (this.jobs[ind] && 'end' in this.jobs[ind]) {
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
      this.#indexer.returnInd(ind);
      return true;
    }
    return false;
  }

  /**
   * Handle network error on Requestee.
   * @param {number} ind
   */
  #handleNetworkErr (ind) {
    if (this.jobs[ind] && ('setState' in this.jobs[ind])) {
      this.jobs[ind].setState(STATE.ERR_NETWORK);
    }
  }
}

module.exports = Server;
