const fs = require('fs').promises;
const { STATE, CHUNKSIZE } = require('../defs');
const { HEADER_END, splitHeader } = require('./Common');

/**
 * @typedef {{dir:string, path:string, type:string, size:number, items:Object.<string, any>}} item
 */

class Sender {
  /**
   * @param {import('net').Socket} socket
   * @param {Array.<{path:string, dir:string, name:string, type:string, size:number}>} itemArray
   * @param {string!} receiverId
   */
  constructor(socket, receiverId, itemArray) {
    this._state = STATE.SENDING;
    /** @type {import('net').Socket} */
    this._socket = socket;
    /** @type {string} _receiver ID. */
    this._receiverId = receiverId;
    /**
     * Normalized item array.
     * @type {Array.<{path:string, dir:string, name:string, type:string, size:number}>}
     */
    this._itemArray = itemArray;
    /** @type {boolean} */
    this._stopFlag = false;
    /** @type {boolean} */
    this._endFlag = false;
    /**
     * Size of sent bytes of the current item.
     * @type {number}
     */
    this._itemSentBytes = 0;
    /**
     * Size of the item.
     * @type {number}
     */
    this._itemSize = 0;
    /**
     * @type {fs.FileHandle}
     */
    this._itemHandle = null;
    /**
     * @type {number} Index in the item array.
     */
    this._index = 0;
    /**
     * @type {Buffer}
     */
    this._recvBuf = new Buffer.from([]);
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
    this._prevSpeedTime = null;
    /**
     * More previous speed measure time in millisecond.
     * @type {number} 
     */
    this._prevPrevSpeedTime = null;

    this._init();
  }

  /**
   * Send items to Receiver.
   * Call this if this was Requester.
   */
  send() {
    this._send();
  }

  /**
   * Stop sending for a moment.
   * @returns {boolean}
   */
  stop() {
    if (this._state === STATE.SENDING)
      return (this._stopFlag = true);
    return false;
  }
  /**
   * Resume from stop.
   * @returns {boolean}
   */
  resume() {
    if (this._state === STATE.SENDER_PAUSE) {
      this._state = STATE.SENDING;
      this._send();
      return true;
    }
    return false;
  }
  /**
   * End sending.
   * @returns {boolean}
   */
  async end() {
    if (this._state === STATE.SENDING || this._state === STATE.SENDER_PAUSE || this._state === STATE.RECVER_PAUSE) {
      this._endFlag = true;
      if (this._itemHandle) {
        await this._itemHandle.close();
      }
      if (this._state === STATE.SENDER_PAUSE || this._state === STATE.RECVER_PAUSE) {
        // Send end header immediately while stop.
        await this._send();
      }
      return true;
    }
    return false;
  }

  /**
   * Initialize all event listeners necessary.
   * The function removes all pre-existing event listeners. 
   */
  _init() {
    this._socket.removeAllListeners('data');
    this._socket.removeAllListeners('close');
    this._socket.removeAllListeners('error');

    this._socket.on('data', async (data) => {
      // Receiver always sends header only.
      let recvHeader = null;
      this._recvBuf = Buffer.concat([this._recvBuf, data]);
      const ret = splitHeader(this._recvBuf);
      if (!ret) {
        // Has not received header yet. just exit the function here for more data by return.
        return;
      }
      try {
        recvHeader = JSON.parse(ret.header);
      } catch (err) {
        this._handleNetworkErr();
        return;
      }
      this._recvBuf = ret.buf;
      switch (this._state) {
        case STATE.SENDING:
          switch (recvHeader.class) {
            case 'ok':
              // Send header and chunk.
              this._send();
              break;
            case 'stop':
              this._state = STATE.RECVER_PAUSE;
              break
            case 'end':
              this._state = STATE.OTHER_END;
              this._socket.end(() => { this._socket = null; });
              break
            case 'next':
              if (this._itemHandle) {
                // _itemHandle is not null only when sending the current item is not finished.
                // Thus checking it will prevent any unexpected skip.
                await this._itemHandle.close();
                this._goToNextItem();
              }
              this._send();
              break;
            default:
              // What the hell?
              console.error('header class value error: Unexpected value ' + recvHeader.class);
              return;
          }
          break;
        case STATE.RECVER_PAUSE:
          switch (recvHeader.class) {
            case 'ok':
              // Receiver wants to resume from stop.
              this._state = STATE.SENDING;
              this._send();
              break;
            case 'end':
              this._state = STATE.OTHER_END;
              this._socket.end();
            default:
              // What the hell?
              break;
          }
          break;
        case STATE.SENDER_PAUSE:
          switch (recvHeader.class) {
            case 'end':
              this._state = STATE.OTHER_END;
              this._socket.end();
              break;
            // Ignore any other classes.
          }
          break;
        default:
          // What the hell?
          console.error('header class value error: Unexpected value ' + recvHeader.class);
          return;
      }
    });

    this._socket.on('close', () => {
      if (!(this._state === STATE.SEND_COMPLETE || this._state === STATE.OTHER_REJECT || this._state === STATE.OTHER_END || this._state === STATE.MY_END))
        // Unexpected close event.
        this._state = STATE.ERR_NETWORK;
      this._socket.end();
    });

    this._socket.on('error', (err) => {
      if (err.code === 'ETIMEDOUT') {
        console.error('Sender: failed to connect due to timeout');
      }
      this._state = STATE.ERR_NETWORK;
    })
  }

