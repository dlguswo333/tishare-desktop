const os = require('os');
const net = require('net');
const fs = require('fs').promises;
const path = require('path');
const port = 8531;
var serverSocket = null;
var socketBusy = false;

// Get my LAN ip and netmask array.
// Not that it returns an array because there could be
// multiple network interfaces with local ip.
// Each array is a dict: { name, ip, netmask }
const getMyNetworks = () => {
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

const initServerSocket = (ip) => {
    if (!ip) {
        // ip is not set.
        return;
    }
    if (serverSocket) {
        if (serverSocket.listening) {
            console.log('Server is already on and listening!');
            return;
        }
        // serverSocket is not null but not listening. close it first.
        serverSocket.close();
    }
    serverSocket = net.createServer();

    // Add error handling callbacks.
    serverSocket.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log('Serversocket Error! Port is already in use!');
        }
        else {
            console.error(err);
            console.log('Serversocket Error! Unknown error!');
        }
        serverSocket = null;
        return;
    });

    // Connection established.
    serverSocket.on('connection', (socket) => {

        // The opponent sent something.
        socket.on('data', (data) => {
            data = data.toString('utf-8');
            console.log(data);
        });
    });

    serverSocket.listen(port, ip);
}

const isServerSocketListening = () => {
    return serverSocket && serverSocket.listening;
}

const closeServerSocket = () => {
    if (serverSocket) {
        serverSocket.close();
        serverSocket = null;
    }
}

// The parameter must be absolute.
const sendFile = async (targetPath) => {
    if (!path.isAbsolute())
        return false;
    var offset = 0;
    var chunk = null;
    const name = path.basename();
    const stat = await fs.stat(targetPath).catch(() => {
        // Cannot read file.
        return false;
    });
    if (stat.isFile()) {

    }
    else if (stat.isDirectory()) {

    }
    else {
        // What the hell?
    }

}

const receiveFile = (downloadPath, name) => {

}

module.exports = { getMyNetworks, initServerSocket, isServerSocketListening, closeServerSocket };