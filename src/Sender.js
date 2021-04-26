const net = require('net');
const fs = require('fs').promises;
const { Stat } = require('fs');
const path = require('path');
const { PORT, STATE, HEADER_END, VERSION, CHUNKSIZE, _splitHeader } = require('./Network');

class Sender {
  /**
   * 
   * @param {String} myId 
   */
  constructor(myId) {
    if (!myId) {
      this._state = STATE.ERR_FS;
      return;
    }
    /**
     * @type {String} my id.
     */
    this._myId = myId;
    this._state = STATE.IDLE;
    /**
     * Message describing the most recent activity or errors.
     */
    this._message = '';
    /**
     * @type {net.Socket}
     */
    this._socket = null;
    /**
     * @type {Array.<{name:String, path:String, size:number}>}
     */
    this._itemArray = null;
    /**
     * Size of read bytes of the item.
     * @type {number}
     */
    this._itemReadBytes = 0;
    /**
     * Size of the item.
     */
    this._itemSize = 0;
    /**
     * @type {fs.FileHandle}
     */
    this._itemHandle = null;
    /**
     * @type {number} Number of bytes sent so far.
     */
    this._speedBytes = 0;
    /**
     * @type {number} Previous Date.now() value when calculating speed. 
     */
    this._speedStart = 0;
    /**
     * @type {number} Index in itemArray.
     */
    this._index = 0;
    /**
     * @type {Buffer}
     */
    this._recvBuf = new Buffer.from([]);

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
   * @param {Array.<{name:String, path:String}>} itemArray
   * @param {String} receiverIp 
   */
  send(itemArray, receiverIp) {
    this._state = STATE.SEND_REQUEST;
    this._itemArray = itemArray;
    this._index = 0;

    if (this._itemArray.length === 0) {
      // Nothing to send and consider it send complete.
      this._state = STATE.SEND_COMPLETE;
      this._message = 'Send Complete. Nothing to sent.';
      return;
    }

    this._socket = net.createConnection(PORT, receiverIp);
    this._socket.on('connect', async () => {
      console.log('client socket connected to ' + this._socket.remoteAddress);
      let sendRequestHeader = await this._createSendRequestHeader(this._itemArray);
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
        this._message = 'Received corrupted header from receiver.';
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
              // TODO Implement
              break
            case 'end':
              // TODO Implement
              break
            case 'next':
              // TODO Implement
              if (this._itemHandle) {
                // _itemHandle is not null only when sending the current item is not finished.
                // Thus checking it will prevent any unexpected skip.
                await this._itemHandle.close();
                this._resetItem();
              }
              this._send();
              break;
            default:
              // What the hell?
              console.error('header class value error: Unexpected value ' + recvHeader.class);
              return;
          }
          break;
        default:
          // What the hell?
          console.error('header class value error: Unexpected value ' + recvHeader.class);
          return;
      }
    });

    this._socket.on('close', () => {
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

  async _send() {
    let header = null;
    if (this._index >= this._itemArray.length) {
      // End of send.
      console.log('Sender: Send complete');
      this._state = STATE.SEND_COMPLETE;
      header = { class: 'done' };
      this._socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', () => {
        this._socket.end();
      });
      return;
    }
    if (!this._itemHandle) {
      // Send 'new' header.
      try {
        let itemStat = await fs.stat(this._itemArray[this._index].path);
        if (itemStat.isDirectory()) {
          header = {
            class: 'new',
            name: this._itemArray[this._index].name,
            type: 'directory'
          };
          this._resetItem();
        }
        else {
          this._itemHandle = await fs.open(this._itemArray[this._index].path);
          this._itemSize = itemStat.size;
          this._itemReadBytes = 0;
          header = {
            class: 'new',
            name: this._itemArray[this._index].name,
            type: 'file',
            size: itemStat.size
          };
        }
      } catch (err) {
        // Go to next item.
        this._resetItem();
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
        this._itemReadBytes += ret.bytesRead;
        chunk = chunk.slice(0, ret.bytesRead);
        if (this._itemReadBytes === this._itemSize) {
          // EOF reached. Done reading this item.
          await this._itemHandle.close();
          this._resetItem();
        }
        else if (ret.bytesRead === 0 || this._itemReadBytes > this._itemSize) {
          // File size changed. This is unexpected thus consider it an error.
          await this._itemHandle.close();
          throw new Error('File Changed');
        }
        header = { class: 'ok', size: ret.bytesRead };
        header = JSON.stringify(header);
        this._socket.write(Buffer.concat([Buffer.from(header + HEADER_END, 'utf-8'), chunk]), this._onWriteError);
      } catch (err) {
        // Go to next item.
        this._resetItem();
        setTimeout(() => { this._send(); }, 0);
        return;
      }
    }
  }

  /**
   * Create and return send request header.
   * Return null on Any Error.
   * @returns {Promise<{app:String, version: String, class: String, itemArray:Array.<{name:String, type:String, size:number}>}>}
   */
  async _createSendRequestHeader() {
    let header = { app: 'SendDone', version: VERSION, class: 'send-request', id: this._myId, itemArray: [] };
    let itemStat = null;
    for (let item of this._itemArray) {
      try {
        itemStat = await fs.stat(item.path);
      } catch (err) {
        this._state = STATE.ERROR;
        this._message = 'Could not read ' + item.path;
        return null;
      }
      let itemHeader = null;
      if (itemStat.isDirectory()) {
        itemHeader = this._createDirectoryHeader(item.name);
      }
      else {
        itemHeader = this._createFileHeader(item.name, itemStat.size);
      }
      header.itemArray.push(itemHeader);
    }
    return header;
  }

  /**
   * @param {String} name name of the item.
   * @param {number} size Size of the item.
   * @returns {{name:String, type: String, size: number}} 
   */
  _createFileHeader(name, size) {
    const header = { name: name, type: 'file', size: size }
    return header;
  }

  /**
   * @param {String} name name of the item.
   * @returns {{name:String, type: String}} 
   */
  _createDirectoryHeader(name) {
    const header = { name: name, type: 'directory' }
    return header;
  }

  /**
   * Reset the item related variable to go to next item.
   */
  _resetItem() {
    this._index++;
    this._itemHandle = null;
    this._itemReadBytes = 0;
  }
}


module.exports = { Sender };