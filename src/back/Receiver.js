// @ts-check
import fs from 'fs/promises';
import path from 'path';
import {HEADER_END, splitHeader} from './Common.js';
import {STATE, SOCKET_TIMEOUT, STATE_INTERVAL} from '../defs.js';

class Receiver {
  /** @type {number} */
  #ind;
  /** @type {STATE[keyof STATE]} */
  #state;
  /** @type {import('net').Socket} */
  #socket;
  /** @type {string} */
  #senderId;
  /** @type {string} */
  #recvPath;
  /** @type {number} */
  #numItems;
  /**
   * A callback that is called upon the end.
   * @type {Function}
   */
  #onEnd;
  /** @type {Function} */
  #sendState;
  /** @type {Buffer} */
  #recvBuf;
  /** @type {Buffer[]} */
  #recvBufArray;
  /** @type {number} */
  #recvBufArrayLen;
  /** @type {boolean} Whether Receiver have parsed header. */
  #haveParsedHeader;
  /**
   * Send Request header.
   * @type {{app: string, version:string, class:string, id:string, itemArray: import('./Common').Item[]} | null}
   */
  #sendRequestHeader;
  /** @type {Object} */
  #recvHeader;
  /**
   * @type {'ok'|'next'}
   */
  #itemFlag;
  /**
   * @type {boolean}
   */
  #endFlag;
  /** @type {boolean} */
  #haveWrittenEndHeader;
  /**
  * File handle for receiving.
  * @type {fs.FileHandle | null}
  */
  #itemHandle;
  /**
   * Name of the current item excluding download path.
   * @type {string | null}
   */
  #itemName;
  /**
   * Size of the current item.
   * @type {number}
   */
  #itemSize;
  /**
   * Size of received bytes for this item.
   */
  #itemWrittenBytes;
  /**
   * Number of received items so far.
   * @type {number}
   */
  #numRecvItem;
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
   * @param {string!} senderId
   * @param {string!} recvDir
   * @param {number!} numItems
   * @param {Function} onExitCallback
   * @param {Function} sendState
   */
  constructor (ind, socket, senderId, recvDir, numItems, onExitCallback, sendState) {
    this.#ind = ind;
    this.#state = STATE.RECVING;
    this.#socket = socket;
    this.#senderId = senderId;
    this.#recvPath = recvDir;
    this.#numItems = numItems;
    this.#onEnd = onExitCallback;
    this.#sendState = sendState;
    this.#recvBuf = Buffer.from([]);
    this.#recvBufArray = [];
    this.#recvBufArrayLen = 0;
    this.#haveParsedHeader = false;
    this.#sendRequestHeader = null;
    this.#recvHeader = null;
    this.#itemFlag = 'ok';
    this.#endFlag = false;
    this.#haveWrittenEndHeader = false;
    this.#itemHandle = null;
    this.#itemName = null;
    this.#itemSize = 0;
    this.#itemWrittenBytes = 0;
    this.#numRecvItem = 0;
    this.#speedBytes = 0;
    this.#prevSpeedBytes = 0;
    this.#prevSpeedTime = Date.now();
    this.#prevPrevSpeedTime = null;
    this.#sendStateHandle = null;

    this.#init();
  }

