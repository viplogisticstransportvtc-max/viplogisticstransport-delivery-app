'use strict';
const http = require('node:http');
const WebSocketClient = (() => { try { return require('ws'); } catch { return globalThis.WebSocket; } })();

// TruckTel has two local HTTP servers by default:
// 8079 = landing page, 8080 = actual TruckTel app/API server.
const TRUCKTEL_BASE = 'http://127.0.0.1:8080';
const TRUCKTEL_WS = 'ws://127.0.0.1:8080';
// TruckTel builds differ slightly in their websocket route parser. Current
// documentation allows /api/ws/event, while some installed builds require a
// structure segment. Try the documented route first, then compatibility routes.
const TRUCKTEL_EVENT_PATHS = [
  '/api/ws/event?throttle=0',
  '/api/ws/event/flat?throttle=0',
  '/api/ws/event/struct?throttle=0',
  '/api/ws/event/single?throttle=0'
];
const BRIDGE_URL = 'http://127.0.0.1:25555/telemetry';
const STATUS_URL = 'http://127.0.0.1:25555/status';

function getJson(path, timeout = 1500) {
  return new Promise((resolve, reject) => {
    const req = http.get(TRUCKTEL_BASE + path, {
      timeout,
      headers: { 'Cache-Control': 'no-cache', Accept: 'application/json' }
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} ${path}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Invalid JSON from ${TRUCKTEL_BASE}${path}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`Timeout ${path}`)));
  });
}

function postJson(url, payload) {
  return new Promise(resolve => {
    const body = JSON.stringify(payload);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 800
    }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end(body);
  });
}

function text(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v._ != null) return String(v._);
    if (v.value != null) return String(v.value);
    if (v.name != null) return String(v.name);
    return '';
  }
  return String(v);
}

function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') v = v._ ?? v.value;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function get(obj, path) {
  let x = obj;
  for (const key of path.split('.')) {
    if (x == null || typeof x !== 'object') return null;
    x = x[key];
  }
  return x == null ? null : x;
}

