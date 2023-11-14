const fs = require('fs').promises;
const path = require('path');
const {HEADER_END, splitHeader} = require('./Common');
const {STATE, SOCKET_TIMEOUT, STATE_INTERVAL} = require('../defs');

class Receiver {
  /**
   * @param {number} ind
   * @param {import('net').Socket} socket
   * @param {string!} senderId
   * @param {string!} recvDir
   * @param {number!} numItems
   * @param {Function} deleteCallback
   * @param {Function} sendState
   */
  constructor (ind, socket, senderId, recvDir, numItems, deleteCallback, sendState) {
    /** @type {number} */
    this._ind = ind;
    this._state = STATE.RECVING;
    /** @type {import('net').Socket} */
    this._socket = socket;
    /** @type {string} */
    this._senderId = senderId;
    /** @type {String} */
    this._recvPath = recvDir;
    /** @type {number} */
    this._numItems = numItems;
    /** @type {Function} */
    this._deleteCallback = deleteCallback;
    /** @type {Function} */
    this._sendState = sendState;
    /** @type {Buffer} */
    this._recvBuf = Buffer.from([]);
    /** @type {Array.<Buffer>} */
    this._recvBufArray = [];
    /** @type {number} */
    this._recvBufArrayLen = 0;
    /** @type {boolean} Whether Receiver have parsed header. */
    this._haveParsedHeader = false;
    /**
     * Send Request header.
     * @type {{app: string, version:string, class:string, id:string, itemArray:Array.<>}}
     */
    this._sendRequestHeader = null;
    /** @type {Object} */
    this._recvHeader = null;
    /**
     * @type {'ok'|'next'}
     */
    this._itemFlag = 'ok';
    /**
     * @type {boolean}
     */
    this._endFlag = false;
    /** @type {boolean} */
    this._haveWrittenEndHeader = false;
    /**
    * File handle for receiving.
    * @type {fs.FileHandle}
    */
    this._itemHandle = null;
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
     * The number of bytes after the previous speed measure.
     * @type {number}
     */
    this._speedBytes = 0;
    /**
     * The number of previous bytes after the previous speed measure.
     * @type {number}
     */
    this._prevSpeedBytes = 0;
    /**
     * Previous speed measure time in millisecond.
     * @type {number}
     */
    this._prevSpeedTime = Date.now();
    /**
     * More previous speed measure time in millisecond.
     * @type {number}
     */
    this._prevPrevSpeedTime = null;
    /**
     * Handle of send state time interval.
     * @type {number}
     */
    this._sendStateHandle = this._prevSpeedTime;

    this._init();
  }

