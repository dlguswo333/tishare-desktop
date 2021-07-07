class Requester {
  /**
   * @param {string} state
   * @param {string} opponentId
   */
  constructor(state, opponentId) {
    this._state = state;
    this._opponentId = opponentId;
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
}

module.exports = Requester;