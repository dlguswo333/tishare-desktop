const {STATE} = require('../defs');
const {HEADER_END} = require('./Common');

class Requester {
  /** @type {number} */
  #ind;
  /** @type {STATE[keyof STATE]} */
  #state;
  /** @param {import('net').Socket | null} */
  #socket;
  /** @type {boolean} */
  #haveWrittenEndFlag;
  /** @type {Function} */
  #sendState;

  /**
   * @param {number} ind
   * @param {string} state
   * @param {import('net').Socket | null} socket Can be `null` if it is pre-receive request.
   * @param {string} opponentIp
   * @param {string} opponentId
   * @param {Function} sendState
   */
  constructor (ind, state, socket, opponentIp, opponentId, sendState) {
    /** @type {number} */
    this.#ind = ind;
    this.#state = state;
    this.#socket = socket;
    this.opponentIp = opponentIp;
    this.opponentId = opponentId;
    this.#haveWrittenEndFlag = false;
    this.#sendState = sendState;
    this.#sendState(this.getState());
  }

  /**
   * Cancel Request.
   */
  end () {
    this.#haveWrittenEndFlag = true;
    if (this.#state === STATE.RQR_SEND_REQUEST || this.#state === STATE.RQR_RECV_REQUEST) {
      this.#socket.write(JSON.stringify({class: 'end'}) + HEADER_END, 'utf-8', this.#onSendError);
    }
  }

  /**
   * Get have written end flag.
   * @returns {boolean}
   */
  getHaveWrittenEndFlag () {
    return this.#haveWrittenEndFlag;
  }

  /**
   * Set state.
   * @param {string} state
   */
  setState (state) {
    this.#state = state;
    this.#sendState(this.getState());
  }

  /**
   * Return the current state.
   */
  getState () {
    return {
      ind: this.#ind,
      state: this.#state,
      id: this.opponentId
    };
  }

  #onSendError = () => {
    // Silently ignore error because the only case that the requester sends data to the other is
    // when it wants to cancel the request.
    this.#socket.destroy();
  };
}

module.exports = Requester;
