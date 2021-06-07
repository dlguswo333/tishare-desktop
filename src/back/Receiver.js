const fs = require('fs').promises;
const net = require('net');
const path = require('path');
const { PORT, STATE, VERSION, HEADER_END, OS, _splitHeader, } = require('./Network');

class Receiver {
  constructor() {
    this._state = STATE.IDLE;
    this._myId = '';
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
     * Send Request header.
     * @type {{app: string, version:string, class:string, id:string, itemArray:Array.<>}}
     */
    this._sendRequestHeader = null;
    /**
     * Tells whether has parsed header sent from the receiver or not.
     * @type {boolean}
     */
    this._recvHeader = false;
    /**
     * @type {'ok'|'next'}
     */
    this._itemFlag = '';
    /**
     * @type {boolean}
     */
    this._stopFlag = false;
    /**
     * @type {boolean}
     */
    this._endFlag = false;
    /**
    * File handle for receiving.
    * @type {fs.FileHandle}
    */
    this._itemHandle = null;
    /**
     * Array of items. Each item is composed of name, dir, type, and size.
     * Size can be omitted if directory.
     * @type {Array.<{name:String, dir:String, type:String, size:number}>}
     */
    this._itemArray = null;
    /**
     * Name of the current item excluding download path.
     * @type {String}
     */
    this._itemName = null;
    /**
     * Size of the current item.
     * @type {number}
     */
    this._itemSize = 0;
    /**
     * Size of received bytes for this item.
     */
    this._itemWrittenBytes = 0;
    /**
     * Number of received items so far.
     * @type {number} 
     */
    this._numRecvItem = 0;
    /**
     * @type {String}
     */
    this._downloadPath = null;

    /**
     * The # of bytes after the previous speed measure. 
     * @type {number}
     */
    this._speedBytes = 0;
    /**
     * Previous speed measure time in millisecond.
     * @type {number} 
     */
    this._prevSpeedTime = null;
    /**
     * Previous measured speed.
     * @type {number} 
     */
    this._prevSpeed = 0;

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
  }

