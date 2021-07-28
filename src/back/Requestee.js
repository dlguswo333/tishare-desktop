const { STATE } = require('../defs');
const { HEADER_END } = require('./Common');

class Requestee {
  /**
   * @param {string} state
   * @param {import('net').Socket} socket
   * @param {string} requestHeader
   */
  constructor(state, socket, requestHeader) {
    this._state = state;
    this._socket = socket;
    this._requestHeader = requestHeader;
    this._haveRejectedFlag = false;
    this._socket.on('close', (err) => {
      if (err || !(this._state == STATE.RQE_CANCEL || this._haveRejectedFlag)) {
        this.setState(STATE.ERR_NETWORK);
      }
    })
  }

  /**
   * Reject Request.
   */
  reject() {
    this._haveRejectedFlag = true;
    if (this._state === STATE.RQE_SEND_REQUEST) {
      this.setState(STATE.RQE_SEND_REJECT);
      this._socket.write(JSON.stringify({ class: 'no' }) + HEADER_END, 'utf-8', this._onWriteError);
    }
    if (this._state === STATE.RQE_RECV_REQUEST) {
      this.setState(STATE.RQE_RECV_REJECT);
      this._socket.write(JSON.stringify({ class: 'no' }) + HEADER_END, 'utf-8', this._onWriteError);
    }
  }

  /**
   * Set state.
   * @param {string} state
   */
  setState(state) {
    this._state = state;
  }

  getId() {
    return this._requestHeader.id;
  }

  getNumItems() {
    return (this._requestHeader.numItems ? this._requestHeader.numItems : 0);
  }

  /**
   * Return the current state.
   */
  getState() {
    return {
      state: this._state,
      id: this._requestHeader.id
    };
  }

  _onWriteError(err) {
    if (err) {
      console.error(err.message);
      this.setState(STATE.ERR_NETWORK);
    }
  }
}

module.exports = Requestee;