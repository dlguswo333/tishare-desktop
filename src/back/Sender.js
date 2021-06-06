const net = require('net');
const fs = require('fs').promises;
const { Stats } = require('fs');
const { PORT, STATE, HEADER_END, VERSION, CHUNKSIZE, _splitHeader } = require('./Network');

/**
 * @typedef {{dir:string, path:string, type:string, size:number, items:Object.<string, any>}} item
 */

class Sender {
  /**
   * 
   * @param {string} myId 
   */
  constructor(myId) {
    this._state = STATE.IDLE;
    if (!myId) {
      this._state = STATE.ERR_FS;
      return;
    }
    /**
     * @type {string} my id.
     */
    this._myId = myId;
    /**
     * @type {boolean} 
     */
    this._stopFlag = false;
    /**
     * @type {boolean}
     */
    this._endFlag = false;
    /**
     * @type {net.Socket}
     */
    this._socket = null;
    /**
     * Normalized item array.
     * @type {Array.<{path:string, dir:string, name:string, type:string, size:number}>}
     */
    this._itemArray = null;
    /**
     * Size of sent bytes of the current item.
     * @type {number}
     */
    this._itemSentBytes = 0;
    /**
     * Size of the item.
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
        console.error(err);
        this._socket.destroy();
        this._state = STATE.ERR_NET;
      }
    }

    /**
     * Handle on corrupted data from receiver.
     * NOTE that it does not set message.
     */
    this._handleNetworkErr = () => {
      this._state = STATE.ERR_NET;
      this._socket.end();
    }
  }

