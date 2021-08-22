const { STATE } = require('../defs');
const { HEADER_END } = require('./Common');

class Requester {
  /**
   * @param {number} ind
   * @param {string} state
   * @param {import('net').Socket|string} socket it will be used for saving sender IP.
   * @param {string} opponentId
   * @param {Function} sendState
   */
  constructor(ind, state, socket, opponentId, sendState) {
    /** @type {number} */
    this._ind = ind;
    this._state = state;
    this._socket = socket;
    this._opponentId = opponentId;
    this._haveWrittenEndFlag = false;
    /** @type {Function} */
    this._sendState = sendState;
  }

  /**
   * Cancel Request.
   */
  end() {
    this._haveWrittenEndFlag = true;
    if (this._state === STATE.RQR_SEND_REQUEST || this._state === STATE.RQR_RECV_REQUEST) {
      this._socket.write(JSON.stringify({ class: 'end' }) + HEADER_END, 'utf-8', this._onWriteError);
    }
  }

  /**
   * Get have written end flag.
   * @returns {boolean}
   */
  getHaveWrittenEndFlag() {
    return this._haveWrittenEndFlag;
  }

  /**
   * Set state.
   * @param {string} state
   */
  setState(state) {
    this._state = state;
  }

  /**
   * Return the current state.
   */
  getState() {
    return {
      ind: this._ind,
      state: this._state,
      id: this._opponentId
    };
  }

  _onWriteError(err) {
    if (err) {
      console.error(err.message);
      this.setState(STATE.ERR_NETWORK);
    }
  }
}

module.exports = Requester;