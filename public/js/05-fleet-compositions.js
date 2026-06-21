// Parc, catalogue, maintenance et compositions du matériel roulant.
function trainEraLabel(epochId) {
  return app.state.balance.epochs[epochId]?.name || `Époque ${Number(epochId) + 1}`;
}

function trainStrengths(model) {
  const parts = [];
  if (model.speed >= 250) parts.push('très grande vitesse');
  else if (model.speed >= 160) parts.push('rapide');
  if (model.capacity >= 700) parts.push('haute capacité');
  else if (model.capacity >= 400) parts.push('capacité solide');
  if (model.freight >= 1200) parts.push('fret lourd');
  else if (model.freight >= 500) parts.push('fret polyvalent');
  if (model.reliability >= 0.92) parts.push('fiabilité élevée');
  if (model.maintenance <= 0.42) parts.push('maintenance légère');
  if (model.comfort >= 0.82) parts.push('premium');
  return parts.slice(0, 3).join(' · ') || 'polyvalent';
}

function formatTrainStatModifier(baseDisplay, modifiedDisplay) {
  if (baseDisplay == null || modifiedDisplay == null || modifiedDisplay === '') return '';
  const base = String(baseDisplay).trim();
  const next = String(modifiedDisplay).trim();
  return !next || base === next ? '' : `<small class="train-stat-modifier good-text">→ ${escapeHtml(next)}</small>`;
}

function renderTrainStat(label, value, ratio, cls = '', modifiedValue = '', modifiedRatio = null) {
  const pct = Math.max(4, Math.min(100, Math.round(ratio * 100)));
  const extraPct = modifiedRatio == null ? pct : Math.max(pct, Math.min(100, Math.round(modifiedRatio * 100)));
  const addPct = Math.max(0, extraPct - pct);
  const hasModifier = modifiedValue !== '' && modifiedValue != null && String(modifiedValue) !== String(value) && addPct > 0;
  return `
    <div class="train-stat ${cls} ${hasModifier ? 'has-modifier' : ''}">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(String(value))}${hasModifier ? formatTrainStatModifier(value, modifiedValue) : ''}</b>
      <i><em style="width:${pct}%"></em>${hasModifier ? `<strong style="left:${pct}%; width:${addPct}%"></strong>` : ''}</i>
    </div>`;
}

const TRAIN_ART_BY_MODEL_ID = Object.freeze({
  steam_001_141_r: '/assets/trains/steam/steam_001_141_r.png',
  steam_002_231_k: '/assets/trains/steam/steam_002_231_k.png',
  steam_003_241_p: '/assets/trains/steam/steam_003_241_p.png',
  steam_004_141_p: '/assets/trains/steam/steam_004_141_p.png',
  steam_005_150_p: '/assets/trains/steam/steam_005_150_p.png',
  steam_006_140_c: '/assets/trains/steam/steam_006_140_c.png',
  steam_007_231_g: '/assets/trains/steam/steam_007_231_g.png',
  steam_008_241_a: '/assets/trains/steam/steam_008_241_a.png',
  steam_009_232_u1: '/assets/trains/steam/steam_009_232_u1.png',
  steam_010_030_tu: '/assets/trains/steam/steam_010_030_tu.png',
  diesel_001_cc_72000: '/assets/trains/diesel/diesel_001_cc_72000.png',
  diesel_002_bb_67400: '/assets/trains/diesel/diesel_002_bb_67400.png',
  diesel_003_x_2800: '/assets/trains/diesel/diesel_003_x_2800.png',
  diesel_004_x_72500: '/assets/trains/diesel/diesel_004_x_72500.png',
  diesel_005_x_73500: '/assets/trains/diesel/diesel_005_x_73500.png',
  diesel_006_x_4300: '/assets/trains/diesel/diesel_006_x_4300.png',
  diesel_007_bb_67000: '/assets/trains/diesel/diesel_007_bb_67000.png',
  diesel_008_a1a_a1a_68000: '/assets/trains/diesel/diesel_008_a1a_a1a_68000.png',
  diesel_009_bb_66000: '/assets/trains/diesel/diesel_009_bb_66000.png',
  diesel_010_bb_75000: '/assets/trains/diesel/diesel_010_bb_75000.png',
  electric_loco_001_cc_6500: '/assets/trains/electric/electric_loco_001_cc_6500.png',
  electric_loco_002_bb_26000: '/assets/trains/electric/electric_loco_002_bb_26000.png',
  electric_loco_003_bb_22200: '/assets/trains/electric/electric_loco_003_bb_22200.png',
  electric_loco_004_bb_15000: '/assets/trains/electric/electric_loco_004_bb_15000.png',
  electric_loco_005_bb_7200: '/assets/trains/electric/electric_loco_005_bb_7200.png',
  electric_emu_006_z_5600: '/assets/trains/electric/electric_emu_006_z_5600.png',
  electric_emu_007_z_20500: '/assets/trains/electric/electric_emu_007_z_20500.png',
  electric_emu_008_z_50000: '/assets/trains/electric/electric_emu_008_z_50000.png',
  electric_emu_009_z_21500: '/assets/trains/electric/electric_emu_009_z_21500.png',
  electric_emu_010_regio_2n: '/assets/trains/electric/electric_emu_010_regio_2n.png',
  high_speed_001_tgv_sud_est: '/assets/trains/high_speed/high_speed_001_tgv_sud_est.png',
  high_speed_002_tgv_atlantique: '/assets/trains/high_speed/high_speed_002_tgv_atlantique.png',
  high_speed_003_tgv_reseau: '/assets/trains/high_speed/high_speed_003_tgv_reseau.png',
  high_speed_004_tgv_duplex: '/assets/trains/high_speed/high_speed_004_tgv_duplex.png',
  high_speed_005_tgv_pos: '/assets/trains/high_speed/high_speed_005_tgv_pos.png',
  high_speed_006_tgv_dasye: '/assets/trains/high_speed/high_speed_006_tgv_dasye.png',
  high_speed_007_euroduplex_2n2: '/assets/trains/high_speed/high_speed_007_euroduplex_2n2.png',
  high_speed_008_thalys_pbka: '/assets/trains/high_speed/high_speed_008_thalys_pbka.png',
  high_speed_009_eurostar_tmst: '/assets/trains/high_speed/high_speed_009_eurostar_tmst.png',
  high_speed_010_tgv_m: '/assets/trains/high_speed/high_speed_010_tgv_m.png'
});

function trainArtUrl(model) {
  const src = TRAIN_ART_BY_MODEL_ID[model?.id];
  return src ? `${src}?v=${encodeURIComponent(PROJECT_VERSION)}` : '';
}

function trainArtClass(model) {
  const classes = ['train-art'];
  if (model?.era) classes.push(`train-art-${String(model.era).replace(/[^a-z0-9_-]/gi, '-')}`);
  if (model?.id?.startsWith('high_speed_')) classes.push('train-art-high-speed');
  return classes.join(' ');
}

function renderTrainArt(model) {
  const artUrl = trainArtUrl(model);
  if (artUrl) {
    return `<div class="${escapeAttr(trainArtClass(model))}" data-train-art-id="${escapeAttr(model.id)}" aria-label="Visuel de ${escapeAttr(model.name)}"><img src="${escapeAttr(artUrl)}" alt="Illustration du train ${escapeAttr(model.name)}" loading="lazy" decoding="async"></div>`;
  }
  return `<div class="train-art train-art-placeholder" aria-label="Visuel à refaire pour ${escapeAttr(model.name)}"><span>Visuel matériel</span><b>À refaire</b></div>`;
}



function trainRuntimeProfile(train, model = app.state.balance.trains[train.modelId]) {
  const p = train?.profile || {};
  return {
    capacity: Number.isFinite(p.capacity) ? p.capacity : Number(model?.capacity || 0),
    freight: Number.isFinite(p.freight) ? p.freight : Number(model?.freight || 0),
    speed: Number.isFinite(p.speed) ? p.speed : Number(model?.speed || 0),
    range: Number.isFinite(p.range) ? p.range : Number(model?.range || 0),
    energy: Number.isFinite(p.energy) ? p.energy : Number(model?.energy || 0),
    maintenance: Number.isFinite(p.maintenance) ? p.maintenance : Number(model?.maintenance || 0),
    reliability: Number.isFinite(p.reliability) ? p.reliability : Number(model?.reliability || 0),
    comfort: Number.isFinite(p.comfort) ? p.comfort : Number(model?.comfort || 0)
  };
}

function trainModelSearchLabelClient(model) {
  return `${model?.id || ''} ${model?.name || ''} ${model?.type || ''}`.toLowerCase();
}

function trainModelIdSearchLabelClient(model) {
  return String(model?.id || '').toLowerCase();
}

function isMultipleUnitModelClient(model) {
  if (!model) return false;
  if (model.multipleUnit === true || model.compositionFamily === 'multiple_unit' || model.compositionSpec?.mode === 'multiple_unit') return true;
  const id = trainModelIdSearchLabelClient(model);
  if (/(^|_)(emu|railcar|trainset|unit)(_|$)/.test(id)) return true;
  const label = trainModelSearchLabelClient(model);
  return /(autorail|automotrice|rame|navette|tgv|duplex|régio|regio|ter|hydrogène|hydrogene|batterie|maglev|grande vitesse)/.test(label);
}

function isHighSpeedTrainsetModelClient(model) {
  if (!model) return false;
  if (Number(model.multipleUnitMax || 0) === 2) return true;
  const id = trainModelIdSearchLabelClient(model);
  if (/^(hsv_|tgv)/.test(id) || /(_tgv|_duplex|trainset)/.test(id)) return true;
  const label = trainModelSearchLabelClient(model);
  return /(tgv|grande vitesse|duplex)/.test(label);
}


function normalizeRouteProfileClient(profile) {
  const value = String(profile || '').trim().toLowerCase();
  if (['highspeed', 'classic'].includes(value)) return value;
  return 'default';
}

function routeProfileForModelClient(model) {
  if (!model) return 'default';
  return isHighSpeedTrainsetModelClient(model) ? 'highspeed' : 'classic';
}

function routeProfileForTrainClient(train) {
  const model = train ? app.state?.balance?.trains?.[train.modelId] : null;
  return routeProfileForModelClient(model);
}

function routeProfileForLineClient(line, player = app.state?.me) {
  const trains = lineAssignedTrainsClient(line, player || app.state?.me || {}) || [];
  if (!trains.length) return 'default';
  return trains.some(train => routeProfileForTrainClient(train) === 'highspeed') ? 'highspeed' : 'classic';
}

function routeProfileForDraftClient(draft = app.lineDraft || {}) {
  const trainId = $('#lineTrain')?.value || draft.trainId || '';
  const train = app.state?.me?.trains?.find(t => t.id === trainId) || null;
  return routeProfileForTrainClient(train);
}

function multipleUnitMaxUnitsForModelClient(model) {
  if (!isMultipleUnitModelClient(model)) return 1;
  const explicit = Math.floor(Number(model?.multipleUnitMax || model?.compositionSpec?.powerUnits?.max || 0));
  if (explicit >= 1) return clamp(explicit, 1, 3);
  return isHighSpeedTrainsetModelClient(model) ? 2 : 3;
}

function compositionDefaultModeForModelClient(model) {
  if (isMultipleUnitModelClient(model)) return 'multiple_unit';
  const passengerDominant = (model?.capacity || 0) >= Math.max(80, (model?.freight || 0) * 0.9);
  return passengerDominant && (model?.capacity || 0) > 0 ? 'passenger_loco' : 'freight_loco';
}

function buildClientCompositionSpec(model, preferredMode = null) {
  const defaultMode = compositionDefaultModeForModelClient(model);
  if (defaultMode === 'multiple_unit') {
    const maxUnits = multipleUnitMaxUnitsForModelClient(model);
    return {
      mode: 'multiple_unit',
      availableModes: ['multiple_unit'],
      powerUnits: { min: 1, max: maxUnits, default: 1 },
      label: 'Rames en unité multiple',
      unitLabel: 'rame',
      passengerOnly: true,
      unitCapacity: Math.max(0, Math.round(Number(model?.capacity || 0))),
      unitCost: Math.max(0, Math.round(Number(model?.price || 0))),
      variants: []
    };
  }
  const availableModes = ['passenger_loco', 'freight_loco'];
  const mode = availableModes.includes(preferredMode) ? preferredMode : defaultMode;
  const passengerDefault = clamp(Math.round((Math.max(model?.capacity || 100, 100)) / 90), 1, 8);
  const freightDefault = clamp(Math.round((Math.max(model?.freight || 200, 180)) / 180), 2, 14);
  if (mode === 'passenger_loco') {
    return {
      mode,
      availableModes,
      passengerCars: { min: 1, max: Math.max(passengerDefault + 5, 8), default: passengerDefault },
      label: 'Voitures voyageurs',
      variants: CLIENT_COMPOSITION_VARIANTS?.passenger_loco || []
    };
  }
  return {
    mode,
    availableModes,
    freightCars: { min: 2, max: Math.max(freightDefault + 6, 12), default: freightDefault },
    label: 'Wagons fret',
    variants: CLIENT_COMPOSITION_VARIANTS?.freight_loco || []
  };
}

function activeCompositionMode(train, model = app.state.balance.trains[train.modelId]) {
  if (isMultipleUnitModelClient(model)) return 'multiple_unit';
  const requested = app.compositionEditorModes?.[train.id] || train?.composition?.mode || train?.compositionMode || train?.compositionSpec?.mode || compositionDefaultModeForModelClient(model);
  return buildClientCompositionSpec(model, requested).mode;
}

