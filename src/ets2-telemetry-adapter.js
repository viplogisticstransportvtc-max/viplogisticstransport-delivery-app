'use strict';

const http = require('node:http');

const BRIDGE_URL = 'http://127.0.0.1:25555/telemetry';
const STATUS_URL = 'http://127.0.0.1:25555/status';

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function jsonSafe(value, seen = new WeakSet()) {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(v => jsonSafe(v, seen));
  const out = {};
  for (const [key, val] of Object.entries(value)) out[key] = jsonSafe(val, seen);
  return out;
}

function postJson(url, payload) {
  return new Promise((resolve) => {
    let body;
    try { body = JSON.stringify(payload); } catch (_) { return resolve(false); }
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 1000
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

function normalize(data, sdkJobActive = false, sdkJobEvent = '', sdkJobEventAt = 0) {
  const d = data || {};
  const trailer = Array.isArray(d.trailers) ? d.trailers.find(t => t.attached !== false) || d.trailers[0] || {} : {};
  const cargo = text(d.cargo);
  const origin = text(d.citySrc);
  const destination = text(d.cityDst);
  // Some SDK/plugin revisions expose job state as an event flag. Others can
  // briefly clear onJob while the job data is already populated. Treat a
  // complete current-job payload as active as a fallback.
  const jobDataPresent = Boolean(cargo && origin && destination);
  const jobActive = Boolean((d.onJob || sdkJobActive || (jobDataPresent && !d.jobFinished && !d.jobDelivered && !d.jobCancelled)));
  if (d.jobDelivered || d.jobCancelled || d.jobFinished) sdkJobActive = false;
  const gameName = Number(d.game) === 2 ? 'ATS' : 'ETS2';
  const speedMs = numberOrNull(d.speed);
  const fuel = numberOrNull(d.fuel);
  const odometer = numberOrNull(d.truckOdometer);
  const bool = (...keys) => {
    for (const key of keys) {
      const v = d?.[key];
      if (v === true) return true;
      if (v === false || v == null || v === '') continue;
      const n = Number(v);
      if (Number.isFinite(n)) return n !== 0;
      if (['true','on','active','yes'].includes(String(v).trim().toLowerCase())) return true;
    }
    return false;
  };
  // ETS2/ATS SCS telemetry channel names as exposed by the bridge.
  const indicators = {
    left: bool('truck.light.lblinker','truck.blinkerLeftOn','truck.blinkerLeftActive'),
    right: bool('truck.light.rblinker','truck.blinkerRightOn','truck.blinkerRightActive'),
    hazard: bool('truck.hazard.warning','truck.hazardWarningLights'),
    parking: bool('truck.light.parking','truck.lightsParkingOn'),
    lowBeam: bool('truck.light.beam.low','truck.lightsBeamLowOn'),
    highBeam: bool('truck.light.beam.high','truck.lightsBeamHighOn'),
    brake: bool('truck.light.brake','truck.lightsBrakeOn'),
    beacon: bool('truck.light.beacon','truck.lightsBeaconOn')
  };

  return {
    game: gameName,
    truck: text(d.truckName || d.truckBrand),
    trailer: text(trailer.name || trailer.bodyType || trailer.brand),
    speedKmh: speedMs === null ? null : speedMs * 3.6,
    odometerKm: odometer,
    fuelLiters: fuel,
    fuelCapacityLiters: numberOrNull(d.fuelCapacity),
    fuelPct: numberOrNull(d.fuelCapacity) && fuel !== null ? (fuel / Number(d.fuelCapacity)) * 100 : null,
    indicators,
    gear: d.gearDashboard ?? d.gear ?? null,
    rpm: numberOrNull(d.engineRpm),
    origin,
    destination,
    cargo,
    jobActive,
    jobFinished: Boolean(d.jobFinished || d.jobDelivered),
    jobDelivered: Boolean(d.jobDelivered),
    jobCancelled: Boolean(d.jobCancelled),
    jobStartingTime: numberOrNull(d.jobStartingTime),
    plannedDistanceKm: numberOrNull(d.plannedDistanceKm),
    jobIncome: d.jobIncome == null ? null : String(d.jobIncome),
    jobEvent: sdkJobEvent,
    jobEventAt: sdkJobEventAt || null,
    isCargoLoaded: Boolean(d.isCargoLoaded),
    connected: Boolean(d.sdkActive),
    sdkActive: Boolean(d.sdkActive),
    telemetryPluginRevision: numberOrNull(d.telemetryPluginRevision),
    timestamp: Date.now(),
    raw: jsonSafe(d)
  };
}

function loadTelemetryModule() {
  try {
    // eslint-disable-next-line global-require
    const mod = require('trucksim-telemetry');
    return mod?.truckSimTelemetry || mod?.default || mod;
  } catch (error) {
    return { error };
  }
}

function startEts2TelemetryAdapter() {
  const factory = loadTelemetryModule();
  if (factory?.error) {
    const reason = `Native module unavailable: ${factory.error.message}`;
    postJson(STATUS_URL, { state: 'ERROR', reason });
    return { connected: false, available: false, reason, stop() {} };
  }

  let stopped = false;
  let received = false;
  let telemetry;
  let lastSignature = '';
  let sdkJobActive = false;
  let sdkJobEvent = '';
  let sdkJobEventAt = 0;

  const publish = async (data) => {
    if (stopped || !data) return;
    const normalized = normalize(data, sdkJobActive, sdkJobEvent, sdkJobEventAt);
    received = true;
    await postJson(BRIDGE_URL, normalized);
    await postJson(STATUS_URL, {
      state: normalized.sdkActive ? 'CONNECTED' : 'WAITING',
      reason: normalized.sdkActive ? 'ETS2 telemetry connected.' : 'Telemetry module is running, but ETS2 SDK is not active.',
      pluginRevision: normalized.telemetryPluginRevision
    });

    const signature = JSON.stringify({
      odometerKm: normalized.odometerKm,
      speedKmh: normalized.speedKmh,
      origin: normalized.origin,
      destination: normalized.destination,
      cargo: normalized.cargo,
      jobActive: normalized.jobActive,
      jobFinished: normalized.jobFinished
    });
    if (signature === lastSignature) return;
    lastSignature = signature;
  };

  const markJobStarted = (data) => {
    sdkJobActive = true;
    sdkJobEvent = 'job-started';
    sdkJobEventAt = Date.now();
    publish({ ...(data || {}), onJob: true, jobFinished: false, jobDelivered: false, jobCancelled: false });
  };
  const markJobEnded = (eventName, data) => {
    sdkJobActive = false;
    sdkJobEvent = eventName;
    sdkJobEventAt = Date.now();
    publish({ ...(data || {}), jobFinished: true, jobDelivered: eventName === 'job-delivered', jobCancelled: eventName === 'job-cancelled', onJob: false });
  };

  try {
    // Current trucksim-telemetry v1.0.0 uses the onUpdate option.
    telemetry = typeof factory === 'function' ? factory({ onUpdate: publish }) : factory;

    if (telemetry && typeof telemetry.on === 'function') {
      telemetry.on('connected', () => postJson(STATUS_URL, { state: 'CONNECTED', reason: 'ETS2 SDK shared memory connected.' }));
      telemetry.on('disconnected', () => { sdkJobActive = false; postJson(STATUS_URL, { state: 'WAITING', reason: 'ETS2 SDK shared memory disconnected.' }); });
      telemetry.on('job-started', markJobStarted);
      telemetry.on('job-delivered', (data) => markJobEnded('job-delivered', data));
      telemetry.on('job-finished', (data) => markJobEnded('job-finished', data));
      telemetry.on('job-cancelled', (data) => markJobEnded('job-cancelled', data));
    }

    // Compatibility with older releases.
    if (!telemetry || typeof telemetry.on !== 'function') {
      if (typeof telemetry?.watch === 'function') telemetry.watch({ interval: 250 }, publish);
      else if (typeof telemetry?.getData === 'function') {
        telemetry.__vipTimer = setInterval(() => {
          try { publish(telemetry.getData()); } catch (_) {}
        }, 250);
      }
    }

    postJson(STATUS_URL, { state: 'WAITING', reason: 'Telemetry adapter started. Start ETS2 and enable the SCS SDK plugin.' });
  } catch (error) {
    const reason = `Telemetry adapter error: ${error.message}`;
    postJson(STATUS_URL, { state: 'ERROR', reason });
    return { connected: false, available: true, reason, stop() {} };
  }

  return {
    connected: received,
    available: true,
    reason: 'Telemetry adapter started.',
    stop() {
      stopped = true;
      try { if (telemetry?.__vipTimer) clearInterval(telemetry.__vipTimer); } catch (_) {}
      try { if (typeof telemetry?.stop === 'function') telemetry.stop(); } catch (_) {}
      postJson(STATUS_URL, { state: 'STOPPED', reason: 'Telemetry adapter stopped.' });
    }
  };
}

module.exports = { startEts2TelemetryAdapter };