  /**
   * Initialize Receiver by adding event listeners.
   * Call it inside contructor.
   */
  _init () {
    this._socket.removeAllListeners('data');
    this._socket.removeAllListeners('close');
    this._socket.removeAllListeners('error');
    this._sendState(this.getState());
    this._sendStateHandle = setInterval(() => {
      this._sendState(this.getState());
    }, STATE_INTERVAL);

    this._socket.on('data', async (data) => {
      if (this._haveWrittenEndHeader) {
        // Have written end header but received data.
        // Consider it as an error.
        this._handleNetworkErr();
        return;
      }
      let ret = null;
      if (!this._haveParsedHeader) {
        // Concatenate and try to parse header and save into header.
        this._recvBuf = Buffer.concat([this._recvBuf, data]);
        ret = splitHeader(this._recvBuf);
        if (!ret) {
          // The header is still splitted. Wait for more data by return.
          return;
        }
        try {
          this._recvHeader = JSON.parse(ret.header);
        } catch (err) {
          this._setState(STATE.ERR_NETWORK);
          console.error('Header parsing error. Not JSON format.');
          this._socket.destroy();
          return;
        }
        this._haveParsedHeader = true;
        this._recvBufArray = [ret.buf];
        this._recvBuf = Buffer.from([]);
        this._recvBufArrayLen = ret.buf.length;
      }
      else {
        this._recvBufArray.push(data);
        this._recvBufArrayLen += data.length;
      }

      // Reaching here means we now have header or already have header.
      switch (this._state) {
      case STATE.RECVING:
        switch (this._recvHeader.class) {
        case 'ok':
          if (this._recvBufArrayLen === this._recvHeader.size) {
            // One whole chunk received.
            // Write chunk on disk.
            try {
              await this._itemHandle.appendFile(Buffer.concat(this._recvBufArray));
            } catch (err) {
              // Appending to file error.
              // In this error, there is nothing tiShare can do about it.
              // Better delete what has been written so far,
              // mark it failed, and go to next item.
              // TODO mark the item failed.
              try {
                await this._itemHandle.close();
                await fs.rm(path.join(this._recvPath, this._itemName), {force: true});
              } finally {
                this._itemHandle = null;
                this._itemFlag = 'next';
                this._numRecvItem++;
                this._writeOnSocket();
              }
              return;
            }
            this._speedBytes += this._recvBufArrayLen;
            this._itemWrittenBytes += this._recvBufArrayLen;
            this._recvBuf = Buffer.from([]);
            this._itemFlag = 'ok';
            this._writeOnSocket();
          }
          break;
        case 'new':
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
                this._setState(STATE.ERR_FILE_SYSTEM);
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
              this._itemFlag = 'next';
              this._numRecvItem++;
              this._writeOnSocket();
              return;
            }
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
            this._itemHandle = null;
          }
          this._setState(STATE.RECV_COMPLETE);
          this._socket.end();
          break;
        case 'end':
          this._setState(STATE.OTHER_END);
          if (this._itemHandle) {
            // Close previous item handle.
            await this._itemHandle.close();
            await fs.rm(path.join(this._recvPath, this._itemName), {force: true});
          }
          this._socket.end();
          break;
        default:
          this._setState(STATE.ERR_NETWORK);
          this._socket.destroy();
          return;
        }
        break;
      default:
        // What the hell?
        // Unhandled Receiver state case.
        this._handleNetworkErr();
        return;
      }
    });

    this._socket.on('close', () => {
      if (!(this._state === STATE.RECV_COMPLETE || this._state === STATE.OTHER_END || this._haveWrittenEndHeader))
        // Unexpected close event.
        this._handleNetworkErr();
      else if (this._haveWrittenEndHeader)
        this._deleteCallback(this._ind);
    });

    this._socket.on('error', (err) => {
      console.error(err.message);
    });

    this._socket.setTimeout(SOCKET_TIMEOUT, () => {
      this._handleNetworkErr();
    });
  }

  /**
   * Return the # of bytes per second.
   * If the # of bytes or the interval is 0, calculate speed based on previous measure.
   * @returns {number}
   */
  getSpeed () {
    const now = Date.now();
    let ret = 0;
    if (now === this._prevSpeedTime || this._speedBytes === 0) {
      if (this._prevPrevSpeedTime === null)
        return 0;
      return this._prevSpeedBytes / (now - this._prevPrevSpeedTime);
    }
    ret = this._speedBytes / ((now - this._prevSpeedTime) / 1000);
    this._prevSpeedBytes = this._speedBytes;
    this._speedBytes = 0;
    this._prevPrevSpeedTime = this._prevSpeedTime;
    this._prevSpeedTime = now;
    return ret;
  }
  /**
   * Return the current item progress out of 100.
   * @returns {number}
   */
  getItemProgress () {
    // If item type is directory, set this._itemSize to 0.
    // In case of empty file whose size is 0, progress is 100%.
    return (this._itemSize === 0 ? 100 : Math.floor(this._itemWrittenBytes / this._itemSize * 100));
  }
  /**
   * Return a string representing the total progress.
   */
  getTotalProgress () {
    return this._numRecvItem + '/' + this._numItems;
  }

  /**
   * Return the current state
   */
  getState () {
    if (this._state === STATE.RECVING) {
      return {
        ind: this._ind,
        state: this._state,
        speed: this.getSpeed(),
        progress: this.getItemProgress(),
        totalProgress: this.getTotalProgress(),
        id: this._senderId,
        itemName: this._itemName,
      };
    }
    return {
      ind: this._ind,
      state: this._state,
      id: this._senderId
    };
  }

  /**
     * @param {string} state
     * Sets the state and call sendState.
     */
  _setState (state) {
    clearInterval(this._sendStateHandle);
    this._state = state;
    this._sendState(this.getState());
  }

  /**
   * End receiving.
   * @returns {boolean}
   */
  async end () {
    if (this._state === STATE.RECVING) {
      if (this._itemHandle) {
        // Delete currently receiving file.
        await this._itemHandle.close();
        this._itemHandle = null;
        await fs.rm(path.join(this._recvPath, this._itemName), {force: true});
      }
      this._endFlag = true;
      return true;
    }
    return false;
  }

  /**
   * Special method for writing to socket while receiving.
   */
  _writeOnSocket () {
    let header = null;
    this._haveParsedHeader = false;
    if (this._endFlag) {
      this._haveWrittenEndHeader = true;
      header = {class: 'end'};
      this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
      this._deleteCallback(this._ind);
      clearInterval(this._sendStateHandle);
      return;
    }
    switch (this._state) {
    case STATE.RECVING:
      header = {class: this._itemFlag};
      this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
      break;
    default:
      // TODO Handle edge case.
      break;
    }
  }

  /**
   * @param {Error} err
   */
  _onWriteError (err) {
    if (err) {
      console.error('Sender: Error Occurred during writing to Socket.');
      console.error(err);
      this._handleNetworkErr();
    }
  }

  /**
   * Handle on corrupted data from receiver.
   */
  _handleNetworkEr () {
    this._setState(STATE.ERR_NETWORK);
    this._socket.destroy();
  }
}

module.exports = Receiver;