function trainCompositionSpec(train, model = app.state.balance.trains[train.modelId]) {
  const mode = activeCompositionMode(train, model);
  return buildClientCompositionSpec(model, mode);
}

function compositionVariantUnlockedForClient(variant, model) {
  const me = app.state?.me;
  if (!variant || !me) return false;
  if ((variant.requiredEpoch || 0) > (me.epoch || 0)) return false;
  if ((variant.requiredModelEpoch || 0) > (model?.unlockEpoch || 0)) return false;
  if (variant.requiredTech && !me.techUnlocked?.[variant.requiredTech]) return false;
  return true;
}

function trainCompositionVariants(train, model = app.state.balance.trains[train.modelId]) {
  return (trainCompositionSpec(train, model)?.variants || []).filter(variant => compositionVariantUnlockedForClient(variant, model));
}

function selectedCompositionVariant(train, model = app.state.balance.trains[train.modelId]) {
  const spec = trainCompositionSpec(train, model);
  const variants = trainCompositionVariants(train, model);
  if (!variants.length) return null;
  const composition = train?.composition || {};
  const selectedId = spec.mode === 'freight_loco' ? composition.freightVariant : composition.passengerVariant;
  return variants.find(v => v.id === selectedId) || variants[0] || null;
}

function compositionVariantAssetMultiplierClient(variant) {
  if (!variant) return 1;
  const stats = variant.stats || variant;
  const raw = 1
    + (Number(stats.capacityMultiplier ?? 1) - 1) * 0.42
    + (Number(stats.speedMultiplier ?? 1) - 1) * 0.35
    + (Number(stats.revenueMultiplier ?? 1) - 1) * 0.38
    + Math.max(0, Number(stats.comfortDelta || 0)) * 0.55
    + Math.max(0, Number(stats.reliabilityDelta || 0)) * 2.5
    + Math.max(0, Number(stats.maintenanceMultiplier ?? 1) - 1) * 0.14
    + Math.max(0, Number(stats.energyMultiplier ?? 1) - 1) * 0.10
    + Math.max(0, Number(variant.requiredModelEpoch ?? variant.requiredEpoch ?? 0)) * 0.08;
  return clamp(raw, 0.72, 1.85);
}

function compositionVariantByIdClient(mode, id) {
  const list = CLIENT_COMPOSITION_VARIANTS?.[mode] || [];
  return list.find(v => v.id === id) || list[0] || null;
}

function compositionUnitCostClient(model, mode, variantId = '') {
  const modelPrice = Math.max(50000, Number(model?.price || 0));
  if (mode === 'multiple_unit') {
    return Math.round(modelPrice);
  }
  if (mode === 'freight_loco') {
    const spec = buildClientCompositionSpec(model, 'freight_loco');
    const defaultWagons = Math.max(1, Number(spec.freightCars?.default || 1));
    const variant = compositionVariantByIdClient('freight_loco', variantId || 'covered');
    return Math.max(18000, Math.round(modelPrice * 0.34 / defaultWagons * compositionVariantAssetMultiplierClient(variant)));
  }
  const spec = buildClientCompositionSpec(model, 'passenger_loco');
  const defaultCars = Math.max(1, Number(spec.passengerCars?.default || 1));
  const variant = compositionVariantByIdClient('passenger_loco', variantId || 'standard');
  return Math.max(26000, Math.round(modelPrice * 0.38 / defaultCars * compositionVariantAssetMultiplierClient(variant)));
}

function compositionAssetValueClient(model, composition, mode = null) {
  if (!model || !composition) return 0;
  const requestedMode = mode || composition.mode || compositionDefaultModeForModelClient(model);
  const activeMode = buildClientCompositionSpec(model, requestedMode).mode;
  if (activeMode === 'multiple_unit') {
    const spec = buildClientCompositionSpec(model, 'multiple_unit');
    const count = clamp(Math.round(Number(composition.powerUnits ?? spec.powerUnits?.default ?? 1)), spec.powerUnits.min, spec.powerUnits.max);
    return Math.round(count * compositionUnitCostClient(model, 'multiple_unit'));
  }
  if (activeMode === 'freight_loco') {
    const spec = buildClientCompositionSpec(model, 'freight_loco');
    const count = clamp(Math.round(Number(composition.freightCars ?? spec.freightCars?.default ?? 0)), spec.freightCars.min, spec.freightCars.max);
    return Math.round(count * compositionUnitCostClient(model, 'freight_loco', composition.freightVariant || 'covered'));
  }
  const spec = buildClientCompositionSpec(model, 'passenger_loco');
  const count = clamp(Math.round(Number(composition.passengerCars ?? spec.passengerCars?.default ?? 0)), spec.passengerCars.min, spec.passengerCars.max);
  return Math.round(count * compositionUnitCostClient(model, 'passenger_loco', composition.passengerVariant || 'standard'));
}

function compositionChangeEconomyClient(train, payload) {
  const model = app.state.balance.trains[train.modelId];
  const current = train.composition || {};
  const mode = payload?.mode || activeCompositionMode(train, model);
  const target = { ...current, mode };
  if (mode === 'multiple_unit') target.powerUnits = Number(payload.powerUnits ?? current.powerUnits ?? buildClientCompositionSpec(model, 'multiple_unit').powerUnits.default);
  if (mode === 'freight_loco') {
    target.freightCars = Number(payload.freightCars ?? current.freightCars ?? buildClientCompositionSpec(model, 'freight_loco').freightCars.default);
    target.freightVariant = payload.freightVariant || current.freightVariant || 'covered';
  }
  if (mode === 'passenger_loco') {
    target.passengerCars = Number(payload.passengerCars ?? current.passengerCars ?? buildClientCompositionSpec(model, 'passenger_loco').passengerCars.default);
    target.passengerVariant = payload.passengerVariant || current.passengerVariant || 'standard';
  }
  const beforeValue = compositionAssetValueClient(model, current, current.mode || compositionDefaultModeForModelClient(model));
  const afterValue = compositionAssetValueClient(model, target, target.mode);
  const delta = Math.round(afterValue - beforeValue);
  const conditionFactor = clamp(Number(train?.condition || 0), 0.05, 1);
  return {
    beforeValue,
    afterValue,
    delta,
    cost: delta > 0 ? delta : 0,
    refund: delta < 0 ? Math.round(Math.abs(delta) * 0.78 * conditionFactor) : 0,
    target
  };
}

function renderCompositionCostSummary(train) {
  const model = app.state.balance.trains[train.modelId];
  const composition = train.composition || {};
  const value = compositionAssetValueClient(model, composition, composition.mode || activeCompositionMode(train, model));
  const condition = Math.round(clamp(Number(train.condition || 0), 0, 1) * 100);
  return `
    <div class="composition-cost-summary" id="compositionCostSummary">
      <span>Valeur composition actuelle : <b>${money(value)}</b></span>
      <span class="small muted">Tout ajout est facturé. Pour les rames en unité multiple, chaque rame ajoutée coûte le prix du matériel de base. Tout retrait est remboursé à 78% de sa valeur, corrigé par l’usure du train (${condition}%).</span>
    </div>`;
}

function trainResaleEstimateClient(train, model = app.state.balance.trains[train.modelId]) {
  if (!train || !model) return 0;
  const defaultMode = compositionDefaultModeForModelClient(model);
  const defaultSpec = buildClientCompositionSpec(model, defaultMode);
  const defaultComposition = defaultMode === 'multiple_unit'
    ? { mode: defaultMode, powerUnits: defaultSpec.powerUnits.default }
    : defaultMode === 'freight_loco'
      ? { mode: defaultMode, freightCars: defaultSpec.freightCars.default, freightVariant: 'covered' }
      : { mode: defaultMode, passengerCars: defaultSpec.passengerCars.default, passengerVariant: 'standard' };
  const currentCompositionValue = compositionAssetValueClient(model, train.composition || defaultComposition, train.composition?.mode || defaultMode);
  const defaultCompositionValue = compositionAssetValueClient(model, defaultComposition, defaultMode);
  const baseTractionValue = defaultMode === 'multiple_unit'
    ? 0
    : Math.max(Math.round(Number(model.price || 0) * 0.42), Math.round(Number(model.price || 0) - defaultCompositionValue));
  const capitalValue = Math.max(0, baseTractionValue + currentCompositionValue);
  return Math.max(5000, Math.round(capitalValue * (0.45 - Math.min(0.3, Number(train.age || 0) / 1000)) * clamp(Number(train.condition || 0), 0, 1)));
}

function trainConditionPerformanceFactorClient(train) {
  const condition = clamp(Number(train?.condition ?? 1), 0, 1);
  if (condition <= 0) return 0;
  return clamp(0.35 + condition * 0.65, 0.35, 1);
}

function applyTrainConditionToPreview(profile, train) {
  const factor = trainConditionPerformanceFactorClient(train);
  if (factor <= 0) {
    profile.nominalSpeed = profile.speed;
    profile.speed = 0;
    profile.reliability = 0;
    profile.conditionSpeedFactor = 0;
    return profile;
  }
  profile.nominalSpeed = profile.speed;
  profile.speed = Math.max(5, Math.round(profile.speed * factor));
  profile.reliability = clamp(profile.reliability * (0.25 + factor * 0.75), 0.05, 0.995);
  profile.conditionSpeedFactor = round(factor);
  return profile;
}

