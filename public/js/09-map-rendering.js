// Rendu carte, tracés, trains, gares et interactions de base.
function resizeCanvas() {
  if (!app.map.canvas || !app.map.ctx) return;
  const holder = $('#osmMap') || app.map.canvas;
  const rect = holder.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const width = Math.max(400, Math.ceil(rect.width));
  const height = Math.max(300, Math.ceil(rect.height));
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.floor(width * dpr);
  const pixelHeight = Math.floor(height * dpr);
  const sizeChanged = app.map.canvas.width !== pixelWidth || app.map.canvas.height !== pixelHeight || app.map.width !== width || app.map.height !== height || app.map.dpr !== dpr;

  app.map.dpr = dpr;
  app.map.width = width;
  app.map.height = height;

  if (app.map.canvas.width !== pixelWidth || app.map.canvas.height !== pixelHeight) {
    app.map.canvas.width = pixelWidth;
    app.map.canvas.height = pixelHeight;
  }
  app.map.canvas.style.width = '100%';
  app.map.canvas.style.height = '100%';
  app.map.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (sizeChanged) {
    invalidateMapProjection('canvas-resize');
    scheduleLeafletInvalidateSize();
  }
}

function scheduleLeafletInvalidateSize() {
  if (!app.map.leaflet || app.map.invalidatingSize) return;
  app.map.invalidatingSize = true;
  requestAnimationFrame(() => {
    try {
      app.map.leaflet.invalidateSize({ pan: false, animate: false });
    } finally {
      app.map.invalidatingSize = false;
    }
  });
}

function scheduleMobileMapViewportFix() {
  const section = document.querySelector('.map-section');
  const holder = document.querySelector('#osmMap');
  if (!section || !holder) return;
  const run = () => {
    if (window.matchMedia?.('(max-width: 1100px)')?.matches) {
      section.classList.remove('hidden-by-layout');
      section.style.removeProperty('display');
      const height = holder.getBoundingClientRect().height;
      if (height < 260) holder.style.minHeight = '300px';
    }
    resizeCanvas();
    scheduleLeafletInvalidateSize();
  };
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
  window.setTimeout(run, 180);
}

function hasPixelMapArt() {
  const img = artImages[ART.map];
  return !!(img && img.complete && img.naturalWidth);
}

function updateMapFrame() {
  const w = app.map.width;
  const h = app.map.height;
  if (!w || !h) return;
  const img = artImages[ART.map];
  const iw = img?.naturalWidth || 1672;
  const ih = img?.naturalHeight || 1024;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  app.map.frame = {
    image: { x: dx, y: dy, width: dw, height: dh },
    france: {
      x: dx + dw * MAP_ART_FRAME.x,
      y: dy + dh * MAP_ART_FRAME.y,
      width: dw * MAP_ART_FRAME.w,
      height: dh * MAP_ART_FRAME.h
    }
  };
}


function drawLoop(timestamp = performance.now()) {
  if (document.hidden) {
    app.map.lastDrawAt = timestamp;
    requestAnimationFrame(drawLoop);
    return;
  }

  if (app.map.panOverlay.active) {
    // Pendant le déplacement Leaflet, on ne redessine plus le canvas :
    // il est simplement translaté par GPU, puis recalculé au moveend.
    requestAnimationFrame(drawLoop);
    return;
  }

  const moving = app.map.navigating;
  const delay = moving ? 84 : 33; // ~12 fps pendant le zoom, ~30 fps le reste.
  if (timestamp - app.map.lastDrawAt >= delay) {
    drawMap({ lite: moving });
    app.map.lastDrawAt = timestamp;
    if (!moving) app.map.lastFullDrawAt = timestamp;
  }
  requestAnimationFrame(drawLoop);
}

function drawMap(options = {}) {
  if (!app.state?.world || !app.map.ctx) return;
  const ctx = app.map.ctx;
  const w = app.map.width;
  const h = app.map.height;
  if (!w || !h) return;

  if (app.map.needsRouteReproject) invalidateMapProjection('dirty-projection');

  const lite = !!options.lite;
  ctx.clearRect(0, 0, w, h);
  drawAllLines(ctx, lite);
  drawStations(ctx, lite);
  if (!lite) drawMapHud(ctx);
  if (!lite) drawTooltip(ctx);
}



function drawMapHud(ctx) {
  if (!app.map.leaflet) return;
  ctx.save();
  const zoom = app.map.leaflet.getZoom();
  const label = zoom >= 9 ? `Carte · zoom ${zoom} · vue isométrique visuelle` : `Carte · zoom ${zoom}`;
  ctx.font = '12px "Trebuchet MS", system-ui';
  const width = ctx.measureText(label).width + 18;
  const x = app.map.width - width - 18;
  const y = app.map.height - 34;
  ctx.fillStyle = 'rgba(7, 12, 22, 0.82)';
  ctx.strokeStyle = 'rgba(217, 168, 82, 0.25)';
  roundRect(ctx, x, y, width, 22, 10);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f0dfb8';
  ctx.fillText(label, x + 9, y + 15);
  ctx.restore();
}

function drawBackdropArt(ctx, w, h) {
  const img = artImages[ART.map];
  if (!img || !img.complete || !img.naturalWidth) return;
  updateMapFrame();
  const frame = app.map.frame?.image;
  if (!frame) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height);
  ctx.restore();
}

