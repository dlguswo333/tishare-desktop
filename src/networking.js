const os = require('os');
const net = require('net');
const port = 8531;
var serverSocket = null;
var socketBusy = false;

// Get my LAN ip and netmask array.
// Not that it returns an array because there could be
// multiple network interfaces with local ip.
// Each array is a dict: { name, ip, netmask }
const getMyNetwork = () => {
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

const initServerSocket = (myIp) => {
    if (serverSocket) {
        if (serverSocket.listening) {
            console.log('Server is on and listening!');
            return;
        }
        serverSocket.close();
    }
    serverSocket = net.createServer();
    // Listen to the ip and the port.
    try {
        serverSocket.listen(port, myIp);
    }
    catch (err) {
        console.log(err);
        return;
    }

    // Connection established.
    serverSocket.on('connection', (socket) => {

        // The opponent sent something.
        socket.on('data', (data) => {
            data = data.toString('utf-8');
            console.log(data);
        });
    });
}

const closeServerSocket = () => {
    if (serverSocket) {
        serverSocket.close();
        serverSocket = null;
    }
}

module.exports = { getMyNetwork, initServerSocket, closeServerSocket };