  /**
   * Initialize Receiver by adding event listeners.
   * Call it inside contructor.
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
      if (this.#haveWrittenEndHeader) {
        // Have written end header but received data.
        // Consider it as an error.
        this.#onNetworkError();
        return;
      }
      let ret = null;
      if (!this.#haveParsedHeader) {
        // Concatenate and try to parse header and save into header.
        this.#recvBuf = Buffer.concat([this.#recvBuf, data]);
        ret = splitHeader(this.#recvBuf);
        if (!ret) {
          // The header is still splitted. Wait for more data by return.
          return;
        }
        try {
          this.#recvHeader = JSON.parse(ret.header);
        } catch (err) {
          this.#setState(STATE.ERR_NETWORK);
          console.error('Header parsing error. Not JSON format.');
          this.#socket.destroy();
          return;
        }
        this.#haveParsedHeader = true;
        this.#recvBufArray = [ret.buf];
        this.#recvBuf = Buffer.from([]);
        this.#recvBufArrayLen = ret.buf.length;
      }
      else {
        this.#recvBufArray.push(data);
        this.#recvBufArrayLen += data.length;
      }

      // Reaching here means we now have header or already have header.
      switch (this.#state) {
      case STATE.RECVING:
        switch (this.#recvHeader.class) {
        case 'ok':
          if (this.#recvBufArrayLen === this.#recvHeader.size) {
            try {
              // One whole chunk has been received.
              // Write the chunk on disk.
              if (!this.#itemHandle) {
                throw new Error('#itemHandle is null and this should not be occur.');
              }
              await this.#itemHandle.appendFile(Buffer.concat(this.#recvBufArray));
            } catch (err) {
              // Appending to file error.
              // In this error, there is nothing tiShare can do about it.
              // Better delete what has been written so far,
              // mark it failed, and go to next item.
              // TODO mark the item failed.
              try {

                if (this.#itemHandle) {
                  await this.#itemHandle.close();
                }
                if (this.#itemName) {
                  await fs.rm(path.join(this.#recvPath, this.#itemName), {force: true});
                }
              } finally {
                this.#itemHandle = null;
                this.#itemFlag = 'next';
                this.#numRecvItem++;
                this.sendHeader();
              }
              return;
            }
            this.#speedBytes += this.#recvBufArrayLen;
            this.#itemWrittenBytes += this.#recvBufArrayLen;
            this.#recvBuf = Buffer.from([]);
            this.#itemFlag = 'ok';
            this.sendHeader();
          }
          break;

        case 'new':
          this.#itemName = path.join(this.#recvHeader.dir, this.#recvHeader.name);
          if (this.#recvHeader.type === 'directory') {
            this.#haveParsedHeader = false;
            this.#itemSize = 0;
            this.#numRecvItem++;
            try {
              await fs.mkdir(path.join(this.#recvPath, this.#itemName));
            } catch (err) {
              if (err.code !== 'EEXIST') {
                // Making directory failed.
                // Even making directory failed means there are serious issues.
                this.#setState(STATE.ERR_FILE_SYSTEM);
                this.#socket.destroy();
                return;
              }
            }
            this.#itemFlag = 'ok';
            this.sendHeader();
          }
          else if (this.#recvHeader.type === 'file') {
            try {
              if (this.#itemHandle) {
                this.#numRecvItem++;
                // Close previous item handle.
                await this.#itemHandle.close();
              }
              this.#itemHandle = await fs.open(path.join(this.#recvPath, this.#itemName), 'wx');
            } catch (err) {
              // File already exists.
              // TODO Implement handling.
              // 1. Ignore the file.
              // 2. Create the file with another name.
              this.#itemHandle = null;
              this.#itemFlag = 'next';
              this.#numRecvItem++;
              this.sendHeader();
              return;
            }
            this.#itemWrittenBytes = 0;
            this.#itemSize = this.#recvHeader.size;
            this.#recvBuf = Buffer.from([]);
            this.#itemFlag = 'ok';
            this.sendHeader();
          }
          break;

        case 'done':
          if (this.#itemHandle) {
            // Close previous item handle.
            await this.#itemHandle.close();
            this.#itemHandle = null;
          }
          this.#setState(STATE.RECV_COMPLETE);
          this.#socket.end();
          break;

        case 'end':
          this.#setState(STATE.OTHER_END);
          // Close previous item handle and delete.
          if (this.#itemHandle) {
            await this.#itemHandle.close();
          }
          if (this.#itemName) {
            await fs.rm(path.join(this.#recvPath, this.#itemName), {force: true});
          }
          this.#socket.end();
          break;
        default:
          this.#setState(STATE.ERR_NETWORK);
          this.#socket.destroy();
          return;
        }
        break;

      default:
        // What the hell?
        // Unhandled Receiver state case.
        this.#onNetworkError();
        return;
      }
    });

    this.#socket.on('close', () => {
      if (!(this.#state === STATE.RECV_COMPLETE || this.#state === STATE.OTHER_END || this.#haveWrittenEndHeader))
        // Unexpected close event.
        this.#onNetworkError();
      else if (this.#haveWrittenEndHeader)
        this.#onEnd(this.#ind);
    });

    this.#socket.on('error', (err) => {
      console.error(err.message);
    });

    this.#socket.setTimeout(SOCKET_TIMEOUT, this.#onNetworkError);
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
    return (this.#itemSize === 0 ? 100 : Math.floor(this.#itemWrittenBytes / this.#itemSize * 100));
  }
  /**
   * Return a string representing the total progress.
   */
  getTotalProgress () {
    return this.#numRecvItem + '/' + this.#numItems;
  }

  /**
   * Return the current state
   */
  getState () {
    if (this.#state === STATE.RECVING) {
      return {
        ind: this.#ind,
        state: this.#state,
        speed: this.getSpeed(),
        progress: this.getItemProgress(),
        totalProgress: this.getTotalProgress(),
        id: this.#senderId,
        itemName: this.#itemName,
      };
    }
    return {
      ind: this.#ind,
      state: this.#state,
      id: this.#senderId
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

  /**
   * End receiving.
   * @returns {Promise<boolean>}
   */
  async end () {
    if (this.#state === STATE.RECVING) {
      if (this.#itemHandle && this.#itemName) {
        // Delete currently receiving file.
        await this.#itemHandle.close();
        this.#itemHandle = null;
        await fs.rm(path.join(this.#recvPath, this.#itemName), {force: true});
      }
      this.#endFlag = true;
      return true;
    }
    return false;
  }

  /**
   * Send header to the opponent, in accordance to the current state.
   */
  sendHeader () {
    let header = null;
    this.#haveParsedHeader = false;
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
    switch (this.#state) {
    case STATE.RECVING:
      header = {class: this.#itemFlag};
      this.#socket.write(JSON.stringify(header) + HEADER_END, 'utf-8', this.#onSendError);
      break;
    default:
      // TODO Handle edge case.
      break;
    }
  }

  /**
   * @param {Error | undefined} err
   */
  #onSendError (err) {
    if (err) {
      console.error('Sender: Error Occurred during sending data.');
      console.error(err);
      this.#onNetworkError();
    }
  }

  /**
   * Handle on corrupted data from receiver.
   */
  #onNetworkError () {
    this.#setState(STATE.ERR_NETWORK);
    this.#socket.destroy();
  }
}

export default Receiver;
