// @ts-check
import {PORT, VERSION, STATE} from '../defs.js';
import {HEADER_END, splitHeader, MAX_HEADER_LEN, createItemArray} from './Common.js';
import net from 'net';
import Sender from './Sender.js';
import Requester from './Requester.js';
import Receiver from './Receiver.js';

class Client {
  /** @type {import('./Indexer').default} */
  #indexer;
  /** @type {Function} */
  #sendState;
  /** @type {string} */
  myId;
  /** @type {Object.<number, (Sender|Receiver|Requester)>} */
  jobs;

  /**
   * @param {import('./Indexer').default} indexer
   * @param {Function} sendState
   */
  constructor (indexer, sendState) {
    this.#indexer = indexer;
    this.#sendState = sendState;
    this.myId = '';
    this.jobs = {};
    // Other objects may call this method so bind the function.
    this.deleteJob = this.deleteJob.bind(this);
  }

  /**
   * Set Client's ID.
   * @param {string} id
   * @returns {boolean} The result of the execution.
   */
  setMyId (id) {
    if (id) {
      this.myId = id;
      return true;
    }
    return false;
  }

  /**
   * Request to send to opponent Server.
   * NOTE that it does not embed itemArray.
   * @param {Record<string, import('../types.js').TiFrontItem>} items
   * @param {string} receiverIp
   * @param {string} receiverId
   * @returns {Promise.<number|boolean>} Index value of the Sender or false.
   */
  async sendRequest (items, receiverIp, receiverId) {
    const ind = this.#getNextInd();
    if (!this.myId || ind < 0)
      return false;
    /** @type {Buffer} */
    let recvBuf = Buffer.from([]);
    const itemArray = await createItemArray(items);
    const socket = net.createConnection(PORT, receiverIp);


    const requester = new Requester(ind, STATE.RQR_SEND_REQUEST, socket, receiverIp, receiverId, this.#sendState);
    this.jobs[ind] = requester;

    socket.once('connect', async () => {
      console.log('sendRequest: connected to ' + socket.remoteAddress);
      const requestHeader = this.#createSendRequestHeader(itemArray.length);
      socket.write(JSON.stringify(requestHeader) + HEADER_END, 'utf-8', (err) => { if (err) this.#handleNetworkErr(ind); });
    });

    socket.on('data', async (data) => {
      let recvHeader = null;
      recvBuf = Buffer.concat([recvBuf, data]);
      const ret = splitHeader(recvBuf);
      if (!ret) {
        if (recvBuf.length > MAX_HEADER_LEN) {
          // Abort this suspicious connection.
          this.#handleNetworkErr(ind);
        }
        // Has not received header yet. just exit the function here for more data by return.
        return;
      }
      try {
        recvHeader = JSON.parse(ret.header);
      } catch (err) {
        // HEADER_END is met but is not JSON format.
        // Abort this suspicious connection.
        this.#handleNetworkErr(ind);
        return;
      }
      switch (recvHeader.class) {
      case 'ok':
        // Transform Requester into Sender.
        this.jobs[ind] = new Sender(ind, socket, receiverId, itemArray, this.deleteJob, this.#sendState);
        this.jobs[ind].send();
        break;
      case 'no':
        requester.setState(STATE.RQR_SEND_REJECT);
        socket.end();
        break;
      default:
        this.#handleNetworkErr(ind);
      }
    });

    socket.on('close', () => {
      const state = requester.getState().state;
      if (state === STATE.RQR_SEND_REJECT || requester.getHaveWrittenEndFlag()) {
        if (requester.getHaveWrittenEndFlag())
          this.deleteJob(ind);
        return;
      }
      this.#handleNetworkErr(ind);
    });

    socket.on('error', (err) => {
      if (err) {
        socket.destroy();
        this.#handleNetworkErr(ind);
      }
    });

    return ind;
  }

  /**
   * Prepare to request to receive from the opponent.
   * @param {string} senderIp
   * @param {string} senderId
   */
  preRecvRequest (senderIp, senderId) {
    const ind = this.#getNextInd();
    if (!this.myId || ind < 0)
      return;
    this.jobs[ind] = new Requester(ind, STATE.RQR_PRE_RECV_REQUEST, null, senderIp, senderId, this.#sendState);
  }

  /**
   * Send Receive request to receive from the opponent.
   * @param {number} ind
   * @param {string} recvDir
   */
  recvRequest (ind, recvDir) {
    const preRequester = this.jobs[ind];
    if (!(preRequester instanceof Requester)) {
      throw new Error(`Requester expected but got ${this.jobs[ind]}`);
    }
    /** @type {Buffer} */
    let recvBuf = Buffer.from([]);
    const senderIp = preRequester.opponentIp;
    const senderId = preRequester.opponentId;
    const socket = net.createConnection(PORT, senderIp);

    const requester = new Requester(ind, STATE.RQR_RECV_REQUEST, socket, senderIp, senderId, this.#sendState);
    this.jobs[ind] = requester;

    socket.once('connect', async () => {
      console.log('recvRequest: connected to ' + socket.remoteAddress);
      const requestHeader = this.#createRecvRequestHeader();
      socket.write(JSON.stringify(requestHeader) + HEADER_END, 'utf-8', (err) => { if (err) this.#handleNetworkErr(ind); });
    });

    socket.on('data', async (data) => {
      let recvHeader = null;
      recvBuf = Buffer.concat([recvBuf, data]);
      const ret = splitHeader(recvBuf);
      if (!ret) {
        if (recvBuf.length > MAX_HEADER_LEN) {
          // Abort this suspicious connection.
          this.#handleNetworkErr(ind);
        }
        // Has not received header yet. just exit the function here for more data by return.
        return;
      }
      try {
        recvHeader = JSON.parse(ret.header);
      } catch (err) {
        // HEADER_END is met but is not JSON format.
        // Abort this suspicious connection.
        this.#handleNetworkErr(ind);
        return;
      }
      switch (recvHeader.class) {
      case 'ok': {
        // Transform Requester into Sender.
        const receiver = new Receiver(ind, socket, senderId, recvDir, recvHeader.numItems, this.deleteJob, this.#sendState);
        // Send ok header explictly to notify it is ready to receive.
        this.jobs[ind] = receiver;
        receiver.sendHeader();
        break;
      }
      case 'no':
        requester.setState(STATE.RQR_RECV_REJECT);
        socket.end();
        break;
      default:
        this.#handleNetworkErr(ind);
      }
    });

    socket.on('close', () => {
      const state = requester.getState().state;
      if (!(state === STATE.RQR_RECV_REJECT || requester.getHaveWrittenEndFlag())) {
        this.#handleNetworkErr(ind);
      }
      else if (requester.getHaveWrittenEndFlag()) {
        this.deleteJob(ind);
      }
    });

    socket.on('error', (err) => {
      if (err) {
        socket.destroy();
        this.#handleNetworkErr(ind);
      }
    });
  }

  /**
   * Create and return send request header.
   * @param {number} numItems
   * @returns {import('./Common').SendRequestHeader}
   */
  #createSendRequestHeader (numItems) {
    const header = {app: 'tiShare', version: VERSION, class: 'send-request', id: this.myId, numItems: numItems};
    return header;
  }

  /**
   * Create and return recv request header.
   * @returns {import('./Common').RecvRequestHeader}
   */
  #createRecvRequestHeader () {
    const header = {app: 'tiShare', version: VERSION, class: 'recv-request', id: this.myId};
    return header;
  }

  /**
   * End a job with the ind.
   * @param {number} ind
   * @returns {boolean} Whether the execution has been successful.
   */
  endJob (ind) {
    if (this.jobs[ind]) {
      if (this.jobs[ind].getState().state === STATE.RQR_PRE_RECV_REQUEST)
        this.deleteJob(ind);
      else
        this.jobs[ind].end();
      return true;
    }
    return false;
  }

  /**
   * Delete a Job from jobs.
   * This function must be preceded by endJob.
   * @param {number} ind
   * @returns {boolean} Whether the execution has been successful.
   */
  deleteJob (ind) {
    if (this.jobs[ind]) {
      delete this.jobs[ind];
      this.#indexer.returnInd(ind);
      return true;
    }
    return false;
  }

  #getNextInd () {
    return this.#indexer.getInd();
  }

  /**
   * Handle network error on Requester.
   * @param {number} ind
   */
  #handleNetworkErr (ind) {
    if (this.jobs[ind] && ('setState' in this.jobs[ind])) {
      this.jobs[ind].setState(STATE.ERR_NETWORK);
    }
  }
}

export default Client;
