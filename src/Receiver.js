const fs = require('fs').promises;
const net = require('net');
const path = require('path');
const { PORT, STATE, VERSION, HEADER_END, CHUNKSIZE, OS, _splitHeader, } = require('./Network');

class Receiver {
  /**
   * 
   * @param {string} ip 
   * @param {string} myId 
   */
  constructor(ip, myId) {
    if (!myId) {
      this._state = STATE.ERR_FS;
      return;
    }
    this._state = STATE.IDLE;
    /**
     * @type {String} my id.
     */
    this._myId = myId;
    /**
     * @type {net.Server}
     */
    this._serverSocket = null;
    /**
     * This is a socket created when a client connects to my server socket.
     * @type {net.Socket}
     */
    this._recvSocket = null;
    /**
     * Tells whether has parsed header sent from the receiver or not.
     * @type {boolean}
     */
    this._recvHeader = false;
    /**
     * File handle for receiving.
     * @type {fs.FileHandle}
     */
    this._itemHandle = null;
    /**
     * Array of items. Each item is composed of name, type, and size.
     * Size can be omitted if directory.
     * @type {Array.<{name:String, type:String, size:number}>}
     */
    this._itemArray = null;
    /**
     * Name of the current item.
     * @type {String}
     */
    this._itemName = null;
    /**
     * this._index for itemArray.
     * @type {number}
     */
    this._index = 0;
    /**
     * Total written bytes for this item.
     */
    this._itemWrittenBytes = 0;

    this._downloadPath = null;

    this._onWriteError = (err) => {
      if (err) {
        console.error('Sender: Error Occurred during writing to Socket.');
      }
    }

    this._onWriteRecvError = (err) => {
      if (err) {
        console.error('Sender: Error Occurred during writing to Socket.');
        console.error(err);
        this._recvSocket.end();
        this._recvSocket = null;
        this._state = STATE.ERR_NET;
      }
    }

    this.initServerSocket(ip);
  }

