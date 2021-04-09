// Because of webpack, renderer process cannot see node modules.
// Therefore, we add node modules to the window object.
window.remote = require('electron').remote;
window.networking = require('./networking');