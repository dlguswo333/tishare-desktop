const { STATE } = require('../defs');
const { HEADER_END } = require('./Common');

class Requestee {
  /**
   * @param {number} ind
   * @param {string} state
   * @param {import('net').Socket} socket
   * @param {string} requestHeader
   * @param {Function} sendState
   */
  constructor(ind, state, socket, requestHeader, sendState) {
    /** @type {number} */
    this._ind = ind;
    this._state = state;
    this._socket = socket;
    this._requestHeader = requestHeader;
    this._haveRejectedFlag = false;
    /** @type {Function} */
    this._sendState = sendState;
  }

  /**
   * Reject Request.
   */
  reject() {
    this._haveRejectedFlag = true;
    if (this._state === STATE.RQE_SEND_REQUEST) {
      this._socket.write(JSON.stringify({ class: 'no' }) + HEADER_END, 'utf-8', this._onWriteError);
    }
    if (this._state === STATE.RQE_RECV_REQUEST) {
      this._socket.write(JSON.stringify({ class: 'no' }) + HEADER_END, 'utf-8', this._onWriteError);
    }
  }

  /**
   * Return the reject flag.
   * @returns {boolean}
   */
  getRejectFlag() {
    return this._haveRejectedFlag;
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