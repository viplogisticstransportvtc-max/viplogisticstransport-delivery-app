const VTC_API_BASE = 'https://viplogisticstransportvtc.vercel.app';
const $ = id => document.getElementById(id);

const updateUi = { state:null, hidden:false };

// Keep the footer version in sync with the actual installed Electron app version.
window.vipClient?.updates?.getState?.().then(u => {
  const el = $('appVersion');
  if (el && u?.currentVersion) el.textContent = `v${u.currentVersion}`;
}).catch(() => {});
function renderUpdateState(u){
  if(!u || !window.vipClient?.updates) return;
  updateUi.state=u;
  const banner=$('updateBanner'), title=$('updateTitle'), text=$('updateText'), install=$('updateInstall');
  if(!banner) return;
  if(updateUi.hidden && u.status!=='downloaded') { banner.classList.add('hidden'); return; }
  const version=u.version||'new';
  if(u.status==='available'){
    banner.classList.remove('hidden'); title.textContent=`UPDATE AVAILABLE · v${version}`; text.textContent='The new version is downloading automatically in the background.'; install.disabled=true; install.textContent='DOWNLOADING…';
  }else if(u.status==='downloading'){
    banner.classList.remove('hidden'); title.textContent=`DOWNLOADING UPDATE · v${version}`; text.textContent=`Update download ${Number(u.progress||0)}% complete.`; install.disabled=true; install.textContent=`${Number(u.progress||0)}%`;
  }else if(u.status==='downloaded'){
    banner.classList.remove('hidden'); title.textContent=`UPDATE READY · v${version}`;
    const active=Boolean(state.active); text.textContent=active?'Update downloaded. Finish your current delivery before restarting the app.':'Update downloaded and ready to install.';
    install.disabled=active; install.textContent=active?'FINISH DELIVERY':'RESTART & UPDATE';
  }else if(u.status==='error'){
    banner.classList.remove('hidden'); title.textContent='UPDATE CHECK FAILED'; text.textContent='The app will try again automatically later.'; install.disabled=true; install.textContent='UPDATE';
  }else{ banner.classList.add('hidden'); }
}
if(window.vipClient?.updates){
  window.vipClient.updates.onState(renderUpdateState);
  window.vipClient.updates.getState().then(renderUpdateState).catch(()=>{});
}
$('updateLater')?.addEventListener('click',()=>{updateUi.hidden=true;$('updateBanner')?.classList.add('hidden');});
$('updateInstall')?.addEventListener('click',async()=>{try{await window.vipClient.updates.install();}catch(e){message(e.message||'Unable to install update.','error');}});

const state = { base: VTC_API_BASE, username:'', token:'', active:null, lastJobActive:false, lastJobFinished:false, lastJobSignature:'', lastJobEventAt:0, startingJob:false, autoStartKey:'', completing:false, lastCancelAt:0, lastCompletedEventAt:0, pendingCompletion:null, completionRetryTimer:null, restCompletionTimer:null, lastRestJobSeenAt:0 };

