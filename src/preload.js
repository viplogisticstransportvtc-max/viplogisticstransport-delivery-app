const {contextBridge, ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('vipClient',{
  version:'0.5.42',
  telemetry:{get:()=>fetch('http://127.0.0.1:25555/telemetry').then(r=>r.json()),endpoint:'http://127.0.0.1:25555/telemetry'},
  auth:{getToken:()=>ipcRenderer.invoke('vip-auth:get'),setToken:(token)=>ipcRenderer.invoke('vip-auth:set',token),clearToken:()=>ipcRenderer.invoke('vip-auth:clear')},
  platform:process.platform,
  updates:{
    getState:()=>ipcRenderer.invoke('vip-update:get-state'),
    check:()=>ipcRenderer.invoke('vip-update:check'),
    install:()=>ipcRenderer.invoke('vip-update:install'),
    onState:(callback)=>{const h=(_,state)=>callback(state);ipcRenderer.on('vip-update:state',h);return()=>ipcRenderer.removeListener('vip-update:state',h);}
  }
});
