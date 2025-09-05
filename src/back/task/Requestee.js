import {STATE} from '../../defs.js';
import {HEADER_END} from '../Common.js';

class Requestee {
  /** @type {number} */
  #ind;
  /** @type {STATE[keyof STATE]} */
  #state;
  socket;
  /** @type {import('../Common.js').SendRequestHeader} */
  #requestHeader;
  #haveRejectedFlag;
  /** @type {Function} */
  #sendState;

  /**
   * @param {number} ind
   * @param {string} state
   * @param {import('net').Socket} socket
   * @param {string} requestHeader
   * @param {Function} sendState
   */
  constructor (ind, state, socket, requestHeader, sendState) {
    this.#ind = ind;
    this.#state = state;
    this.socket = socket;
    this.#requestHeader = requestHeader;
    this.#haveRejectedFlag = false;
    this.#sendState = sendState;
    this.#sendState(this.getState());
  }

  /**
   * Reject Request.
   */
  reject () {
    this.#haveRejectedFlag = true;
    if (this.#state === STATE.RQE_SEND_REQUEST) {
      this.socket.write(JSON.stringify({class: 'no'}) + HEADER_END, 'utf-8', this.#onSendError);
    }
    if (this.#state === STATE.RQE_RECV_REQUEST) {
      this.socket.write(JSON.stringify({class: 'no'}) + HEADER_END, 'utf-8', this.#onSendError);
    }
  }

  /**
   * Return the reject flag.
   * @returns {boolean}
   */
  getRejectFlag () {
    return this.#haveRejectedFlag;
  }

  /**
   * Set state.
   * @param {string} state
   */
  setState (state) {
    this.#state = state;
    this.#sendState(this.getState());
  }

  getId () {
    return this.#requestHeader.id;
  }

  getNumItems () {
    return (this.#requestHeader.numItems ? this.#requestHeader.numItems : 0);
  }

  /**
   * Return the current state.
   */
  getState () {
    return {
      ind: this.#ind,
      state: this.#state,
      id: this.#requestHeader.id
    };
  }

  #onSendError (err) {
    if (err) {
      console.error(err.message);
      this.setState(STATE.ERR_NETWORK);
    }
  }
}

export default Requestee;
