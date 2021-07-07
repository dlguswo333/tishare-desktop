class Requestee {
  /**
   * @param {string} state
   * @param {string} opponentId
   */
  constructor(state, opponentId) {
    this._state = state;
    this._opponentId = opponentId;
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

module.exports = Requestee;