  /**
   * Initialize the server socket with the ip address.
   * Note that the port number is fixed thus cannot be changed.
   * @param {String} ip address. 
   */
  initServerSocket(ip) {
    if (!ip) {
      // ip is not set.
      return;
    }
    if (this._serverSocket) {
      if (this._serverSocket.listening) {
        console.log('Server is already on and listening!');
        return;
      }
      // this._serverSocket is not null but not listening. close it first.
      this._serverSocket.close();
    }
    this._serverSocket = net.createServer();

    // Add error handling callbacks.
    this._serverSocket.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('this._serverSocket Error! Port is already in use!');
      }
      else {
        console.error(err);
        console.log('this._serverSocket Error! Unknown error!');
      }
      this._serverSocket = null;
      return;
    });

    // Connection established.
    this._serverSocket.on('connection', (socket) => {
      /**
       * @type {Buffer}
       */
      let recvBuf = new Buffer.from([]);
      let recvHeader = null;
      let haveParsedHeader = false;
      console.log('Receiver: connection from ' + socket.remoteAddress + ':' + socket.remotePort);

      socket.on('data', async (data) => {
        let ret = null;
        recvBuf = Buffer.concat([recvBuf, data]);
        if (!haveParsedHeader) {
          // Try to parse header and save into header.
          ret = _splitHeader(recvBuf);
          if (!ret) {
            // The header is still splitted. Wait for more data by return.
            return;
          }
          haveParsedHeader = true;
          try {
            recvHeader = JSON.parse(ret.header);
            recvBuf = ret.buf;
          } catch (err) {
            console.error('Header parsing error. Not JSON format.');
            socket.end();
            return;
          }
        }

        if (recvHeader.class === 'scan') {
          // Always responds to scan no matter the current state.
          this._handleScan(socket);
          socket.end();
          return;
        }

        // Reaching here means we now have header or already have header.
        switch (this._state) {
          case STATE.IDLE:
            switch (recvHeader.class) {
              case 'send-request':
                if (!this._validateSendRequestHeader(recvHeader)) {
                  console.error('Header error. Not valid.');
                  socket.end();
                }
                this._itemArray = recvHeader.itemArray;
                this._index = 0;
                this._state = STATE.RECV_WAIT;
                this._recvSocket = socket;
                haveParsedHeader = false;
                break;
              default:
                // What the hell?
                socket.end();
                return;
            }
            break;
          case STATE.RECV_WAIT:
            switch (recvHeader.class) {
              default:
                // What the hell?
                socket.end();
                return;
            }
          case STATE.RECV:
            switch (recvHeader.class) {
              case 'ok':
                if (!this._isRecvSocket(socket)) {
                  // Destroy this malicious socket.
                  socket.destroy();
                  return;
                }

                if (recvBuf.length === recvHeader.size) {
                  // One whole chunk received.
                  // Write chunk on disk.
                  try {
                    await this._itemHandle.appendFile(recvBuf);
                  } catch (err) {
                    // Appending to file error.
                    // In this error, there is nothing SendDone can do about it.
                    // Better delete what has been written so far,
                    // mark it failed, and go to next item.
                    // TODO mark failed.
                    try {
                      await this._itemHandle.close();
                      await fs.rm(path.join(this._downloadPath, this._itemName), { force: true });
                    } finally {
                      this._itemHandle = null;
                    }
                  }
                  haveParsedHeader = false;
                  this._itemWrittenBytes += recvBuf.length;
                  recvBuf = Buffer.from([]);
                  // TODO Handle various states(stop, end)
                  socket.write(JSON.stringify({ class: 'ok' }) + HEADER_END, 'utf-8', this._onWriteRecvError);
                }
                break;
              case 'new':
                if (!this._isRecvSocket(socket)) {
                  // Destroy this malicious socket.
                  socket.destroy();
                  return;
                }

                this._itemName = recvHeader.name;
                if (recvHeader.type === 'directory') {
                  try {
                    await fs.mkdir(path.join(this._downloadPath, recvHeader.name));
                  } catch (err) {
                    if (err.code === 'EEXIST') {
                      socket.write(JSON.stringify({ class: 'ok' }) + HEADER_END, 'utf-8', this._onWriteRecvError);
                    }
                    else {
                      // Making directory failed.
                      // Even making directory failed means there are serious issues.
                      this._recvSocket.destroy();
                      this._state = STATE.ERR_FS;
                    }
                    haveParsedHeader = false;
                    return;
                  }
                  haveParsedHeader = false;
                  // TODO Handle various states(stop, end)
                  socket.write(JSON.stringify({ class: 'ok' }) + HEADER_END, 'utf-8', this._onWriteRecvError);
                }
                else if (recvHeader.type === 'file') {
                  try {
                    if (this._itemHandle) {
                      // Close previous item handle.
                      await this._itemHandle.close();
                    }
                    this._itemHandle = await fs.open(path.join(this._downloadPath, this._itemName), 'wx');
                  } catch (err) {
                    // File already exists.
                    // TODO Implement.
                    this._itemHandle = null;
                    haveParsedHeader = false;
                    socket.write(JSON.stringify({ class: 'next' }) + HEADER_END);
                    return;
                  }
                  haveParsedHeader = false;
                  recvBuf = Buffer.from([]);
                  // TODO Handle various states(stop, end)
                  socket.write(JSON.stringify({ class: 'ok' }) + HEADER_END, 'utf-8', this._onWriteRecvError);
                }
                else {
                  // What the hell?
                  // TODO Reject bad header.
                }
                break;
              case 'done':
                if (!this._isRecvSocket(socket)) {
                  // Destroy this malicious socket.
                  socket.destroy();
                  return;
                }

                if (this._itemHandle) {
                  // Close previous item handle.
                  await this._itemHandle.close();
                }
                socket.end();
                this._state = STATE.RECV_COMPLETE;
                break;
              case 'stop':
                // TODO Implement
                break;
              case 'end':
                // TODO Implement
                break;
            }
            break;
          // TODO Implement
          default:
            // What the hell?
            socket.end();
            break;
        }
      });
      socket.on('close', () => { socket.end(); });
    });

    this._serverSocket.listen(PORT, ip);
  }

  /**
   * Return whether the server socket is not null and it is listening.
   * @returns {boolean}
   */
  isExposed() {
    return this._serverSocket && this._serverSocket.listening;
  }

  /**
   * @returns {Array<{name:String, type:String, size:number}>}
   */
  getitemArray() {
    return this._itemArray;
  }
  /**
   * Close the server socket.
   */
  closeServerSocket() {
    if (this._serverSocket) {
      this._serverSocket.close(() => { this._serverSocket = null; });
    }
  }
  /**
   * Return the # of bytes per second.
   * @returns {number}
   */
  getSpeed() {
    const now = Date.now();
    const ret = speedBytes / ((now - speedStart) / 1000);
    speedBytes = 0;
    speedStart = now;
    return ret;
  }

  /**
   * Return the current state
   */
  getState() {
    return this._state;
  }
  /**
   * Set the current state to IDLE.
   * This is needed to reinitialize the state so after an error or complete,
   * user has been acknowledged about the status and okay to do another job.
   */
  setStateIdle() {
    this._state = STATE.IDLE;
  }
  /**
   * This shall be called when the user clicks receive accept button.
   * The module is going to change current state and be ready to receive.
   * @returns {boolean} Return the result of the function.
   */
  acceptRecv(downloadPath) {
    if (this._state !== STATE.RECV_WAIT || this._recvSocket === null) {
      return false;
    }
    this._state = STATE.RECV;
    this._downloadPath = downloadPath;
    const header = { class: 'ok' };
    this._recvSocket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteRecvError);
    return true;
  }
  /**
   * This shall be called when the user clicks receive reject button.
   * @returns {boolean} Return the result of the function.
   */
  rejectRecv() {
    if (this._state !== STATE.RECV_WAIT || this._recvSocket === null) {
      return false;
    }
    this._state = STATE.IDLE;
    const header = { class: 'no' };
    this._recvSocket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteRecvError);
    this._recvSocket = null;
    return true;
  }
  /**
   * Validate header what sender sent and return false if invalid, or return true.
   * @param {{app:String, version: String, class: String, array: Array.<{}>}} header 
   */
  _validateSendRequestHeader(header) {
    if (!header)
      return false;
    if (header.app !== 'SendDone')
      return false;
    if (header.version !== VERSION)
      return false;
    if (!header.itemArray)
      return false;
    return true;
  }

  /**
   * 
   * @param {net.Socket} socket 
   */
  _handleScan(socket) {
    let header = {
      app: "SendDone",
      version: VERSION,
      class: 'ok',
      id: this._myId,
      os: OS
    };
    socket.write(JSON.stringify(header) + HEADER_END, 'utf-8');
  }
  /**
   * Test whether this socket is connected to the current sender.
   * @param {net.Socket} socket 
   * @returns 
   */
  _isRecvSocket(socket) {
    return (this._recvSocket.remoteAddress === socket.remoteAddress) && (this._recvSocket.remotePort === socket.remotePort);
  }
}


module.exports = { Receiver };