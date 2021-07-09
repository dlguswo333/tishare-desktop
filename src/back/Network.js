const os = require('os');
const dgram = require('dgram');
const { PORT, OS, VERSION, SCANTIMEOUT } = require('../defs');
/**
 * Return an array of dictionary each looks like: { name, ip, netmask }.
 * @returns {Array.<{name:String, ip:String, netmask:String}>} Array of networks.
 */
function getNetworks() {
  var array = [];
  const interfaces = os.networkInterfaces();
  for (const network in interfaces) {
    const one = interfaces[network];
    for (const ip of one) {
      // Only ipv4 and external ip
      if (ip['family'] === 'IPv4' && !ip['internal']) {
        // LAN ip addresses start with 192, 10, or 172.
        if (ip['address'].startsWith('192') || ip['address'].startsWith('10') || ip['address'].startsWith('172')) {
          array.push({ name: network, ip: ip['address'], netmask: ip['netmask'] });
        }
      }
    }
  }
  return array;
}

/**
 * @callback scanCallback
 * @param {String} deviceIp 
 * @param {String} deviceVersion Version of tiShare 
 * @param {String} deviceId 
 * @param {String} deviceOs 
 */
/**
 * 
 * @param {String} ip 
 * @param {String} netmask 
 * @param {String} myId 
 * @param {scanCallback} callback Callback function to call when found a device.
 */
function scan(ip, netmask, myId, callback) {
  const broadcastIp = _IpBroadcastIp(ip, netmask);
  const socket = dgram.createSocket('udp4');

  // Bind socket.
  // Binding is necessary to set the socket broadcast mode.
  socket.bind(ip, () => {
    socket.setBroadcast(true);
    const header = {
      app: "tiShare",
      version: VERSION,
      class: "scan",
      id: myId,
      os: OS
    };
    socket.on('message', (msg, rinfo) => {
      // if (rinfo.address === ip) {
      //   // Ignore myself.
      //   return;
      // }
      try {
        const recvHeader = JSON.parse(msg.toString('utf-8'));
        if (callback)
          callback(rinfo.address, recvHeader.version, recvHeader.id, recvHeader.os);
      } catch {
        return;
      }
    });
    socket.send(JSON.stringify(header), PORT, broadcastIp);

    // Close socket after some time.
    setTimeout(() => {
      socket.close();
    }, SCANTIMEOUT);
  });
}

/**
 * Return number representation of IPv4.
 * @param {String} ip String representation of IPv4.
 * @returns {number}
 */
function _IpStringToNumber(ip) {
  let tmp = ip.split('.');
  let ret = 0;
  for (let i = 0; i < 4; ++i) {
    ret <<= 8;
    ret += parseInt(tmp[i], 10);
  }
  return ret >>> 0;
}

/**
 * Return number representation of IPv4.
 * @param {number} ip Number representation of IPv4.
 * @returns {String}
 */
function _IpNumberToString(ip) {
  let ret = '';
  for (let i = 0; i < 4; ++i) {
    let tmp = 255 & ip;
    ret = tmp.toString(10) + ret;
    ip >>= 8;
    if (i !== 3)
      ret = '.' + ret;
  }
  return ret;
}

/**
 * Return broadcast ip address.
 * @param {String} ip 
 * @param {String} netmask 
 * @returns {String}
 */
function _IpBroadcastIp(ip, netmask) {
  return _IpNumberToString((_IpStringToNumber(ip) | (2 ** 32 - 1 - _IpStringToNumber(netmask))) >>> 0);
}

module.exports = { getNetworks, scan, _IpBroadcastIp };