function first(obj, paths) {
  for (const p of paths) {
    const v = get(obj, p);
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return null;
}

function unwrap(v) {
  if (v && typeof v === 'object' && v._ !== undefined) return v._;
  return v;
}

async function safeJson(path) {
  try { return await getJson(path); } catch { return null; }
}

async function readTelemetry() {
  const [game, gameFlat, truck, truckFlat, job, frame, jobFlat] = await Promise.all([
    safeJson('/api/rest/struct/game'),
    safeJson('/api/rest/flat/game'),
    safeJson('/api/rest/struct/truck'),
    safeJson('/api/rest/flat/truck'),
    safeJson('/api/rest/struct/job'),
    safeJson('/api/rest/struct/frame'),
    safeJson('/api/rest/flat/job')
  ]);

  const gameIdRaw = first(game, ['game.id', 'id']) ?? first(gameFlat, ['game.id']);
  const gameNameRaw = first(game, ['game.name', 'name']) ?? first(gameFlat, ['game.name']);
  const gameIdText = text(gameIdRaw).trim().toLowerCase();
  const gameNameText = text(gameNameRaw).trim().toLowerCase();
  const gameId = gameIdText || (gameNameText.includes('american truck simulator') || gameNameText === 'ats' ? 'ats' : gameNameText.includes('euro truck simulator') || gameNameText === 'ets2' ? 'eut2' : '');
  const gameVersionRaw = first(game, ['game.version', 'version']) ?? first(gameFlat, ['game.version']);
  const apiVersionRaw = first(game, ['game.api_version', 'api_version']) ?? first(gameFlat, ['game.api_version']);
  const truckName = text(first(truck, ['truck.name', 'name']) ?? first(truckFlat, ['truck.name']));
  const odo = num(first(truck, ['truck.odometer', 'odometer']) ?? first(truckFlat, ['truck.odometer']));
  const speed = num(first(truck, ['truck.speed', 'speed']) ?? first(truckFlat, ['truck.speed']));
  const rpm = num(first(truck, ['truck.engine.rpm', 'truck.engine_rpm', 'truck.rpm', 'engine.rpm', 'engine_rpm', 'rpm']) ?? first(truckFlat, ['truck.engine.rpm', 'truck.engine_rpm', 'truck.rpm', 'engine.rpm', 'engine_rpm', 'rpm']));
  const gearRaw = first(truck, ['truck.displayed.gear', 'truck.engine.gear', 'truck.transmission.gear', 'truck.gear', 'displayed.gear', 'engine.gear', 'transmission.gear', 'gear']) ?? first(truckFlat, ['truck.displayed.gear', 'truck.engine.gear', 'truck.transmission.gear', 'truck.gear', 'displayed.gear', 'engine.gear', 'transmission.gear', 'gear']);
  const gear = num(gearRaw);
  const fuel = num(first(truck, ['truck.fuel.amount', 'fuel.amount']) ?? first(truckFlat, ['truck.fuel.amount']));
  const capacity = num(first(truck, ['truck.fuel.capacity', 'fuel.capacity']) ?? first(truckFlat, ['truck.fuel.capacity']));
  const bool = v => {
    if (v === true) return true;
    if (v === false || v == null || v === '') return false;
    const n = Number(unwrap(v));
    if (Number.isFinite(n)) return n !== 0;
    return ['true','on','active','yes'].includes(String(unwrap(v)).trim().toLowerCase());
  };
  const light = paths => bool(first(truck, paths) ?? first(truckFlat, paths));
  // TruckTel exposes SCS telemetry channels using the exact `truck.light.*`
  // names below. Use the actual lamp state for blinkers, not only the switch
  // state, so the dashboard follows the visible blinking phase.
  const indicators = {
    left: light(['truck.light.lblinker','truck.blinkerLeftOn','truck.blinkerLeftActive']),
    right: light(['truck.light.rblinker','truck.blinkerRightOn','truck.blinkerRightActive']),
    hazard: light(['truck.hazard.warning','truck.hazardWarningLights']),
    parking: light(['truck.light.parking','truck.lightsParkingOn']),
    lowBeam: light(['truck.light.beam.low','truck.lightsBeamLowOn']),
    highBeam: light(['truck.light.beam.high','truck.lightsBeamHighOn']),
    brake: light(['truck.light.brake','truck.lightsBrakeOn']),
    beacon: light(['truck.light.beacon','truck.lightsBeaconOn'])
  };
  const trailer = text(first(truck, [
    'trailer.0.body.type', 'trailer.0.brand', 'trailer.0.id',
    'trailer.0.chain.type'
  ]) ?? first(truckFlat, ['trailer.0.body.type', 'trailer.0.brand', 'trailer.0.id', 'trailer.0.chain.type']));

  // TruckTel structured data can represent a scalar-with-children as {_: value, ...}.
  // Support both that representation and plain scalar values.
  const source = (job && typeof job === 'object') ? job : {};
  const flat = (jobFlat && typeof jobFlat === 'object') ? jobFlat : {};
  const origin = text(first(source, ['job.source.city._', 'job.source.city', 'source.city._', 'source.city'])) || text(first(flat, ['job.source.city']));
  const destination = text(first(source, ['job.destination.city._', 'job.destination.city', 'destination.city._', 'destination.city'])) || text(first(flat, ['job.destination.city']));
  const cargo = text(first(source, ['job.cargo._', 'job.cargo.name', 'job.cargo', 'cargo._', 'cargo.name', 'cargo'])) || text(first(flat, ['job.cargo']));
  const cargoLoaded = Boolean(first(source, ['job.cargo.loaded', 'cargo.loaded'])) || Boolean(first(flat, ['job.cargo.loaded']));
  const planned = num(first(source, ['job.planned_distance.km', 'planned_distance.km'])) ?? num(first(flat, ['job.planned_distance.km']));
  const income = unwrap(first(source, ['job.income', 'income'])) ?? unwrap(first(flat, ['job.income']));
  const market = text(first(source, ['job.job.market', 'job.market', 'market'])) || text(first(flat, ['job.job.market']));
  const jobStartingTime = num(first(source, ['job.starting_time', 'starting_time', 'job.job.starting_time'])) ?? num(first(flat, ['job.starting_time']));

  const hasStructuredJob = Boolean(job && typeof job === 'object' && Object.keys(job).length);
  const hasFlatJob = Boolean(jobFlat && typeof jobFlat === 'object' && Object.keys(jobFlat).length);
  const jobActive = (hasStructuredJob || hasFlatJob) && Boolean(origin || destination || cargo || planned != null || income != null || market || jobStartingTime != null);
  const signature = [origin, destination, cargo, planned, income, market, jobStartingTime].map(text).join('|');
  const gameVersion = Array.isArray(gameVersionRaw) ? gameVersionRaw.join('.') : text(gameVersionRaw);
  const apiVersion = Array.isArray(apiVersionRaw) ? apiVersionRaw.join('.') : text(apiVersionRaw);
  const supportedGame = gameId === 'eut2' || gameId === 'ats';
  const apiReachable = Boolean(game || gameFlat || truck || truckFlat || job || frame || jobFlat);
  const gameName = gameId === 'ats' ? 'ATS' : gameId === 'eut2' ? 'ETS2' : text(gameNameRaw) || 'Truck Simulator';
  // TruckTel exposes game.id from its initialization callback. Once that exists,
  // the plugin is connected even if the truck is parked in the menu and some
  // truck channels are temporarily unavailable. Do not require odometer/truck
  // data to decide whether the game connection itself is alive.
  const connected = supportedGame;

  return {
    game: gameName,
    gameVersion,
    telemetryApiVersion: apiVersion,
    truck: truckName,
    trailer,
    speedKmh: speed == null ? null : Math.abs(speed) * 3.6,
    rpm,
    gear,
    odometerKm: odo,
    fuelLiters: fuel,
    fuelCapacityLiters: capacity,
    fuelPct: fuel != null && capacity ? fuel / capacity * 100 : null,
    indicators,
    origin,
    destination,
    cargo,
    jobActive,
    jobFinished: false,
    jobDelivered: false,
    jobCancelled: false,
    jobStartingTime,
    plannedDistanceKm: planned,
    jobIncome: income == null ? null : String(income),
    jobMarket: market,
    jobCargoLoaded: cargoLoaded,
    jobEvent: '',
    jobEventAt: 0,
    jobEventDistanceKm: null,
    connected,
    apiReachable,
    sdkActive: connected,
    telemetryPluginRevision: 'TruckTel',
    source: 'TruckTel',
    sourceEndpoint: TRUCKTEL_BASE,
    framePaused: Boolean(first(frame, ['frame.paused', 'paused'])),
    timestamp: Date.now(),
    jobSignature: signature,
    jobSource: hasFlatJob ? 'TruckTel REST struct+flat' : 'TruckTel REST struct'
  };
}

function startTruckTelAdapter() {
  let stopped = false;
  let timer = null;
  let ws = null;
  let wsReconnectTimer = null;
  let lastJob = false;
  let lastSig = '';
  let missingJobTicks = 0;
  let lastError = '';
  let pendingEvent = null;
  let eventConnected = false;
  let eventState = 'DISCONNECTED';
  let eventError = '';
  let eventClose = '';
  let eventAttempts = 0;
  let eventPath = '';

  function queueEvent(event) {
    if (Array.isArray(event)) { for (const item of event) queueEvent(item); return; }
    if (!event || typeof event !== 'object') return;
    // TruckTel's documented event format is { _: 'job.delivered', ... }.
    // Accept a few harmless wrappers as well so a proxy/client update cannot
    // make the delivery event invisible to the app.
    const payload = (event.data && typeof event.data === 'object') ? event.data
      : (event.event && typeof event.event === 'object' ? event.event : event);
    const id = text(payload._ || payload.event || payload.id || payload.type || event._ || event.event || event.id || event.type);
    if (!id) return;
    const now = Date.now();
    if (id === 'job.delivered') {
      pendingEvent = {
        name: 'job-delivered',
        at: now,
        distanceKm: num(first(payload, ['distance.km', 'job.distance.km'])) ?? num(first(event, ['distance.km', 'job.distance.km'])),
        raw: payload
      };
    } else if (id === 'job.cancelled') {
      pendingEvent = { name: 'job-cancelled', at: now, raw: payload };
    }
  }

  function connectEvents() {
    if (stopped || !WebSocketClient) {
      eventConnected = false;
      eventState = 'UNAVAILABLE';
      eventError = 'WebSocket client module is unavailable in the desktop app.';
      return;
    }
    try {
      eventAttempts += 1;
      eventState = 'CONNECTING';
      eventError = '';
      eventClose = '';
      // The user's TruckTel build is explicitly returning "missing structure"
      // for /api/ws/event. That means the server is using the older route
      // parser even though the current TruckTel docs describe /api/ws/event.
      // Rotate through compatible endpoints until one is accepted.
      const path = TRUCKTEL_EVENT_PATHS[(eventAttempts - 1) % TRUCKTEL_EVENT_PATHS.length];
      eventPath = path;
      const eventUrl = `${TRUCKTEL_WS}${path}`;
      ws = new WebSocketClient(eventUrl, {
        perMessageDeflate: false,
        handshakeTimeout: 2500,
      });

      const onOpen = () => {
        eventConnected = true;
        eventState = 'CONNECTED';
        eventError = '';
        eventClose = '';
      };
      const onMessage = raw => {
        try {
          let textData;
          if (Buffer.isBuffer(raw)) textData = raw.toString('utf8');
          else if (raw && raw.data != null) textData = Buffer.isBuffer(raw.data) ? raw.data.toString('utf8') : String(raw.data);
          else textData = String(raw);
          queueEvent(JSON.parse(textData));
        } catch (e) {
          // Keep the connection alive even if TruckTel sends a non-JSON frame.
          eventError = `Invalid event frame: ${String(e?.message || e).slice(0, 120)}`;
        }
      };
      const onError = err => {
        eventConnected = false;
        eventState = 'ERROR';
        eventError = String(err?.message || err || 'WebSocket error').slice(0, 180);
      };
      const onClose = (code, reason) => {
        eventConnected = false;
        eventState = 'DISCONNECTED';
        const reasonText = Buffer.isBuffer(reason) ? reason.toString('utf8') : String(reason || '').trim();
        eventClose = `code ${code}${reasonText ? `: ${reasonText}` : ''}`;
        ws = null;
        if (!stopped) {
          clearTimeout(wsReconnectTimer);
          wsReconnectTimer = setTimeout(connectEvents, 1000);
        }
      };

      // node `ws` uses EventEmitter; Electron/browser WebSocket uses DOM events.
      if (typeof ws.on === 'function') {
        ws.on('open', onOpen);
        ws.on('message', onMessage);
        ws.on('error', onError);
        ws.on('close', onClose);
        ws.on('unexpected-response', (_request, response) => {
          eventConnected = false;
          eventState = 'ERROR';
          eventError = `HTTP ${response?.statusCode || 'unknown'} during WebSocket handshake (${path})`;
          eventState = 'RETRYING';
        });
      } else if (typeof ws.addEventListener === 'function') {
        ws.addEventListener('open', onOpen);
        ws.addEventListener('message', onMessage);
        ws.addEventListener('error', onError);
        ws.addEventListener('close', ev => onClose(ev?.code ?? 1006, ev?.reason ?? ''));
      } else {
        throw new Error('Unsupported WebSocket client API');
      }
    } catch (e) {
      eventConnected = false;
      eventState = 'ERROR';
      eventError = String(e?.message || e || 'WebSocket connection failed').slice(0, 180);
      ws = null;
      clearTimeout(wsReconnectTimer);
      if (!stopped) wsReconnectTimer = setTimeout(connectEvents, 1000);
    }
  }

  const tick = async () => {
    if (stopped) return;
    try {
      const t = await readTelemetry();
      let event = '';
      let eventAt = 0;
      let eventDistanceKm = null;
      let delivered = false;
      let cancelled = false;

      if (pendingEvent) {
        event = pendingEvent.name;
        eventAt = pendingEvent.at;
        eventDistanceKm = pendingEvent.distanceKm;
        delivered = pendingEvent.name === 'job-delivered';
        cancelled = pendingEvent.name === 'job-cancelled';
        // Keep the event available for several polls so the renderer cannot miss it.
        // Keep the explicit event buffered long enough for the renderer/API
        // request to finish even if the game clears the active job immediately.
        if (Date.now() - pendingEvent.at > 20000) pendingEvent = null;
      }

      const sig = t.jobSignature;
      if (!event && t.jobActive && !lastJob) event = 'job-started';
      else if (!event && sig && sig !== lastSig && t.jobActive && lastJob) event = 'job-changed';

      // Do not infer cancellation from a disappearing REST job. TruckTel can
      // briefly report no active job while the delivery event is still being
      // delivered over the event stream. Cancellation is authoritative only
      // when TruckTel emits job.cancelled.
      if (!t.jobActive) missingJobTicks += 1;
      else missingJobTicks = 0;

      if (event && !eventAt) eventAt = Date.now();
      if (event === 'job-delivered') delivered = true;
      if (event === 'job-cancelled') cancelled = true;

      t.jobEvent = event;
      t.jobEventAt = eventAt;
      t.jobEventDistanceKm = eventDistanceKm;
      t.jobDelivered = delivered;
      t.jobCancelled = cancelled;
      t.jobFinished = delivered || cancelled;
      t.eventStreamConnected = eventConnected;
      t.eventStreamState = eventState;
      t.eventStreamError = eventError;
      t.eventStreamClose = eventClose;
      t.eventStreamAttempts = eventAttempts;
      t.eventStreamPath = eventPath;

      lastJob = t.jobActive;
      lastSig = sig;
      lastError = '';

      await postJson(BRIDGE_URL, t);
      await postJson(STATUS_URL, {
        state: t.connected ? 'CONNECTED' : 'WAITING',
        reason: t.connected
          ? `${t.game} ${t.gameVersion || ''} connected through TruckTel on port 8080.`.replace(/\s+/g, ' ').trim()
          : t.apiReachable
            ? `TruckTel API on port 8080 is reachable, but it is not reporting an ETS2/ATS game session yet.`
            : `TruckTel API on port 8080 is not reachable yet. Start ETS2 or ATS with TruckTel loaded.`,
        apiReachable: Boolean(t.apiReachable),
        game: t.game,
        gameId: t.game === 'ATS' ? 'ats' : t.game === 'ETS2' ? 'eut2' : '',
        source: 'TruckTel',
        sourceEndpoint: TRUCKTEL_BASE,
        gameVersion: t.gameVersion || '',
        apiVersion: t.telemetryApiVersion || '',
        jobActive: t.jobActive,
        jobEvent: t.jobEvent || '',
        eventStreamConnected: eventConnected,
        eventStreamStatus: eventState,
        eventStreamError: eventError,
        eventStreamClose: eventClose,
        eventStreamAttempts: eventAttempts,
        eventStreamPath: eventPath
      });
    } catch (e) {
      lastError = e.message;
      await postJson(STATUS_URL, {
        state: 'WAITING',
        reason: `Cannot read TruckTel at ${TRUCKTEL_BASE}: ${e.message}`,
        source: 'TruckTel',
        sourceEndpoint: TRUCKTEL_BASE
      });
    }
    timer = setTimeout(tick, 500);
  };

  connectEvents();
  tick();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      try { ws?.close(); } catch {}
    },
    getLastError() { return lastError; }
  };
}

module.exports = { startTruckTelAdapter };