function message(text, type=''){ $('msg').textContent=text; $('msg').className='message '+type; if($('clusterStatusText')) $('clusterStatusText').textContent=text; }
function loginMessage(text,type=''){ $('loginMsg').textContent=text; $('loginMsg').className='message '+type; }
function baseUrl(){ return VTC_API_BASE; }
async function api(path, options={}){
  const headers={...(options.headers||{})};
  if(state.token) headers.Authorization=`Bearer ${state.token}`;
  const r = await fetch(baseUrl()+path,{...options,headers});
  const d = await r.json().catch(()=>({error:'Server returned an invalid response.'}));
  if(!r.ok) throw new Error(d.error || d.details || 'Request failed');
  return d;
}
async function storeToken(token){
  state.token=token||'';
  try{ if(window.vipClient?.auth){ if(token) await window.vipClient.auth.setToken(token); else await window.vipClient.auth.clearToken(); } }catch{}
}
function showActive(a){
  state.active=a;
  $('activeCard').classList.remove('hidden');
  $('route').textContent=`${a.truckersmp_username} · ${a.origin} → ${a.destination} · ${a.cargo}`;
  $('clusterRoute').textContent=`${a.origin} → ${a.destination}`;
  $('clusterCargo').textContent=`${a.truckersmp_username} · ${a.cargo}`;
  $('activeStart').textContent=Number(a.start_km).toLocaleString()+' KM';
  $('activeEnd').textContent='—';
  $('distance').textContent='—';
  if(updateUi.state) renderUpdateState(updateUi.state);
}
async function refresh(){
  if(!state.username||!state.token) return;
  try{
    const d=await api('/api/deliveries?active='+encodeURIComponent(state.username));
    if(d.active) showActive(d.active);
    else { state.active=null; $('activeCard').classList.add('hidden'); $('clusterRoute').textContent='No active delivery'; $('clusterCargo').textContent='Waiting for TruckTel job…'; }
  }catch(e){ if(/login required|invalid/i.test(e.message)){ await logout(false); } else message(e.message,'error'); }
}
async function enterApp(driver){
  state.username=driver.truckersmp_username||driver.username;
  $('driverName').textContent=`${driver.username} · TruckersMP: ${state.username}`;
  $('connection').textContent='CONNECTED';
  $('loginCard').classList.add('hidden');
  $('appContent').classList.remove('hidden');
  message(`Connected as ${driver.username}. Automatic delivery mode is active.`,'ok');
  await refresh();
}
async function authenticateWithToken(token){
  if(!token) return false;
  state.token=token;
  try{ const d=await api('/api/driver-auth'); if(d.authenticated){ await enterApp(d.driver); return true; } }catch{}
  state.token=''; return false;
}
$('showRegister').onclick=()=>{
  $('loginView').classList.add('hidden'); $('registerView').classList.remove('hidden');
  $('registerMsg').textContent='Your registration will be sent to VTC management for approval.';
  $('registerMsg').className='message'; $('registerUsername').focus();
};
$('showLogin').onclick=()=>{
  $('registerView').classList.add('hidden'); $('loginView').classList.remove('hidden');
  $('loginMsg').textContent='Enter your VTC username and password.';
  $('loginMsg').className='message'; $('username').focus();
};
$('register').onclick=async()=>{
  const username=$('registerUsername').value.trim(), tmp=$('registerTmp').value.trim(), email=$('registerEmail').value.trim(), password=$('registerPassword').value, confirm=$('registerConfirm').value;
  if(!username||!tmp||!email||!password||!confirm){$('registerMsg').textContent='Complete all registration fields.';$('registerMsg').className='message error';return;}
  $('register').disabled=true; $('registerMsg').textContent='Submitting registration…'; $('registerMsg').className='message';
  try{
    const r=await fetch(baseUrl()+'/api/driver-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'register',username,truckersmp_username:tmp,email,password,confirmPassword:confirm})});
    const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d.error||'Registration failed.');
    $('registerPassword').value=''; $('registerConfirm').value=''; $('registerUsername').value=''; $('registerTmp').value=''; $('registerEmail').value='';
    $('registerMsg').textContent=d.message||'Registration submitted. Management approval is required before you can log in.'; $('registerMsg').className='message ok';
  }catch(e){ $('registerMsg').textContent=e.message; $('registerMsg').className='message error'; }
  finally{ $('register').disabled=false; }
};
$('registerConfirm').addEventListener('keydown',e=>{if(e.key==='Enter')$('register').click();});
$('login').onclick=async()=>{
  const u=$('username').value.trim(), p=$('password').value;
  if(!u||!p)return loginMessage('Enter your username and password.','error');
  $('login').disabled=true; loginMessage('Signing in…');
  try{
    const r=await fetch(baseUrl()+'/api/driver-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',username:u,password:p})});
    const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d.error||'Login failed.');
    await storeToken(d.token); $('password').value=''; await enterApp(d.driver);
  }catch(e){ loginMessage(e.message,'error'); }
  finally{ $('login').disabled=false; }
};
$('password').addEventListener('keydown',e=>{if(e.key==='Enter')$('login').click();});
$('showForgot').onclick=()=>{
  $('loginView').classList.add('hidden'); $('registerView').classList.add('hidden'); $('forgotView').classList.remove('hidden');
  $('forgotMsg').textContent='The reset code expires after 15 minutes.'; $('forgotMsg').className='message'; $('resetForm').classList.add('hidden'); $('forgotUsername').focus();
};
$('forgotBack').onclick=()=>{
  $('forgotView').classList.add('hidden'); $('loginView').classList.remove('hidden'); $('loginMsg').textContent='Enter your username and password.'; $('loginMsg').className='message'; $('username').focus();
};
$('sendReset').onclick=async()=>{
  const username=$('forgotUsername').value.trim(), email=$('forgotEmail').value.trim();
  if(!username||!email){$('forgotMsg').textContent='Enter your username and recovery email.';$('forgotMsg').className='message error';return;}
  $('sendReset').disabled=true; $('forgotMsg').textContent='Sending reset code…'; $('forgotMsg').className='message';
  try{const r=await fetch(baseUrl()+'/api/driver-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request-reset',username,email})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Unable to send reset code.');$('forgotMsg').textContent=d.message||'If the account matches, a reset code has been sent.';$('forgotMsg').className='message ok';$('resetForm').classList.remove('hidden');$('resetCode').focus();}catch(e){$('forgotMsg').textContent=e.message;$('forgotMsg').className='message error';}finally{$('sendReset').disabled=false;}
};
$('resetPasswordBtn').onclick=async()=>{
  const username=$('forgotUsername').value.trim(), code=$('resetCode').value.trim(), password=$('resetPassword').value, confirm=$('resetConfirm').value;
  if(!code||!password||!confirm){$('resetMsg').textContent='Complete the reset fields.';$('resetMsg').className='message error';return;}
  $('resetPasswordBtn').disabled=true; $('resetMsg').textContent='Changing password…'; $('resetMsg').className='message';
  try{const r=await fetch(baseUrl()+'/api/driver-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reset-password',username,code,password,confirmPassword:confirm})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Unable to change password.');$('resetPassword').value='';$('resetConfirm').value='';$('resetCode').value='';$('resetMsg').textContent=d.message||'Password changed successfully. You can now log in.';$('resetMsg').className='message ok';setTimeout(()=>{ $('forgotView').classList.add('hidden');$('loginView').classList.remove('hidden');$('username').value=username;$('password').focus();loginMessage('Password changed. Please sign in with your new password.','ok'); },900);}catch(e){$('resetMsg').textContent=e.message;$('resetMsg').className='message error';}finally{$('resetPasswordBtn').disabled=false;}
};
$('resetConfirm').addEventListener('keydown',e=>{if(e.key==='Enter')$('resetPasswordBtn').click();});

