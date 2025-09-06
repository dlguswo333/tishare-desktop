// @ts-check
import fs from 'fs/promises';
import {STATE, CHUNKSIZE, SOCKET_TIMEOUT, STATE_INTERVAL} from '../../defs.js';
import {HEADER_END, splitHeader} from '../common.js';

class Sender {
  /** @type {number} */
  #ind;
  #state;
  /** @type {import('net').Socket} */
  #socket;
  /** @type {string} receiver ID. */
  #receiverId;
  /**
     * Normalized item array.
     * @type {import('../../types.js').TiItem[]}
     */
  #itemArray;
  /**
   * A callback that is called upon the end.
   * @type {Function}
   */
  #onEnd;
  /** @type {Function} */
  #sendState;
  /** @type {boolean} */
  #endFlag;
  /** @type {boolean} */
  #haveWrittenEndHeader;
  /**
   * Size of sent bytes of the current item.
   * @type {number}
   */
  #itemSentBytes;
  /**
   * Size of the item.
   * @type {number}
   */
  #itemSize;
  /**
   * @type {fs.FileHandle | null}
   */
  #itemHandle;
  /**
   * @type {number} Index in the item array.
   */
  #index;
  /**
   * @type {Buffer}
   */
  #recvBuf;
  /**
   * The number of bytes after the previous speed measure.
   * @type {number}
   */
  #speedBytes;
  /**
   * The number of previous bytes after the previous speed measure.
   * @type {number}
   */
  #prevSpeedBytes;
  /**
   * Previous speed measure time in millisecond.
   * @type {number}
   */
  #prevSpeedTime;
  /**
   * More previous speed measure time in millisecond.
   * @type {number | null}
   */
  #prevPrevSpeedTime;
  /**
   * Handle of send state time interval.
   * @type {ReturnType<setTimeout>?}
   */
  #sendStateHandle;

  /**
   * @param {number} ind
   * @param {import('net').Socket} socket
   * @param {string!} receiverId
   * @param {import('../../types.js').TiItem[]} itemArray
   * @param {Function} onExitCallback
   * @param {Function} sendState
   */
  constructor (ind, socket, receiverId, itemArray, onExitCallback, sendState) {
    this.#ind = ind;
    this.#state = STATE.SENDING;
    this.#socket = socket;
    this.#receiverId = receiverId;
    this.#itemArray = itemArray;
    this.#onEnd = onExitCallback;
    this.#sendState = sendState;
    this.#endFlag = false;
    this.#haveWrittenEndHeader = false;
    this.#itemSentBytes = 0;
    this.#itemSize = 0;
    this.#itemHandle = null;
    this.#index = 0;
    this.#recvBuf = Buffer.from([]);
    this.#speedBytes = 0;
    this.#prevSpeedBytes = 0;
    this.#prevSpeedTime = Date.now();
    this.#prevPrevSpeedTime = null;
    this.#sendStateHandle = null;

    this.#init();
  }

  /**
   * Send items to Receiver.
   * Call this if this was Requester.
   */
  send () {
    this.#send();
  }

  /**
   * End sending.
   * @returns {Promise<boolean>}
   */
  async end () {
    if (this.#state === STATE.SENDING) {
      this.#endFlag = true;
      return true;
    }
    return false;
  }

