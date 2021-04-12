// Because of webpack, renderer process cannot see node modules.
// Therefore, we add node modules to the window object.
window.ipcRenderer = require('electron').ipcRenderer;