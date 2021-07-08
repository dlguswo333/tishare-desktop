const { STATE } = require('../defs');
const { HEADER_END } = require('./Common');

class Requestee {
  /**
   * @param {string} state
   * @param {import('net').Socket} socket
   * @param {string} opponentId
   */
  constructor(state, socket, opponentId) {
    this._state = state;
    this._socket = socket;
    this._opponentId = opponentId;
  }

  /**
   * Reject Request.
   */
  reject() {
    if (this._state === STATE.RQE_SEND_REQUEST || this._state === STATE.RQE_RECV_REQUEST) {
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

  /**
   * Return the current state.
   */
  getState() {
    return {
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

module.exports = Requestee;