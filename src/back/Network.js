import {networkInterfaces} from 'os';
import dgram from 'dgram';
import {PORT, VERSION, SCANTIMEOUT} from '../defs.js';
import {OS} from './common.js';

/**
 * Return an array of dictionary each looks like: { name, ip, netmask }.
 * @returns {Array.<{name:String, ip:String, netmask:String}>} Array of networks.
 */
function getNetworks () {
  var array = [];
  const interfaces = networkInterfaces();
  for (const network in interfaces) {
    const interfaceInfo = interfaces[network];
    if (!interfaceInfo) {
      continue;
    }
    for (const ip of interfaceInfo) {
      // Only IPv4 and external IP which falls into the local IP address range.
      if (ip['family'] === 'IPv4' && !ip['internal'] && isLocalIp(ip['address'])) {
        array.push({name: network, ip: ip['address'], netmask: ip['netmask']});
      }
    }
  }
  return array;
}

/**
 * Returns boolean value whether a given IP string is local(private) or not.
 * @param {string} ip
 * @returns {boolean}
 */
function isLocalIp (ip) {
  const ipAsNum = ipStringToNumber(ip);
  if ((167772160 <= ipAsNum && ipAsNum <= 184549375) || (2886729728 <= ipAsNum && ipAsNum <= 2887778303) || (3232235520 <= ipAsNum && ipAsNum <= 3232301055)) {
    return true;
  }
  return false;
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
function scan (ip, netmask, myId, callback) {
  const broadcastIp = getBroadcastIp(ip, netmask);
  const socket = dgram.createSocket('udp4');

  // Binding socket is necessary to set the socket broadcast mode.
  // https://nodejs.org/docs/latest-v22.x/api/dgram.html#socketsetbroadcastflag
  socket.bind({address: ip}, () => {
    socket.setBroadcast(true);

    socket.on('message', (msg, rinfo) => {
      if (rinfo.address === ip) {
        // Ignore myself.
        return;
      }
      try {
        const recvHeader = JSON.parse(msg.toString('utf-8'));
        if (callback)
          callback(rinfo.address, recvHeader.version, recvHeader.id, recvHeader.os);
      } catch {
        return;
      }
    });

    const header = {
      app: 'tiShare',
      version: VERSION,
      class: 'scan',
      id: myId,
      os: OS
    };
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
 * @returns {number} Number representation of IPv4.
 */
function ipStringToNumber (ip) {
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
 * @returns {String} String representation of IPv4.
 */
function ipNumberToString (ip) {
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
function getBroadcastIp (ip, netmask) {
  return ipNumberToString((ipStringToNumber(ip) | (2 ** 32 - 1 - ipStringToNumber(netmask))) >>> 0);
}

export {getNetworks, isLocalIp, scan, getBroadcastIp};
