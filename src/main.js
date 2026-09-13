const { app, BrowserWindow, ipcMain, safeStorage, Tray, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const { startTelemetryBridge } = require('./telemetry-bridge');
const { startTruckTelAdapter } = require('./trucktel-adapter');

const iconPath = path.join(__dirname, '..', 'assets', 'vip-logistics.ico');
let telemetryServer, telemetryAdapter, tray;
let isQuitting = false;
let mainWindow = null;
let updateState = { status:'idle', version:null, downloaded:false, error:null };

const authFile = () => path.join(app.getPath('userData'), 'driver-session.bin');
function readToken(){try{if(!safeStorage.isEncryptionAvailable()||!fs.existsSync(authFile()))return '';return safeStorage.decryptString(fs.readFileSync(authFile()));}catch{return '';}}
function writeToken(token){if(!safeStorage.isEncryptionAvailable())throw new Error('Secure local storage is unavailable on this PC.');fs.mkdirSync(path.dirname(authFile()),{recursive:true});fs.writeFileSync(authFile(),safeStorage.encryptString(String(token||'')));}
function clearToken(){try{fs.rmSync(authFile(),{force:true});}catch{}}

ipcMain.handle('vip-auth:get',()=>readToken());
ipcMain.handle('vip-auth:set',(_,token)=>{writeToken(token);return true;});
ipcMain.handle('vip-auth:clear',()=>{clearToken();return true;});

function sendUpdateState(extra={}) {
  updateState = { ...updateState, ...extra };
  try { mainWindow?.webContents?.send('vip-update:state', updateState); } catch {}
}

function setupAutoUpdater(){
  if(!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on('checking-for-update',()=>sendUpdateState({status:'checking',error:null}));
  autoUpdater.on('update-available',info=>sendUpdateState({status:'available',version:info.version,error:null,downloaded:false}));
  autoUpdater.on('update-not-available',info=>sendUpdateState({status:'current',version:info.version||app.getVersion(),error:null,downloaded:false}));
  autoUpdater.on('download-progress',p=>sendUpdateState({status:'downloading',version:updateState.version,progress:Math.round(p.percent||0),error:null}));
  autoUpdater.on('update-downloaded',info=>sendUpdateState({status:'downloaded',version:info.version,progress:100,downloaded:true,error:null}));
  autoUpdater.on('error',err=>sendUpdateState({status:'error',error:String(err?.message||err)}));
  setTimeout(()=>checkForUpdates(),5000);
  setInterval(()=>checkForUpdates(),30*60*1000);
}
async function checkForUpdates(){
  if(!app.isPackaged) return {status:'dev'};
  try { return await autoUpdater.checkForUpdates(); }
  catch(e){ sendUpdateState({status:'error',error:String(e?.message||e)}); return null; }
}
ipcMain.handle('vip-update:get-state',()=>({...updateState, currentVersion:app.getVersion()}));
ipcMain.handle('vip-update:check',()=>checkForUpdates());
ipcMain.handle('vip-update:install',()=>{
  if(updateState.downloaded){ isQuitting=true; autoUpdater.quitAndInstall(false,true); return true; }
  return false;
});

function createTray(win){
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('V.I.P LOGISTICS TRANSPORT DELIVERY APP');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label:'Open Delivery App', click:()=>{ win.show(); win.restore(); win.focus(); } },
      { type:'separator' },
      { label:'Exit Delivery App', click:()=>{ isQuitting=true; app.quit(); } }
    ]));
    tray.on('double-click',()=>{ win.show(); win.restore(); win.focus(); });
  } catch (e) {
    console.error('Tray icon could not be created:', e);
  }
}

function createWindow(){
  const win = new BrowserWindow({
    width:1050,
    height:760,
    minWidth:900,
    minHeight:650,
    show:true,
    backgroundColor:'#090909',
    icon:iconPath,
    webPreferences:{
      preload:path.join(__dirname,'preload.js'),
      contextIsolation:true,
      nodeIntegration:false
    }
  });
  mainWindow = win;
  win.setIcon(iconPath);
  win.setSkipTaskbar(false);
  win.setTitle('V.I.P LOGISTICS TRANSPORT DELIVERY APP');
  win.loadFile(path.join(__dirname,'index.html'));

  // Closing the window hides the delivery client to the system tray instead of
  // terminating it. TruckTel monitoring and automatic delivery tracking continue
  // running in the background. Use the tray menu's Exit Delivery App to quit.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  createTray(win);
  const launchedAtStartup = process.platform==='win32' && process.argv.includes('--autostart');
  if(launchedAtStartup){win.once('ready-to-show',()=>win.hide());}
  return win;
}

app.whenReady().then(()=>{
  // Must be set before the BrowserWindow is created so Windows associates the
  // window/taskbar button with the V.I.P application identity.
  app.setAppUserModelId('com.viplogistics.deliveryclient');
  if(process.platform==='win32'){
    app.setLoginItemSettings({openAtLogin:true,openAsHidden:false,args:['--autostart']});
  }
  telemetryServer=startTelemetryBridge(25555);
  telemetryAdapter=startTruckTelAdapter();
  const win=createWindow();
  setupAutoUpdater();
  app.on('activate',()=>{
    if(BrowserWindow.getAllWindows().length===0) createWindow();
    else {win.show();win.restore();win.focus();}
  });
});

app.on('before-quit',()=>{isQuitting=true;});
app.on('will-quit',()=>{try{telemetryAdapter?.stop();}catch{}try{tray?.destroy();}catch{}try{telemetryServer?.close();}catch{}});
app.on('window-all-closed',()=>{
  // Keep the app alive on Windows/macOS when the window is minimized/hidden.
  if(process.platform==='darwin') app.quit();
});