async function logout(callServer=true){
  if(callServer&&state.token){try{await api('/api/driver-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});}catch{}}
  clearTimeout(state.completionRetryTimer); state.completionRetryTimer=null; clearTimeout(state.restCompletionTimer); state.restCompletionTimer=null; state.pendingCompletion=null; state.lastRestJobSeenAt=0; state.token=''; state.username=''; state.active=null;
  await storeToken('');
  $('connection').textContent='NOT CONNECTED'; $('appContent').classList.add('hidden'); $('loginCard').classList.remove('hidden'); $('username').value=''; $('password').value=''; $('activeCard').classList.add('hidden'); loginMessage('You have been logged out.');
}
$('logout').onclick=()=>logout(true);

async function cancelActiveDelivery(){
  if(!state.active||state.completing)return;
  const id=state.active.id;
  if(state.lastCancelAt && Date.now()-state.lastCancelAt<1200)return;
  state.lastCancelAt=Date.now();
  state.completing=true;
  let cancelled=false;
  try{
    for(let attempt=1;attempt<=3 && !cancelled;attempt++){
      try{
        await api('/api/deliveries',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'CANCEL',id})});
        cancelled=true;
      }catch(e){
        if(/not found|already completed|already closed/i.test(e.message)){cancelled=true;break;}
        if(attempt<3) await new Promise(r=>setTimeout(r,500));
        else throw e;
      }
    }
    state.active=null;
    $('activeCard').classList.add('hidden');
    $('activeEnd').textContent='—'; $('distance').textContent='—';
    message('Delivery cancelled automatically. No KM was recorded.','ok');
  }catch(e){
    message(`Automatic delivery cancellation failed: ${e.message} — checking server…`,'error');
    await refresh();
    if(state.active){
      // The UI must never remain stuck on a cancelled job. Try the server one more
      // time after the refresh has completed.
      state.completing=false;
      setTimeout(()=>cancelActiveDelivery(),600);
      return;
    }
  }finally{state.completing=false;}
}

