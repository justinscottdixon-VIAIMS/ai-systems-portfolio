// Visual dissolve across the final 15 dB (25% of the displayed scale).
export function greenDissolve(peak, rms) {
 const remaining = Math.max(0, Math.min(1, -Math.max(peak, rms) / 15));
 return remaining * remaining * (3 - 2 * remaining);
}
export function initialMeter() {
 return { levels: [-60,-60], peaks: [-60,-60], holdUntil: [0,0], rmsPeaks: [-60,-60], rmsHoldUntil: [0,0], clipUntil: [0,0], clipped: [false,false], time: null };
}
export function advanceMeter(previous, samples, now, rmsSamples = [0,0]) {
 const next = initialMeter();
 const elapsed = previous.time === null ? 0 : Math.max(0, now - previous.time) / 1000;
 next.time = now;
 for (let c=0;c<2;c++) {
  const sample = Number.isFinite(samples[c]) ? Math.abs(samples[c]) : 0;
  const db = sample > 0 ? Math.max(-60, Math.min(0, 20 * Math.log10(sample))) : -60;
  next.levels[c] = Math.max(db, previous.levels[c] - elapsed * 15);
  next.holdUntil[c] = db >= previous.peaks[c] ? now + 1000 : previous.holdUntil[c];
  const peakFall = Math.max(0, now - Math.max(previous.time ?? now, previous.holdUntil[c])) / 1000 * 6;
  next.peaks[c] = Math.max(db, previous.peaks[c] - peakFall, -60);
  const rmsSample = Number.isFinite(rmsSamples[c]) ? Math.abs(rmsSamples[c]) : 0;
  const rmsDb = rmsSample > 0 ? Math.max(-60, Math.min(0, 20 * Math.log10(rmsSample))) : -60;
  next.rmsHoldUntil[c] = rmsDb >= previous.rmsPeaks[c] ? now + 1500 : previous.rmsHoldUntil[c];
  const rmsFall = Math.max(0, now - Math.max(previous.time ?? now, previous.rmsHoldUntil[c])) / 1000 * 4;
  next.rmsPeaks[c] = Math.max(rmsDb, previous.rmsPeaks[c] - rmsFall, -60);
  next.clipUntil[c] = sample >= 1 ? now + 2000 : previous.clipUntil[c];
  next.clipped[c] = now < next.clipUntil[c];
 }
 return next;
}

// Preserve the media controller's mute/volume contract while metering upstream.
export function routeMeterOutput(element, gain, prototype = globalThis.HTMLMediaElement?.prototype) {
 const mute = prototype && Object.getOwnPropertyDescriptor(prototype, 'muted');
 const volume = prototype && Object.getOwnPropertyDescriptor(prototype, 'volume');
 if (!mute || !volume) return;
 let muted = element.muted, level = element.volume;
 const sync = () => { gain.gain.value = muted ? 0 : level; };
 sync();
 Object.defineProperties(element, {
  muted: { configurable:true, get:()=>muted, set(value) { muted=Boolean(value); sync(); element.dispatchEvent(new Event('volumechange')); } },
  volume: { configurable:true, get:()=>level, set(value) { value=Number(value); if(!Number.isFinite(value)||value<0||value>1) throw new RangeError('Volume must be between 0 and 1'); level=value; sync(); element.dispatchEvent(new Event('volumechange')); } },
 });
 mute.set.call(element,false);
 volume.set.call(element,1);
}

