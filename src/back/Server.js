const dgram = require('dgram');
const { PORT } = require('./Network');

class Server {
  /**
   * @param {string} id 
   */
  constructor(id) {
    if (!id) {
      // Cannot initialize server without ID.
      return;
    }
    this.id = id;
    /**
     * @type {dgram.Socket}
     */
    this._scannee = null;
  }

  /**
   * 
   * @param {string} id 
   */
  setMyId(id) {
    if (id) {

    }
  }

  /**
   * @callback scanCallback
   * @param {String} deviceIp 
   * @param {String} deviceVersion Version of SendDone 
   * @param {String} deviceId 
   * @param {String} deviceOs 
   */

  /**
   * 
   * @param {string} ip 
   * @param {scanCallback} callback Callback function to call when found a device.
   */
  _initScannee(ip, callback) {
    this._scannee = dgram.createSocket('udp4');
    this._scannee.bind(PORT, ip, () => {
      this._scannee.on('message', (msg, rinfo) => {
        let recvHeader = null;
        try {
          recvHeader = JSON.parse(msg.toString('utf-8'));
          if (!(recvHeader.version && recvHeader.id && recvHeader.os))
            throw new Error('header not valid');
        } catch {
          // Abort it.
          return;
        }

        callback(rinfo.address, recvHeader.version, recvHeader.id, recvHeader.os);

        const sendHeader = {
          app: "SendDone",
          version: VERSION,
          class: "scan",
          id: myId,
          os: OS
        };
        this._scannee.send(sendHeader, rinfo.port, rinfo.address);
      });
    });
  }

  _destoryScannee() {
    if (this._scannee) {
      this._scannee.close();
      this._scannee = null;
    }
  }
}

module.exports = Server;