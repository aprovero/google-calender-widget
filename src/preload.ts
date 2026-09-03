import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getPreferences: () => ipcRenderer.invoke('get-preferences'),
    savePreferences: (prefs: any) => ipcRenderer.invoke('save-preferences', prefs),
    openExternal: (url: string) => ipcRenderer.send('open-external', url),
    adjustSplit: (deltaY: number) => ipcRenderer.send('adjust-split', deltaY)
});

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded');
});

