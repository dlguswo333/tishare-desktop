import {STATE} from '../../defs.js';
import {getPeerFingerprintFromSocket} from '../cert.js';
import {HEADER_END} from '../common.js';

/**
 * @typedef {import('../../types.d.ts').TiJob} TiJob
 */

class Requester {
  /** @type {number} */
  #ind;
  /** @type {STATE[keyof STATE]} */
  #state;
  /** @type {import('tls').TLSSocket | null} */
  #socket;
  /** @type {boolean} */
  #haveWrittenEndFlag;
  /** @type {(_: TiJob) => void} */
  #sendState;

  /**
   * @param {number} ind
   * @param {string} state
   * @param {import('tls').TLSSocket | null} socket Can be `null` if it is pre-receive request.
   * @param {string} opponentIp
   * @param {string} opponentId
   * @param {(_: TiJob) => void} sendState
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
      this.#socket?.write(JSON.stringify({class: 'end'}) + HEADER_END, 'utf-8', this.#onSendError);
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
   * @returns {TiJob}
   * Return the current state.
   */
  getState () {
    /** @type {TiJob} */
    const state = {
      ind: this.#ind,
      state: this.#state,
      id: this.opponentId,
      fingerprint: null,
    };
    try {
      if (this.#socket) {
        const fingerprint = getPeerFingerprintFromSocket(this.#socket);
        state.fingerprint = fingerprint;
      }
    } catch {
      // peer certificates may not be available before handshake.
    }
    return state;
  }

  /**
   * @param {Error | null | undefined} err
   */
  #onSendError = (err) => {
    if (err) {
      // Silently ignore error because the only case that the requester sends data to the other is
      // when it wants to cancel the request.
      this.#socket?.destroy();
    }
  };
}

export default Requester;