function formatMaintenanceCountdown(hours) {
  if (hours == null || !Number.isFinite(Number(hours))) return '—';
  const h = Math.max(0, Number(hours));
  if (h <= 0) return 'Maintenance requise';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${round(h)} h`;
  return `${round(h / 24)} j`;
}

function trainProjectionLabel(train) {
  const projection = train?.maintenanceProjection || {};
  if (train?.maintenance?.active) return 'En atelier';
  if (Number(train?.condition || 0) <= 0) return 'Maintenance requise';
  return `0% dans ${formatMaintenanceCountdown(projection.hoursToZero)}`;
}

function metricFormatOptions(metricKey) {
  if (metricKey === 'reliability' || metricKey === 'comfort') return { decimals: 0, unit: '%', factor: 100 };
  if (metricKey === 'energy' || metricKey === 'maintenance') return { decimals: 1, unit: '', factor: 1 };
  if (metricKey === 'freight') return { decimals: 0, unit: ' t', factor: 1 };
  if (metricKey === 'speed' || metricKey === 'range') return { decimals: 0, unit: ' km', factor: 1 };
  return { decimals: 0, unit: '', factor: 1 };
}

function formatMetricAbsolute(metricKey, value) {
  const cfg = metricFormatOptions(metricKey);
  const scaled = Number(value || 0) * cfg.factor;
  const rounded = cfg.decimals ? round(scaled) : Math.round(scaled);
  return `${formatInt(rounded)}${cfg.unit}`;
}

function formatMetricDelta(metricKey, value) {
  const cfg = metricFormatOptions(metricKey);
  const scaled = Number(value || 0) * cfg.factor;
  const rounded = cfg.decimals ? round(Math.abs(scaled)) : Math.round(Math.abs(scaled));
  return `${scaled > 0 ? '+' : '-'}${formatInt(rounded)}${cfg.unit}`;
}

function buildMetricTooltip(metricLabel, metricKey, detail) {
  const lines = [detail.description || metricLabel, `Base : ${formatMetricAbsolute(metricKey, detail.base)}`];
  for (const step of detail.steps || []) {
    if (!step || Math.abs(Number(step.delta || 0)) < 0.0001) continue;
    lines.push(`${step.delta >= 0 ? 'Bonus' : 'Malus'} ${step.label} : ${formatMetricDelta(metricKey, step.delta)}`);
    for (const sub of step.sources || []) lines.push(`${sub.delta >= 0 ? 'Bonus' : 'Malus'} ${sub.label} : ${sub.value}`);
  }
  lines.push('----');
  lines.push(`Final : ${formatMetricAbsolute(metricKey, detail.final)}`);
  return lines.join('\n');
}

function computeOperatingProfileDetailed(train, model = app.state.balance.trains[train.modelId]) {
  const sourceModel = effectiveModelWithResearchClient(model);
  const researchInfo = trainInheritedResearchBonus(model);
  const spec = trainCompositionSpec(train, model);
  const c = train?.composition || {};
  const baseProfile = {
    capacity: Number(model?.capacity || 0),
    freight: Number(model?.freight || 0),
    speed: Number(model?.speed || 0),
    range: Number(model?.range || 0),
    energy: Number(model?.energy || 0),
    maintenance: Number(model?.maintenance || 0),
    reliability: Number(model?.reliability || 0),
    comfort: Number(model?.comfort || 0)
  };
  const profile = {
    capacity: Number(sourceModel?.capacity || 0),
    freight: Number(sourceModel?.freight || 0),
    speed: Number(sourceModel?.speed || 0),
    range: Number(sourceModel?.range || 0),
    energy: Number(sourceModel?.energy || 0),
    maintenance: Number(sourceModel?.maintenance || 0),
    reliability: Number(sourceModel?.reliability || 0),
    comfort: Number(sourceModel?.comfort || 0)
  };
  const metrics = {};
  const metricLabels = {
    capacity: 'Voyageurs / train', freight: 'Fret / train', speed: 'Vitesse commerciale', range: 'Portée', reliability: 'Fiabilité', comfort: 'Confort', energy: 'Énergie', maintenance: 'Maintenance'
  };
  const descriptions = {
    capacity: 'Nombre maximal de voyageurs transportés par train après prise en compte de la composition choisie.',
    freight: 'Tonnage maximal de fret transportable par train avec cette composition.',
    speed: 'Vitesse de référence retenue en exploitation. Elle influence le temps de rotation, la productivité et la capacité quotidienne.',
    range: 'Distance maximale admissible pour ce train après composition et recherches. Une ligne plus longue sera refusée.',
    reliability: 'Probabilité de rouler sans incident majeur. Plus elle est basse, plus le risque de panne, retard et perte d’attractivité augmente.',
    comfort: 'Qualité perçue du service par les voyageurs : agrément, image et standing.',
    energy: 'Consommation énergétique de référence pour cette composition. Une valeur plus élevée alourdit les coûts d’exploitation.',
    maintenance: 'Coût d’entretien unitaire issu du matériel, de la composition et de l’état du train.'
  };
  for (const key of Object.keys(baseProfile)) {
    metrics[key] = { key, label: metricLabels[key], description: descriptions[key], base: Number(baseProfile[key] || 0), steps: [] };
    const researchDelta = Number(profile[key] || 0) - Number(baseProfile[key] || 0);
    if (Math.abs(researchDelta) >= 0.0001) {
      const sourceLines = researchInfo.effects
        .filter(effect => (key === 'range' ? ['range', 'autonomy'].includes(effect.kind) : effect.kind === key))
        .map(effect => ({ label: `${effect.title} niv. ${effect.level}`, delta: researchDelta >= 0 ? 1 : -1, value: effect.signedPercent || '' }))
        .filter(item => item.value);
      metrics[key].steps.push({ label: 'recherches héritées', delta: researchDelta, sources: sourceLines });
    }
  }

  const beforeComposition = { ...profile };
  if (spec.mode === 'multiple_unit') {
    const unitCount = clamp(Math.round(Number(c.powerUnits || spec.powerUnits.default || 1)), spec.powerUnits.min, spec.powerUnits.max);
    const ratio = unitCount;
    profile.capacity = Math.max(0, Math.round(profile.capacity * ratio));
    profile.freight = 0;
    profile.speed = Math.max(35, Math.round(profile.speed * (1 - Math.max(0, ratio - 1) * 0.015)));
    profile.energy = round(profile.energy * ratio * (0.95 + ratio * 0.05));
    profile.maintenance = round(profile.maintenance * ratio * (0.92 + ratio * 0.08));
    profile.reliability = clamp(profile.reliability - Math.max(0, ratio - 1) * 0.015, 0.45, 0.995);
    profile.comfort = clamp(profile.comfort - Math.max(0, ratio - 1) * 0.01, 0.08, 1);
  } else if (spec.mode === 'passenger_loco') {
    const variant = selectedCompositionVariant(train, model) || { stats: {}, capacityMultiplier: 1, speedMultiplier: 1, energyMultiplier: 1, maintenanceMultiplier: 1, reliabilityDelta: 0, comfortDelta: 0 };
    const stats = variant.stats || variant;
    const defaultCars = spec.passengerCars.default;
    const ratio = Number(c.passengerCars || defaultCars) / Math.max(1, defaultCars);
    profile.capacity = Math.max(0, Math.round(profile.capacity * ratio));
    profile.freight = Math.max(0, Math.round((sourceModel?.freight || 0) * Math.min(1.2, 0.65 + Number(c.passengerCars || defaultCars) * 0.08)));
    profile.speed = Math.max(30, Math.round(profile.speed * (1 - Math.max(0, ratio - 1) * 0.03)));
    profile.energy = round(profile.energy * (0.72 + ratio * 0.28 + Math.max(0, ratio - 1) * 0.08));
    profile.maintenance = round(profile.maintenance * (0.76 + ratio * 0.24 + Math.max(0, ratio - 1) * 0.05));
    profile.reliability = clamp(profile.reliability - Math.max(0, ratio - 1) * 0.02, 0.45, 0.995);
    profile.comfort = clamp(profile.comfort + Math.min(0.06, Math.max(0, ratio - 1) * 0.015), 0.08, 1);
    profile.capacity = Math.max(0, Math.round(profile.capacity * (stats.capacityMultiplier || 1)));
    profile.speed = Math.max(30, Math.round(profile.speed * (stats.speedMultiplier || 1)));
    profile.energy = round(profile.energy * (stats.energyMultiplier || 1));
    profile.maintenance = round(profile.maintenance * (stats.maintenanceMultiplier || 1));
    profile.reliability = clamp(profile.reliability + (stats.reliabilityDelta || 0), 0.45, 0.995);
    profile.comfort = clamp(profile.comfort + (stats.comfortDelta || 0), 0.08, 1);
  } else {
    const variant = selectedCompositionVariant(train, model) || { stats: {} };
    const stats = variant.stats || variant;
    const defaultWagons = spec.freightCars.default;
    const ratio = Number(c.freightCars || defaultWagons) / Math.max(1, defaultWagons);
    profile.freight = Math.max(0, Math.round((sourceModel?.freight || 0) * ratio));
    profile.capacity = Math.max(0, Math.round((sourceModel?.capacity || 0) * Math.max(0.4, 1 - Math.max(0, ratio - 1) * 0.18)));
    profile.speed = Math.max(25, Math.round(profile.speed * (1 - Math.max(0, ratio - 1) * 0.035)));
    profile.energy = round(profile.energy * (0.7 + ratio * 0.3 + Math.max(0, ratio - 1) * 0.1));
    profile.maintenance = round(profile.maintenance * (0.74 + ratio * 0.26 + Math.max(0, ratio - 1) * 0.06));
    profile.reliability = clamp(profile.reliability - Math.max(0, ratio - 1) * 0.022, 0.45, 0.995);
    profile.comfort = clamp(profile.comfort - Math.max(0, ratio - 1) * 0.01, 0.05, 1);
    profile.freight = Math.max(0, Math.round(profile.freight * (stats.capacityMultiplier || 1)));
    profile.speed = Math.max(25, Math.round(profile.speed * (stats.speedMultiplier || 1)));
    profile.energy = round(profile.energy * (stats.energyMultiplier || 1));
    profile.maintenance = round(profile.maintenance * (stats.maintenanceMultiplier || 1));
    profile.reliability = clamp(profile.reliability + (stats.reliabilityDelta || 0), 0.45, 0.995);
  }
  for (const key of Object.keys(beforeComposition)) {
    const delta = Number(profile[key] || 0) - Number(beforeComposition[key] || 0);
    if (Math.abs(delta) >= 0.0001) metrics[key].steps.push({ label: 'composition', delta, sources: [] });
  }

  const beforeCondition = { ...profile };
  applyTrainConditionToPreview(profile, train);
  for (const key of Object.keys(beforeCondition)) {
    const delta = Number(profile[key] || 0) - Number(beforeCondition[key] || 0);
    if (Math.abs(delta) >= 0.0001) metrics[key].steps.push({ label: 'état du train', delta, sources: [] });
  }
  for (const key of Object.keys(metrics)) metrics[key].final = Number(profile[key] || 0);
  return { profile, metrics };
}

function previewOperatingProfile(train, model = app.state.balance.trains[train.modelId]) {
  return computeOperatingProfileDetailed(train, model).profile;
}

function deriveCompositionSummary(train) {
  const c = train?.composition || {};
  const spec = trainCompositionSpec(train);
  const variant = selectedCompositionVariant(train);
  if (spec.mode === 'multiple_unit') {
    const count = c.powerUnits || spec.powerUnits?.default || 1;
    return `${count} rame${count > 1 ? 's' : ''} en UM`;
  }
  if (spec.mode === 'freight_loco') return `${c.freightCars || spec.freightCars?.default || 0} wagon(s) · ${variant?.shortLabel || 'Fret'}`;
  return `${c.passengerCars || spec.passengerCars?.default || 0} voiture(s) · ${variant?.shortLabel || 'Voyageurs'}`;
}

function renderCompositionPart(type, src, alt = '') {
  return `<span class="composition-part composition-${type}"><img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy"></span>`;
}

function renderTrainCompositionStrip(train, model, size = 'large') {
  const spec = trainCompositionSpec(train, model);
  const c = train?.composition || {};
  const variant = selectedCompositionVariant(train, model);
  const parts = [];
  if (spec.mode === 'multiple_unit') {
    const count = Math.max(1, Number(c.powerUnits || 1));
    for (let i = 0; i < count; i += 1) parts.push(renderCompositionPart('power', COMPOSITION_ART.power, model.name));
  } else if (spec.mode === 'freight_loco') {
    const wagonArt = variant?.asset || COMPOSITION_ART.wagon;
    parts.push(renderCompositionPart('engine', COMPOSITION_ART.power, model.name));
    const count = Math.max(1, Number(c.freightCars || spec.freightCars?.default || 2));
    for (let i = 0; i < count; i += 1) parts.push(renderCompositionPart('wagon', wagonArt, variant?.name || 'Wagon fret'));
  } else {
    const coachArt = variant?.asset || COMPOSITION_ART.coach;
    parts.push(renderCompositionPart('engine', COMPOSITION_ART.power, model.name));
    const count = Math.max(1, Number(c.passengerCars || spec.passengerCars?.default || 1));
    for (let i = 0; i < count; i += 1) parts.push(renderCompositionPart('coach', coachArt, variant?.name || 'Voiture voyageurs'));
  }
  return `<div class="composition-strip ${size}">${parts.join('')}</div>`;
}

function renderCompositionModeTabs(train, model) {
  const spec = trainCompositionSpec(train, model);
  if (!spec.availableModes || spec.availableModes.length <= 1) return '';
  const labels = { passenger_loco: 'Voitures voyageurs', freight_loco: 'Wagons de marchandises' };
  return `
    <div class="composition-mode-tabs">
      ${spec.availableModes.map(mode => `<button type="button" class="composition-mode-tab ${spec.mode === mode ? 'active' : ''}" data-comp-mode="${mode}" data-id="${train.id}">${labels[mode] || mode}</button>`).join('')}
    </div>`;
}

function renderCompositionVariantPicker(train, model) {
  const spec = trainCompositionSpec(train, model);
  const variants = trainCompositionVariants(train, model);
  if (!variants.length) return '';
  const current = selectedCompositionVariant(train, model);
  const inputName = spec.mode === 'freight_loco' ? 'compFreightVariant' : 'compPassengerVariant';
  const heading = spec.mode === 'freight_loco' ? 'Type de wagon' : 'Type de voiture';
  const intro = spec.mode === 'freight_loco'
    ? 'Choisis la famille de wagons à exploiter. Chaque type détermine la marchandise prioritaire, la charge utile et la valeur de transport.'
    : 'Choisis la famille de voitures à accrocher à la locomotive. Chaque variante modifie capacité, confort, vitesse commerciale et coût d’exploitation.';

  return `
    <div class="composition-variant-section">
      <div class="composition-variant-heading">
        <strong>${heading}</strong>
        <span class="small muted">${intro}</span>
        <span class="small muted">D’autres variantes apparaissent à l’époque suivante après les recherches dédiées.</span>
      </div>
      <div class="composition-variant-grid">
        ${variants.map(variant => {
          const selected = current?.id === variant.id;
          const stats = variant.stats || {};
          const statRows = spec.mode === 'freight_loco'
            ? [
                renderVariantStatRow('Charge utile', variantMetricValue(stats.capacityMultiplier || 1), (stats.capacityMultiplier || 1) >= 1 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Valeur transportée', variantMetricValue(stats.revenueMultiplier || 1), (stats.revenueMultiplier || 1) >= 1 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Vitesse', variantMetricValue(stats.speedMultiplier || 1), (stats.speedMultiplier || 1) >= 1 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Coût maintenance', variantMetricValue(stats.maintenanceMultiplier || 1), (stats.maintenanceMultiplier || 1) <= 1 ? 'good-text' : 'warn-text')
              ].join('')
            : [
                renderVariantStatRow('Capacité', variantMetricValue(stats.capacityMultiplier || 1), (stats.capacityMultiplier || 1) >= 1 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Confort', variantMetricValue(1, stats.comfortDelta || 0, 'delta'), (stats.comfortDelta || 0) >= 0 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Vitesse', variantMetricValue(stats.speedMultiplier || 1), (stats.speedMultiplier || 1) >= 1 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Coût maintenance', variantMetricValue(stats.maintenanceMultiplier || 1), (stats.maintenanceMultiplier || 1) <= 1 ? 'good-text' : 'warn-text')
              ].join('');
          return `
            <label class="composition-variant-card">
              <input type="radio" name="${escapeAttr(inputName)}" value="${escapeAttr(variant.id)}" ${selected ? 'checked' : ''}>
              <div class="composition-variant-thumb">
                <img src="${escapeAttr(variant.asset || '')}" alt="${escapeAttr(variant.name)}" loading="lazy">
              </div>
              <div class="composition-variant-copy">
                <div class="composition-variant-title-row">
                  <strong>${escapeHtml(variant.name)}</strong>
                  ${variant.cargoType ? `<span class="tag">${escapeHtml(variant.cargoType)}</span>` : ''}
                </div>
                <p class="small muted">${escapeHtml(variant.description || '')}</p>
                <div class="composition-variant-stats">${statRows}</div>
              </div>
            </label>`;
        }).join('')}
      </div>
    </div>`;
}

function trainCurrentLine(trainId) {

  return app.state.me.lines.find(l => l.active && lineHasTrain(l, trainId)) || null;
}

