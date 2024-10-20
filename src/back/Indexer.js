const {MAX_NUM_JOBS} = require('../defs');

/**
 * @callback NumJobsCallback
 * @param {!number} numJobs
 */
/**
 * @callback ReturnCallback
 * @param {!number} ind
 */

class Indexer {
  /** @type {number} */
  #nextInd;
  /** @type {Record<string, true>} */
  #indexState;
  /** @type {!NumJobsCallback} */
  #numJobsCallback;
  /** @type {!ReturnCallback} */
  #returnCallback;

  /**
   * @param {!NumJobsCallback} numJobsCallback Will be called upon changes with # of indexes being used as a parameter.
   * @param {!ReturnCallback} returnCallback Will be called upon returning an index with the index as a parameter.
   */
  constructor (numJobsCallback, returnCallback) {
    this.#nextInd = 0;
    this.#indexState = {};
    this.#numJobsCallback = numJobsCallback;
    this.#returnCallback = returnCallback;
  }

  /**
   * Get a index.
   * @returns {number} A valid index or -1 if not available.
   */
  getInd () {
    if (Object.keys(this.#indexState).length >= MAX_NUM_JOBS)
      return -1;
    const ind = this.#nextInd++;
    this.#indexState[ind] = true;
    this.#numJobsCallback(this.getNumJobs());
    return ind;
  }

  /**
   * Return a index back to the Indexer.
   * @param {number} ind
   * @returns {boolean} Whether the function succeeded.
   */
  returnInd (ind) {
    if (this.#indexState[ind]) {
      delete this.#indexState[ind];
      this.#numJobsCallback(this.getNumJobs());
      this.#returnCallback(ind);
      return true;
    }
    console.log(`Indexer error: tried to return ind ${ind} that does not exist.`);
    return false;
  }

  /**
   * Return the numer of running jobs.
   * @returns {number}
   */
  getNumJobs () {
    return Object.keys(this.#indexState).length;
  }
}

module.exports = Indexer;
