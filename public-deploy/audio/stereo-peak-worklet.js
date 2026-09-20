// BS.1770 K weighting. Coefficients specified at 48 kHz; bilinear rate conversion.
function rateFilter(b, a) {
 const x=48000-sampleRate, y=48000+sampleRate;
 const transform=c=>[c[0]*y*y+c[1]*x*y+c[2]*x*x,2*c[0]*x*y+c[1]*(x*x+y*y)+2*c[2]*x*y,c[0]*x*x+c[1]*x*y+c[2]*y*y];
 const aa=transform(a),bb=transform(b);return {b:bb.map(v=>v/aa[0]),a:aa.map(v=>v/aa[0]),z:[0,0]};
}
function filtered(f,x){const y=f.b[0]*x+f.z[0];f.z[0]=f.b[1]*x-f.a[1]*y+f.z[1];f.z[1]=f.b[2]*x-f.a[2]*y;return y;}
class StereoPeakProcessor extends AudioWorkletProcessor {
 constructor(){super();this.epoch=0;this.reset();this.port.onmessage=({data})=>{if(data.reset){this.epoch=data.epoch;this.reset();}};}
 reset(){
  this.peaks=[0,0];this.frames=0;this.count=0;this.index=0;this.rIndex=0;
  this.energy=new Float64Array(Math.round(sampleRate*3));this.sum=0;
  this.rings=[new Float64Array(Math.round(sampleRate*.4)),new Float64Array(Math.round(sampleRate*.4))];this.rSum=[0,0];
  this.filters=[0,1].map(()=>[
   rateFilter([1.53512485958697,-2.69169618940638,1.19839281085285],[1,-1.69065929318241,.73248077421585]),
   rateFilter([1,-2,1],[1,-1.99004745483398,.99007225036621])]);
 }
 process(inputs,outputs){
  for(const out of outputs)for(const ch of out)ch.fill(0); // Silent measurement branch.
  const channels=inputs[0]||[],length=outputs[0]?.[0]?.length||128;
  for(let i=0;i<length;i++){
   let energy=0;
   for(let c=0;c<2;c++){
    const raw=(channels[c]||channels[0])?.[i]||0,x=Number.isFinite(raw)?raw:0;
    this.peaks[c]=Math.max(this.peaks[c],Math.abs(x));
    const square=x*x;this.rSum[c]+=square-this.rings[c][this.rIndex];this.rings[c][this.rIndex]=square;
    const k=filtered(this.filters[c][1],filtered(this.filters[c][0],x));energy+=k*k;
   }
   this.sum+=energy-this.energy[this.index];this.energy[this.index]=energy;
   this.index=(this.index+1)%this.energy.length;this.rIndex=(this.rIndex+1)%this.rings[0].length;this.count++;
  }
  this.frames+=length;
  if(this.frames>=sampleRate/30){
   const mean=Math.max(0,this.sum)/this.energy.length;
   this.port.postMessage({epoch:this.epoch,peaks:this.peaks,rms:this.rSum.map(v=>Math.sqrt(Math.max(0,v)/Math.min(this.count,this.rings[0].length))),lufs:this.count>=this.energy.length&&mean>1e-12?-.691+10*Math.log10(mean):null,warming:this.count<this.energy.length});
   this.peaks=[0,0];this.frames=0;
  }
  return true;
 }
}
registerProcessor('viaims-stereo-peak',StereoPeakProcessor);