  /**
   * Open the server socket with the ip address.
   * Note that the port number is fixed thus cannot be changed.
   * @param {String} ip address. 
   */
  openServerSocket(ip) {
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
      let recvBuf = Buffer.from([]);
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
                this._sendRequestHeader = recvHeader;
                if (!this._validateSendRequestHeader(this._sendRequestHeader)) {
                  console.error('Header error. Not valid.');
                  socket.end();
                }
                this._itemArray = recvHeader.itemArray;
                this._state = STATE.RECV_WAIT;
                this._recvSocket = socket;
                // Add receive socket specific event handlers.
                socket.on('close', () => {
                  if (!(this._state === STATE.RECV_DONE || this._state === STATE.RECEIVER_END || this._state === STATE.SENDER_END))
                    // Unexpected close event.
                    this._state = STATE.ERR_NET;
                  socket.end();
                });
                socket.on('error', (err) => {
                  this._state = STATE.ERR_NET;
                });
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
              case 'end':
                this._state = STATE.SENDER_END;
                socket.end();
                return;
              default:
                // What the hell?
                socket.end();
                return;
            }
          case STATE.RECV:
          case STATE.SENDER_STOP:
            if (!this._isRecvSocket(socket)) {
              // Destroy this malicious socket.
              socket.destroy();
              return;
            }
            switch (recvHeader.class) {
              case 'ok':
                if (this._state === STATE.SENDER_STOP)
                  this._state = STATE.RECV;
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
                    // TODO mark the item failed.
                    try {
                      await this._itemHandle.close();
                      await fs.rm(path.join(this._downloadPath, this._itemName), { force: true });
                    } finally {
                      this._itemHandle = null;
                      this._itemFlag = 'next';
                      this._writeOnRecvSocket();
                      return;
                    }
                  }
                  haveParsedHeader = false;
                  this._speedBytes += recvBuf.length;
                  this._itemWrittenBytes += recvBuf.length;
                  recvBuf = Buffer.from([]);
                  this._itemFlag = 'ok';
                  this._writeOnRecvSocket();
                }
                break;
              case 'new':
                if (this._state === STATE.SENDER_STOP)
                  this._state = STATE.RECV;
                this._itemName = path.join(recvHeader.dir, recvHeader.name);
                if (recvHeader.type === 'directory') {
                  haveParsedHeader = false;
                  this._itemSize = 0;
                  this._numRecvItem++;
                  try {
                    await fs.mkdir(path.join(this._downloadPath, this._itemName));
                  } catch (err) {
                    if (err.code !== 'EEXIST') {
                      // Making directory failed.
                      // Even making directory failed means there are serious issues.
                      this._state = STATE.ERR_FS;
                      this._recvSocket.destroy();
                      return;
                    }
                  }
                  this._itemFlag = 'ok';
                  this._writeOnRecvSocket();
                }
                else if (recvHeader.type === 'file') {
                  try {
                    if (this._itemHandle) {
                      this._numRecvItem++;
                      // Close previous item handle.
                      await this._itemHandle.close();
                    }
                    this._itemHandle = await fs.open(path.join(this._downloadPath, this._itemName), 'wx');
                  } catch (err) {
                    // File already exists.
                    // TODO Implement.
                    this._itemHandle = null;
                    haveParsedHeader = false;
                    this._itemFlag = 'next';
                    this._writeOnRecvSocket();
                    return;
                  }
                  haveParsedHeader = false;
                  this._itemWrittenBytes = 0;
                  this._itemSize = recvHeader.size;
                  recvBuf = Buffer.from([]);
                  this._itemFlag = 'ok';
                  this._writeOnRecvSocket();
                }
                break;
              case 'done':
                if (this._itemHandle) {
                  // Close previous item handle.
                  await this._itemHandle.close();
                }
                this._state = STATE.RECV_DONE;
                this._recvSocket = null;
                socket.end();
                break;
              case 'stop':
                this._state = STATE.SENDER_STOP;
                haveParsedHeader = false;
                break;
              case 'end':
                this._state = STATE.SENDER_END;
                this._recvSocket = null;
                break;
            }
            break;
          case STATE.RECEIVER_STOP:
            switch (recvHeader.class) {
              case 'end':
                this._state = STATE.SENDER_END;
                this._recvSocket = null;
                break;
              // Ignore any other classes.
            }
            break;
          case STATE.RECV_BUSY:
            socket.end();
            break;
          default:
            // What the hell?
            // Unhandled Receiver state case.
            socket.end();
            break;
        }
      });
    });

    this._serverSocket.listen(PORT, ip);
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
   * Return whether the server socket is not null and it is listening.
   * @returns {boolean}
   */
  isOpen() {
    return this._serverSocket && this._serverSocket.listening;
  }

  /**
   * Change this my id.
   * @param {string} newId 
   */
  setMyId(newId) {
    if (!newId)
      return false;
    this._myId = newId;
    return true;
  }
  /**
   * @returns {Array<{name:String, type:String, size:number}>}
   */
  getitemArray() {
    return this._itemArray;
  }

  /**
   * Return the # of bytes per second.
   * If the # of bytes or the interval is 0, return previous measured speed.
   * @returns {number}
   */
  getSpeed() {
    const now = Date.now();
    if (now === this._prevSpeedTime || this._speedBytes === 0)
      return this._prevSpeed;
    this._prevSpeed = this._speedBytes / ((now - this._prevSpeedTime) / 1000);
    this._speedBytes = 0;
    this._prevSpeedTime = now;
    return this._prevSpeed;
  }
  /**
   * Return the current item progress out of 100.
   * @returns {number}
   */
  getItemProgress() {
    // If item type is directory, set this._itemSize to 0.
    // In case of empty file whose size is 0, progress is 100%.
    return (this._itemSize === 0 ? 100 : Math.floor(this._itemWrittenBytes / this._itemSize * 100));
  }
  /**
   * Return a string representing the total progress.
   */
  getTotalProgress() {
    return this._numRecvItem + '/' + this._itemArray.length;
  }

  /**
   * Return the current state
   */
  getState() {
    if (this._state === STATE.RECV) {
      return {
        state: this._state,
        speed: this.getSpeed(),
        progress: this.getItemProgress(),
        totalProgress: this.getTotalProgress(),
        name: this._itemName
      };
    }
    if (this._state === STATE.RECV_WAIT) {
      return {
        state: this._state,
        id: this._sendRequestHeader.id,
        itemArray: this._sendRequestHeader.itemArray
      }
    }
    return { state: this._state };
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
   * Set the current state to BUSY.
   * This is going to be called before the app is going into send mode,
   * to prevent receiving activated while sending.
   */
  setStateBusy() {
    if (this._state === STATE.IDLE)
      this._state = STATE.RECV_BUSY;
  }

  /**
   * Stop receiving for a moment.
   * @returns {boolean}
   */
  stop() {
    if (this._state === STATE.RECV)
      return (this._stopFlag = true);
    return false;
  }
  /**
   * Retume from stop.
   * @returns {boolean}
   */
  resume() {
    if (this._state === STATE.RECEIVER_STOP) {
      this._state = STATE.RECV;
      let header = { class: this._itemFlag };
      this._recvSocket.write(JSON.stringify(header) + HEADER_END, this._onWriteRecvError);
      return true;
    }
    return false;
  }
  /**
   * End receiving.
   * @returns {boolean}
   */
  async end() {
    if (this._state === STATE.RECV || this._state === STATE.SENDER_STOP || this._state === STATE.RECEIVER_STOP) {
      if (this._itemHandle) {
        // Delete currently receiving file.
        await this._itemHandle.close();
        await fs.rm(path.join(this._downloadPath, this._itemName), { force: true });
      }
      this._endFlag = true;
      if (this._state === STATE.SENDER_STOP || this._state === STATE.RECEIVER_STOP) {
        // Send end header immediately while stop.
        this._writeOnRecvSocket();
      }
      return true;
    }
    return false;
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
    this._numRecvItem = 0;
    this._speedBytes = 0;
    this._itemFlag = 'ok';
    const header = { class: this._itemFlag };
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
   * Special method for writing to recvSocket while receiving.
   */
  _writeOnRecvSocket() {
    let header = null;
    if (this._endFlag) {
      this._endFlag = false;
      this._state = STATE.RECEIVER_END;
      header = { class: 'end' };
      this._recvSocket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteRecvError);
      return;
    }
    if (this._stopFlag) {
      this._stopFlag = false;
      this._state = STATE.RECEIVER_STOP;
      header = { class: 'stop' };
      this._recvSocket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteRecvError);
      return;
    }
    switch (this._state) {
      case STATE.RECV:
        header = { class: this._itemFlag };
        this._recvSocket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteRecvError);
        break;
      case STATE.RECEIVER_END:
        header = { class: 'end' };
        this._recvSocket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteRecvError);
        break;
    }
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
    if (!header.id)
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