export function connectStereoMeters({ root, elements, getSource, onHear, Context = globalThis.AudioContext, Worklet = globalThis.AudioWorkletNode, clock = () => performance.now(), schedule = setInterval, unschedule = clearInterval }) {
 const panel = root.querySelector('.engineering-meters');
 const status = root.querySelector('#meter-status');
 const overlay = root.querySelector('#meter-hear-overlay');
 const nodes = new Map();
 let context, ready, state = initialMeter(), selected = null, selectedSrc = null, lastTime = 0;
 let starting = false, unavailable = false, lastDigits = -Infinity, wasActive = false;
 const db = value => value > 0 ? 20*Math.log10(value) : -Infinity;
 const digits = value => Number.isFinite(value) && value > -60 ? value.toFixed(1) : '−∞';
 const width = value => `${Math.max(0,Math.min(100,(value+60)/60*100))}%`;
 const display = (label, samples = null, now = clock(), measurement = null) => {
  state = samples ? advanceMeter(state, samples, now, measurement?.rms) : initialMeter();
  status.textContent = label;
  panel.dataset.meterStatus = samples ? 'active' : label.includes('UNAVAILABLE') ? 'unavailable' : 'idle';
  const updateDigits = !samples || now-lastDigits >= 66;
  if(updateDigits) lastDigits = samples ? now : -Infinity;
  ['l','r'].forEach((channel,c) => {
   const rms = samples ? db(measurement?.rms?.[c] || 0) : -Infinity;
   root.querySelector(`#meter-${channel}`).value = state.levels[c];
   root.querySelector(`#bar-${channel}`).style.width = width(state.levels[c]);
   root.querySelector(`[data-meter-channel="${c ? 'right' : 'left'}"]`).style.setProperty('--peak-position', width(state.levels[c]));
   root.querySelector(`#rms-bar-${channel}`).style.width = width(rms);
   root.querySelector(`#bar-${channel}`).style.setProperty('--level', width(state.levels[c]));
   root.querySelector(`#rms-bar-${channel}`).style.setProperty('--level', width(rms));
   for (const [kind, value] of [['peak', state.peaks[c]], ['rms', state.rmsPeaks[c]]]) {
    const marker = root.querySelector(`#${kind}-hold-${channel}`);
    marker.style.left = width(value);
    marker.hidden = !samples || value <= -60;
   }
   root.querySelector(`[data-meter-channel="${c ? 'right' : 'left'}"]`).dataset.clipped = String(state.clipped[c]);
   root.querySelector(`[data-meter-channel="${c ? 'right' : 'left'}"]`).style.setProperty('--green-presence', String(samples ? greenDissolve(state.levels[c], rms) : 0));
   if(updateDigits) {
    root.querySelector(`#meter-${channel}-value`).textContent = state.levels[c] <= -60 ? '−∞' : digits(state.levels[c]);
    root.querySelector(`#rms-${channel}-value`).textContent = digits(rms);
   }
  });
  const lufs = samples && Number.isFinite(measurement?.lufs) ? measurement.lufs : -Infinity;
  root.querySelector('#lufs-bar').style.width = width(lufs);
  root.querySelector('#lufs-bar').style.setProperty('--level', width(lufs));
  const loudness=root.querySelector('#lufs-meter');
  loudness.setAttribute('aria-valuenow',String(Math.max(-60,Math.min(0,lufs))));
  loudness.setAttribute('aria-valuetext',measurement?.warming ? 'Warming up, three seconds required' : `${digits(lufs)} LUFS`);
  if(updateDigits) root.querySelector('#lufs-value').textContent = samples && measurement?.warming ? '…' : samples ? digits(lufs) : '—';
 };
 const reset = () => {
  lastDigits=-Infinity;state=initialMeter();
  for(const node of nodes.values()) {
   node.epoch++;node.samples=[0,0];node.received=0;node.measurement=null;
   node.probe.port.postMessage({reset:true,epoch:node.epoch});
  }
 };
 const attach = (element) => {
  if(nodes.has(element)) return;
  const probe = new Worklet(context, 'viaims-stereo-peak', { numberOfInputs:1, numberOfOutputs:1, outputChannelCount:[2], channelCount:2, channelCountMode:'explicit', channelInterpretation:'speakers' });
  // Create all fallible measurement resources before rerouting the native element.
  probe.connect(context.destination);
  let source;
  try { source = context.createMediaElementSource(element); }
  catch(error) { probe.disconnect(); throw error; }
  const output = context.createGain();
  output.gain.value = element.muted ? 0 : element.volume;
  source.connect(output);
  output.connect(context.destination);
  routeMeterOutput(element, output);
  source.connect(probe);
  nodes.set(element, { source, probe, samples:[0,0], received:0, epoch:0, measurement:null });
  probe.port.onmessage = ({data}) => {
   const entry = nodes.get(element);
   if(data.epoch !== entry.epoch) return;
   entry.samples = entry.samples.map((value,c) => Math.max(value, data.peaks[c] || 0)); entry.measurement=data;entry.received = clock();
  };
  probe.onprocessorerror = () => { unavailable = true; };
 };
 const start = async () => {
  if(!Context) { unavailable = true; return; }
  try {
   context ??= new Context();
   const resumed = context.resume(); // Must run directly within the user gesture.
   if(!ready) ready = context.audioWorklet.addModule('/audio/stereo-peak-worklet.js');
   if(starting) { await resumed; return; }
   starting = true;
   await Promise.all([resumed, ready]);
   for(const element of elements) attach(element);
  } catch { unavailable = true; }
  finally { starting = false; }
 };
 const tick = () => {
  const current = getSource();
  const element = current?.element;
  if(element !== selected || element?.currentSrc !== selectedSrc) { state = initialMeter(); selected = element; selectedSrc = element?.currentSrc; lastTime = clock(); reset(); }
  if (overlay) overlay.hidden = !!current?.external || !element || (!element.muted && element.volume > 0);
  const active=!!element && !element.paused && !element.ended;
  if(active !== wasActive) { reset();state=initialMeter();wasActive=active; }
  const entry = nodes.get(element);
  const now = clock();
  if(current?.external) display('METERS UNAVAILABLE · EXTERNAL');
  else if(unavailable || element?.error) display('METERS UNAVAILABLE');
  else if(!element || element.paused || element.ended) { display('METERS IDLE'); lastTime = now; }
  else if(context?.state !== 'running') display('METERS · CLICK TO ENABLE');
  else if(!entry || entry.received <= lastTime || now-entry.received > 250) display('METERS WAITING');
  else { display('PEAK + RMS · dBFS / ST · LUFS', entry.samples, now, entry.measurement); entry.samples = [0,0]; }
  for (const [other, node] of nodes) if(other !== element || element.paused) node.samples = [0,0];
 };
 const hear = async () => { await start(); await onHear?.(getSource()?.element); };
 overlay?.addEventListener?.('click', hear);
 for(const element of elements) element.addEventListener?.('seeking', reset);
 root.addEventListener('pointerdown', start, {capture:true});
 root.addEventListener('keydown', start, {capture:true});
 const timer = schedule(tick, 33);
 display('METERS · CLICK TO ENABLE');
 return { start, dispose() { overlay?.removeEventListener?.('click',hear); unschedule(timer); for(const element of elements) element.removeEventListener?.('seeking', reset); root.removeEventListener('pointerdown',start,true); root.removeEventListener('keydown',start,true); for(const {probe} of nodes.values())probe.port.onmessage=null; } };
}
