const { ipcRenderer } = require('electron');

document.getElementById('openManager')?.addEventListener('click', () => {
    console.log("OPENING IN vmInstance.ts");
    ipcRenderer.send('open-manager-window');
});