const dgram = require('dgram');
const net = require('net');
const Receiver = require('./Receiver');
const { PORT, OS, VERSION, STATE, MAX_NUM_JOBS } = require('../defs');

class Server {
  /**
   * @param {string} id 
   */
  constructor(id) {
    this._state = STATE.INITING;
    if (!id) {
      // Cannot initialize Server without ID.
      this._state = STATE.ERR_ID;
      return;
    }
    /** @type {string} */
    this.myId = id;
    /** @type {dgram.Socket} */
    this._scannee = null;
    /** @type {net.Server} */
    this._serverSocket = null;
    this._state = STATE.IDLE;
    /** @type {Object.<number, Receiver>} */
    this.jobs = {};
    /** @type {number} */
    this._nextNum = 0;
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
    if (!ip) {
      this._state = STATE.ERR_IP;
      return false;
    }
    if (this._serverSocket)
      return true;
    this._serverSocket = net.createServer();
    this._serverSocket.on('connection', (socket) => {
      // TODO At this moment, server does only receiving, and client does only sending.
      // Let server and client do both receiving and sending.
      // But is it really necessary?

      if (Object.keys(this.jobs).length >= MAX_NUM_JOBS) {
        // Do not accept more than limit.
        socket.destroy();
        return;
      }
      const receiver = new Receiver(socket);
      this.jobs[this._nextNum++] = receiver;
    });

    this._serverSocket.on('error', (err) => {
      console.error(err.message);
      this._state = STATE.ERR_NETWORK;
    });

    this._serverSocket.listen(PORT, ip);
  }

  /**
   * Close myself in the network and also close the server sockets.
   * @returns {boolean} Always true.
   */
  close() {
    if (this._serverSocket) {
      this._serverSocket.close();
      this._serverSocket = null;
    }
    if (this._scannee) {
      this._scannee.close();
      this._scannee = null;
    }
    return true;
  }

  getState() {
    return this._state;
  }

  /**
   * @callback scanCallback
   * @param {String} deviceIp 
   * @param {String} deviceVersion Version of SendDone 
   * @param {String} deviceId 
   * @param {String} deviceOs 
   */
  /**
   * Initialize an udp socket which responds to scans.
   * @param {string} ip 
   * @param {scanCallback} callback Callback function to call when found a device.
   */
  _initScannee(ip, callback) {
    this._scannee = dgram.createSocket('udp4');
    this._scannee.bind(PORT, ip, () => {
      this._scannee.on('message', (msg, rinfo) => {
        let recvHeader = null;
        try {
          recvHeader = JSON.parse(msg.toString('utf-8'));
          if (!(recvHeader.version && recvHeader.id && recvHeader.os))
            throw new Error('header not valid');
        } catch {
          // Abort it.
          return;
        }

        callback(rinfo.address, recvHeader.version, recvHeader.id, recvHeader.os);

        const sendHeader = {
          app: "SendDone",
          version: VERSION,
          class: "scan",
          id: this.myId,
          os: OS
        };
        this._scannee.send(sendHeader, rinfo.port, rinfo.address);
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
}

module.exports = Server;