function trainServiceClass(model) {
  if (!model) return 'passengers';
  const cap = Number(model.capacity || 0);
  const freight = Number(model.freight || 0);
  if (freight > 0 && cap <= 0) return 'freight';
  if (freight > 0 && cap > 0) return 'mixed';
  return 'passengers';
}

function trainServiceSortLabel(kind) {
  return kind === 'freight' ? 'Fret' : kind === 'mixed' ? 'Mixte' : 'Voyageurs';
}

function compositionValidTrainIds() {
  return new Set((app.state?.me?.trains || []).map(train => train.id));
}

function compositionSelectedIds() {
  const valid = compositionValidTrainIds();
  const ids = Array.isArray(app.selectedCompositionTrainIds) ? app.selectedCompositionTrainIds : [];
  return [...new Set(ids.map(id => String(id || '').trim()).filter(id => valid.has(id)))];
}

function setCompositionSelection(ids, primaryId = '') {
  const valid = compositionValidTrainIds();
  const cleaned = [...new Set((ids || []).map(id => String(id || '').trim()).filter(id => valid.has(id)))];
  app.selectedCompositionTrainIds = cleaned;
  app.selectedCompositionTrainId = cleaned.includes(primaryId) ? primaryId : (cleaned[0] || '');
  if (app.compositionEditorTrainId && !cleaned.includes(app.compositionEditorTrainId)) {
    app.compositionEditorTrainId = '';
    localStorage.removeItem('sillons.compositionEditorTrainId');
  }
  localStorage.setItem('sillons.selectedCompositionTrainIds', JSON.stringify(cleaned));
  if (app.selectedCompositionTrainId) localStorage.setItem('sillons.selectedCompositionTrainId', app.selectedCompositionTrainId);
  else localStorage.removeItem('sillons.selectedCompositionTrainId');
}

function setCompositionEditorTrain(trainId = '') {
  const id = String(trainId || '').trim();
  if (id && !compositionValidTrainIds().has(id)) return false;
  app.compositionEditorTrainId = id;
  if (id) localStorage.setItem('sillons.compositionEditorTrainId', id);
  else localStorage.removeItem('sillons.compositionEditorTrainId');
  return true;
}


function toggleCompositionCardSelection(trainId) {
  const id = String(trainId || '').trim();
  if (!compositionValidTrainIds().has(id)) return;
  const selected = new Set(compositionSelectedIds());
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  const next = [...selected];
  setCompositionSelection(next, selected.has(app.selectedCompositionTrainId) ? app.selectedCompositionTrainId : (selected.has(id) ? id : (next[0] || '')));
  renderAll();
}

function compositionEditTargetIds(primaryId = '') {
  const selected = compositionSelectedIds();
  if (selected.length) return selected;
  const valid = compositionValidTrainIds();
  return primaryId && valid.has(primaryId) ? [primaryId] : [];
}

function compositionGroupStorageKey(mode, key) {
  return `${mode || 'era'}::${key || 'default'}`;
}

function isCompositionGroupCollapsed(mode, key) {
  return Boolean(app.compositionGroupCollapsed?.[compositionGroupStorageKey(mode, key)]);
}

function setCompositionGroupCollapsed(mode, key, collapsed) {
  const storageKey = compositionGroupStorageKey(mode, key);
  app.compositionGroupCollapsed = { ...(app.compositionGroupCollapsed || {}), [storageKey]: Boolean(collapsed) };
  if (!collapsed) delete app.compositionGroupCollapsed[storageKey];
  localStorage.setItem('sillons.compositionGroupCollapsed', JSON.stringify(app.compositionGroupCollapsed));
}

function sortedCompositionTrains(trains) {
  const mode = 'era';
  return [...(trains || [])].sort((a, b) => {
    const ma = app.state.balance.trains[a.modelId] || {};
    const mb = app.state.balance.trains[b.modelId] || {};
    const eraA = Number(ma.unlockEpoch ?? ma.epoch ?? 0);
    const eraB = Number(mb.unlockEpoch ?? mb.epoch ?? 0);
    const typeA = trainServiceClass(ma);
    const typeB = trainServiceClass(mb);
    if (mode === 'type') {
      if (typeA !== typeB) return trainServiceSortLabel(typeA).localeCompare(trainServiceSortLabel(typeB), 'fr');
      if (eraA !== eraB) return eraA - eraB;
    } else {
      if (eraA !== eraB) return eraA - eraB;
      if (typeA !== typeB) return trainServiceSortLabel(typeA).localeCompare(trainServiceSortLabel(typeB), 'fr');
    }
    return String(ma.name || '').localeCompare(String(mb.name || ''), 'fr') || String(a.id || '').localeCompare(String(b.id || ''), 'fr');
  });
}

function groupCompositionTrains(trains) {
  const mode = 'era';
  const groups = [];
  for (const train of sortedCompositionTrains(trains)) {
    const model = app.state.balance.trains[train.modelId] || {};
    const era = Number(model.unlockEpoch ?? model.epoch ?? 0);
    const type = trainServiceClass(model);
    const key = mode === 'type' ? type : `era-${era}`;
    let group = groups.find(item => item.key === key);
    if (!group) {
      group = mode === 'type'
        ? { key, label: trainServiceSortLabel(type), meta: 'type de composition', trains: [] }
        : { key, label: trainEraLabel(era), meta: 'ère matériel', trains: [] };
      groups.push(group);
    }
    group.trains.push(train);
  }
  return groups;
}