async function completeActiveDelivery(end, activeId=null, retryCount=0){
  const targetId=String(activeId || state.active?.id || '');
  const target=state.active && String(state.active.id)===targetId ? state.active : null;
  if(!targetId || !target) return false;
  const start=Number(target.start_km);
  if(!Number.isFinite(end)||end<=start){
    if(retryCount<12){
      clearTimeout(state.completionRetryTimer);
      state.completionRetryTimer=setTimeout(()=>completeActiveDelivery(end,targetId,retryCount+1),1000);
    }
    return false;
  }
  if(state.completing && state.pendingCompletion?.id===targetId) return false;
  state.completing=true;
  state.pendingCompletion={id:targetId,end:Number(end),attempt:retryCount};
  try{
    const d=await api('/api/deliveries',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'COMPLETE',id:targetId,end_km:Math.round(Number(end))})});
    // Only clear the card if it is still the same delivery we completed.
    if(state.active && String(state.active.id)===targetId){
      state.active=null;
      $('activeCard').classList.add('hidden');
      $('activeEnd').textContent='—'; $('distance').textContent='—'; $('clusterRoute').textContent='No active delivery'; if(updateUi.state) renderUpdateState(updateUi.state); $('clusterCargo').textContent='Waiting for TruckTel job…';
    }
    state.lastCompletedEventAt=Math.max(state.lastCompletedEventAt,Number(telemetry.latest?.jobEventAt||Date.now()));
    state.pendingCompletion=null;
    clearTimeout(state.completionRetryTimer);
    clearTimeout(state.restCompletionTimer); state.restCompletionTimer=null;
    message(`Delivery completed automatically — ${Number(d.distance_km).toLocaleString()} KM recorded and approved.`,'ok');
    // Re-read the server immediately. This prevents the old active delivery from
    // remaining on screen while the next TruckTel job is being detected.
    await refresh();
    return true;
  }catch(e){
    // A transient Vercel/network/database response must not leave the driver stuck
    // on the old delivery. Keep the active ID and retry automatically.
    const msg=String(e?.message||e);
    if(/not found|already completed|already closed/i.test(msg)){
      if(state.active && String(state.active.id)===targetId){
        state.active=null;
        $('activeCard').classList.add('hidden');
        $('activeEnd').textContent='—'; $('distance').textContent='—';
      }
      state.pendingCompletion=null;
      await refresh();
      return true;
    }
    if(retryCount<20){
      message(`Automatic completion is retrying… (${retryCount+1})`,'ok');
      clearTimeout(state.completionRetryTimer);
      state.completionRetryTimer=setTimeout(()=>completeActiveDelivery(end,targetId,retryCount+1),1500);
    }else{
      message(`Automatic delivery completion is still pending. The app will keep the active delivery until the server confirms it.`,'error');
    }
    return false;
  }finally{ state.completing=false; }
}

function scheduleRestCompletionFallback(t){
  if(!state.active || !t) return false;
  // TruckTel's websocket is the preferred source. If it is unavailable, REST
  // still tells us when the active job disappears. A delivery that was already
  // tracked, has no active TruckTel job, and has advanced the odometer can be
  // recovered automatically instead of leaving the old Active Delivery card
  // stuck forever.
  if(t.eventStreamConnected) return false;
  if(t.jobActive) {
    state.lastRestJobSeenAt=Date.now();
    clearTimeout(state.restCompletionTimer);
    state.restCompletionTimer=null;
    return false;
  }
  if(state.completing || state.pendingCompletion) return false;
  const start=Number(state.active.start_km);
  const odo=Number(t.odometerKm);
  if(!Number.isFinite(start)||!Number.isFinite(odo)||odo<=start) return false;
  const startedAt=Date.parse(state.active.started_at||'');
  const age=Number.isFinite(startedAt)?Date.now()-startedAt:999999;
  if(age<8000) return false;
  if(!state.lastRestJobSeenAt) state.lastRestJobSeenAt=Date.now()-2500;
  clearTimeout(state.restCompletionTimer);
  state.restCompletionTimer=setTimeout(()=>{
    const latest=telemetry.latest;
    if(!latest || latest.jobActive || latest.eventStreamConnected || !state.active || state.completing) return;
    const end=Number(latest.odometerKm);
    const s=Number(state.active.start_km);
    if(Number.isFinite(end)&&Number.isFinite(s)&&end>s){
      message('TruckTel delivery event was unavailable. Completing the tracked delivery from REST/odometer recovery…','ok');
      completeActiveDelivery(Math.round(end),String(state.active.id),0);
    }
  },1500);
  return true;
}