  /**
   * Return the total number of items.
   * @returns {number}
   */
  getTotalNumItems() {
    return this._itemArray.length;
  }
  /**
   * Return the number of nested items.
   * @param {item} item
   * @returns {number}
   */
  _getNumItems(item) {
    let ret = 0;
    for (let subItem in item.items) {
      ++ret;
      if (item.type === 'directory')
        ret += this._getNumItems(subItem);
    }
    return ret;
  }

  /**
   * Return the # of bytes per second.
   * If the # of bytes or the interval is 0, calculate speed based on previous measure.
   * @returns {number}
   */
  getSpeed() {
    const now = Date.now();
    let ret = 0;
    if (now === this._prevSpeedTime || this._speedBytes === 0) {
      if (this._prevPrevSpeedTime === 0)
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
  getItemProgress() {
    // If item type is directory, set this._itemSize to 0.
    // In case of empty file whose size is 0, progress is 100%.
    return (this._itemSize === 0 ? 100 : Math.floor(this._itemSentBytes / this._itemSize * 100));
  }
  /**
   * Return a string representing the total progress.
   */
  getTotalProgress() {
    return this._index + '/' + this.getTotalNumItems();
  }

  /**
   * Return the current state.
   */
  getState() {
    if (this._state === STATE.RQR_SEND_REQUEST) {
      return {
        state: this._state,
        id: this._receiverId
      };
    }
    if (this._state === STATE.SENDING) {
      let itemName = '';
      try {
        itemName = this._itemArray[this._index].name;
      }
      catch {
        itemName = '';
      }
      return {
        state: this._state,
        speed: this.getSpeed(),
        progress: this.getItemProgress(),
        totalProgress: this.getTotalProgress(),
        itemName: itemName
      };
    }
    return { state: this._state, id: this._receiverId };
  }

  async _send() {
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
      this._state = STATE.SENDER_PAUSE;
      header = { class: 'stop' };
      this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
      return;
    }
    if (this._state === STATE.SENDER_PAUSE) {
      // What the hell?
      // Do not do anything.
      return;
    }
    if (this._index >= this._itemArray.length) {
      // End of send.
      console.log('Sender: Send complete');
      this._state = STATE.SEND_COMPLETE;
      header = { class: 'done' };
      this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
      return;
    }
    if (!this._itemHandle) {
      // Send 'new' header.
      try {
        let itemStat = await fs.stat(this._itemArray[this._index].path);
        if (itemStat.isDirectory()) {
          this._itemSize = 0;
          this._itemSentBytes = 0;
          header = {
            class: 'new',
            name: this._itemArray[this._index].name,
            dir: this._itemArray[this._index].dir,
            type: 'directory'
          };
          this._goToNextItem();
        }
        else {
          this._itemHandle = await fs.open(this._itemArray[this._index].path);
          this._itemSize = itemStat.size;
          this._itemSentBytes = 0;
          header = {
            class: 'new',
            name: this._itemArray[this._index].name,
            dir: this._itemArray[this._index].dir,
            type: 'file',
            size: itemStat.size
          };
        }
      } catch (err) {
        // Go to next item.
        this._goToNextItem();
        setTimeout(() => { this._send(); }, 0);
        return;
      }
      header = JSON.stringify(header);
      this._socket.write(Buffer.from(header + HEADER_END, 'utf-8'), this._onWriteError);
    }
    else {
      // itemHandle is null.
      // Send a chunk with header.
      try {
        let chunk = Buffer.alloc(CHUNKSIZE);
        let ret = await this._itemHandle.read(chunk, 0, CHUNKSIZE, null);
        this._itemSentBytes += ret.bytesRead;
        chunk = chunk.slice(0, ret.bytesRead);
        if (this._itemSentBytes === this._itemSize) {
          // EOF reached. Done reading this item.
          await this._itemHandle.close();
          this._goToNextItem();
        }
        else if (ret.bytesRead === 0 || this._itemSentBytes > this._itemSize) {
          // File size changed. This is unexpected thus consider it an error.
          await this._itemHandle.close();
          throw new Error('File Changed');
        }
        header = { class: 'ok', size: ret.bytesRead };
        header = JSON.stringify(header);
        this._socket.write(Buffer.concat([Buffer.from(header + HEADER_END, 'utf-8'), chunk]), (err) => {
          this._speedBytes += chunk.byteLength;
          this._onWriteError(err);
        });
      } catch (err) {
        // Go to next item.
        this._goToNextItem();
        setTimeout(() => { this._send(); }, 0);
        return;
      }
    }
  }

  /**
   * Reset the item related variable and go to next item.
   */
  _goToNextItem() {
    this._index++;
    this._itemHandle = null;
  }

  _onWriteError = (err) => {
    if (err) {
      console.error('Sender: Error Occurred during writing to Socket.');
      console.error(err);
      this._socket.destroy();
      this._state = STATE.ERR_NETWORK;
    }
  }

  /**
   * Handle on corrupted data from receiver.
   */
  _handleNetworkErr = () => {
    this._state = STATE.ERR_NETWORK;
    this._socket.end();
  }
}

module.exports = Sender;