function compositionOwnedModelOptions(trains = app.state?.me?.trains || []) {
  const map = new Map();
  for (const train of trains || []) {
    const model = app.state?.balance?.trains?.[train.modelId] || null;
    const id = train.modelId || '';
    if (!id) continue;
    const existing = map.get(id) || { id, label: model?.name || id, count: 0 };
    existing.count += 1;
    existing.label = model?.name || existing.label;
    map.set(id, existing);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

function compositionAssignmentFilterOptions() {
  const lines = (app.state?.me?.lines || [])
    .filter(line => line.active)
    .slice()
    .sort((a, b) => linePublicName(a).localeCompare(linePublicName(b), 'fr'));
  return [
    { id: 'all', label: 'Tous les trains' },
    { id: 'free', label: 'Trains libres' },
    ...lines.map(line => ({ id: `line:${line.id}`, label: linePublicName(line) }))
  ];
}

function compositionTrainAssignmentKey(train) {
  if (!train) return 'free';
  const line = trainCurrentLine(train.id);
  if (line) return `line:${line.id}`;
  return 'free';
}

function compositionFilteredTrains(trains = app.state?.me?.trains || []) {
  const modelFilter = app.compositionModelFilter || 'all';
  const assignmentFilter = app.compositionAssignmentFilter || 'all';
  return (trains || []).filter(train => {
    if (modelFilter !== 'all' && train.modelId !== modelFilter) return false;
    if (assignmentFilter !== 'all' && compositionTrainAssignmentKey(train) !== assignmentFilter) return false;
    return true;
  });
}

function compositionFilteredTrainIds() {
  return compositionFilteredTrains().map(train => train.id).filter(Boolean);
}

function compositionSelectionSaleSummary(selectedIds = compositionSelectedIds()) {
  const selected = new Set(selectedIds);
  const trains = (app.state?.me?.trains || []).filter(train => selected.has(train.id));
  const unavailable = trains.filter(train => train.maintenance?.active || trainCurrentLine(train.id));
  const estimatedValue = trains.reduce((total, train) => {
    const model = app.state.balance.trains[train.modelId];
    return total + (model ? trainResaleEstimateClient(train, model) : 0);
  }, 0);
  return { trains, unavailable, estimatedValue };
}

function setCompositionModelFilter(value) {
  const allowed = new Set(['all', ...compositionOwnedModelOptions().map(option => option.id)]);
  app.compositionModelFilter = allowed.has(value) ? value : 'all';
  localStorage.setItem('sillons.compositionModelFilter', app.compositionModelFilter);
}

function setCompositionAssignmentFilter(value) {
  const allowed = new Set(compositionAssignmentFilterOptions().map(option => option.id));
  app.compositionAssignmentFilter = allowed.has(value) ? value : 'all';
  localStorage.setItem('sillons.compositionAssignmentFilter', app.compositionAssignmentFilter);
}

function assignableLinesForTrain(train, currentLine = null) {
  if (!train || train.maintenance?.active) return [];
  const model = app.state.balance.trains[train.modelId];
  const profile = previewOperatingProfile(train, model);
  const currentLineId = currentLine?.id || '';
  return (app.state.me?.lines || [])
    .filter(line => line.active && line.id !== currentLineId && !lineHasTrain(line, train.id) && !lineAssignedTrainsClient(line).some(t => t.id === train.id))
    .filter(line => lineServiceCompatibleWithProfileClient(line.service || 'passengers', profile))
    .filter(line => lineDistance(line) <= Number(profile.range || 0))
    .sort((a, b) => linePublicName(a).localeCompare(linePublicName(b), 'fr'));
}

function lineServiceCompatibleWithProfileClient(service, profile) {
  if (service === 'freight') return Number(profile?.freight || 0) > 0;
  if (service === 'mixed') return Number(profile?.capacity || 0) > 0 && Number(profile?.freight || 0) > 0;
  return Number(profile?.capacity || 0) > 0;
}

function lineAvailableSillonsClient(line) {
  const sillons = line?.stats?.capacity?.sillons || line?.stats?.staffing?.sillons || null;
  if (!sillons) return null;
  const max = Number(sillons.maxFrequency ?? sillons.bottleneck?.available ?? sillons.lineCapacity ?? 0);
  const requested = Math.max(0, Math.floor(Number(sillons.requestedFrequency ?? lineSlotDemandClient(line))));
  const maxForLine = Math.max(0, Math.floor(max));
  const available = Math.max(0, maxForLine - requested);
  return { available, requested, maxForLine, capacity: Math.max(0, Math.floor(Number(sillons.lineCapacity ?? max))) };
}

function slotPurchaseCostClient(line, count = 1) {
  const distance = Math.max(1, lineDistance(line));
  const stops = Math.max(2, lineStopsOf(line).length);
  return Math.round(Math.max(2500, distance * 780 + stops * 240) * Math.max(1, Number(count || 1)));
}


function renderCompositionTrainFallbackCard(train, reason = '') {
  const trainId = escapeAttr(train?.id || '');
  const modelId = escapeHtml(train?.modelId || 'matériel inconnu');
  const detail = reason ? ` · ${escapeHtml(reason)}` : '';
  return `
    <article class="composition-train-vignette composition-train-vignette-error" data-composition-select-card data-id="${trainId}" role="button" tabindex="0">
      <div class="composition-vignette-main">
        <div class="composition-vignette-media"><div class="train-art train-art-placeholder"><span>Matériel</span><b>Erreur</b></div></div>
        <div class="composition-vignette-body">
          <div class="composition-vignette-title">
            <strong>${modelId}</strong>
            <span>Composition indisponible${detail}</span>
          </div>
          <span class="small muted">Cette vignette est neutralisée pour ne pas bloquer tout le menu Compositions.</span>
        </div>
      </div>
    </article>`;
}

function safeTrainProfileForComposition(train, model) {
  try {
    return previewOperatingProfile(train, model);
  } catch (error) {
    console.warn('Profil de composition indisponible', train?.id, train?.modelId, error);
    return trainRuntimeProfile(train, model);
  }
}

function safeAssignableLinesForTrain(train, currentLine = null) {
  try {
    return assignableLinesForTrain(train, currentLine);
  } catch (error) {
    console.warn('Lignes compatibles indisponibles pour le train', train?.id, train?.modelId, error);
    return [];
  }
}

function safeCompositionSummary(train, model = null) {
  try {
    return deriveCompositionSummary(train);
  } catch (error) {
    console.warn('Résumé de composition indisponible', train?.id, train?.modelId, error);
    const spec = model ? buildClientCompositionSpec(model, compositionDefaultModeForModelClient(model)) : null;
    if (spec?.mode === 'multiple_unit') return `${spec.powerUnits?.default || 1} rame en UM`;
    if (spec?.mode === 'freight_loco') return `${spec.freightCars?.default || 0} wagon(s)`;
    if (spec?.mode === 'passenger_loco') return `${spec.passengerCars?.default || 0} voiture(s)`;
    return 'Composition à vérifier';
  }
}

function renderCompositionTrainVignette(train, selectedTrainIds = new Set(compositionSelectedIds())) {
  const model = app.state.balance.trains[train.modelId];
  if (!model) return renderCompositionTrainFallbackCard(train, 'modèle absent du référentiel');
  const profile = safeTrainProfileForComposition(train, model);
  const active = app.compositionEditorTrainId === train.id;
  const selected = selectedTrainIds.has(train.id);
  const line = trainCurrentLine(train.id);
  const inMaint = !!train.maintenance?.active;
  const canSell = !line && !inMaint;
  const assignable = safeAssignableLinesForTrain(train, line);
  const hasAssignmentAction = !!line || (assignable.length > 0 && !inMaint);
  const statusLabel = line ? linePublicName(line) : inMaint ? 'En atelier' : 'Libre';
  const assignButtonLabel = line ? 'Appliquer' : 'Affecter';
  const sellEstimate = trainResaleEstimateClient(train, model);
  const era = trainEraLabel(Number(model.unlockEpoch ?? model.epoch ?? 0));
  const serviceLabel = trainServiceSortLabel(trainServiceClass(model));
  return `
    <article class="composition-train-vignette ${active ? 'active' : ''} ${selected ? 'selected' : ''}" data-composition-select-card data-id="${escapeAttr(train.id)}" role="button" tabindex="0" aria-pressed="${selected ? 'true' : 'false'}" title="Cliquer dans une zone libre pour ${selected ? 'retirer ce train de la sélection' : 'sélectionner ce train'}">
      <div class="composition-vignette-select-row">
        <span class="tag composition-status-tag" title="${escapeAttr(statusLabel)}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="composition-vignette-main" aria-hidden="true">
        <div class="composition-vignette-media">
          ${renderTrainArt(model)}
        </div>
        <div class="composition-vignette-body">
          <div class="composition-vignette-title">
            <strong>${escapeHtml(model.name)}</strong>
            <span>${escapeHtml(era)} · ${escapeHtml(serviceLabel)}</span>
          </div>
          <span class="small muted">${escapeHtml(safeCompositionSummary(train, model))}</span>
          <div class="composition-mini-stats">
            <b>${formatInt(profile.capacity)} voy.</b>
            <b>${formatInt(profile.freight)} t</b>
            <b>${formatInt(profile.speed)} km/h</b>
            <b>${formatInt(profile.range)} km</b>
          </div>
        </div>
      </div>
      <div class="composition-assign-row">
        <select class="composition-assign-select" data-assign-line-select="${escapeAttr(train.id)}" ${hasAssignmentAction ? '' : 'disabled'}>
          <option value="">${line ? 'Changer / retirer...' : inMaint ? 'En maintenance' : assignable.length ? 'Affecter à une ligne...' : 'Aucune ligne compatible'}</option>
          ${line ? `<option value="__remove__">Retirer de la ligne actuelle</option>` : ''}
          ${assignable.map(candidate => {
            const slots = lineAvailableSillonsClient(candidate);
            const label = slots ? `${linePublicName(candidate)} · ${slots.available} sillons dispo` : linePublicName(candidate);
            return `<option value="${escapeAttr(candidate.id)}">${escapeHtml(label)}</option>`;
          }).join('')}
        </select>
        <button type="button" class="ghost" data-action="assign-train-line" data-id="${escapeAttr(train.id)}" ${hasAssignmentAction ? '' : 'disabled'}>${escapeHtml(assignButtonLabel)}</button>
      </div>
      <div class="composition-train-actions">
        <button type="button" class="ghost" data-action="duplicate-train" data-id="${escapeAttr(train.id)}" ${tooltipAttr(`Duplique ce matériel avec la même composition. Coût : ${money(Math.round((model?.price || 0) * 0.98))}.`)}>Dupliquer</button>
        <button type="button" class="danger ghost composition-sell-train-btn" data-action="sell-train" data-id="${escapeAttr(train.id)}" ${canSell ? '' : 'disabled'} ${tooltipAttr(canSell ? `Vendre ce train inutilisé. Estimation : ${money(sellEstimate)}.` : line ? 'Impossible : train affecté à une ligne active.' : 'Impossible : train en maintenance.')}>Vendre</button>
      </div>
    </article>
  `;
}

function renderCompositionTrainGroup(group, selectedTrainIds = new Set(compositionSelectedIds())) {
  const mode = 'era';
  const collapsed = isCompositionGroupCollapsed(mode, group.key);
  const selectedCount = group.trains.reduce((count, train) => count + (selectedTrainIds.has(train.id) ? 1 : 0), 0);
  return `
    <section class="composition-train-group ${collapsed ? 'collapsed' : ''}">
      <button type="button" class="research-era-heading composition-group-heading" data-action="toggle-composition-group" data-mode="${escapeAttr(mode)}" data-key="${escapeAttr(group.key)}" aria-expanded="${collapsed ? 'false' : 'true'}">
        <span class="research-era-title">
          <span class="research-era-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
          <span>${escapeHtml(group.label)}</span>
        </span>
        <span class="research-era-meta">${group.trains.length} train${group.trains.length > 1 ? 's' : ''}${selectedCount ? ` · ${selectedCount} sélectionné${selectedCount > 1 ? 's' : ''}` : ''} · ${collapsed ? 'Déplier' : 'Réduire'}</span>
      </button>
      ${collapsed ? '' : `<div class="composition-vignette-grid">${group.trains.map(train => {
        try { return renderCompositionTrainVignette(train, selectedTrainIds); }
        catch (error) {
          console.warn('Vignette de composition ignorée', train?.id, train?.modelId, error);
          return renderCompositionTrainFallbackCard(train, error?.message || 'erreur de rendu');
        }
      }).join('')}</div>`}
    </section>
  `;
}

function renderCompositionFilterToolbar(displayedTrains) {
  const modelOptions = compositionOwnedModelOptions();
  const assignmentOptions = compositionAssignmentFilterOptions();
  const modelFilter = modelOptions.some(option => option.id === app.compositionModelFilter) ? app.compositionModelFilter : 'all';
  const assignmentFilter = assignmentOptions.some(option => option.id === app.compositionAssignmentFilter) ? app.compositionAssignmentFilter : 'all';
  const visibleCount = displayedTrains.length;
  return `
    <div class="composition-filter-toolbar">
      <label>
        <span>Modèle affiché</span>
        <select data-composition-filter="model">
          <option value="all" ${modelFilter === 'all' ? 'selected' : ''}>Tous les modèles possédés</option>
          ${modelOptions.map(option => `<option value="${escapeAttr(option.id)}" ${modelFilter === option.id ? 'selected' : ''}>${escapeHtml(option.label)} · ${option.count}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>Affectation</span>
        <select data-composition-filter="assignment">
          ${assignmentOptions.map(option => `<option value="${escapeAttr(option.id)}" ${assignmentFilter === option.id ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </label>
      <span class="tag">${visibleCount} affiché${visibleCount > 1 ? 's' : ''}</span>
    </div>
  `;
}

function renderCompositionSelectionToolbar(selectedIds, displayedTrains) {
  const selectedCount = selectedIds.length;
  const visibleIds = (displayedTrains || []).map(train => train.id).filter(Boolean);
  const visibleCount = visibleIds.length;
  const allVisibleSelected = visibleCount > 0 && visibleIds.every(id => selectedIds.includes(id));
  const sale = compositionSelectionSaleSummary(selectedIds);
  const saleBlocked = sale.unavailable.length > 0;
  const saleTooltip = saleBlocked
    ? `Vente impossible : ${sale.unavailable.length} train${sale.unavailable.length > 1 ? 's sont' : ' est'} en maintenance ou affecté à une ligne active.`
    : `Vendre les ${selectedCount} trains sélectionnés. Valeur estimée : ${money(sale.estimatedValue)}.`;
  const hint = selectedCount
    ? 'Sélection faite. Clique sur Modifier pour ouvrir l’atelier d’édition de la composition.'
    : 'Clique sur une zone libre d’une vignette pour sélectionner un ou plusieurs trains.';
  return `
    <div class="composition-list-toolbar composition-refit-toolbar">
      ${renderCompositionFilterToolbar(displayedTrains || [])}
      <div class="composition-selection-hint small muted">${escapeHtml(hint)}</div>
      <div class="composition-selection-actions">
        <span class="tag ${selectedCount ? 'good' : ''}">${selectedCount} sélectionné${selectedCount > 1 ? 's' : ''}</span>
        <button type="button" class="ghost" data-action="select-visible-composition-trains" ${allVisibleSelected || !visibleCount ? 'disabled' : ''}>Tout sélectionner affiché</button>
        <button type="button" class="primary" data-action="edit-composition-selection" ${selectedCount ? '' : 'disabled'}>Modifier</button>
        <button type="button" class="ghost" data-action="clear-composition-selection" ${selectedCount ? '' : 'disabled'}>Vider</button>
        ${selectedCount > 1 ? `<button type="button" class="danger ghost" data-action="sell-composition-selection" ${tooltipAttr(saleTooltip)} ${saleBlocked ? 'disabled' : ''}>Tout vendre</button>` : ''}
      </div>
    </div>
  `;
}



function compositionProfileWithChange(train, model, spec, key, value) {
  const clone = {
    ...train,
    composition: {
      ...(train.composition || {}),
      mode: spec.mode,
      [key]: value
    }
  };
  return previewOperatingProfile(clone, model);
}

function profileDeltaValue(next, current, key) {
  return Number(next?.[key] || 0) - Number(current?.[key] || 0);
}

function deltaSigned(value, suffix = '', decimals = 0) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const rounded = decimals ? round(abs) : Math.round(abs);
  return `${n > 0 ? '+' : n < 0 ? '-' : '±'}${rounded}${suffix}`;
}

function compositionDeltaClass(value, positiveIsGood = true) {
  const n = Number(value || 0);
  if (Math.abs(n) < 0.0001) return '';
  return (positiveIsGood ? n > 0 : n < 0) ? 'good-text' : 'warn-text';
}

function renderCompositionDeltaItem(label, value, suffix = '', positiveIsGood = true, decimals = 0) {
  return `
    <div class="composition-delta-item">
      <span>${escapeHtml(label)}</span>
      <b class="${compositionDeltaClass(value, positiveIsGood)}">${escapeHtml(deltaSigned(value, suffix, decimals))}</b>
    </div>`;
}

function renderCompositionMarginalImpact(train, model, spec, profile) {
  let key = '';
  let label = '';
  let current = 0;
  let max = 0;

  if (spec.mode === 'multiple_unit') {
    key = 'powerUnits';
    label = '+1 rame en UM';
    current = Number(train.composition?.powerUnits || spec.powerUnits?.default || 1);
    max = Number(spec.powerUnits?.max || current);
  } else if (spec.mode === 'freight_loco') {
    key = 'freightCars';
    label = '+1 wagon fret';
    current = Number(train.composition?.freightCars || spec.freightCars?.default || 0);
    max = Number(spec.freightCars?.max || current);
  } else {
    key = 'passengerCars';
    label = '+1 voiture voyageurs';
    current = Number(train.composition?.passengerCars || spec.passengerCars?.default || 0);
    max = Number(spec.passengerCars?.max || current);
  }

  if (!key || current >= max) {
    return `
      <div class="composition-delta-card">
        <div>
          <strong>Impact marginal</strong>
          <p class="small muted">La composition est déjà au maximum autorisé pour ce matériel.</p>
        </div>
      </div>`;
  }

  const nextProfile = compositionProfileWithChange(train, model, spec, key, current + 1);
  const capacityDelta = profileDeltaValue(nextProfile, profile, 'capacity');
  const freightDelta = profileDeltaValue(nextProfile, profile, 'freight');
  const speedDelta = profileDeltaValue(nextProfile, profile, 'speed');
  const energyDelta = profileDeltaValue(nextProfile, profile, 'energy');
  const maintenanceDelta = profileDeltaValue(nextProfile, profile, 'maintenance');
  const reliabilityDelta = profileDeltaValue(nextProfile, profile, 'reliability') * 100;
  const comfortDelta = profileDeltaValue(nextProfile, profile, 'comfort') * 100;

  return `
    <div class="composition-delta-card">
      <div class="composition-delta-head">
        <strong>Impact de ${escapeHtml(label)}</strong>
        <span class="small muted">Comparaison immédiate avant enregistrement.</span>
      </div>
      <div class="composition-delta-grid">
        ${renderCompositionDeltaItem('Voyageurs', capacityDelta, '', true)}
        ${renderCompositionDeltaItem('Fret', freightDelta, ' t', true)}
        ${renderCompositionDeltaItem('Vitesse', speedDelta, ' km/h', true)}
        ${renderCompositionDeltaItem('Énergie', energyDelta, '', false, 1)}
        ${renderCompositionDeltaItem('Maintenance', maintenanceDelta, '', false, 2)}
        ${renderCompositionDeltaItem('Fiabilité', reliabilityDelta, '%', true, 1)}
        ${renderCompositionDeltaItem('Confort', comfortDelta, '%', true, 1)}
      </div>
    </div>`;
}

function renderCompositionEditor(train) {
  if (!train) return '<p class="muted">Sélectionne un train à configurer.</p>';
  const model = app.state.balance.trains[train.modelId];
  if (!model) return `<p class="muted">Modèle introuvable pour ce train : ${escapeHtml(train.modelId || 'inconnu')}.</p>`;
  const targetIds = compositionEditTargetIds(train.id);
  const targetCount = Math.max(1, targetIds.length);
  const spec = trainCompositionSpec(train, model);
  let detailBundle;
  try {
    detailBundle = computeOperatingProfileDetailed(train, model);
  } catch (error) {
    console.warn('Détail de composition indisponible', train?.id, train?.modelId, error);
    detailBundle = { profile: trainRuntimeProfile(train, model), metrics: {} };
  }
  const profile = detailBundle.profile || trainRuntimeProfile(train, model);
  const metricDetails = detailBundle.metrics || {};
  for (const key of ['capacity', 'freight', 'speed', 'range', 'reliability', 'comfort', 'energy', 'maintenance']) {
    if (!metricDetails[key]) metricDetails[key] = { key, label: key, description: '', base: Number(model?.[key] || 0), final: Number(profile?.[key] || 0), steps: [] };
  }
  const composition = train.composition || {};
  const line = trainCurrentLine(train.id);
  const variant = selectedCompositionVariant(train, model);
  let quantityControl = '';
  let variantPanel = '';

  if (spec.mode === 'multiple_unit') {
    quantityControl = `
      <div class="composition-control-box">
        <div class="composition-control-head">
          <strong>Nombre de rames en unité multiple</strong>
          <span class="small muted">Ajoute une rame complète : coût identique au matériel de base, voyageurs uniquement.</span>
        </div>
        <div class="composition-control-row wide">
          <input id="compPowerUnits" type="range" min="${spec.powerUnits.min}" max="${spec.powerUnits.max}" value="${composition.powerUnits || spec.powerUnits.default}">
          <input id="compPowerUnitsValue" class="plain-input composition-number-input" type="number" min="${spec.powerUnits.min}" max="${spec.powerUnits.max}" value="${composition.powerUnits || spec.powerUnits.default}">
        </div>
      </div>`;
  } else if (spec.mode === 'freight_loco') {
    quantityControl = `
      <div class="composition-control-box">
        <div class="composition-control-head">
          <strong>Nombre de wagons fret</strong>
          <span class="small muted">Dose la capacité utile du convoi en fonction de la demande fret.</span>
        </div>
        <div class="composition-control-row wide">
          <input id="compFreightCars" type="range" min="${spec.freightCars.min}" max="${spec.freightCars.max}" value="${composition.freightCars || spec.freightCars.default}">
          <input id="compFreightCarsValue" class="plain-input composition-number-input" type="number" min="${spec.freightCars.min}" max="${spec.freightCars.max}" value="${composition.freightCars || spec.freightCars.default}">
        </div>
      </div>`;
    variantPanel = renderCompositionVariantPicker(train, model);
  } else {
    quantityControl = `
      <div class="composition-control-box">
        <div class="composition-control-head">
          <strong>Nombre de voitures voyageurs</strong>
          <span class="small muted">Ajuste la capacité offerte sans surcadencer la ligne.</span>
        </div>
        <div class="composition-control-row wide">
          <input id="compPassengerCars" type="range" min="${spec.passengerCars.min}" max="${spec.passengerCars.max}" value="${composition.passengerCars || spec.passengerCars.default}">
          <input id="compPassengerCarsValue" class="plain-input composition-number-input" type="number" min="${spec.passengerCars.min}" max="${spec.passengerCars.max}" value="${composition.passengerCars || spec.passengerCars.default}">
        </div>
      </div>`;
    variantPanel = renderCompositionVariantPicker(train, model);
  }

  return `
    <div class="composition-workshop-shell" style="background-image: linear-gradient(180deg, rgba(4,10,22,.74), rgba(4,10,22,.92)), url('${COMPOSITION_ART.workshop}');">
      <div class="fleet-card-heading composition-editor-heading">
        <div>
          <h2>Atelier de composition</h2>
          <p class="muted small">Ajuste la longueur utile du train et sélectionne les voitures / wagons spécialisés. En sélection multiple, l’enregistrement applique le réglage aux trains compatibles.</p>
        </div>
        <div class="composition-editor-heading-actions">
          <span class="tag ${targetCount > 1 ? 'good' : ''}">${targetCount > 1 ? `${targetCount} trains ciblés` : line ? `Affecté à ${escapeHtml(linePublicName(line))}` : 'Train libre'}</span>
          <button type="button" class="ghost" data-action="close-composition-editor">Fermer</button>
        </div>
      </div>

      ${renderCompositionModeTabs(train, model)}

      <div class="composition-editor-top">
        <div class="composition-train-card">
          ${renderTrainArt(model)}
          <div>
            <strong>${escapeHtml(model.name)}</strong>
            <p class="small muted">${escapeHtml(safeCompositionSummary(train, model))}</p>
            <p class="small muted">Mode : ${spec.mode === 'multiple_unit' ? 'Unité multiple voyageurs' : spec.mode === 'freight_loco' ? 'Locomotive + wagons' : 'Locomotive + voitures'}</p>
            ${variant ? `<p class="small muted">Variante active : <b>${escapeHtml(variant.name)}</b>${variant.cargoType ? ` · ${escapeHtml(variant.cargoType)}` : ''}</p>` : ''}
          </div>
        </div>
        <div class="composition-capacity-card">
          <b>Capacité réelle par train</b>
          <span>${formatInt(profile.capacity)} voyageurs · ${formatInt(profile.freight)} t fret</span>
          <span>${formatInt(profile.speed)} km/h · Portée ${formatInt(profile.range)} km</span>
          <span>Maintenance ${round(profile.maintenance)} · ${Math.round(profile.reliability * 100)}% fiabilité · ${Math.round(profile.comfort * 100)}% confort</span>
          ${variant ? `<span class="small muted">${escapeHtml(variant.description || '')}</span>` : ''}
        </div>
      </div>

      ${renderTrainCompositionStrip(train, model, 'large')}

      <div class="composition-stat-grid">
        ${compositionMetric('Voyageurs / train', formatInt(profile.capacity), buildMetricTooltip('Voyageurs / train', 'capacity', metricDetails.capacity), profile.capacity >= (model.capacity || 0) ? 'good-text' : '', `Base ${formatInt(metricDetails.capacity.base)}`)}
        ${compositionMetric('Fret / train', `${formatInt(profile.freight)} t`, buildMetricTooltip('Fret / train', 'freight', metricDetails.freight), profile.freight >= (model.freight || 0) ? 'good-text' : '', `Base ${formatInt(metricDetails.freight.base)} t`)}
        ${compositionMetric('Vitesse commerciale', `${formatInt(profile.speed)} km/h`, buildMetricTooltip('Vitesse commerciale', 'speed', metricDetails.speed), '', `Base ${formatInt(metricDetails.speed.base)} km/h`)}
        ${compositionMetric('Portée', `${formatInt(profile.range)} km`, buildMetricTooltip('Portée', 'range', metricDetails.range), profile.range >= (model.range || 0) ? 'good-text' : '', `Base ${formatInt(metricDetails.range.base)} km`)}
        ${compositionMetric('Fiabilité', `${Math.round(profile.reliability * 100)}%`, buildMetricTooltip('Fiabilité', 'reliability', metricDetails.reliability), profile.reliability >= 0.88 ? 'good-text' : '', `Base ${Math.round(metricDetails.reliability.base * 100)}%`)}
        ${compositionMetric('Confort', `${Math.round(profile.comfort * 100)}%`, buildMetricTooltip('Confort', 'comfort', metricDetails.comfort), profile.comfort >= 0.75 ? 'good-text' : '', `Base ${Math.round(metricDetails.comfort.base * 100)}%`)}
        ${compositionMetric('Énergie', round(profile.energy), buildMetricTooltip('Énergie', 'energy', metricDetails.energy), profile.energy <= (model.energy || 0) ? 'good-text' : 'warn-text', `Base ${round(metricDetails.energy.base)}`)}
      </div>

      ${renderCompositionMarginalImpact(train, model, spec, profile)}

      <div class="composition-controls refined-layout ${variantPanel ? 'has-variants' : ''}">
        <div class="composition-controls-top">
          ${quantityControl}
          <div class="composition-save-box">
            ${renderCompositionCostSummary(train)}
            <p class="small muted">Impact ligne : capacité d’exploitation = composition × trains affectés. Les variantes permettent de spécialiser ton offre voyageurs ou la marchandise transportée.</p>
            <button class="primary" data-action="save-train-composition" data-id="${train.id}">${targetCount > 1 ? `Enregistrer sur ${targetCount} trains` : 'Enregistrer la composition'}</button>
          </div>
        </div>
        ${variantPanel ? `<div class="composition-variant-panel">${variantPanel}</div>` : ''}
      </div>
    </div>
  `;
}

function renderFleetCompositionPanel() {
  const me = app.state.me;
  if (!me.trains.length) {
    return `<div class="card"><h2>Compositions</h2><p class="muted">Achète d’abord un train dans le catalogue pour accéder à l’atelier de composition.</p></div>`;
  }

  const validIds = compositionValidTrainIds();
  const cleanedSelection = compositionSelectedIds();
  if (cleanedSelection.length !== (app.selectedCompositionTrainIds || []).length) setCompositionSelection(cleanedSelection, app.selectedCompositionTrainId);
  if (app.selectedCompositionTrainId && !validIds.has(app.selectedCompositionTrainId)) {
    app.selectedCompositionTrainId = '';
    localStorage.removeItem('sillons.selectedCompositionTrainId');
  }
  setCompositionModelFilter(app.compositionModelFilter || 'all');
  setCompositionAssignmentFilter(app.compositionAssignmentFilter || 'all');
  if (app.compositionEditorTrainId && !validIds.has(app.compositionEditorTrainId)) setCompositionEditorTrain('');
  if (app.compositionEditorTrainId && cleanedSelection.length && !cleanedSelection.includes(app.compositionEditorTrainId)) setCompositionEditorTrain(cleanedSelection[0] || '');
  if (app.compositionEditorTrainId && !cleanedSelection.length) setCompositionEditorTrain('');
  const selected = me.trains.find(t => t.id === app.compositionEditorTrainId) || null;
  const displayedTrains = compositionFilteredTrains(me.trains);
  const groups = groupCompositionTrains(displayedTrains);
  const selectedTrainIds = new Set(cleanedSelection);
  const configurable = me.trains.filter(t => !!t.compositionSpec).length;
  const avgSeats = me.trains.length ? Math.round(me.trains.reduce((sum, t) => sum + trainRuntimeProfile(t).capacity, 0) / me.trains.length) : 0;

  return `
    <div class="fleet-composition-layout composition-refit-layout ${selected ? 'has-editor' : 'no-editor'}">
      <div class="card fleet-kpi-card composition-kpi-card">
        ${metric('Trains configurables', configurable)}
        ${metric('Capacité moyenne', `${avgSeats} voy.`)}
        ${metric('Sélection multiple', `${cleanedSelection.length} train${cleanedSelection.length > 1 ? 's' : ''}`)}
        ${metric('Lignes actives', me.lines.filter(l => l.active).length)}
      </div>

      <div class="card composition-list-card composition-refit-list-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Trains de la compagnie</h2>
            <p class="muted small">Sélectionne un ou plusieurs matériels, puis clique sur Modifier pour ouvrir l’atelier de composition.</p>
          </div>
          <span class="tag">${displayedTrains.length}/${me.trains.length} unité(s)</span>
        </div>
        ${renderCompositionSelectionToolbar(cleanedSelection, displayedTrains)}
        <div class="composition-train-list composition-group-list">
          ${groups.length ? groups.map(group => renderCompositionTrainGroup(group, selectedTrainIds)).join('') : '<p class="muted composition-empty-filter">Aucun train ne correspond aux filtres sélectionnés.</p>'}
        </div>
      </div>

      ${selected ? `<div class="card composition-editor-card composition-refit-editor">${(() => {
        try { return renderCompositionEditor(selected); }
        catch (error) {
          console.warn('Éditeur de composition indisponible', selected?.id, selected?.modelId, error);
          return `<p class="muted">Impossible d’ouvrir l’éditeur pour ce train. La liste reste accessible.</p>`;
        }
      })()}</div>` : ''}
    </div>
  `;
}


function renderFleet() {
  const me = app.state.me;
  const active = ['catalog', 'maintenance', 'composition'].includes(app.activeFleetSubtab) ? app.activeFleetSubtab : 'catalog';
  const models = Object.values(app.state.balance.trains);
  const available = models.filter(t => trainModelUnlocked(t));
  const locked = models.filter(t => !trainModelUnlocked(t));
  const inWorkshop = me.trains.filter(t => t.maintenance?.active).length;
  const avgCondition = me.trains.length ? Math.round(me.trains.reduce((sum, t) => sum + Number(t.condition || 0), 0) / me.trains.length * 100) : 0;
  const heroTitle = active === 'catalog' ? 'Catalogue du matériel roulant' : active === 'maintenance' ? 'Maintenance du matériel' : 'Atelier de compositions';
  const heroText = active === 'catalog'
    ? 'Achète du matériel adapté à tes lignes : Capacité, vitesse, énergie, confort, fret ou fiabilité.'
    : active === 'maintenance'
      ? 'Choisis une politique d’entretien et planifie les interventions pour éviter l’usure excessive du parc.'
      : 'Allonge ou raccourcis les trains pour ajuster la capacité : voitures voyageurs, wagons fret ou rames en unité multiple.';

  return `
    ${renderSectionHero('PARC FERROVIAIRE', heroTitle, heroText, ART.tabs.fleet, ['Matériel', 'Atelier', 'Compositions'])}

    <div class="fleet-workspace">
      <div class="fleet-subtabs" role="tablist" aria-label="Parc ferroviaire">
        <button type="button" data-fleet-subtab="catalog" class="${active === 'catalog' ? 'active' : ''}">
          <span>Catalogue</span>
          <b>${available.length} disponible(s)</b>
        </button>
        <button type="button" data-fleet-subtab="maintenance" class="${active === 'maintenance' ? 'active' : ''}">
          <span>Maintenance</span>
          <b>${inWorkshop} en atelier</b>
        </button>
        <button type="button" data-fleet-subtab="composition" class="${active === 'composition' ? 'active' : ''}">
          <span>Compositions</span>
          <b>${me.trains.length} train(s)</b>
        </button>
      </div>

      ${active === 'catalog' ? renderFleetCatalogPanel(available, locked) : active === 'maintenance' ? renderFleetMaintenancePanel(avgCondition, inWorkshop) : renderFleetCompositionPanel()}
    </div>
  `;
}


function fleetCatalogEraStorageKey(epoch) {
  return `epoch::${Math.max(0, Number(epoch || 0))}`;
}

function isFleetCatalogEraCollapsed(epoch) {
  return Boolean(app.fleetCatalogEraCollapsed?.[fleetCatalogEraStorageKey(epoch)]);
}

function setFleetCatalogEraCollapsed(epoch, collapsed) {
  const key = fleetCatalogEraStorageKey(epoch);
  app.fleetCatalogEraCollapsed = { ...(app.fleetCatalogEraCollapsed || {}), [key]: Boolean(collapsed) };
  if (!collapsed) delete app.fleetCatalogEraCollapsed[key];
  localStorage.setItem('sillons.fleetCatalogEraCollapsed', JSON.stringify(app.fleetCatalogEraCollapsed));
}


function fleetMaintenanceEraStorageKey(epoch) {
  return `epoch::${Math.max(0, Number(epoch || 0))}`;
}

function isFleetMaintenanceEraCollapsed(epoch) {
  return Boolean(app.fleetMaintenanceEraCollapsed?.[fleetMaintenanceEraStorageKey(epoch)]);
}

function setFleetMaintenanceEraCollapsed(epoch, collapsed) {
  const key = fleetMaintenanceEraStorageKey(epoch);
  app.fleetMaintenanceEraCollapsed = { ...(app.fleetMaintenanceEraCollapsed || {}), [key]: Boolean(collapsed) };
  if (!collapsed) delete app.fleetMaintenanceEraCollapsed[key];
  localStorage.setItem('sillons.fleetMaintenanceEraCollapsed', JSON.stringify(app.fleetMaintenanceEraCollapsed));
}

function renderFleetCatalogPanel(available, locked) {
  const me = app.state.me;
  const models = Object.values(app.state.balance.trains);
  const byEpoch = {};
  for (const model of models) (byEpoch[model.unlockEpoch] ||= []).push(model);
  const eraEntries = Object.entries(byEpoch).sort((a, b) => Number(a[0]) - Number(b[0]));

  return `
    <div class="fleet-catalog-layout">
      <div class="card fleet-kpi-card">
        ${metric('Budget achat', money(me.cash))}
        ${metric('Matériels achetables', available.length)}
        ${metric('Matériels verrouillés', locked.length)}
        ${metric('Époque actuelle', me.eraName)}
      </div>

      <div class="card rolling-stock-catalog fleet-catalog-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Catalogue de matériel roulant</h2>
            <p class="muted small">Les cartes sont classées par époque. Utilise-les comme choix de stratégie : Économique, grande capacité, Fret, Vitesse, Confort ou Énergie propre.</p>
          </div>
          <span class="tag">${models.length} modèles</span>
        </div>

        <div class="era-catalog">
          ${eraEntries.map(([epoch, list]) => {
            const collapsed = isFleetCatalogEraCollapsed(epoch);
            return `
              <section class="era-block fleet-era-block ${collapsed ? 'collapsed' : ''}">
                <button type="button" class="era-title fleet-era-toggle" data-action="toggle-fleet-catalog-era" data-epoch="${escapeAttr(String(epoch))}" aria-expanded="${collapsed ? 'false' : 'true'}">
                  <span class="research-era-title">
                    <span class="research-era-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
                    <strong>${escapeHtml(trainEraLabel(Number(epoch)))}</strong>
                  </span>
                  <span class="research-era-meta">${list.length} matériels · ${collapsed ? 'Déplier' : 'Masquer'}</span>
                </button>
                ${collapsed ? '' : `
                  <div class="train-card-grid fleet-catalog-grid">
                    ${list.sort((a, b) => a.price - b.price).map(model => renderTrainCatalogItem(model, trainModelUnlocked(model))).join('')}
                  </div>
                `}
              </section>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderFleetMaintenancePanel(avgCondition, inWorkshop) {
  const me = app.state.me;
  const free = me.trains.filter(t => !t.maintenance?.active && !me.lines.some(l => l.active && lineHasTrain(l, t.id))).length;
  const assigned = me.trains.filter(t => me.lines.some(l => l.active && lineHasTrain(l, t.id))).length;
  const trainsByEpoch = {};
  for (const train of me.trains || []) {
    const model = app.state.balance.trains[train.modelId] || {};
    const epoch = Number(model.unlockEpoch ?? model.epoch ?? 0);
    (trainsByEpoch[epoch] ||= []).push(train);
  }
  const eraEntries = Object.entries(trainsByEpoch).sort((a, b) => Number(a[0]) - Number(b[0]));

  return `
    <div class="fleet-maintenance-layout">
      <div class="card fleet-kpi-card">
        ${metric('État moyen', `${avgCondition}%`, avgCondition >= 70 ? 'good-text' : avgCondition >= 45 ? '' : 'bad-text')}
        ${metric('En atelier', inWorkshop)}
        ${metric('Affectés', assigned)}
        ${metric('Libres', free)}
      </div>

      ${renderMaintenancePolicyCard()}

      <div class="card fleet-bulk-maintenance-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Maintenance globale</h2>
            <p class="muted small">Envoie en une seule action tous les trains éligibles en révision atelier. Les trains déjà en atelier ou presque neufs sont ignorés.</p>
          </div>
          <button class="danger confirm-danger" data-action="repair-all-trains" data-mode="standard" ${me.trains.length ? '' : 'disabled'}>Tout envoyer en maintenance</button>
        </div>
      </div>

      <div class="card fleet-owned-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Parc de la compagnie</h2>
            <p class="muted small">Lance les interventions depuis les cartes de matériel. Un train usé perd en vitesse et en ponctualité. À 0 %, il est immobilisé et sa ligne ne produit plus rien.</p>
          </div>
          <span class="tag">${me.trains.length} unité(s)</span>
        </div>
        <div class="era-catalog fleet-maintenance-era-list">
          ${eraEntries.length ? eraEntries.map(([epoch, trains]) => {
            const collapsed = isFleetMaintenanceEraCollapsed(epoch);
            const sorted = trains.sort((a, b) => {
              const ma = app.state.balance.trains[a.modelId] || {};
              const mb = app.state.balance.trains[b.modelId] || {};
              return String(ma.name || '').localeCompare(String(mb.name || ''), 'fr') || String(a.id).localeCompare(String(b.id));
            });
            return `
              <section class="era-block fleet-era-block ${collapsed ? 'collapsed' : ''}">
                <button type="button" class="era-title fleet-era-toggle" data-action="toggle-fleet-maintenance-era" data-epoch="${escapeAttr(String(epoch))}" aria-expanded="${collapsed ? 'false' : 'true'}">
                  <span class="research-era-title">
                    <span class="research-era-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
                    <strong>${escapeHtml(trainEraLabel(Number(epoch)))}</strong>
                  </span>
                  <span class="research-era-meta">${sorted.length} train${sorted.length > 1 ? 's' : ''} · ${collapsed ? 'Déplier' : 'Masquer'}</span>
                </button>
                ${collapsed ? '' : `
                  <div class="train-card-grid fleet-catalog-grid fleet-maintenance-grid">
                    ${sorted.map(t => renderOwnedTrain(t)).join('')}
                  </div>
                `}
              </section>
            `;
          }).join('') : '<p class="muted">Aucun matériel.</p>'}
        </div>
      </div>
    </div>
  `;
}

function renderMaintenancePolicyCard() {
  const me = app.state.me;
  const policies = app.state.balance.maintenancePolicies || {};
  return `
    <div class="card fleet-policy-card">
      <div class="fleet-card-heading">
        <div>
          <h2>Politique de maintenance</h2>
          <p class="muted small">La politique influence l’usure, les coûts récurrents et la fiabilité du parc en exploitation.</p>
        </div>
        <span class="tag good">${escapeHtml(policies[me.maintenancePolicy]?.name || 'Active')}</span>
      </div>
      <div class="maintenance-policy-grid">
        ${Object.values(policies).map(policy => `
          <article class="maintenance-policy-card ${me.maintenancePolicy === policy.id ? 'active' : ''}">
            <div class="policy-head">
              <strong>${escapeHtml(policy.name)}</strong>
              <span class="tag ${me.maintenancePolicy === policy.id ? 'good' : ''}">${me.maintenancePolicy === policy.id ? 'Active' : 'Choix'}</span>
            </div>
            <p class="small muted">${escapeHtml(policy.description)}</p>
            <div class="policy-stats">
              <div><span>Coût</span><b>×${round(policy.costMultiplier)}</b></div>
              <div><span>Usure</span><b>×${round(policy.wearMultiplier)}</b></div>
              <div><span>Fiabilité</span><b>${policy.reliabilityBonus >= 0 ? '+' : ''}${Math.round(policy.reliabilityBonus * 100)} pts</b></div>
            </div>
            <button data-action="maintenance-policy" data-id="${policy.id}" ${tooltipAttr(maintenancePolicyTooltip(policy))} ${me.maintenancePolicy === policy.id ? 'disabled' : ''}>${me.maintenancePolicy === policy.id ? 'Politique active' : 'Appliquer'}</button>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function trainModelRequiredTechLevel(model) {
  return Math.max(1, Math.floor(Number(model.requiredTechLevel || 1)));
}

function trainModelResearchRequirementLabel(model) {
  if (!model.requiredTech) return 'Aucune recherche';
  return `${techNodeTitle(model.requiredTech)} niv. ${trainModelRequiredTechLevel(model)}`;
}

function trainModelEpochRequirementChip(model) {
  const requiredEpoch = Math.max(0, Number(model.unlockEpoch || 0));
  const currentEpoch = Math.max(0, Number(app.state.me?.epoch || 0));
  const ok = currentEpoch >= requiredEpoch;
  const label = trainEraLabel(requiredEpoch);
  const tip = ok
    ? `Ère requise atteinte : ${label}.`
    : `Ère requise : ${label}. Ère actuelle : ${trainEraLabel(currentEpoch)}.`;
  return `<span class="research-prereq train-prereq-chip ${ok ? 'met' : 'missing'}" ${tooltipAttr(tip)}><small>Ère</small>${escapeHtml(label)}</span>`;
}

function trainModelResearchRequirementChip(model) {
  if (!model.requiredTech) {
    return '<span class="research-prereq train-prereq-chip met"><small>Recherche</small>Aucune</span>';
  }
  const requiredLevel = trainModelRequiredTechLevel(model);
  const currentLevel = techLevel(model.requiredTech);
  const ok = currentLevel >= requiredLevel;
  const techTitle = techNodeTitle(model.requiredTech);
  const label = `${techTitle} · niv. ${formatInt(currentLevel)}/${formatInt(requiredLevel)}`;
  const tip = ok
    ? `${techTitle} niveau ${requiredLevel} atteint.`
    : `${techTitle} requis au niveau ${requiredLevel}. Niveau actuel : ${currentLevel}.`;
  if (ok) {
    return `<span class="research-prereq train-prereq-chip met" ${tooltipAttr(tip)}><small>Recherche</small>${escapeHtml(label)}</span>`;
  }
  return `<button type="button" class="research-prereq train-prereq-chip missing" data-action="focus-research" data-id="${escapeAttr(model.requiredTech)}" ${tooltipAttr(tip)}><small>Recherche</small>${escapeHtml(label)}</button>`;
}


function trainResearchEra(model) {
  return Math.max(1, Number(model?.unlockEpoch || 0) + 1);
}

function normalizeResearchEffectTextClient(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseResearchNumericEffectsClient(effectText) {
  const text = normalizeResearchEffectTextClient(effectText);
  if (!text || text.includes('niveaux suivants') || text.includes('aucune fonctionnalite')) return [];
  const regex = /([+-])\s*(\d+(?:[.,]\d+)?)\s*%\s*(portee|autonomie|vitesse max|fiabilite|consommation|impact environnemental|rentabilite)/g;
  const effects = [];
  let match;
  while ((match = regex.exec(text))) {
    const sign = match[1] === '-' ? -1 : 1;
    const rawValue = Number(String(match[2]).replace(',', '.')) / 100;
    const label = match[3];
    const kind = (
      label === 'vitesse max' ? 'speed' :
      label === 'fiabilite' ? 'reliability' :
      label === 'consommation' ? 'energy' :
      label === 'impact environnemental' ? 'environment' :
      label === 'rentabilite' ? 'profitability' :
      label === 'autonomie' ? 'autonomy' :
      'range'
    );
    effects.push({ kind, value: sign * rawValue });
  }
  return effects;
}

function researchNodesForEraClient(era) {
  const nodes = [];
  for (const group of Object.values(app.state?.balance?.techTree || {})) {
    for (const node of group.nodes || []) {
      if (Number(node.era || 0) === Number(era)) nodes.push(node);
    }
  }
  return nodes;
}

function trainInheritedResearchBonus(model) {
  const modifiers = { speed: 1, range: 1, autonomy: 1, reliability: 1, energy: 1, environment: 1, profitability: 1 };
  const sources = [];
  const effects = [];
  for (const node of researchNodesForEraClient(trainResearchEra(model))) {
    const level = techLevel(node.id);
    if (level <= 0) continue;
    const units = researchLevelEffectUnitsClient(level);
    const nodeEffects = [];
    for (const effectText of node.improves || []) {
      for (const effect of parseResearchNumericEffectsClient(effectText)) {
        const multiplier = Math.max(0.08, 1 + effect.value * units);
        modifiers[effect.kind] *= multiplier;
        nodeEffects.push({
          kind: effect.kind,
          rawValue: effect.value,
          units,
          multiplier,
          signedPercent: signedPercentFromMultiplier(multiplier, effect.kind === 'energy' || effect.kind === 'environment')
        });
      }
    }
    if (nodeEffects.length) {
      const source = { title: node.title, level, effects: nodeEffects };
      sources.push(source);
      for (const item of nodeEffects) effects.push({ ...item, title: node.title, level });
    }
  }
  return { modifiers, sources, effects };
}

function signedPercentFromMultiplier(multiplier, inverse = false) {
  const value = inverse ? (1 - multiplier) : (multiplier - 1);
  const pct = Math.round(value * 1000) / 10;
  if (Math.abs(pct) < 0.05) return '';
  return `${pct > 0 ? '+' : ''}${pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%`;
}

function effectiveModelWithResearchClient(model) {
  const { modifiers } = trainInheritedResearchBonus(model);
  const rangeMultiplier = model.energyType === 'battery'
    ? modifiers.range * modifiers.autonomy
    : modifiers.range;
  return {
    ...model,
    speed: Math.max(20, Math.round(Number(model?.speed || 0) * modifiers.speed)),
    range: Math.max(1, Math.round(Number(model?.range || 0) * rangeMultiplier)),
    reliability: clamp(Number(model?.reliability || 0) * modifiers.reliability, 0.18, 0.995),
    energy: Math.max(0.01, round(Number(model?.energy || 0) * modifiers.energy)),
    researchModifiers: modifiers
  };
}

function trainEffectiveCatalogRange(model) {
  return effectiveModelWithResearchClient(model).range;
}

function renderTrainInheritedResearchBonuses(model) {
  const { modifiers, sources } = trainInheritedResearchBonus(model);
  const autonomyOrRange = model.energyType === 'battery'
    ? ['Autonomie', modifiers.autonomy * modifiers.range, false]
    : ['Portée', modifiers.range, false];
  const items = [
    autonomyOrRange,
    ['Vitesse max', modifiers.speed, false],
    ['Fiabilité', modifiers.reliability, false],
    ['Consommation', modifiers.energy, true],
    ['Impact env.', modifiers.environment, true],
    ['Rentabilité', modifiers.profitability, false]
  ]
    .map(([label, multiplier, inverse]) => ({ label, value: signedPercentFromMultiplier(multiplier, inverse) }))
    .filter(item => item.value);

  if (!items.length) {
    return `
      <div class="train-research-bonus-panel empty">
        <div class="train-research-bonus-title">Bonus recherches hérités</div>
        <span>Aucun bonus actif pour cette ère</span>
      </div>
    `;
  }

  return `
    <div class="train-research-bonus-panel">
      <div class="train-research-bonus-title">Bonus recherches hérités</div>
      <div class="train-research-bonus-grid">
        ${items.map(item => `<span><small>${escapeHtml(item.label)}</small><b>${escapeHtml(item.value)}</b></span>`).join('')}
      </div>
    </div>
  `;
}

function renderTrainRequirementPills(model) {
  return `
    <div class="train-prereq-panel">
      <div class="train-prereq-title">Prérequis</div>
      <div class="research-prereqs train-requirements compact">
        ${trainModelEpochRequirementChip(model)}
        ${trainModelResearchRequirementChip(model)}
      </div>
    </div>
  `;
}

function trainPurchaseUnitPriceClient(model) {
  const market = app.state?.game?.market || {};
  const steel = Number(market.steel ?? 1);
  const electricity = Number(market.electricity ?? 0.34);
  const multiplier = 1
    + Math.max(0, steel - 1) * 0.35
    + (model.energyType === 'electricity' ? Math.max(0, electricity - 0.34) * 0.1 : 0);
  return Math.round(Number(model.price || 0) * multiplier);
}

function parseTrainPurchaseQuantityDraft(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const quantity = Math.floor(Number(raw));
  if (!Number.isFinite(quantity)) return null;
  return clamp(quantity, 1, 99);
}

function normalizeTrainPurchaseQuantity(value) {
  return parseTrainPurchaseQuantityDraft(value) ?? 1;
}

function updateTrainPurchaseTotal(input, options = {}) {
  if (!input) return;
  const modelId = input.dataset.buyTrainQty || '';
  const quantity = parseTrainPurchaseQuantityDraft(input.value);
  const committedQuantity = quantity ?? 1;
  if (options.commit) input.value = String(committedQuantity);
  const card = input.closest('.train-catalog-card');
  const total = card?.querySelector(`[data-buy-train-total="${CSS.escape(modelId)}"]`);
  const unitPrice = Math.max(0, Math.round(Number(input.dataset.unitPrice || 0)));
  if (total) total.textContent = quantity === null ? '—' : money(unitPrice * quantity);
}


function estimateTrainPowerKw(model) {
  const speed = Math.max(0, Number(model?.speed || 0));
  const capacity = Math.max(0, Number(model?.capacity || 0));
  const freight = Math.max(0, Number(model?.freight || 0));
  const typeLabel = `${model?.name || ''} ${model?.type || ''}`.toLowerCase();
  const energyType = String(model?.energyType || '').toLowerCase();
  let multiplier = energyType === 'coal'
    ? 0.72
    : energyType === 'diesel'
      ? 0.88
      : energyType === 'battery'
        ? 0.92
        : energyType === 'hydrogen'
          ? 0.96
          : 1;
  if (/(grande vitesse|tgv|maglev)/.test(typeLabel)) multiplier *= 1.22;
  else if (/(autorail|rame|duplex|regio|régio|navette)/.test(typeLabel)) multiplier *= 1.08;
  else if (/(fret|marchand)/.test(typeLabel) && freight > capacity) multiplier *= 1.1;
  const weightedLoad = capacity * 5 + freight * 1.6 + speed * 18 + Math.max(capacity, freight * 0.25);
  return Math.max(350, Math.round((weightedLoad * multiplier) / 50) * 50);
}

function renderTrainCatalogItem(model, buyable) {
  const effective = effectiveModelWithResearchClient(model);
  const effectiveRange = effective.range;
  const unitPrice = trainPurchaseUnitPriceClient(model);
  const powerKw = estimateTrainPowerKw(model);
  const multipleUnit = isMultipleUnitModelClient(model);
  const muSpec = multipleUnit ? buildClientCompositionSpec(model, 'multiple_unit') : null;
  return `
    <div class="list-item train-catalog-card ${buyable ? 'buyable' : 'locked'}">
      ${renderTrainArt(model)}
      <div class="train-card-body">
        <div class="item-title">
          <strong>${escapeHtml(model.name)}</strong>
          <span class="tag ${buyable ? 'good' : 'warn'}">${buyable ? money(unitPrice) : 'À débloquer'}</span>
        </div>
        <p class="small muted">${escapeHtml(model.description || trainStrengths(model))}</p>
        <div class="train-stat-grid">
          ${renderTrainStat('Vitesse', `${model.speed} km/h`, model.speed / 420, model.speed >= 250 ? 'good' : '', `${effective.speed} km/h`, effective.speed / 420)}
          ${renderTrainStat('Portée', `${formatInt(model.range)} km`, (model.range || 0) / 1400, effectiveRange >= 900 ? 'good' : '', `${formatInt(effectiveRange)} km`, effectiveRange / 1400)}
          ${renderTrainStat('Puissance', `${formatInt(powerKw)} kW`, powerKw / 20000, powerKw >= 8000 ? 'good' : '')}
          ${multipleUnit ? renderTrainStat('Capacité rame', `${formatInt(model.capacity)} voy.`, Math.min(1, (model.capacity || 0) / 1100), model.capacity >= 650 ? 'good' : '') : ''}
          ${multipleUnit ? renderTrainStat('UM max', `${muSpec.powerUnits.max} rame${muSpec.powerUnits.max > 1 ? 's' : ''}`, muSpec.powerUnits.max / 3, muSpec.powerUnits.max >= 3 ? 'good' : '') : ''}
          ${renderTrainStat('Fiabilité', `${Math.round(model.reliability * 100)}%`, model.reliability, effective.reliability >= 0.92 ? 'good' : '', `${Math.round(effective.reliability * 100)}%`, effective.reliability)}
          ${renderTrainStat('Confort', `${Math.round(model.comfort * 100)}%`, model.comfort, model.comfort >= 0.8 ? 'good' : '')}
          ${renderTrainStat('Maint./h', maintenanceHourlyRange(model), 1 - Math.min(1, model.maintenance / 1.3), model.maintenance <= 0.45 ? 'good' : 'warn')}
        </div>
        ${renderTrainRequirementPills(model)}
        ${renderTrainInheritedResearchBonuses(model)}
        <div class="train-buy-control">
          <label>
            <span>Quantité</span>
            <input type="number" min="1" max="99" step="1" value="1" inputmode="numeric" data-buy-train-qty="${escapeAttr(model.id)}" data-unit-price="${unitPrice}" ${buyable ? '' : 'disabled'}>
          </label>
          <span class="train-buy-total">Total <b data-buy-train-total="${escapeAttr(model.id)}">${money(unitPrice)}</b></span>
        </div>
        <div class="actions">
          <button class="primary" data-action="buy-train" data-id="${model.id}" data-unit-price="${unitPrice}" ${buyable ? '' : 'disabled'}>Acheter</button>
        </div>
      </div>
    </div>
  `;
}




function formatTrainServiceTime(train) {
  const tickMs = Math.max(250, Number(app.state?.game?.tickMs || 2000));
  const totalSeconds = Math.max(0, Math.floor(Number(train?.age || 0) * tickMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${formatInt(days)} j ${hours} h`;
  if (hours > 0) return `${formatInt(hours)} h ${minutes} min`;
  if (minutes > 0) return `${formatInt(minutes)} min ${seconds} s`;
  return `${formatInt(seconds)} s`;
}

function renderOwnedTrain(train) {
  const model = app.state.balance.trains[train.modelId];
  const line = app.state.me.lines.find(l => l.active && lineHasTrain(l, train.id));
  const maint = train.maintenance || {};
  const inMaint = !!maint.active;
  const actions = app.state.balance.maintenanceActions || {};
  const condition = Math.round((train.condition || 0) * 100);
  const conditionClass = condition > 70 ? 'good' : condition > 40 ? 'warn' : 'bad';
  const profile = previewOperatingProfile(train, model);
  const sellTip = line
    ? 'Impossible de vendre : Ce train est affecté à une ligne active.'
    : inMaint
      ? 'Impossible de vendre : Ce train est en maintenance.'
      : `Vend ce train d’occasion. Valeur influencée par son état (${condition}%).`;
  const statusLabel = line
    ? linePublicName(line)
    : inMaint
      ? 'En atelier'
      : condition <= 0
        ? 'Immobilisé'
        : 'Libre';
  const statusClass = inMaint ? 'warn' : condition <= 0 ? 'bad' : line ? 'good' : '';

  return `
    <div class="list-item train-catalog-card owned-train-card maintenance-train-card">
      ${renderTrainArt(model)}
      <div class="train-card-body owned-train-body">
        <div class="item-title">
          <strong>${escapeHtml(model.name)}</strong>
          <span class="tag ${statusClass}">${escapeHtml(statusLabel)}</span>
        </div>
        <p class="small muted">${escapeHtml(model.description || trainStrengths(model))}</p>
        <div class="train-condition-head">
          <span>État ${condition}%</span>
          <b class="${conditionClass}-text">${escapeHtml(trainProjectionLabel(train))}</b>
        </div>
        <div class="progress train-condition-bar ${conditionClass}"><i style="width:${condition}%"></i></div>
        <div class="owned-train-detail-grid">
          <div><span>Disponibilité</span><b>${inMaint ? `${escapeHtml(maint.label || 'Maintenance')} · ${formatCycles(maint.daysLeft)}` : 'Disponible'}</b></div>
          <div><span>Usure historique</span><b>${escapeHtml(formatTrainServiceTime(train))}</b></div>
          <div><span>Composition</span><b>${escapeHtml(deriveCompositionSummary(train))}</b></div>
          <div><span>Maintenance</span><b>${maintenanceHourlyRange(profile, line ? lineDistance(line) : 100, 1, train.condition)}</b></div>
        </div>
        ${inMaint ? `
          <p class="small muted">Le train est immobilisé. Toute ligne qui l’utilise reste ouverte mais ne produit rien jusqu’à la fin de l’intervention.</p>
        ` : `
          <div class="maintenance-actions">
            ${Object.values(actions).map(action => renderMaintenanceButton(train, model, action)).join('')}
          </div>
        `}
        <div class="actions">
          <button data-action="open-composition" data-id="${train.id}">Composition</button>
          <button class="danger" data-action="sell-train" data-id="${train.id}" ${tooltipAttr(sellTip)} ${line || inMaint ? 'disabled' : ''}>Vendre</button>
        </div>
      </div>
    </div>
  `;
}

function renderMaintenanceButton(train, model, action) {
  const locked = maintenanceActionLockedReason(action);
  const preview = maintenancePreview(train, model, action);
  const targetCondition = Math.max(train.condition, Math.min(action.target || 0.99, train.condition + action.restore));
  const disabled = locked || targetCondition <= train.condition + 0.005;
  return `
    <button class="maintenance-btn" data-action="repair-train" data-id="${train.id}" data-mode="${action.id}" ${tooltipAttr(`${action.name}. ${action.description || ''} ${preview}. Effet : Immobilise le train pendant l’intervention, puis remonte son état, sa vitesse effective et sa ponctualité.`)} ${disabled ? 'disabled' : ''}>
      <strong>${escapeHtml(action.name)}</strong>
      <span>${preview}</span>
      ${locked ? `<em>${escapeHtml(locked)}</em>` : ''}
    </button>
  `;
}