  /**
   * Initialize all event listeners necessary.
   * The function removes all pre-existing event listeners.
   */
  #init () {
    this.#socket.removeAllListeners('data');
    this.#socket.removeAllListeners('close');
    this.#socket.removeAllListeners('error');
    this.#sendState(this.getState());
    this.#sendStateHandle = setInterval(() => {
      this.#sendState(this.getState());
    }, STATE_INTERVAL);

    this.#socket.on('data', async (data) => {
      // Receiver always sends only headers.
      if (this.#haveWrittenEndHeader) {
        // Have written end header but received data.
        // Consider it as an error.
        this.#handleNetworkErr();
        return;
      }
      let recvHeader = null;
      this.#recvBuf = Buffer.concat([this.#recvBuf, data]);
      const ret = splitHeader(this.#recvBuf);
      if (!ret) {
        // Has not received header yet. just exit the function here for more data by return.
        return;
      }
      try {
        recvHeader = JSON.parse(ret.header);
      } catch (err) {
        this.#handleNetworkErr();
        return;
      }
      this.#recvBuf = ret.buf;
      switch (this.#state) {
      case STATE.SENDING:
        switch (recvHeader.class) {
        case 'ok':
          // Send header and chunk.
          this.#send();
          break;
        case 'end':
          this.#setState(STATE.OTHER_END);
          if (this.#itemHandle) {
            await this.#itemHandle.close();
            this.#itemHandle = null;
          }
          this.#socket.end();
          break;
        case 'next':
          if (this.#itemHandle) {
            // If itemHandle is not null there is a possibility that the handle has not been closed.
            // Thus checking it prevents any unexpected behavior.
            await this.#itemHandle.close();
            this.#goToNextItem();
          }
          this.#send();
          break;
        default:
          // What the hell?
          console.error('header class value error: Unexpected value ' + recvHeader.class);
          return;
        }
        break;
      default:
        // What the hell?
        console.error(`Sender: current state is ${this.#state} but received ${recvHeader.class}`);
        this.#handleNetworkErr();
        return;
      }
    });

    this.#socket.on('close', async () => {
      if (this.#itemHandle) {
        await this.#itemHandle.close();
        this.#itemHandle = null;
      }
      if (!(this.#state === STATE.SEND_COMPLETE || this.#state === STATE.OTHER_END || this.#haveWrittenEndHeader))
        // Unexpected close event.
        this.#setState(STATE.ERR_NETWORK);
      else if (this.#haveWrittenEndHeader)
        this.#onEnd(this.#ind);
    });

    this.#socket.on('error', (err) => {
      console.error(err.message);
    });

    this.#socket.setTimeout(SOCKET_TIMEOUT, this.#handleNetworkErr);
  }

  /**
   * Return the total number of items.
   * @returns {number}
   */
  getTotalNumItems () {
    return this.#itemArray.length;
  }

  /**
   * Return the # of bytes per second.
   * If the # of bytes or the interval is 0, calculate speed based on previous measure.
   * @returns {number}
   */
  getSpeed () {
    const now = Date.now();
    let ret = 0;
    if (now === this.#prevSpeedTime || this.#speedBytes === 0) {
      if (this.#prevPrevSpeedTime === null)
        return 0;
      return this.#prevSpeedBytes / (now - this.#prevPrevSpeedTime);
    }
    ret = this.#speedBytes / ((now - this.#prevSpeedTime) / 1000);
    this.#prevSpeedBytes = this.#speedBytes;
    this.#speedBytes = 0;
    this.#prevPrevSpeedTime = this.#prevSpeedTime;
    this.#prevSpeedTime = now;
    return ret;
  }

  /**
   * Return the current item progress out of 100.
   * @returns {number}
   */
  getItemProgress () {
    // If item type is directory, set this.#itemSize to 0.
    // In case of empty file whose size is 0, progress is 100%.
    return (this.#itemSize === 0 ? 100 : Math.floor(this.#itemSentBytes / this.#itemSize * 100));
  }

  /**
   * Return a string representing the total progress.
   */
  getTotalProgress () {
    return this.#index + '/' + this.getTotalNumItems();
  }

  /**
   * Return the current state.
   */
  getState () {
    if (this.#state === STATE.SENDING) {
      let itemName = '';
      try {
        itemName = this.#itemArray[this.#index].name;
      }
      catch {
        itemName = '';
      }
      return {
        ind: this.#ind,
        state: this.#state,
        speed: this.getSpeed(),
        progress: this.getItemProgress(),
        totalProgress: this.getTotalProgress(),
        id: this.#receiverId,
        itemName: itemName
      };
    }
    return {
      ind: this.#ind,
      state: this.#state,
      id: this.#receiverId
    };
  }

  /**
   * @param {string} state
   * Sets the state and call sendState.
   */
  #setState (state) {
    if (this.#sendStateHandle) {
      clearInterval(this.#sendStateHandle);
    }
    this.#state = state;
    this.#sendState(this.getState());
  }

  async #send () {
    let header = null;
    if (this.#endFlag) {
      this.#haveWrittenEndHeader = true;
      header = {class: 'end'};
      this.#socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this.#onSendError);
      this.#onEnd(this.#ind);
      if (this.#sendStateHandle) {
        clearInterval(this.#sendStateHandle);
      }
      return;
    }
    if (this.#index >= this.#itemArray.length) {
      // End of send.
      this.#setState(STATE.SEND_COMPLETE);
      header = {class: 'done'};
      this.#socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this.#onSendError);
      return;
    }
    if (!this.#itemHandle) {
      // Send 'new' header.
      try {
        let itemStat = await fs.stat(this.#itemArray[this.#index].path);
        if (itemStat.isDirectory()) {
          this.#itemSize = 0;
          this.#itemSentBytes = 0;
          header = {
            class: 'new',
            name: this.#itemArray[this.#index].name,
            dir: this.#itemArray[this.#index].dir,
            type: 'directory'
          };
          this.#goToNextItem();
        }
        else {
          this.#itemHandle = await fs.open(this.#itemArray[this.#index].path);
          this.#itemSize = itemStat.size;
          this.#itemSentBytes = 0;
          header = {
            class: 'new',
            name: this.#itemArray[this.#index].name,
            dir: this.#itemArray[this.#index].dir,
            type: 'file',
            size: itemStat.size
          };
        }
      } catch (err) {
        // Go to next item.
        this.#goToNextItem();
        setTimeout(this.#send, 0);
        return;
      }
      header = JSON.stringify(header);
      this.#socket.write(Buffer.from(header + HEADER_END, 'utf-8'), this.#onSendError);
    }
    else {
      // itemHandle is not null.
      // Send a chunk with header.
      try {
        let chunk = Buffer.alloc(CHUNKSIZE);
        let ret = await this.#itemHandle.read(chunk, 0, CHUNKSIZE, null);
        this.#itemSentBytes += ret.bytesRead;
        chunk = chunk.subarray(0, ret.bytesRead);
        if (this.#itemSentBytes === this.#itemSize) {
          // EOF reached. Done reading this item.
          await this.#itemHandle.close();
          this.#goToNextItem();
        }
        else if (ret.bytesRead === 0 || this.#itemSentBytes > this.#itemSize) {
          // File size changed. This is unexpected thus consider it an error.
          await this.#itemHandle.close();
          throw new Error('File Changed');
        }
        header = {class: 'ok', size: ret.bytesRead};
        header = JSON.stringify(header);
        this.#socket.write(Buffer.concat([Buffer.from(header + HEADER_END, 'utf-8'), chunk]), (err) => {
          this.#speedBytes += chunk.byteLength;
          this.#onSendError(err);
        });
      } catch (err) {
        // Go to next item.
        this.#goToNextItem();
        setTimeout(this.#send, 0);
        return;
      }
    }
  }

  /**
   * Reset the item related variable and go to next item.
   */
  #goToNextItem () {
    this.#index++;
    this.#itemHandle = null;
  }

  /**
   * @param {Error | undefined} err
   */
  #onSendError (err) {
    if (err) {
      console.error('Sender: Error Occurred during writing to Socket.');
      console.error(err);
      this.#handleNetworkErr();
    }
  }

  /**
   * Handle on corrupted data from receiver.
   */
  #handleNetworkErr () {
    this.#setState(STATE.ERR_NETWORK);
    this.#socket.destroy();
  }
}

export default Sender;