  /**
   * Create a new client socket with the receiver ip and send items in the array.
   * Call this API from UI.
   * @param {Object.<string, {dir:string, path:string, type:string, size:number}>} items
   * @param {string} receiverIp 
   */
  async send(items, receiverIp) {
    this._state = STATE.SEND_REQUEST;
    this._itemArray = [];
    this._index = 0;
    this._speedBytes = 0;

    await this._createItemArray(items);
    if (this.getTotalNumItems() === 0) {
      // Nothing to send and consider it send complete.
      this._state = STATE.SEND_DONE;
      return;
    }

    this._socket = net.createConnection(PORT, receiverIp);
    this._socket.on('connect', async () => {
      console.log('client socket connected to ' + this._socket.remoteAddress);
      let sendRequestHeader = this._createSendRequestHeader(items);
      if (sendRequestHeader === null) {
        this._socket.end();
        return;
      }
      console.log('Sender: About to send total ' + this._itemArray.length);
      this._socket.write(JSON.stringify(sendRequestHeader) + HEADER_END, 'utf-8', this._onWriteError);
    });

    this._socket.on('data', async (data) => {
      // Receiver always sends header only.
      let recvHeader = null;
      this._recvBuf = Buffer.concat([this._recvBuf, data]);
      const ret = _splitHeader(this._recvBuf);
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
        case STATE.SEND_REQUEST:
          switch (recvHeader.class) {
            case 'ok':
              this._state = STATE.SEND;
              // Send header and chunk.
              this._send();
              break;
            case 'no':
              this._state = STATE.SEND_REJECT;
              this._socket.end();
              return;
            default:
              // What the hell?
              console.error('header class value error: Unexpected value ' + recvHeader.class);
              this._state = STATE.ERR_NET;
              this._socket.end();
              return;
          }
          break;
        case STATE.SEND:
          switch (recvHeader.class) {
            case 'ok':
              // Send header and chunk.
              this._send();
              break;
            case 'stop':
              this._state = STATE.RECEIVER_STOP;
              break
            case 'end':
              this._state = STATE.RECEIVER_END;
              this._socket.end();
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
        case STATE.RECEIVER_STOP:
          switch (recvHeader.class) {
            case 'ok':
              // Receiver wants to resume from stop.
              this._state = STATE.SEND;
              this._send();
              break;
            case 'end':
              this._state = STATE.RECEIVER_END;
            default:
              // What the hell?
              break;
          }
          break;
        case STATE.SENDER_STOP:
          switch (recvHeader.class) {
            case 'end':
              this._state = STATE.RECEIVER_END;
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
      if (!(this._state === STATE.SEND_DONE || this._state === STATE.RECEIVER_END || this._state === STATE.SENDER_END))
        // Unexpected close event.
        this._state = STATE.ERR_NET;
      this._socket.end();
    });

    this._socket.on('error', (err) => {
      if (err.code === 'ETIMEDOUT') {
        console.error('Sender: failed to connect due to timeout');
      }
      this._state = STATE.ERR_NET;
    })
  }

  /**
   * Stop sending for a moment.
   * @returns {boolean}
   */
  stop() {
    if (this._state === STATE.SEND)
      return (this._stopFlag = true);
    return false;
  }
  /**
   * Resume from stop.
   * @returns {boolean}
   */
  resume() {
    if (this._state === STATE.SENDER_STOP) {
      this._state = STATE.SEND;
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
    if (this._state === STATE.SEND || this._state === STATE.SEND_REQUEST || this._state === STATE.SENDER_STOP || this._state === STATE.RECEIVER_STOP) {
      if (this._itemHandle) {
        await this._itemHandle.close();
      }
      this._endFlag = true;
      if (this._state === STATE.SENDER_STOP || this._state === STATE.RECEIVER_STOP) {
        // Send end header immediately while stop.
        let header = { class: 'end' };
        this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
      }
      return true;
    }
    return false;
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
  getNumItems(item) {
    let ret = 0;
    for (let subItem in item.items) {
      ++ret;
      if (item.type === 'directory')
        ret += this.getNumItems(subItem);
    }
    return ret;
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
    return (this._itemSize === 0 ? 100 : Math.floor(this._itemSentBytes / this._itemSize * 100));
  }
  /**
   * Return a string representing the total progress.
   */
  getTotalProgress() {
    return this._index + '/' + this.getTotalNumItems();
  }

  /**
   * Return the current state
   */
  getState() {
    if (this._state === STATE.SEND_REQUEST) {
      return { state: this._state };
    }
    if (this._state === STATE.SEND) {
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
        name: itemName
      };
    }
    return { state: this._state };
  }

  async _send() {
    let header = null;
    if (this._endFlag) {
      this._endFlag = false;
      this._state = STATE.RECEIVER_END;
      header = { class: 'end' };
      this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
      return;
    }
    if (this._stopFlag) {
      this._stopFlag = false;
      this._state = STATE.SENDER_STOP;
      header = { class: 'stop' };
      this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this._onWriteError);
      return;
    }
    if (this._state === STATE.SENDER_STOP) {
      // What the hell?
      // Do not do anything.
      return;
    }
    if (this._index >= this._itemArray.length) {
      // End of send.
      console.log('Sender: Send complete');
      this._state = STATE.SEND_DONE;
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
        this._socket.write(Buffer.concat([Buffer.from(header + HEADER_END, 'utf-8'), chunk]), this._onWriteError);
        this._speedBytes += chunk.byteLength;
      } catch (err) {
        // Go to next item.
        this._goToNextItem();
        setTimeout(() => { this._send(); }, 0);
        return;
      }
    }
  }

  /**
   * Create and return send request header.
   * Return null on Any Error.
   * @param {{}} items
   * @returns {{app:string, version: string, class: string, items:Object.<string, item>}}
   */
  _createSendRequestHeader(items) {
    let header = { app: 'SendDone', version: VERSION, class: 'send-request', id: this._myId, itemArray: this._itemArray };
    return header;
  }

  /**
   * Deep copy items Object and return the result.
   * When calling the function, let dst value undefined.
   * @param {Object.<string, item>} items
   * @param {boolean} noPath
   */
  _deepCopyItems(dst, items, noPath) {
    let retFlag = false;
    if (dst === undefined) {
      retFlag = true;
      dst = {};
    }
    for (let itemName in items) {
      dst[itemName] = {};
      for (let key in items[itemName]) {
        if (key === 'items') {
          // Deep copy it.
          this._deepCopyItems(dst[itemName], items[itemName], noPath);
        }
        else if (key !== 'path' || !noPath)
          dst[itemName][key] = items[itemName][key];
      }
    }
    if (retFlag)
      return dst;
  }

  /**
   * Normalize tree structure items into serialized item array.
   * Before calling the function, be sure that this._itemArray is an empty array.
   * @param {Object.<string, item>} items
   */
  async _createItemArray(items) {
    for (let itemName in items) {
      let itemStat = await fs.stat(items[itemName].path);
      if (itemStat.isDirectory()) {
        this._itemArray.push(this._createDirectoryHeader(items[itemName].path, items[itemName].name, items[itemName].dir));
        await this._createItemArray(items[itemName].items);
      }
      else {
        this._itemArray.push(this._createFileHeader(items[itemName].path, items[itemName].name, items[itemName].dir, itemStat.size));
      }
    }
  }

  /**
   * @param {string} path Path of the item.
   * @param {string} name Name of the item.
   * @param {string} dir Directory of the item.
   * @param {number} size Size of the item.
   * @returns {{name:string, type: string, size: number}} 
   */
  _createFileHeader(path, name, dir, size) {
    const header = { path: path, name: name, dir: dir.split('\\').join('/'), type: 'file', size: size }
    return header;
  }

  /**
   * @param {string} path Path of the item.
   * @param {string} name name of the item.
   * @param {string} dir Directory of the item.
   * @returns {{name:string, type: string}} 
   */
  _createDirectoryHeader(path, name, dir) {
    const header = { path: path, name: name, dir: dir.split('\\').join('/'), type: 'directory' }
    return header;
  }

  /**
   * Reset the item related variable and go to next item.
   */
  _goToNextItem() {
    this._index++;
    this._itemHandle = null;
  }
}


module.exports = { Sender };