function drawSea(ctx, w, h) {
  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#0a2340');
  gradient.addColorStop(0.55, '#0c355a');
  gradient.addColorStop(1, '#07182d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const shimmer = ctx.createRadialGradient(w * 0.22, h * 0.16, 10, w * 0.22, h * 0.16, w * 0.75);
  shimmer.addColorStop(0, 'rgba(147, 197, 253, 0.16)');
  shimmer.addColorStop(1, 'rgba(147, 197, 253, 0)');
  ctx.fillStyle = shimmer;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGrid(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(191, 219, 254, 0.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.restore();
}

function drawFrance(ctx) {
  const outlines = app.state.world.outlines || [app.state.world.outline || []];
  ctx.save();
  const land = ctx.createLinearGradient(0, 0, app.map.width, app.map.height);
  land.addColorStop(0, '#1f5f4a');
  land.addColorStop(0.45, '#2f7c5f');
  land.addColorStop(1, '#8aa163');

  const relief = ctx.createLinearGradient(app.map.width * 0.2, 0, app.map.width * 0.8, app.map.height);
  relief.addColorStop(0, 'rgba(255,255,255,0.16)');
  relief.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  relief.addColorStop(1, 'rgba(0,0,0,0.12)');

  ctx.shadowColor = 'rgba(2, 6, 23, 0.42)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  for (const outline of outlines) {
    if (!outline?.length) continue;
    pathFromLonLat(ctx, outline);
    ctx.fillStyle = land;
    ctx.fill();
    pathFromLonLat(ctx, outline);
    ctx.fillStyle = relief;
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  for (const outline of outlines) {
    if (!outline?.length) continue;
    pathFromLonLat(ctx, outline);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.lineWidth = 2.3;
    ctx.stroke();
    pathFromLonLat(ctx, outline);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.lineWidth = 7;
    ctx.stroke();
  }

  // subtle internal texture clipped to land
  ctx.save();
  for (const outline of outlines) {
    if (!outline?.length) continue;
    pathFromLonLat(ctx, outline);
  }
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 1;
  for (let i = -app.map.height; i < app.map.width; i += 18) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + app.map.height * 0.5, app.map.height);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function pathFromLonLat(ctx, coords) {
  ctx.beginPath();
  coords.forEach(([lon, lat], i) => {
    const p = project(lon, lat);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
}

function drawBaseRailNetwork(ctx) {
  const graph = app.state.world.railGraph || [];
  if (!graph.length) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.16)';
  ctx.lineWidth = 1.25;
  ctx.setLineDash([]);
  for (const [from, to] of graph) {
    const aStation = station(from);
    const bStation = station(to);
    if (!aStation || !bStation) continue;
    const a = projectStationPoint(aStation);
    const b = projectStationPoint(bStation);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}


function visualLineWithEffectiveFrequency(line) {
  return line;
}

function drawAllLines(ctx, lite = false) {
  if (!lite) app.map.lineHit = [];
  const players = app.state.players || [];
  const me = app.state.me || null;
  const maxZoom = mapMaxZoomReached();
  const focusedLineId = app.focusedLineId && me?.lines?.some(l => l.id === app.focusedLineId && l.active) ? app.focusedLineId : '';
  if (app.focusedLineId && !focusedLineId) clearFocusedLine();

  const drawLinesForPlayer = (player, own = false) => {
    if (!player) return;
    for (const line of player.lines || []) {
      if (!line.active) continue;
      if (focusedLineId && (!own || line.id !== focusedLineId)) continue;
      const routeProfile = routeProfileForLineClient(line, player);
      const route = getRouteForStops(lineStopsOf(line), { profile: routeProfile });
      if (!route.points.length) continue;
      if (!lite) registerLineHitTarget(player, line, route.points, own);

      drawRailLine(ctx, route.points, player.color, own, line.electrified, lite, focusedLineId === line.id);
      if (lite) continue;

      // Les trains du joueur connecté sont toujours dessinés.
      // Ceux des autres compagnies restent masqués tant que le zoom maximal n'est pas atteint.
      if (!own && !maxZoom) continue;

      const trains = lineAssignedTrainsClient(line, player)
        .filter(t => !t.maintenance?.active && Number(t.condition || 0) > 0);
      if (!trains.length) continue;

      // Les états de pénurie masquent seulement les trains concurrents.
      // Le joueur connecté doit toujours voir son exploitation et son animation.
      if (!own && (
        line.stats?.status === 'resource-shortage'
        || line.stats?.status === 'driver-shortage'
        || line.stats?.status === 'train-out-of-service'
      )) continue;

      const visualLine = visualLineWithEffectiveFrequency(line);
      const visualRoute = { ...route, speedProfile: route.speedProfile || null };
      const speeds = trains.map(train => {
        const model = app.state.balance.trains[train.modelId];
        return model ? trainVisualAverageSpeedKmH(train, model, visualLine, visualRoute) : 0;
      }).filter(speed => speed > 0);
      const averageSpeed = speeds.length ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 70;

      trains.forEach((train, index) => {
        const model = app.state.balance.trains[train.modelId];
        if (!model) return;
        drawTrainSprite(ctx, route.points, player.color, { ...visualLine, id: `${player.id}:${line.id}`, visualAverageSpeed: averageSpeed }, model, own, train, index, trains.length, visualRoute);
      });
    }
  };

  if (!focusedLineId && app.showOtherLines) {
    for (const player of players) {
      if (me && player.id === me.id) continue;
      drawLinesForPlayer(player, false);
    }
  }
  drawLinesForPlayer(me, true);
  drawLineDraftPreview(ctx, lite);
}

function drawLineDraftPreview(ctx, lite = false) {
  if (app.activeTab !== 'lines' || app.activeLinesSubtab !== 'create') return;
  const stops = buildLineDraftStops();
  if (!Array.isArray(stops) || stops.length < 2) return;
  const profile = routeProfileForDraftClient();
  const route = getRouteForStops(stops, { profile });
  let points = Array.isArray(route.points) && route.points.length >= 2 ? route.points : [];
  if (!points.length) {
    points = stops.map(pointFromStationId).filter(Boolean);
  }
  if (points.length < 2) return;
  drawDraftRailLine(ctx, points, lite, route.pending);
  if (!lite) drawDraftStopMarkers(ctx, stops);
}

function drawDraftRailLine(ctx, points, lite = false, pending = false) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = pending ? 0.66 : 0.95;
  ctx.setLineDash([14, 9]);
  ctx.strokeStyle = 'rgba(4, 8, 16, 0.92)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.strokeStyle = pending ? 'rgba(251, 191, 36, 0.72)' : '#facc15';
  ctx.lineWidth = 5.2;
  ctx.shadowColor = 'rgba(250, 204, 21, 0.72)';
  ctx.shadowBlur = lite ? 0 : 18;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawDraftStopMarkers(ctx, stops) {
  ctx.save();
  ctx.font = '11px "Trebuchet MS", system-ui';
  stops.forEach((id, index) => {
    const point = pointFromStationId(id);
    if (!point) return;
    ctx.fillStyle = 'rgba(4, 8, 16, 0.95)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === 0 || index === stops.length - 1 ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}


function registerLineHitTarget(player, line, points, own = false) {
  if (!line?.id || !Array.isArray(points) || points.length < 2) return;
  app.map.lineHit.push({
    playerId: player?.id || '',
    playerName: player?.name || '',
    lineId: line.id,
    lineName: linePublicName(line),
    own: !!own,
    points
  });
}

function pointSegmentDistance(p, a, b) {
  const ax = Number(a?.x);
  const ay = Number(a?.y);
  const bx = Number(b?.x);
  const by = Number(b?.y);
  if (![p.x, p.y, ax, ay, bx, by].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - ax, p.y - ay);
  const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (ax + t * dx), p.y - (ay + t * dy));
}

function lineHitDistance(p, target) {
  const points = target?.points || [];
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i += 1) {
    const distance = pointSegmentDistance(p, points[i - 1], points[i]);
    if (distance < best) best = distance;
  }
  return best;
}

function hitLineAt(p, maxDistance = null) {
  const zoom = app.map.leaflet?.getZoom?.() || 7;
  const threshold = Number.isFinite(maxDistance) ? maxDistance : Math.max(9, Math.min(18, 21 - zoom));
  return (app.map.lineHit || [])
    .map((target, index) => ({ ...target, index, d: lineHitDistance(p, target) }))
    .filter(target => target.d <= threshold)
    .sort((a, b) => {
      if (a.own !== b.own) return a.own ? -1 : 1;
      if (a.d !== b.d) return a.d - b.d;
      return b.index - a.index;
    })[0] || null;
}

function selectMapLine(hit) {
  if (!hit?.lineId) return;
  if (!hit.own) {
    toast(`Ligne de ${hit.playerName || 'autre joueur'} : ${hit.lineName || hit.lineId}.`, 'info');
    return;
  }
  focusLineOnMap(hit.lineId, { fit: false, toggle: true });
}

function drawRailLine(ctx, points, color, own, electrified, lite = false, highlighted = false) {
  if (!points?.length) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = highlighted ? 1 : (own ? 0.96 : 0.68);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);

  // sleeper/shadow pass
  ctx.strokeStyle = 'rgba(10, 15, 24, 0.85)';
  ctx.lineWidth = highlighted ? 13 : (own ? 8 : 6);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  // main rail pass
  ctx.strokeStyle = color || '#d9a852';
  ctx.lineWidth = highlighted ? 6.4 : (own ? 4 : 2.8);
  ctx.shadowColor = color || 'rgba(236, 205, 127, 0.25)';
  ctx.shadowBlur = lite ? 0 : (highlighted ? 18 : (own ? 8 : 3));
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  if (electrified) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y - 2);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y - 2);
    ctx.stroke();
  }
  ctx.restore();
}

const TRAIN_VISUAL_SECONDS_PER_TRAVEL_HOUR = 18;

function trainVisualConditionMultiplier(train) {
  const condition = Math.max(0.35, Math.min(1, Number(train?.condition ?? 0.9)));
  return 0.76 + condition * 0.24;
}

function trainVisualEffectiveMaxSpeedKmH(train, model) {
  const profile = train ? trainRuntimeProfile(train, model) : {};
  const maxSpeed = Number(profile.speed || model?.speed || 90);
  return Math.max(18, maxSpeed * trainVisualConditionMultiplier(train));
}

function trainVisualAverageSpeedKmH(train, model, line, route = null) {
  const speedProfile = route?.speedProfile || line?.speedProfile || null;
  const maxSpeed = trainVisualEffectiveMaxSpeedKmH(train, model);
  if (speedProfile?.segments?.length) {
    let distanceKm = 0;
    let durationHours = 0;
    for (const segment of speedProfile.segments) {
      const segmentDistance = Math.max(0, Number(segment.distanceKm || (Number(segment.toKm) - Number(segment.fromKm)) || 0));
      const trackSpeed = Math.max(5, Number(segment.speedKmh || speedProfile.averageSpeedKmh || 100));
      const effectiveSpeed = Math.max(8, Math.min(maxSpeed, trackSpeed));
      distanceKm += segmentDistance;
      durationHours += segmentDistance / effectiveSpeed;
    }
    if (distanceKm > 0 && durationHours > 0) return Math.max(18, distanceKm / durationHours);
  }

  const profile = train ? trainRuntimeProfile(train, model) : {};
  const legacyMaxSpeed = Number(profile.speed || model?.speed || 90);
  const stopCount = Math.max(2, lineStopsOf(line).length);
  const stopPenalty = Math.max(0.58, 1 - Math.max(0, stopCount - 2) * 0.045);
  const servicePenalty = line?.service === 'freight' ? 0.62 : line?.service === 'mixed' ? 0.68 : 0.74;
  return Math.max(18, legacyMaxSpeed * servicePenalty * stopPenalty * trainVisualConditionMultiplier(train));
}

function trainVisualOneWaySeconds(line, train, model, route = null) {
  const distanceKm = Math.max(1, Number(route?.speedProfile?.totalKm || route?.distance || lineDistance(line) || 1));
  const speedProfile = route?.speedProfile || line?.speedProfile || null;
  if (speedProfile?.segments?.length) {
    const maxSpeed = trainVisualEffectiveMaxSpeedKmH(train, model);
    const durationHours = speedProfile.segments.reduce((sum, segment) => {
      const segmentDistance = Math.max(0, Number(segment.distanceKm || (Number(segment.toKm) - Number(segment.fromKm)) || 0));
      const trackSpeed = Math.max(5, Number(segment.speedKmh || speedProfile.averageSpeedKmh || 100));
      return sum + segmentDistance / Math.max(8, Math.min(maxSpeed, trackSpeed));
    }, 0);
    if (durationHours > 0) return Math.max(5.5, Math.min(85, durationHours * TRAIN_VISUAL_SECONDS_PER_TRAVEL_HOUR));
  }
  const averageSpeed = Number(line?.visualAverageSpeed || 0) > 0
    ? Number(line.visualAverageSpeed)
    : trainVisualAverageSpeedKmH(train, model, line, route);
  const travelHours = distanceKm / Math.max(1, averageSpeed);
  return Math.max(5.5, Math.min(55, travelHours * TRAIN_VISUAL_SECONDS_PER_TRAVEL_HOUR));
}

function trainVisualInstanceCount(line) {
  return Math.max(1, Math.round(Number(line?.slotUsage?.used || line?.trainCount || 1)));
}

function speedProfileSegmentAtKm(speedProfile, km) {
  const segments = speedProfile?.segments || [];
  if (!segments.length) return null;
  const value = Number(km) || 0;
  for (const segment of segments) {
    if (value >= Number(segment.fromKm || 0) && value <= Number(segment.toKm || 0)) return segment;
  }
  return value < Number(segments[0].fromKm || 0) ? segments[0] : segments[segments.length - 1];
}

function trainVisualSpeedAtKm(line, train, model, route, km) {
  const speedProfile = route?.speedProfile || line?.speedProfile || null;
  const maxSpeed = trainVisualEffectiveMaxSpeedKmH(train, model);
  if (speedProfile?.segments?.length) {
    const segment = speedProfileSegmentAtKm(speedProfile, km);
    const trackSpeed = Math.max(5, Number(segment?.speedKmh || speedProfile.averageSpeedKmh || 100));
    return Math.max(8, Math.min(maxSpeed, trackSpeed));
  }
  return trainVisualAverageSpeedKmH(train, model, line, route);
}

function trainVisualRouteDistanceKm(line, route) {
  const value = Number(route?.speedProfile?.totalKm || route?.distance || lineDistance(line) || 1);
  return Math.max(1, Number.isFinite(value) ? value : 1);
}

function trainVisualMotion(line, train, model, route, instanceIndex = 0, instanceCount = 1) {
  const totalKm = trainVisualRouteDistanceKm(line, route);
  const key = `${line.id}:${train?.id || 'train'}:${instanceIndex}`;
  const now = performance.now();
  const motion = app.map.trainMotion || (app.map.trainMotion = {});
  let entry = motion[key];
  if (!entry || Math.abs(Number(entry.totalKm || 0) - totalKm) > Math.max(1, totalKm * 0.02)) {
    const seed = (hashCode(`${line.id}:${train?.id || ''}`) % 10000) / 10000;
    const offset = instanceCount > 1 ? instanceIndex / instanceCount : 0;
    const phase = (seed + offset) % 1;
    entry = motion[key] = {
      positionKm: totalKm * phase,
      direction: seed < 0.5 ? 1 : -1,
      totalKm,
      lastAt: now
    };
  } else {
    const elapsedSeconds = Math.max(0, Math.min(0.25, (now - Number(entry.lastAt || now)) / 1000));
    let speedKmh = trainVisualSpeedAtKm(line, train, model, route, entry.positionKm);
    let deltaKm = speedKmh * elapsedSeconds / TRAIN_VISUAL_SECONDS_PER_TRAVEL_HOUR;
    entry.positionKm += deltaKm * (Number(entry.direction || 1) >= 0 ? 1 : -1);
    if (entry.positionKm > totalKm) {
      entry.positionKm = Math.max(0, totalKm - (entry.positionKm - totalKm));
      entry.direction = -1;
    } else if (entry.positionKm < 0) {
      entry.positionKm = Math.min(totalKm, -entry.positionKm);
      entry.direction = 1;
    }
    entry.lastAt = now;
  }
  const speedKmh = trainVisualSpeedAtKm(line, train, model, route, entry.positionKm);
  return {
    progress: Math.max(0.001, Math.min(0.999, entry.positionKm / totalKm)),
    reverse: Number(entry.direction || 1) < 0,
    speedKmh
  };
}

function drawTrainDot(ctx, points, color, line, model, own, train, instanceIndex = 0, instanceCount = 1, route = null) {
  const motion = trainVisualMotion(line, train, model, route, instanceIndex, instanceCount);
  const reverse = motion.reverse;
  const t = Math.max(0.001, Math.min(0.999, motion.progress));
  const pose = pointAndAngleAlongPolyline(points, t);
  const speed = Number(motion.speedKmh || line?.visualAverageSpeed || trainVisualAverageSpeedKmH(train, model, line, route) || 0);
  const normalizedSpeed = clamp((speed - 35) / 165, 0, 1);
  const trainCount = Math.max(1, instanceCount);
  const densityShrink = clamp(1 - Math.max(0, trainCount - 1) * 0.025, 0.78, 1);
  const radius = (own ? 7.2 : 5.8) * densityShrink;
  const haloRadius = radius + 4 + normalizedSpeed * 3;
  const pulse = 0.72 + 0.28 * Math.sin(performance.now() / 260 + instanceIndex * 0.9);
  const directionX = Math.cos(reverse ? pose.angle + Math.PI : pose.angle);
  const directionY = Math.sin(reverse ? pose.angle + Math.PI : pose.angle);
  const dotColor = color || '#d9a852';

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = own ? 0.98 : 0.88;

  ctx.shadowColor = dotColor;
  ctx.shadowBlur = own ? 14 + normalizedSpeed * 6 : 8 + normalizedSpeed * 3;

  ctx.beginPath();
  ctx.arc(0, 0, haloRadius * pulse, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(dotColor, own ? 0.18 : 0.12);
  ctx.fill();

  // Trainée dans le sens de circulation. Sa longueur reflète la vitesse moyenne.
  const trailLength = 8 + normalizedSpeed * 12;
  const gradient = ctx.createLinearGradient(-directionX * trailLength, -directionY * trailLength, 0, 0);
  gradient.addColorStop(0, hexToRgba(dotColor, 0));
  gradient.addColorStop(1, hexToRgba(dotColor, own ? 0.55 : 0.38));
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Math.max(2.2, radius * 0.52);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-directionX * trailLength, -directionY * trailLength);
  ctx.lineTo(-directionX * radius * 0.45, -directionY * radius * 0.45);
  ctx.stroke();

  ctx.shadowBlur = own ? 10 : 5;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 1.8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(5, 10, 18, 0.96)';
  ctx.fill();

  const dotGradient = ctx.createRadialGradient(-radius * 0.35, -radius * 0.45, 1, 0, 0, radius + 1);
  dotGradient.addColorStop(0, 'rgba(255,255,255,0.92)');
  dotGradient.addColorStop(0.22, '#f8df98');
  dotGradient.addColorStop(0.5, dotColor);
  dotGradient.addColorStop(1, own ? '#16372b' : '#2b2134');
  ctx.fillStyle = dotGradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = own ? 2 : 1.4;
  ctx.strokeStyle = own ? 'rgba(252, 230, 170, 0.95)' : 'rgba(252, 230, 170, 0.62)';
  ctx.stroke();

  if (trainCount > 1) {
    ctx.font = `${Math.max(8, Math.round(radius * 1.08))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(3, 8, 14, 0.92)';
    ctx.fillText(String(instanceIndex + 1), 0, 0.4);
  }
  ctx.restore();
}

function drawTrainSprite(ctx, points, color, line, model, own, train = null, instanceIndex = 0, instanceCount = 1, route = null) {
  if (!points?.length) return;
  drawTrainDot(ctx, points, color, line, model, own, train, instanceIndex, Math.max(1, instanceCount), route);
}

function drawPixelTrainBody(ctx, color, model) {
  ctx.fillStyle = 'rgba(8, 12, 18, 0.95)';
  ctx.fillRect(-14, -7, 28, 14);
  ctx.fillStyle = color;
  ctx.fillRect(-12, -5, 22, 10);
  ctx.fillStyle = '#f3d48a';
  ctx.fillRect(10, -2, 4, 4);
  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(-8, -4, 4, 3);
  ctx.fillRect(-3, -4, 4, 3);
  if ((model?.capacity || 0) > 100 || model?.type?.toLowerCase().includes('tgv')) {
    ctx.fillStyle = 'rgba(8, 12, 18, 0.95)';
    ctx.fillRect(14, -5, 10, 10);
    ctx.fillStyle = color;
    ctx.fillRect(15, -4, 8, 8);
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(17, -3, 4, 2);
  }
  // rails
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2c3647';
  ctx.fillRect(-15, 7, 12, 2);
  ctx.fillRect(2, 7, 12, 2);
}

function drawSteamPuffs(ctx, t) {
  const phase = (t * 8) % 1;
  ctx.fillStyle = 'rgba(245, 245, 245, 0.85)';
  ctx.fillRect(-15 - phase * 8, -10, 4, 4);
  ctx.fillStyle = 'rgba(220, 225, 235, 0.65)';
  ctx.fillRect(-19 - phase * 10, -14, 5, 5);
}

function drawDieselExhaust(ctx, t) {
  const phase = (t * 7) % 1;
  ctx.fillStyle = 'rgba(170, 180, 190, 0.55)';
  ctx.fillRect(-16 - phase * 9, -11, 4, 4);
}

function drawPantographSpark(ctx, t) {
  if ((t * 10) % 1 > 0.55) return;
  ctx.fillStyle = 'rgba(125, 211, 252, 0.9)';
  ctx.fillRect(-2, -10, 5, 2);
  ctx.fillRect(0, -12, 2, 2);
}

function pointAndAngleAlongPolyline(points, t) {
  const p = pointAlongPolyline(points, t);
  const p2 = pointAlongPolyline(points, Math.min(0.999, t + 0.01));
  return { x: p.x, y: p.y, angle: Math.atan2(p2.y - p.y, p2.x - p.x) };
}

function polylineMetrics(points) {
  if (points._metrics) return points._metrics;
  const segments = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    total += len;
    segments.push({ len, total });
  }
  points._metrics = { segments, total };
  return points._metrics;
}

function pointAlongPolyline(points, t) {
  if (points.length === 1) return points[0];
  const { segments, total } = polylineMetrics(points);
  let target = total * t;
  for (let i = 1; i < points.length; i++) {
    const len = segments[i - 1]?.len || 0;
    if (target <= len) {
      const r = len ? target / len : 0;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * r,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * r
      };
    }
    target -= len;
  }
  return points[points.length - 1];
}


function shouldDrawStation(s, asset, selected) {
  if (selected || asset) return true;
  const zoom = Number(app.map.leaflet?.getZoom?.() || 6);
  const pop = Number(s.population || s.baseDemand * 450 || 0);
  if (zoom < 6) return pop >= 300000 || s.id === 'PAR';
  if (zoom < 7) return pop >= 150000;
  if (zoom < 8) return pop >= 80000;
  if (zoom < 9) return pop >= 45000;
  if (zoom < 10) return pop >= 25000;
  if (zoom < 11) return pop >= 12000 || !s.commune;
  if (zoom < 12) return pop >= 5000 || !s.commune;
  return true;
}

function stationViewportCacheKey(lite = false) {
  const map = app.map.leaflet;
  const zoom = map?.getZoom?.() || 6;
  let boundsKey = 'static';
  if (map?.getBounds) {
    const b = map.getBounds();
    const round = v => Math.round(v * 20) / 20;
    boundsKey = `${round(b.getWest())},${round(b.getSouth())},${round(b.getEast())},${round(b.getNorth())}`;
  }
  const owned = Object.keys(app.state?.me?.stations || {}).sort().join(',');
  const stations = app.state?.world?.stations || [];
  const stationSignature = stationListSignature(stations);
  const collisionRadius = stationCollisionRadiusForZoom();
  return `${lite ? 'lite' : 'full'}:${Math.round(zoom * 2) / 2}:${collisionRadius}:${boundsKey}:${stationSignature}:${app.selectedStation || ''}:${owned}`;
}

function stationMapPriority(s, asset, selected, served) {
  const pop = Number(s.population || s.baseDemand * 450 || 0);
  if (selected) return 1_000_000_000;
  if (asset) return 900_000_000 + (asset.level || 1) * 100_000 + pop;
  if (served) return 800_000_000 + pop;
  if (!s.commune) return 700_000_000 + pop;
  return pop;
}

function stationCollisionRadiusForZoom() {
  const zoom = Number(app.map.leaflet?.getZoom?.() || 6);
  const max = Number(app.map.leaflet?.getMaxZoom?.() || 13);
  if (zoom >= max) return 13;
  if (zoom >= max - 1) return 16;
  if (zoom >= 10) return 19;
  if (zoom >= 8) return 22;
  return 26;
}

function stationMarkerRadiusForItem(item) {
  if (item.selected) return 8;
  if (item.asset) return 6.5;
  if (item.served) return 5.8;
  return 4.8;
}

function stationHitRadiusForItem(item) {
  // Hitbox resserrée : la gare reste cliquable sur son marqueur,
  // mais elle ne bloque plus abusivement la sélection des lignes proches.
  if (item.selected) return 9;
  if (item.asset) return 7;
  if (item.served) return 6;
  return 5;
}

function stationSquareSizeForItem(item) {
  const zoom = Number(app.map.leaflet?.getZoom?.() || 6);
  if (item.selected) return 12;
  if (item.asset) return zoom >= 11 ? 10 : 9;
  if (item.served) return zoom >= 11 ? 8 : 7;
  return zoom >= 12 ? 6 : zoom >= 10 ? 5 : 4;
}

function drawStationSquareMarker(ctx, item) {
  const { p, asset, selected, served } = item;
  const size = stationSquareSizeForItem(item);
  const half = Math.round(size / 2);
  const x = Math.round(p.x) - half;
  const y = Math.round(p.y) - half;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = selected
    ? 'rgba(250, 204, 21, .55)'
    : asset
      ? 'rgba(217, 168, 82, .34)'
      : 'rgba(15, 23, 42, .30)';
  ctx.shadowBlur = selected ? 10 : asset ? 7 : 3;

  ctx.fillStyle = selected
    ? 'rgba(250, 204, 21, .96)'
    : asset
      ? 'rgba(217, 168, 82, .92)'
      : served
        ? 'rgba(106, 197, 143, .88)'
        : 'rgba(230, 220, 195, .76)';
  ctx.fillRect(x, y, size, size);

  ctx.shadowBlur = 0;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeStyle = selected
    ? 'rgba(255, 246, 200, .98)'
    : asset
      ? 'rgba(255, 236, 179, .82)'
      : 'rgba(4, 8, 16, .72)';
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, size - 1), Math.max(1, size - 1));
  ctx.restore();
}

function stationMarkerMinDistance(a, b, baseRadius) {
  return Math.max(baseRadius, stationMarkerRadiusForItem(a) + stationMarkerRadiusForItem(b) + 5);
}

function stationItemOverlaps(item, kept, baseRadius) {
  for (const other of kept) {
    const minDistance = stationMarkerMinDistance(item, other, baseRadius);
    if (Math.hypot(item.p.x - other.p.x, item.p.y - other.p.y) < minDistance) return true;
  }
  return false;
}

function drawableStations(lite = false) {
  const key = stationViewportCacheKey(lite);
  if (app.map.stationDrawCache.key === key) return app.map.stationDrawCache.items;

  const me = app.state.me;
  const servedStationIds = new Set((me?.lines || [])
    .filter(line => line.active)
    .flatMap(line => lineStopsOf(line)));
  const candidates = [];
  const bounds = app.map.leaflet?.getBounds?.();
  const viewport = bounds ? {
    west: bounds.getWest() - 0.18,
    east: bounds.getEast() + 0.18,
    south: bounds.getSouth() - 0.12,
    north: bounds.getNorth() + 0.12
  } : null;

  for (const s of dedupedStations(app.state.world.stations)) {
    const asset = me?.stations?.[s.id];
    const selected = app.selectedStation === s.id;
    const served = servedStationIds.has(s.id);
    if (lite && !selected && !asset && !served) continue;
    if (!shouldDrawStation(s, asset, selected)) continue;
    if (viewport && !selected && !asset) {
      const lat = stationRouteLat(s);
      const lon = stationRouteLon(s);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < viewport.south || lat > viewport.north || lon < viewport.west || lon > viewport.east) continue;
    }
    const p = projectStationPoint(s);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < -40 || p.x > app.map.width + 40 || p.y < -40 || p.y > app.map.height + 40) continue;
    candidates.push({
      s,
      p,
      asset,
      selected,
      served,
      priority: stationMapPriority(s, asset, selected, served)
    });
  }

  const baseRadius = stationCollisionRadiusForZoom();
  const protectedItems = [];
  const normalItems = [];

  candidates
    .sort((a, b) => b.priority - a.priority || String(a.s.name || '').localeCompare(String(b.s.name || ''), 'fr'))
    .forEach(item => {
      if (item.selected || item.asset) protectedItems.push(item);
      else normalItems.push(item);
    });

  const kept = [];
  for (const item of protectedItems) {
    for (let i = kept.length - 1; i >= 0; i -= 1) {
      const other = kept[i];
      if (!other.selected && !other.asset && stationItemOverlaps(item, [other], baseRadius)) kept.splice(i, 1);
    }
    if (!stationItemOverlaps(item, kept.filter(other => other.selected || other.asset), baseRadius)) kept.push(item);
  }

  for (const item of normalItems) {
    if (!stationItemOverlaps(item, kept, baseRadius)) kept.push(item);
  }

  kept.sort((a, b) => a.priority - b.priority);
  app.map.stationDrawCache = { key, items: kept };
  return kept;
}

function drawStations(ctx, lite = false) {
  if (!lite) app.map.stationHit = [];
  const items = drawableStations(lite);
  const zoomMax = mapMaxZoomReached();

  for (const item of items) {
    const { s, p, asset } = item;

    if (!lite) {
      // Les gares restent cliquables même si elles ne sont pas rendues visuellement.
      app.map.stationHit.push({ id: s.id, x: p.x, y: p.y, r: stationHitRadiusForItem(item) });
    }

    drawStationSquareMarker(ctx, item);

    // Les noms restent réservés au zoom maximal pour éviter de recharger la carte.
    if (!zoomMax || !asset) continue;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.font = '12px "Trebuchet MS", system-ui';
    const label = shortStationName(s.name);
    const labelW = Math.min(170, ctx.measureText(label).width + 12);
    const lx = Math.round(p.x + 8);
    const ly = Math.round(p.y - 10);
    roundRect(ctx, lx, ly, labelW, 17, 7);
    ctx.fillStyle = 'rgba(2,6,23,.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(217,168,82,0.30)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(246,236,214,.98)';
    ctx.fillText(label, lx + 6, ly + 12);
    // Le libellé reste visuel uniquement : la hitbox reste centrée sur le marqueur
    // pour éviter qu'un long nom de gare capture les clics destinés aux lignes.
    ctx.restore();
  }
}

function shortStationName(name) {
  return String(name).replace(' Saint-Charles', '').replace(' Saint-Roch', '').replace(' Part-Dieu', '').replace(' Rive-Droite', '').replace(' Flandres', '').replace(' Matabiau', '').replace('-Ville', '').replace('-Jean', '');
}

function drawTooltip(ctx) {
  if (!app.hoverStation) return;
  const s = station(app.hoverStation);
  const hit = app.map.stationHit.find(h => h.id === app.hoverStation);
  if (!s || !hit) return;

  const owner = stationOwnerClient(s.id);
  const ownedByMe = owner?.player?.id === app.state?.me?.id;
  const asset = owner?.asset || null;
  const sprite = asset ? getStationMapSprite(asset) : null;
  const hasSprite = Boolean(asset && sprite?.complete && sprite.naturalWidth);

  const lines = (app.state.players || [])
    .flatMap(player => (player.lines || []).map(line => ({ ...line, owner: player })))
    .filter(line => line.active && lineStopsOf(line).includes(s.id));

  const stage = stationPrestigeStage(asset);
  const level = Number(asset?.level || 0);
  const commerce = Number(asset?.commerce || 0);
  const maintenance = Number(asset?.maintenance || 0);

  const margin = 12;
  const width = Math.min(hasSprite ? 386 : 286, Math.max(220, app.map.width - margin * 2));
  const height = Math.min(hasSprite ? 226 : 190, Math.max(150, app.map.height - margin * 2));
  const anchorX = Number.isFinite(hit.width) ? hit.x + hit.width : hit.x;
  const anchorY = Number.isFinite(hit.height) ? hit.y : hit.y;

  let x = anchorX + 18;
  if (x + width > app.map.width - margin) x = anchorX - width - 18;
  x = Math.max(margin, Math.min(app.map.width - width - margin, x));

  let y = anchorY - Math.round(height * 0.48);
  y = Math.max(margin, Math.min(app.map.height - height - margin, y));

  ctx.save();
  ctx.imageSmoothingEnabled = true;

  // Lien visuel entre le marqueur et la fiche, toujours borné dans le canvas.
  ctx.strokeStyle = 'rgba(217,168,82,.42)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hit.x, hit.y);
  ctx.lineTo(x > anchorX ? x : x + width, y + height * 0.5);
  ctx.stroke();

  // Fond principal.
  ctx.shadowColor = 'rgba(0,0,0,.42)';
  ctx.shadowBlur = 24;
  roundRect(ctx, x, y, width, height, 16);
  const panel = ctx.createLinearGradient(x, y, x + width, y + height);
  panel.addColorStop(0, 'rgba(6,13,26,.98)');
  panel.addColorStop(0.58, 'rgba(12,24,43,.97)');
  panel.addColorStop(1, 'rgba(24,32,47,.98)');
  ctx.fillStyle = panel;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(217,168,82,.40)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Bandeau haut.
  roundRect(ctx, x + 1, y + 1, width - 2, 46, 15);
  ctx.fillStyle = 'rgba(18,32,58,.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(81,142,205,.28)';
  ctx.beginPath();
  ctx.moveTo(x + 14, y + 47);
  ctx.lineTo(x + width - 14, y + 47);
  ctx.stroke();

  function fitTooltipText(text, maxWidth) {
    let value = String(text || '');
    if (ctx.measureText(value).width <= maxWidth) return value;
    while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
    return `${value}…`;
  }

  // Badge statut. Calculé avant les textes pour réserver l'espace à droite.
  const badgeText = owner ? `Niv. ${level || 1}` : 'Libre';
  ctx.font = '700 11px "Trebuchet MS", system-ui';
  const badgeW = Math.min(96, Math.ceil(ctx.measureText(badgeText).width) + 20);
  const reservedRight = badgeW + 24;
  const textMaxW = Math.max(96, width - reservedRight - 24);

  ctx.font = '700 15px "Trebuchet MS", system-ui';
  ctx.fillStyle = '#f6e8c9';
  ctx.fillText(fitTooltipText(shortStationName(s.name), textMaxW), x + 16, y + 20);

  ctx.font = '12px "Trebuchet MS", system-ui';
  ctx.fillStyle = '#b8aa84';
  const acquisitionCost = stationAcquisitionCost(s);
  const trafficText = s.annualPassengers ? ` · ${formatInt(s.annualPassengers)} voy./an` : '';
  const subtitle = owner
    ? `${ownedByMe ? 'Ta gare' : `Propriétaire : ${owner.player.name}`} · Prix base ${money(acquisitionCost)}${trafficText}`
    : `Gare libre · accès par sillons de ligne${trafficText}`;
  ctx.fillText(fitTooltipText(subtitle, textMaxW), x + 16, y + 38);

  roundRect(ctx, x + width - badgeW - 14, y + 11, badgeW, 23, 11);
  ctx.fillStyle = owner ? 'rgba(217,168,82,.18)' : 'rgba(148,163,184,.14)';
  ctx.fill();
  ctx.strokeStyle = owner ? 'rgba(217,168,82,.35)' : 'rgba(148,163,184,.22)';
  ctx.stroke();
  ctx.font = '700 11px "Trebuchet MS", system-ui';
  ctx.fillStyle = owner ? '#f0c875' : '#d1d5db';
  ctx.fillText(badgeText, x + width - badgeW - 4, y + 26);

  const contentY = y + 60;

  if (hasSprite) {
    const artX = x + 14;
    const artY = contentY;
    const artW = 154;
    const artH = 128;

    roundRect(ctx, artX, artY, artW, artH, 14);
    ctx.fillStyle = 'rgba(4,10,18,.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(217,168,82,.24)';
    ctx.stroke();

    roundRect(ctx, artX + 14, artY + artH - 26, artW - 28, 12, 6);
    ctx.fillStyle = 'rgba(17,24,39,.84)';
    ctx.fill();

    const maxW = artW - 22;
    const maxH = artH - 30;
    const scale = Math.min(maxW / sprite.naturalWidth, maxH / sprite.naturalHeight) * 1.12;
    const sw = Math.round(sprite.naturalWidth * scale);
    const sh = Math.round(sprite.naturalHeight * scale);
    const sx = artX + Math.round((artW - sw) / 2);
    const sy = artY + Math.round((artH - sh) / 2) - 2;

    ctx.shadowColor = 'rgba(0,0,0,.34)';
    ctx.shadowBlur = 10;
    ctx.drawImage(sprite, sx, sy, sw, sh);
    ctx.shadowBlur = 0;

    ctx.font = '700 11px "Trebuchet MS", system-ui';
    ctx.fillStyle = '#f0c875';
    ctx.fillText('Aperçu gare', artX + 14, artY + 19);
  }

  const infoX = hasSprite ? x + 184 : x + 16;
  const infoW = hasSprite ? width - 198 : width - 32;
  const chipW = Math.floor((infoW - 8) / 2);

  function chip(cx, cy, cw, label, value, accent = '#f6e8c9') {
    roundRect(ctx, cx, cy, cw, 40, 11);
    ctx.fillStyle = 'rgba(8,15,29,.58)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(81,142,205,.16)';
    ctx.stroke();

    ctx.font = '11px "Trebuchet MS", system-ui';
    ctx.fillStyle = '#b8aa84';
    ctx.fillText(label, cx + 9, cy + 15);

    ctx.font = '700 13px "Trebuchet MS", system-ui';
    ctx.fillStyle = accent;
    ctx.fillText(String(value), cx + 9, cy + 31);
  }

  chip(infoX, contentY, chipW, 'Dessertes', lines.length);
  chip(infoX + chipW + 8, contentY, chipW, 'Niveau', level || 0, '#f0c875');
  chip(infoX, contentY + 48, chipW, 'Commerce', commerce);
  chip(infoX + chipW + 8, contentY + 48, chipW, 'Atelier', maintenance);

  const footerY = y + height - 32;
  roundRect(ctx, x + 14, footerY, width - 28, 21, 10);
  ctx.fillStyle = owner ? (ownedByMe ? 'rgba(76,175,80,.16)' : 'rgba(217,168,82,.13)') : 'rgba(255,255,255,.055)';
  ctx.fill();
  ctx.strokeStyle = owner ? 'rgba(217,168,82,.22)' : 'rgba(255,255,255,.08)';
  ctx.stroke();

  ctx.font = '12px "Trebuchet MS", system-ui';
  ctx.fillStyle = owner ? (ownedByMe ? '#9be7a2' : '#f0c875') : '#d3c7ac';
  const footerText = owner
    ? (ownedByMe ? `Péage perçu · prix base ${money(acquisitionCost)}` : `Péage dû · prix base ${money(acquisitionCost)}`)
    : 'Achat direct retiré · utilise les sillons d’une ligne';
  ctx.fillText(fitTooltipText(footerText, width - 54), x + 25, footerY + 14);

  ctx.restore();
}


function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function projectBaseSimple(lon, lat) {
  const b = app.state.world.bounds;
  const lat0 = ((b.minLat + b.maxLat) / 2) * Math.PI / 180;
  const minX = b.minLon * Math.cos(lat0);
  const maxX = b.maxLon * Math.cos(lat0);
  const xRaw = lon * Math.cos(lat0);

  if (app.map.frame?.france) {
    const frame = app.map.frame.france;
    const padX = frame.width * 0.04;
    const padY = frame.height * 0.04;
    const x = frame.x + padX + ((xRaw - minX) / (maxX - minX)) * (frame.width - padX * 2);
    const y = frame.y + padY + (1 - ((lat - b.minLat) / (b.maxLat - b.minLat))) * (frame.height - padY * 2);
    return { x, y };
  }

  const pad = Math.min(app.map.width, app.map.height) * 0.075;
  const x = pad + ((xRaw - minX) / (maxX - minX)) * (app.map.width - pad * 2);
  const y = pad + (1 - ((lat - b.minLat) / (b.maxLat - b.minLat))) * (app.map.height - pad * 2);
  return { x, y };
}

function correctedProjection(base) {
  if (!app.state?.world?.stations?.length || !app.map.frame?.image) return base;
  let sumW = 0, dx = 0, dy = 0;
  for (const [id, anchor] of Object.entries(MAP_CITY_ANCHORS)) {
    const s = station(id);
    if (!s) continue;
    const ref = projectBaseSimple(s.lon, s.lat);
    const target = artPoint(anchor[0], anchor[1]);
    const dist = Math.max(18, Math.hypot(base.x - ref.x, base.y - ref.y));
    const w = 1 / (dist * dist);
    sumW += w;
    dx += (target.x - ref.x) * w;
    dy += (target.y - ref.y) * w;
  }
  return sumW ? { x: base.x + dx / sumW, y: base.y + dy / sumW } : base;
}

function project(lon, lat) {
  if (app.map.leaflet && app.map.mapReady) {
    const p = app.map.leaflet.latLngToContainerPoint([lat, lon]);
    return { x: p.x, y: p.y };
  }
  return projectBaseSimple(lon, lat);
}


function stationRouteLon(station) {
  return Number(station?.railLon ?? station?.stationLon ?? station?.lon);
}

function stationRouteLat(station) {
  return Number(station?.railLat ?? station?.stationLat ?? station?.lat);
}

function projectStationPoint(station) {
  if (!station) return { x: NaN, y: NaN };
  return project(stationRouteLon(station), stationRouteLat(station));
}

function stationRouteDistanceClient(a, b) {
  const latA = stationRouteLat(a);
  const lonA = stationRouteLon(a);
  const latB = stationRouteLat(b);
  const lonB = stationRouteLon(b);
  if (![latA, lonA, latB, lonB].every(Number.isFinite)) return 0;
  return haversineClient(latA, lonA, latB, lonB);
}

function projectStationOnRailSegmentClient(station, segment) {
  const a = app.state?.world?.stationIndex?.[segment?.from];
  const b = app.state?.world?.stationIndex?.[segment?.to];
  if (!station || !a || !b) return null;
  const ax = Number(a.lon), ay = Number(a.lat);
  const bx = Number(b.lon), by = Number(b.lat);
  const px = Number(station.lon), py = Number(station.lat);
  if (![ax, ay, bx, by, px, py].every(Number.isFinite)) return null;
  const vx = bx - ax;
  const vy = by - ay;
  const denom = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / denom));
  const lon = ax + vx * t;
  const lat = ay + vy * t;
  return { lat, lon, distanceKm: haversineClient(py, px, lat, lon), from: segment.from, to: segment.to };
}

function nearestRailAnchorsForStationClient(station, count = 4) {
  const segments = app.state?.world?.railSegments || [];
  const ranked = segments
    .map(segment => ({ segment, snap: projectStationOnRailSegmentClient(station, segment) }))
    .filter(item => item.snap)
    .sort((a, b) => a.snap.distanceKm - b.snap.distanceKm);
  const anchors = [];
  for (const item of ranked.slice(0, Math.max(2, count))) {
    for (const id of [item.segment.from, item.segment.to]) {
      if (!anchors.includes(id)) anchors.push(id);
      if (anchors.length >= count) return anchors;
    }
  }
  return anchors;
}

function stationsShareProjectedRailSegmentClient(a, b) {
  const sa = station(a);
  const sb = station(b);
  if (!sa || !sb) return false;
  if (sa.railSegment && sb.railSegment && sa.railSegment === sb.railSegment) return true;
  if (sa.stationUic && sb.stationUic && sa.stationUic === sb.stationUic) return true;
  return false;
}

function addLocalRouteShortcutClient(adjacency, a, b) {
  if (!a || !b || a === b) return;
  const sa = station(a);
  const sb = station(b);
  if (!sa || !sb) return;
  const direct = stationRouteDistanceClient(sa, sb);
  if (!Number.isFinite(direct) || direct <= 0) return;
  const allowDirect = direct <= 45 || stationsShareProjectedRailSegmentClient(a, b);
  if (!allowDirect) return;
  adjacency[a] ||= [];
  adjacency[b] ||= [];
  if (!adjacency[a].includes(b)) adjacency[a].push(b);
  if (!adjacency[b].includes(a)) adjacency[b].push(a);
}

function routeAdjacencyForClient(a, b) {
  const base = app.state?.world?.railAdjacency || {};
  const adjacency = {};
  for (const [id, list] of Object.entries(base)) adjacency[id] = [...list];

  addLocalRouteShortcutClient(adjacency, a, b);

  for (const id of [a, b]) {
    if (!id || adjacency[id]) continue;
    const s = station(id);
    if (!s) continue;
    const anchors = nearestRailAnchorsForStationClient(s, s.commune ? 6 : 4);
    const fallback = anchors.length
      ? anchors
      : dedupedStations(app.state?.world?.stations || [])
          .filter(candidate => app.state?.world?.railAdjacency?.[candidate.id])
          .map(candidate => ({ id: candidate.id, distance: stationRouteDistanceClient(s, candidate) }))
          .sort((x, y) => x.distance - y.distance)
          .slice(0, s.commune ? 4 : 3)
          .map(item => item.id);
    adjacency[id] ||= [];
    for (const anchorId of fallback) {
      adjacency[id].push(anchorId);
      (adjacency[anchorId] ||= []).push(id);
    }
  }
  return adjacency;
}


function hitStationAt(p) {
  return app.map.stationHit
    .map(h => {
      if (Number.isFinite(h.width) && Number.isFinite(h.height)) {
        const inside = p.x >= h.x && p.x <= h.x + h.width && p.y >= h.y && p.y <= h.y + h.height;
        return { ...h, d: inside ? 0 : Number.POSITIVE_INFINITY };
      }
      return { ...h, d: Math.hypot(h.x - p.x, h.y - p.y) };
    })
    .filter(h => h.d <= (h.r || 0))
    .sort((a, b) => a.d - b.d)[0] || null;
}

function onMapDown(event) {
  if (event.button !== 0) return;
  const p = pointer(event);
  app.map.drag.active = true;
  app.map.drag.moved = false;
  app.map.drag.startX = p.x;
  app.map.drag.startY = p.y;
  app.map.drag.startPanX = app.map.view.panX;
  app.map.drag.startPanY = app.map.view.panY;
  document.body.classList.add('dragging-map');
}

function onWindowMapDrag(event) {
  if (!app.map.drag.active) return;
  const p = pointer(event, app.map.canvas);
  const dx = p.x - app.map.drag.startX;
  const dy = p.y - app.map.drag.startY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) app.map.drag.moved = true;
  if (app.map.view.zoom > 1 || app.map.drag.moved) {
    app.map.view.panX = app.map.drag.startPanX + dx;
    app.map.view.panY = app.map.drag.startPanY + dy;
  }
}

function onMapUp() {
  if (!app.map.drag.active) return;
  app.map.drag.active = false;
  document.body.classList.remove('dragging-map');
}

function onMapWheel(event) {
  event.preventDefault();
  const p = pointer(event);
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  setMapZoom(app.map.view.zoom * factor, p);
}

function onMapMove(event) {
  const p = pointer(event);
  const stationHit = hitStationAt(p);
  const lineHit = stationHit ? null : hitLineAt(p);
  app.hoverStation = stationHit?.id || null;
  app.hoverLine = lineHit ? { playerId: lineHit.playerId, lineId: lineHit.lineId, own: !!lineHit.own } : null;
  app.map.canvas.style.cursor = stationHit || lineHit ? 'pointer' : 'crosshair';
}

function onMapClick(event) {
  if (app.map.drag.moved) { app.map.drag.moved = false; return; }
  const p = pointer(event);
  const stationHit = hitStationAt(p) || nearestStationAt(p, 10);
  if (stationHit) {
    setSelectedStation(stationHit.id);
    app.activeTab = 'stations';
    localStorage.setItem('sillons.activeTab', app.activeTab);
    renderAll();
    return;
  }
  const lineHit = hitLineAt(p);
  if (lineHit) selectMapLine(lineHit);
}

function nearestStationAt(p, maxDistance = 20) {
  return app.map.stationHit
    .map(h => ({ ...h, d: Math.hypot(h.x - p.x, h.y - p.y) }))
    .filter(h => h.d <= maxDistance)
    .sort((a, b) => a.d - b.d)[0] || null;
}

function nearestProjectedStationAt(p, maxDistance = 28) {
  const stations = dedupedStations(app.state?.world?.stations || []);
  let best = null;
  for (const s of stations) {
    const sp = projectStationPoint(s);
    if (!Number.isFinite(sp.x) || !Number.isFinite(sp.y)) continue;
    if (sp.x < -80 || sp.x > app.map.width + 80 || sp.y < -80 || sp.y > app.map.height + 80) continue;
    const d = Math.hypot(sp.x - p.x, sp.y - p.y);
    if (d <= maxDistance && (!best || d < best.d)) best = { id: s.id, x: sp.x, y: sp.y, r: maxDistance, d };
  }
  return best;
}

function setSelectedStation(stationId) {
  if (!stationId || !station(stationId)) {
    app.selectedStation = null;
    localStorage.removeItem('sillons.selectedStation');
    return;
  }
  app.selectedStation = stationId;
  localStorage.setItem('sillons.selectedStation', stationId);
}

function pointer(event, sourceCanvas = app.map.canvas) {
  const rect = sourceCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function stationListSignature(list) {
  const stations = Array.isArray(list) ? list : [];
  if (app.stationSignatureCache.source === list) return app.stationSignatureCache.signature;
  const ids = stations.map(s => `${s?.id || ''}:${s?.code || s?.communeCode || ''}:${s?.population || 0}`).join('|');
  let hash = 0;
  for (let i = 0; i < ids.length; i += 1) hash = ((hash << 5) - hash + ids.charCodeAt(i)) | 0;
  const communes = app.state?.world?.communesStatus || {};
  const signature = `${stations.length}:${hash}:${ids.length}:${communes.status || ''}:${communes.updatedAt || ''}:${communes.count || 0}`;
  app.stationSignatureCache = { source: list, signature };
  return signature;
}

function dedupedStations(list = app.state?.world?.stations || []) {
  if (app.stationListCache.source === list) return app.stationListCache.deduped;
  const signature = stationListSignature(list);
  if (app.stationListCache.signature === signature) {
    app.stationListCache.source = list;
    return app.stationListCache.deduped;
  }

  const out = [];
  for (const s of list) {
    if (!s) continue;
    const dup = out.find(existing => isStationDuplicateClient(s, existing));
    if (!dup) out.push(s);
  }
  app.stationListCache = { source: list, signature, deduped: out };
  return out;
}

function stationCommuneCodeClient(station) {
  return String(station?.code || station?.communeCode || '').trim();
}

function isStationDuplicateClient(a, b) {
  if (!a || !b || a.id === b.id) return false;
  const acode = stationCommuneCodeClient(a);
  const bcode = stationCommuneCodeClient(b);
  const sameMultiStationCommune = a.multiStation && b.multiStation && acode && bcode && acode === bcode;
  if (acode && bcode && acode === bcode && !sameMultiStationCommune) return true;

  const an = stationDedupNameClient(a.name);
  const bn = stationDedupNameClient(b.name);
  const exactSameName = an && bn && an === bn;
  const close = Number.isFinite(a.lat) && Number.isFinite(a.lon) && Number.isFinite(b.lat) && Number.isFinite(b.lon)
    ? haversineClient(a.lat, a.lon, b.lat, b.lon) <= 1.25
    : false;
  return Boolean(exactSameName && close);
}

function stationDedupNameClient(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/gare|station|sncf|saint|sainte|st\.?|ste\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function haversineClient(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const a1 = lat1 * Math.PI / 180, a2 = lat2 * Math.PI / 180;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function stationOptions(selectedId = '') {
  const selected = station(selectedId);
  const candidates = sortStationsForPurchase(dedupedStations(app.state.world.stations), app.stationSortMode);
  if (selected && !candidates.some(s => s.id === selected.id)) candidates.unshift(selected);
  return candidates
    .map(s => {
      const owner = stationOwnerClient(s.id);
      const status = owner ? owner.player.id === app.state?.me?.id ? 'à toi' : `possédée: ${owner.player.name}` : 'libre';
      return `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.name)} · ${money(stationSortPrice(s))} · demande ${formatInt(s.baseDemand)} · ${escapeHtml(status)}</option>`;
    })
    .join('');
}


function station(id) {
  const found = app.state.world.stationIndex[id] || dedupedStations(app.state.world.stations).find(s => s.id === id);
  return canonicalizeStationDisplayClient(found);
}