function scheduleCompletionFromTelemetry(t){
  if(!state.active || !t) return;
  const targetId=String(state.active.id);
  const start=Number(state.active.start_km);
  const odo=t.odometerKm==null?null:Number(t.odometerKm);
  const eventDistance=t.jobEventDistanceKm==null?null:Number(t.jobEventDistanceKm);
  const eventEnd=(Number.isFinite(eventDistance)&&eventDistance>0)?Math.round(start+eventDistance):null;
  const liveEnd=(Number.isFinite(odo)&&odo>start)?Math.round(odo):null;
  // Prefer TruckTel's authoritative delivered distance, but use the live odometer
  // if it is already beyond the start. Either value is only used after an explicit
  // job.delivered event has been received.
  const end=eventEnd || liveEnd;
  if(end!=null && end>start){
    $('activeEnd').textContent=end.toLocaleString()+' KM';
    $('distance').textContent=(end-start).toLocaleString()+' KM';
    state.pendingCompletion={id:targetId,end};
    clearTimeout(state.completionRetryTimer);
    state.completionRetryTimer=setTimeout(()=>completeActiveDelivery(end,targetId,0),250);
    return true;
  }
  // The delivery event can arrive before the final odometer update. Poll for a
  // short period rather than leaving the old active delivery stuck forever.
  if(t.jobDelivered || t.jobEvent==='job-delivered'){
    clearTimeout(state.completionRetryTimer);
    state.completionRetryTimer=setTimeout(()=>{
      const latest=telemetry.latest;
      scheduleCompletionFromTelemetry(latest);
    },1000);
  }
  return false;
}

(async()=>{try{const token=await window.vipClient?.auth?.getToken?.(); await authenticateWithToken(token);}catch{}})();

const telemetry = { latest:null };
function polar(cx,cy,r,deg){const a=(deg-90)*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];}
function buildGaugeTicks(tickId,labelId,max,step){
  const ticks=$(tickId), labels=$(labelId); if(!ticks||!labels||ticks.childElementCount)return;
  for(let i=0;i<=max;i+=step){
    const deg=-135+(i/max)*270, rad=deg*Math.PI/180;
    const outer=polar(100,100,76,deg), inner=polar(100,100,69,deg);
    const line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',outer[0]);line.setAttribute('y1',outer[1]);line.setAttribute('x2',inner[0]);line.setAttribute('y2',inner[1]);line.setAttribute('class','tick');ticks.appendChild(line);
    const p=polar(100,100,59,deg), text=document.createElementNS('http://www.w3.org/2000/svg','text'); text.setAttribute('x',p[0]);text.setAttribute('y',p[1]+4);text.setAttribute('class','label');text.textContent=String(i);labels.appendChild(text);
    if(i<max){ for(let m=1;m<5;m++){ const md=deg+(270/max)*step*(m/5); const mo=polar(100,100,75,md), mi=polar(100,100,71,md); const minor=document.createElementNS('http://www.w3.org/2000/svg','line'); minor.setAttribute('x1',mo[0]);minor.setAttribute('y1',mo[1]);minor.setAttribute('x2',mi[0]);minor.setAttribute('y2',mi[1]);minor.setAttribute('class','minor');ticks.appendChild(minor); } }
  }
}
const gaugeMotion={speed:0,rpm:0,targetSpeed:0,targetRpm:0,raf:0};
function setNeedle(id,value,max){const el=$(id); if(!el)return; const n=Math.max(0,Math.min(max,Number(value)||0)); const deg=-135+(n/max)*270; el.style.transform=`rotate(${deg}deg)`;}
function animateGauges(){
  const ease=0.22;
  gaugeMotion.speed += (gaugeMotion.targetSpeed-gaugeMotion.speed)*ease;
  gaugeMotion.rpm += (gaugeMotion.targetRpm-gaugeMotion.rpm)*ease;
  setNeedle('speedNeedle',gaugeMotion.speed,240);
  setNeedle('rpmNeedle',gaugeMotion.rpm/1000,8);
  gaugeMotion.raf=requestAnimationFrame(animateGauges);
}
function initGauges(){buildGaugeTicks('speedTicks','speedLabels',240,20);buildGaugeTicks('rpmTicks','rpmLabels',8,1);cancelAnimationFrame(gaugeMotion.raf);animateGauges();}
initGauges();

