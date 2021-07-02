const fs = require('fs').promises;
const net = require('net');
const path = require('path');
const { _splitHeader } = require('./Network');
const { VERSION, HEADER_END, OS, STATE } = require('../defs');

class Receiver {
  /**
   * @param {net.Socket} socket 
   */
  constructor(socket) {
    this._state = STATE.IDLE;
    /** @type {net.Socket} */
    this._socket = socket;
    /** @type {Buffer} */
    this._recvBuf = Buffer.from([]);
    /** @type {boolean} Whether Receiver have parsed header. */
    this._haveParsedHeader = false;
    /**
     * Send Request header.
     * @type {{app: string, version:string, class:string, id:string, itemArray:Array.<>}}
     */
    this._sendRequestHeader = null;
    /** @type {string} */
    this._senderId = null;
    /** @type {Object} */
    this._recvHeader = null;
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
    this._recvPath = null;
    /**
     * The number of bytes after the previous speed measure. 
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
    this._init();
  }

  /**
   * Initialize Receiver by adding event listeners.
   * Call it after contructor.
   */
  _init() {
    this._socket.on('data', async (data) => {
      let ret = null;
      this._recvBuf = Buffer.concat([this._recvBuf, data]);
      if (!this._haveParsedHeader) {
        // Try to parse header and save into header.
        ret = _splitHeader(this._recvBuf);
        if (!ret) {
          // The header is still splitted. Wait for more data by return.
          return;
        }
        try {
          this._recvHeader = JSON.parse(ret.header);
          this._haveParsedHeader = true;
          this._recvBuf = ret.buf;
        } catch (err) {
          this._state = STATE.ERR_NETWORK;
          console.error('Header parsing error. Not JSON format.');
          this._socket.destroy();
          return;
        }
      }

      // Reaching here means we now have header or already have header.
      switch (this._state) {
        case STATE.IDLE:
          switch (this._recvHeader.class) {
            case 'send-request':
              this._sendRequestHeader = this._recvHeader;
              if (!this._validateSendRequestHeader(this._sendRequestHeader)) {
                console.error('Header error. Not valid.');
                this._socket.end();
              }
              this._senderId = this._sendRequestHeader.id;
              this._itemArray = this._recvHeader.itemArray;
              this._state = STATE.WAITING;
              this._haveParsedHeader = false;
              break;
            default:
              // What the hell?
              this._socket.end();
              return;
          }
          break;
        case STATE.WAITING:
          switch (this._recvHeader.class) {
            case 'end':
              this._state = STATE.OTHER_END;
              this._socket.end();
              return;
            default:
              // What the hell?
              this._socket.end();
              return;
          }
        case STATE.RECVING:
        case STATE.SENDER_STOP:
          switch (this._recvHeader.class) {
            case 'ok':
              if (this._state === STATE.SENDER_STOP)
                this._state = STATE.RECVING;
              if (this._recvBuf.length === this._recvHeader.size) {
                // One whole chunk received.
                // Write chunk on disk.
                try {
                  await this._itemHandle.appendFile(this._recvBuf);
                } catch (err) {
                  // Appending to file error.
                  // In this error, there is nothing SendDone can do about it.
                  // Better delete what has been written so far,
                  // mark it failed, and go to next item.
                  // TODO mark the item failed.
                  try {
                    await this._itemHandle.close();
                    await fs.rm(path.join(this._recvPath, this._itemName), { force: true });
                  } finally {
                    this._itemHandle = null;
                    this._itemFlag = 'next';
                    this._writeOnSocket();
                    return;
                  }
                }
                this._haveParsedHeader = false;
                this._speedBytes += this._recvBuf.length;
                this._itemWrittenBytes += this._recvBuf.length;
                this._recvBuf = Buffer.from([]);
                this._itemFlag = 'ok';
                this._writeOnSocket();
              }
              break;
            case 'new':
              if (this._state === STATE.SENDER_STOP)
                this._state = STATE.RECVING;
              this._itemName = path.join(this._recvHeader.dir, this._recvHeader.name);
              if (this._recvHeader.type === 'directory') {
                this._haveParsedHeader = false;
                this._itemSize = 0;
                this._numRecvItem++;
                try {
                  await fs.mkdir(path.join(this._recvPath, this._itemName));
                } catch (err) {
                  if (err.code !== 'EEXIST') {
                    // Making directory failed.
                    // Even making directory failed means there are serious issues.
                    this._state = STATE.ERR_FILE_SYSTEM;
                    this._socket.destroy();
                    return;
                  }
                }
                this._itemFlag = 'ok';
                this._writeOnSocket();
              }
              else if (this._recvHeader.type === 'file') {
                try {
                  if (this._itemHandle) {
                    this._numRecvItem++;
                    // Close previous item handle.
                    await this._itemHandle.close();
                  }
                  this._itemHandle = await fs.open(path.join(this._recvPath, this._itemName), 'wx');
                } catch (err) {
                  // File already exists.
                  // TODO Implement handling.
                  // 1. Ignore the file.
                  // 2. Create the file with another name.
                  this._itemHandle = null;
                  this._haveParsedHeader = false;
                  this._itemFlag = 'next';
                  this._writeOnSocket();
                  return;
                }
                this._haveParsedHeader = false;
                this._itemWrittenBytes = 0;
                this._itemSize = this._recvHeader.size;
                this._recvBuf = Buffer.from([]);
                this._itemFlag = 'ok';
                this._writeOnSocket();
              }
              break;
            case 'done':
              if (this._itemHandle) {
                // Close previous item handle.
                await this._itemHandle.close();
              }
              this._state = STATE.COMPLETE;
              this._socket.end();
              break;
            case 'stop':
              this._state = STATE.SENDER_STOP;
              this._haveParsedHeader = false;
              break;
            case 'end':
              this._state = STATE.OTHER_END;
              this._socket = null;
              break;
          }
          break;
        case STATE.RECEIVER_STOP:
          switch (this._recvHeader.class) {
            case 'end':
              this._state = STATE.OTHER_END;
              this._socket = null;
              break;
            // Ignore any other classes.
          }
          break;
        default:
          // What the hell?
          // Unhandled Receiver state case.
          this._socket.end();
          break;
      }
    });

    this._socket.on('close', () => {
      if (!(this._state === STATE.COMPLETE || this._state === STATE.MY_END || this._state === STATE.OTHER_END))
        // Unexpected close event.
        this._state = STATE.ERR_NETWORK;
      this._socket.end();
    });

    this._socket.on('error', (err) => {
      console.error(err.message);
      this._state = STATE.ERR_NETWORK;
    })
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
    if (this._state === STATE.RECVING) {
      return {
        state: this._state,
        speed: this.getSpeed(),
        progress: this.getItemProgress(),
        totalProgress: this.getTotalProgress(),
        id: this._senderId,
        itemName: this._itemName,
      };
    }
    if (this._state === STATE.WAITING) {
      return {
        state: this._state,
        id: this._senderId,
        // itemArray: this._sendRequestHeader.itemArray
      }
    }
    return { state: this._state, id: this._senderId };
  }

  /**
   * Stop receiving for a moment.
   * @returns {boolean}
   */
  stop() {
    if (this._state === STATE.RECVING)
      return (this._stopFlag = true);
    return false;
  }
  /**
   * Retume from stop.
   * @returns {boolean}
   */
  resume() {
    if (this._state === STATE.RECEIVER_STOP) {
      this._state = STATE.RECVING;
      let header = { class: this._itemFlag };
      this._socket.write(JSON.stringify(header) + HEADER_END, this._onWriteError);
      return true;
    }
    return false;
  }
  /**
   * End receiving.
   * @returns {boolean}
   */
  async end() {
    if (this._state === STATE.RECVING || this._state === STATE.SENDER_STOP || this._state === STATE.RECEIVER_STOP) {
      if (this._itemHandle) {
        // Delete currently receiving file.
        await this._itemHandle.close();
        await fs.rm(path.join(this._recvPath, this._itemName), { force: true });
      }
      this._endFlag = true;
      if (this._state === STATE.SENDER_STOP || this._state === STATE.RECEIVER_STOP) {
        // Send end header immediately while stop.
        this._writeOnSocket();
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
  acceptRecv(recvPath) {
    if (this._state !== STATE.WAITING || this._socket === null) {
      return false;
    }
    this._state = STATE.RECVING;
    this._recvPath = recvPath;
    this._numRecvItem = 0;
    this._speedBytes = 0;
    this._itemFlag = 'ok';
    const header = { class: this._itemFlag };
    this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
    return true;
  }
  /**
   * This shall be called when the user clicks receive reject button.
   * @returns {boolean} Return the result of the function.
   */
  rejectRecv() {
    if (this._state !== STATE.WAITING || this._socket === null) {
      return false;
    }
    this._state = STATE.IDLE;
    const header = { class: 'no' };
    this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
    this._socket = null;
    return true;
  }

  /**
   * Special method for writing to recvSocket while receiving.
   */
  _writeOnSocket() {
    let header = null;
    if (this._endFlag) {
      this._endFlag = false;
      this._state = STATE.MY_END;
      header = { class: 'end' };
      this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
      return;
    }
    if (this._stopFlag) {
      this._stopFlag = false;
      this._state = STATE.RECEIVER_STOP;
      header = { class: 'stop' };
      this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
      return;
    }
    switch (this._state) {
      case STATE.RECVING:
        header = { class: this._itemFlag };
        this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
        break;
      case STATE.MY_END:
        header = { class: 'end' };
        this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
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
   * @param {Error} err 
   */
  _onWriteError = (err) => {
    if (err) {
      console.error('Sender: Error Occurred during writing to Socket.');
      console.error(err);
      this._socket.destroy();
      this._socket = null;
      this._state = STATE.ERR_NETWORK;
    }
  }
}


module.exports = Receiver;