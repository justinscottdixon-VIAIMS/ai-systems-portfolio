// A monitor control: never boosts the programme or changes source mute state.
export function monitorGain(position) {
 const value=Number(position);
 if(!Number.isFinite(value)||value<0||value>100) throw new RangeError('Listening volume must be between 0 and 100');
 return (value/100)**2;
}
export function monitorLevelText(position) {
 const gain=monitorGain(position);
 return gain===0 ? '−∞ dB' : `${(20*Math.log10(gain)).toFixed(1).replace('-', '−')} dB`;
}
export function createMonitorVolumeController(elements) {
 let position=100,lastAudible=100;
 const setPosition=value=>{
  const gain=monitorGain(value);position=Number(value);
  if(position>0) lastAudible=position;
  for(const element of elements) element.volume=gain;
  return position;
 };
 return {get position(){return position},setPosition,restore(){return setPosition(lastAudible)}};
}
