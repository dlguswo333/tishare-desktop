const os=require('os');
const net=require('net');
const { dialog } = require('electron');
const port=8531;
var serverSocket=null;
var socketBusy=false;

// Get my LAN ip and netmask array.
// Not that it returns an array because there could be
// multiple network interfaces with local ip.
// Each array is a dict: { name, ip, netmask }
const getMyNetwork=()=>{
    var array=[];
    const interfaces=os.networkInterfaces();
    for (const network in interfaces){
        const one=interfaces[network];
        for(const ip of one){
            // Only ipv4 and external ip
            if(ip['family']==='IPv4' && !ip['internal']){
                // LAN ip addresses start with 192, 10, or 172.
                if(ip['address'].startsWith('192') || ip['address'].startsWith('10') || ip['address'].startsWith('172')){
                    array.push({name: network, ip: ip['address'], netmask: ip['netmask']});
                }
            }
        }
    }
    return array;
}

const initServerSocket=(myIp)=>{
    serverSocket=net.createServer();
    serverSocket.listen(port, myIp);
    serverSocket.on('connection', (socket)=>{
        // Connection established.
        dialog.showMessageBox({
            message: "Connection established!",
            type: "info",
        });
    });
}

module.exports={ getMyNetwork, initServerSocket };