async function renderTelemetry(t){
  telemetry.latest=t;
  $('telemetryCard').classList.remove('hidden');
  $('telemetryStatus').textContent=t.connected?'ONLINE':(t.adapterStatus?.state || 'OFFLINE');
  const odoText=t.odometerKm==null?'—':Number(t.odometerKm).toLocaleString(undefined,{minimumFractionDigits:3,maximumFractionDigits:3})+' KM';
  $('telemetryOdo').textContent=odoText;
  const speed=t.speedKmh==null?0:Number(t.speedKmh);
  const rpm=t.rpm==null?0:Number(t.rpm);
  const displaySpeed=Math.max(0,Math.min(240,speed));
  const displayRpm=Math.max(0,Math.min(8000,rpm));
  gaugeMotion.targetSpeed=t.connected?displaySpeed:0;
  gaugeMotion.targetRpm=t.connected?displayRpm:0;
  if($('speedStatus')) $('speedStatus').textContent=displaySpeed<1?'PARKED':displaySpeed<5?'CRAWLING':displaySpeed>100?'HIGH SPEED':'CRUISING';
  if($('rpmStatus')) $('rpmStatus').textContent=displayRpm<700?'IDLE':displayRpm>6000?'REDLINE':'RUNNING';
  $('telemetrySpeed').textContent=t.connected?Math.round(speed)+' KM/H':'—';
  $('telemetryFuel').textContent=t.fuelLiters==null?'—':Number(t.fuelLiters).toFixed(0)+' L';
  $('centerOdo').textContent=t.odometerKm==null?'—':Number(t.odometerKm).toLocaleString(undefined,{minimumFractionDigits:3,maximumFractionDigits:3});
  const gear=t.gear==null?'D':(Number(t.gear)===0?'N':(Number(t.gear)<0?'R':String(Math.round(Number(t.gear)))));
  $('centerGear').textContent=gear;
  const route=[t.origin,t.destination].filter(Boolean).join(' → ');
  const cargo=t.cargo?` · ${t.cargo}`:'';
  $('centerRoute').textContent=t.connected?(route?`${route}${cargo}`:`Connected to ${t.game || 'Truck Simulator'} — waiting for a job…`):(t.adapterStatus?.reason || 'Waiting for ETS2 or ATS telemetry…');
  const trip=state.active && t.odometerKm!=null ? Math.max(0,Number(t.odometerKm)-Number(state.active.start_km)) : null;
  $('centerTrip').innerHTML=`TRIP <b>${trip==null?'—':trip.toFixed(3)+' KM'}</b>`;
  if(state.active){ $('clusterRoute').textContent=`${state.active.origin} → ${state.active.destination}`; $('clusterCargo').textContent=`${state.active.truckersmp_username} · ${state.active.cargo}`; } else { $('clusterRoute').textContent=route||'No active delivery'; $('clusterCargo').textContent=t.cargo||'Waiting for TruckTel job…'; }
  if($('telemetryDebug')) { const wsState=t.eventStreamState || (t.eventStreamConnected?'CONNECTED':'DISCONNECTED'); const wsDetail=t.eventStreamError || t.eventStreamClose || ''; $('telemetryDebug').textContent=`TruckTel :8080 | job=${t.jobActive?'ACTIVE':'NONE'} | event=${t.jobEvent||'—'} | events=WS ${wsState}${wsDetail?` (${wsDetail})`:''} | attempts=${t.eventStreamAttempts||0} | source=${t.jobSource||t.source||'—'} | mode=AUTO`; }

  if(updateUi.state?.status==='downloaded') renderUpdateState(updateUi.state);

  if(state.active && t.odometerKm!=null){
    const end=Number(t.odometerKm);
    if(end>Number(state.active.start_km)){
      $('activeEnd').textContent=end.toLocaleString()+' KM';
      $('distance').textContent=(end-Number(state.active.start_km)).toLocaleString()+' KM';
    }
  }

  const jobSignature=[t.origin,t.destination,t.cargo,t.truck,t.trailer,t.jobStartingTime,t.plannedDistanceKm,t.jobEvent].join('|');
  const eventStarted=t.jobEvent==='job-started' && Number(t.jobEventAt||0)>Number(state.lastJobEventAt||0);
  const jobStarted=eventStarted || t.jobEvent==='job-started' || (Boolean(t.jobActive) && (!state.lastJobActive || (jobSignature && jobSignature!==state.lastJobSignature))) || (Boolean(t.jobActive) && !state.active);
  const jobCancelled=Boolean(t.jobCancelled||t.jobEvent==='job-cancelled');
  // Only TruckTel's explicit job.delivered event is allowed to complete a delivery.
  // A generic job-finished/disappeared state must never create a KM record.
  const deliveryEventAt=Number(t.jobEventAt||0);
  const jobFinished=Boolean(t.jobDelivered||t.jobEvent==='job-delivered') && deliveryEventAt>Number(state.lastCompletedEventAt||0);
  if(jobStarted) message(`${t.game || 'Truck Simulator'} job detected — starting delivery automatically…`,'ok');

  if(jobCancelled && state.active){
    message(`${t.game || 'Truck Simulator'} job cancelled — removing active delivery…`,'ok');
    setTimeout(()=>cancelActiveDelivery(),150);
    state.lastJobFinished=true;
    state.lastJobActive=false;
    return;
  }

  if(t.connected && t.jobActive && !state.active && !state.startingJob && state.username && t.odometerKm!=null){
    const autoKey=[t.jobStartingTime||'',t.origin,t.destination,t.cargo,t.truck,t.trailer,t.plannedDistanceKm].join('|');
    if(autoKey!==state.autoStartKey){
      const startKm=Math.round(Number(t.odometerKm));
      const body={action:'START',truckersmp_username:state.username,delivery_date:new Date().toISOString().slice(0,10),origin:String(t.origin||''),destination:String(t.destination||''),cargo:String(t.cargo||''),truck:String(t.truck||''),trailer:String(t.trailer||''),start_km:startKm};
      if(!body.origin||!body.destination||!body.cargo){ message(`${t.game || 'Truck Simulator'} job detected — waiting for complete TruckTel job data…`,'error'); }
      else{
        state.startingJob=true;
        try{
          const d=await api('/api/deliveries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
          state.autoStartKey=autoKey; showActive(d.delivery);
          message(`Delivery started automatically at ${startKm.toLocaleString()} KM. Drive safely.`,'ok');
          // If TruckTel emitted job.delivered just before the START request
          // finished, don't lose that event. Complete the just-created active
          // delivery from the event distance/odometer.
          if ((t.jobDelivered || t.jobEvent==='job-delivered') && Number(t.jobEventAt||0)>Number(state.lastCompletedEventAt||0)) {
            scheduleCompletionFromTelemetry(t);
          }
        }catch(e){ message(`Automatic delivery start failed: ${e.message} — retrying…`,'error'); }
        finally{state.startingJob=false;}
      }
    }
  }

  if(jobFinished && state.active){
    message(`${t.game || 'Truck Simulator'} delivery finished. Completing automatically…`,'ok');
    scheduleCompletionFromTelemetry(t);
  }

  // Recovery path for machines where TruckTel's /api/ws/event is unavailable.
  // Never use this while the event websocket is healthy.
  if(state.active && !jobFinished && !jobCancelled) scheduleRestCompletionFallback(t);

  if(!t.jobActive) state.autoStartKey='';
  state.lastJobActive=Boolean(t.jobActive);
  state.lastJobFinished=Boolean(t.jobDelivered);
  state.lastJobSignature=jobSignature;
  if(Number(t.jobEventAt||0)>Number(state.lastJobEventAt||0)) state.lastJobEventAt=Number(t.jobEventAt);
}
async function pollTelemetry(){
  try{const t=await window.vipClient.telemetry.get(); await renderTelemetry(t);}
  catch{$('telemetryCard').classList.remove('hidden'); $('telemetryStatus').textContent='OFFLINE';}
}
let telemetryPollBusy=false;
async function smoothTelemetryPoll(){
  if(telemetryPollBusy)return;
  telemetryPollBusy=true;
  try{await pollTelemetry();}finally{telemetryPollBusy=false;setTimeout(smoothTelemetryPoll,250);}
}
smoothTelemetryPoll();
