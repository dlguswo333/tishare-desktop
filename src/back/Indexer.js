const { MAX_NUM_JOBS } = require('../defs');
class Indexer {
  /**
   * @callback Callback
   * @param {!number} numJobs
   */
  /**
   * @param {!Callback} callback
   */
  constructor(callback) {
    this._nextInd = 0;
    this._indexer = {};
    this._callback = callback;
  }
  /**
   * Get a index.
   * @returns {number} A valid index or -1 if not available.
   */
  getInd() {
    if (Object.keys(this._indexer).length >= MAX_NUM_JOBS)
      return -1;
    const ind = this._nextInd++;
    this._indexer[ind] = true;
    this._callback(this.getNumJobs());
    return ind;
  }

  /**
   * Return a index back to the Indexer.
   * @param {number} ind
   * @returns {boolean} Whether the function succeeded.
   */
  returnInd(ind) {
    if (this._indexer[ind]) {
      delete this._indexer[ind];
      this._callback(this.getNumJobs());
      return true;
    }
    console.log(`Indexer error: tried to return ind ${ind} that does not exist.`)
    return false;
  }

  /**
   * Return the numer of running jobs.
   * @returns {number}
   */
  getNumJobs() {
    return Object.keys(this._indexer).length;
  }
}

module.exports = Indexer;