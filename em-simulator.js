
class Antenna {
  constructor(wavelength, amp, phase, dl = 0.12) {
    this.wavelength = wavelength;
    this.amp = amp;
    this.phase = phase;
    this.I0 = ComplexNum.cis(phase).product(amp);
    this.dl = dl;
    this.segments = [];
    this.currentSegments = [];
    this.segmentLengths = new Float64Array(0);
    this.segFlags = [];

  }

  getWavelength() {
    return this.wavelength;
  }

  getAmp() {
    return this.amp;
  }

  getPhase() {
    return this.phase;
  }

  getI0() {
    return this.I0;
  }

  getWirePoints() {
    return this.wirePoints;
  }

  getSegments() {
    return this.segments;
  }

  getCurrentSegments() {
    return this.currentSegments;
  }

  // Stable, normalized source data. Every rebuild replaces these arrays so that
  // geometry/current-profile edits invalidate the basis cache. Drive edits do not.
  // currentSegments[n] = Float64Array([JxRe, JyRe, JxIm, JyIm]).
  // segmentLengths is the integration weight; for a point current moment it is 1.
  getCurrentElements() {
    return {positions: this.segments, currents: this.currentSegments, lengths: this.segmentLengths};
  }

  getProperties() {
    return [
      {key:'amp', label:'Current amplitude', min:0, max:maxAmp, step:0.1, get:()=>this.amp, set:v=>this.setAmp(v)},
      {key:'phase', label:'Phase (°)', min:0, max:360, step:1, get:()=>this.phase*180/Math.PI, set:v=>this.setPhase(v*Math.PI/180)}
    ];
  }
  getReadouts() { return []; }
  getNotes() { return []; }
  getDisplayEdges() { return []; }
  getHitEdges() { return this.getDisplayEdges(); }
  getSelectionPoints() { return []; }

  getSegFlags() {
    return this.segFlags;
  }

  getDl() {
    return this.dl;
  }

  setWavelength(new_wavelength) {
    this.wavelength = new_wavelength;
  }

  setAmp(amp) {
    this.amp = amp;
    this.I0 = ComplexNum.cis(this.phase).product(amp);
  }

  setPhase(phase) {
    this.phase = phase;
    this.I0 = ComplexNum.cis(phase).product(this.amp);
  }

  setDl(dl) {
    this.dl = dl;
  }


}

////

// Point current element: amp means |I*l|, not current through the display glyph.
// Weight 1 keeps this moment independent of wire discretization and zoom.
class HertzianDipole extends Antenna {
  constructor(wavelength,position,angle=0,moment=1,phase=0) {
    super(wavelength,moment,phase);
    this.position=[...position]; this.angle=angle;
    this.setCurrentSegments();
  }
  setCurrentSegments() {
    this.segments=[[...this.position]];
    this.currentSegments=[new Float64Array([Math.cos(this.angle),Math.sin(this.angle),0,0])];
    this.segmentLengths=new Float64Array([1]); this.segFlags=[true];
  }
  setAngle(angle) { this.angle=angle; this.setCurrentSegments(); }
  getProperties() {
    const props=super.getProperties(); props[0].label='Current moment |Iℓ|'; props[0].step=.01;
    return [...props,{key:'angle',label:'Orientation (°)',min:0,max:360,step:1,
      get:()=>((this.angle*180/Math.PI)%360+360)%360,set:v=>this.setAngle(v*Math.PI/180)}];
  }
  getReadouts() { return [['Source','Point current element'],['Orientation','From +x, counterclockwise']]; }
  getNotes() { return []; }
  getDisplayEdges() {
    const p=screenPoint(this.position),dx=Math.cos(this.angle),dy=-Math.sin(this.angle);
    const start=[p[0]-18*dx,p[1]-18*dy],end=[p[0]+18*dx,p[1]+18*dy];
    return [
      {a:start,b:end,current:0,width:4},
      {a:[start[0]-4*dy,start[1]+4*dx],b:[start[0]+4*dy,start[1]-4*dx],current:0,width:3,currentDirection:false},
      {a:[end[0]-4*dy,end[1]+4*dx],b:[end[0]+4*dy,end[1]-4*dx],current:0,width:3,currentDirection:false}];
  }
  getSelectionPoints() { return [screenPoint(this.position)]; }
}

// Closed circular wire in the XY plane. Midpoint quadrature uses exact arc
// weights R*dphi, no duplicate endpoint and no feed gap. Positive current is CCW.
// At least 64 samples are used even when the entire loop is smaller than dl.
class SmallLoop extends Antenna {
  constructor(wavelength,center,radius,amp=10,phase=0) {
    super(wavelength,amp,phase);
    this.center=[...center]; this.radius=radius;
    this.setCurrentSegments();
  }
  setCurrentSegments() {
    const circumference=2*Math.PI*this.radius;
    const count=Math.max(64,Math.ceil(circumference/this.dl));
    const dphi=2*Math.PI/count;
    this.segments=[]; this.currentSegments=[]; this.segFlags=[];
    this.segmentLengths=new Float64Array(count).fill(circumference/count);
    for(let n=0;n<count;n++) {
      const phi=(n+.5)*dphi;
      this.segments.push([this.center[0]+this.radius*Math.cos(phi),this.center[1]+this.radius*Math.sin(phi)]);
      this.currentSegments.push(new Float64Array([-Math.sin(phi),Math.cos(phi),0,0]));
      this.segFlags.push(true);
    }
  }
  setRadius(radius) { if(!Number.isFinite(radius)||radius<=0) return; this.radius=radius; this.setCurrentSegments(); }
  setDl(dl) { if(this.dl===dl) return; this.dl=dl; this.setCurrentSegments(); }
  getProperties() {
    const props=super.getProperties();
    props[0].max=5000; props[0].scale='log';
    return [...props,{key:'radius',label:'Loop radius',min:.001,max:2,step:.001,get:()=>this.radius,set:v=>this.setRadius(v)}];
  }
  getReadouts() {
    const circumference=2*Math.PI*this.radius;
    return [['Circumference',circumference.toFixed(4)],['Electrical size · C/λ',(circumference/this.wavelength).toFixed(4)],['Magnetic moment |I·area|',(this.amp*Math.PI*this.radius*this.radius).toPrecision(4)],['Current profile','Uniform · positive CCW']];
  }
  getNotes() {
    const notes=[{text:'Current slider uses a logarithmic scale from 0 to 5,000. Small loops may need much higher current for a visible field; the numeric value is the actual source current.'},{text:'Loop lies in the XY plane (normal +z). Current is prescribed uniformly around the closed wire; there is no feed gap.'}];
    if(2*Math.PI*this.radius/this.wavelength>.1+1e-12) notes.push({warning:true,text:'C/λ exceeds 0.1. The uniform current is still prescribed, but is outside the small-loop approximation; no real feed response is being solved.'});
    if(this.radius*Scale*zoom<14) notes.push({text:'The ring symbol is enlarged for visibility. Only the radius value sets the field geometry.'});
    if(this.radius<Math.max(.1,sLength/Scale)) notes.push({text:'This loop is smaller than the smoothing/grid scale. Its near-source field is approximate; inspect the field away from the ring.'});
    return notes;
  }
  getDisplayEdges() {
    const p=screenPoint(this.center),r=Math.max(14,this.radius*Scale*zoom),edges=[];
    for(let n=0;n<64;n++) {
      const a=n*2*Math.PI/64,b=(n+1)*2*Math.PI/64;
      edges.push({a:[p[0]+r*Math.cos(a),p[1]-r*Math.sin(a)],b:[p[0]+r*Math.cos(b),p[1]-r*Math.sin(b)],current:Math.min(this.currentSegments.length-1,Math.floor(n*this.currentSegments.length/64)),width:3});
    }
    return edges;
  }
  getSelectionPoints() {
    const p=screenPoint(this.center),r=Math.max(14,this.radius*Scale*zoom);
    return [[p[0]+r,p[1]],[p[0]-r,p[1]]];
  }
}

const ARRAY_DEFAULT_AMPLITUDE = {
  hertzian: 10,
  smallLoop: 200
};

// One scene component; unit-drive currents contain the progressive phase.
// Global amplitude/phase remain in I0, preserving cheap drive-only cache reuse.
class LinearArray extends Antenna {
  constructor(wavelength,center,axisAngle=0) {
    super(wavelength, ARRAY_DEFAULT_AMPLITUDE.hertzian, 0);
    this.center=[...center]; this.axisAngle=axisAngle;
    this.elementType='hertzian'; this.elementAngle=Math.PI/2;
    this.count=6; this.spacingLambda=.2; this.phaseStep=0;
    this.radiusLambda=.08/(2*Math.PI);
    this.setCurrentSegments();
  }
  setCurrentSegments() {
    this.segments=[]; this.currentSegments=[]; this.segFlags=[];
    this.elements=[]; this.elementOffsets=[];
    const lengths=[],d=this.spacingLambda*this.wavelength;
    for(let n=0;n<this.count;n++) {
      const offset=(n-(this.count-1)/2)*d;
      const position=[this.center[0]+offset*Math.cos(this.axisAngle),this.center[1]+offset*Math.sin(this.axisAngle)];
      const element=this.elementType==='hertzian'
        ? new HertzianDipole(this.wavelength,position,this.elementAngle,1,0)
        : new SmallLoop(this.wavelength,position,this.radiusLambda*this.wavelength,1,0);
      element.setDl(this.dl);
      this.elementOffsets.push(this.segments.length); this.elements.push(element);
      const re=Math.cos(n*this.phaseStep),im=Math.sin(n*this.phaseStep);
      for(let j=0;j<element.segments.length;j++) {
        const v=element.currentSegments[j];
        this.segments.push(element.segments[j]);
        this.currentSegments.push(new Float64Array([v[0]*re-v[2]*im,v[1]*re-v[3]*im,v[0]*im+v[2]*re,v[1]*im+v[3]*re]));
        lengths.push(element.segmentLengths[j]); this.segFlags.push(true);
      }
    }
    this.segmentLengths=new Float64Array(lengths);
  }
  setAxisAngle(v) { this.axisAngle=v; this.setCurrentSegments(); }
  setDl(v) { if(this.dl===v) return; this.dl=v; this.setCurrentSegments(); }
  setWavelength(v) { if(this.wavelength===v) return; this.wavelength=v; this.setCurrentSegments(); }
  getProperties() {
    const degrees=v=>((v*180/Math.PI)%360+360)%360;
    const edit=(key,label,min,max,step,get,set)=>({key,label,min,max,step,get,set});
    const rebuild=(key,value)=>{this[key]=value;this.setCurrentSegments();};
    const drive=super.getProperties();
    drive[0].label=this.elementType==='hertzian'?'Global moment |Iℓ| / element':'Global current / element';
    drive[0].max=this.elementType==='hertzian'?maxAmp:1000;
    if(this.elementType==='smallLoop') drive[0].scale='log';
    drive[1].label='Global phase · element 0 (°)';
    const props=[{key:'elementType',label:'Element type',options:[['hertzian','Hertzian dipole'],['smallLoop','Small circular loop']],get:()=>this.elementType,set:v=>{
  this.setAmp(ARRAY_DEFAULT_AMPLITUDE[v]);
  rebuild('elementType',v);
}},
      ...drive,
      edit('count','Number of elements',1,32,1,()=>this.count,v=>rebuild('count',Math.round(v))),
      edit('spacing','Spacing (λ)',.01,2,.01,()=>this.spacingLambda,v=>rebuild('spacingLambda',v)),
      edit('phaseStep','Phase step (°)',-180,180,1,()=>this.phaseStep*180/Math.PI,v=>rebuild('phaseStep',v*Math.PI/180)),
      edit('axis','Array axis (°)',0,360,1,()=>degrees(this.axisAngle),v=>this.setAxisAngle(v*Math.PI/180))];
    if(this.elementType==='hertzian') props.push(edit('elementAngle','Dipole orientation (°)',0,360,1,()=>degrees(this.elementAngle),v=>rebuild('elementAngle',v*Math.PI/180)));
    else props.push(edit('loopRadius','Loop radius (λ)',.001,.1,.001,()=>this.radiusLambda,v=>rebuild('radiusLambda',v)));
    return props;
  }
  getReadouts() { return [['Spacing · simulation units',(this.spacingLambda*this.wavelength).toFixed(4)],['Array span · λ',((this.count-1)*this.spacingLambda).toFixed(3)]]; }
  getNotes() {
    const notes=[{text:'Click the center, then set the array axis. Drag the green axis handle to rotate a selected array. Element 0 is at the negative end of the axis.'},
      {text:'Active excitations are prescribed; coupling does not alter their currents. Passive PEC wires respond to their total field. More elements increase computation time.'}];
    if(this.elementType==='smallLoop') {
      notes.push({text:'All loops lie in XY with normal +z, as in the standalone loop model. Ring symbols may be enlarged for visibility.'});
      if(2*Math.PI*this.radiusLambda>.1+1e-12) notes.push({warning:true,text:'C/λ exceeds 0.1: outside the small-loop approximation.'});
      if(this.spacingLambda<2*this.radiusLambda) notes.push({warning:true,text:'Adjacent physical loops overlap at this spacing.'});
    }
    return notes;
  }
  getDisplayEdges() {
    return this.elements.flatMap((element,n)=>element.getDisplayEdges().map(edge=>({...edge,current:edge.current+this.elementOffsets[n]})));
  }
  getAxisHandle() {
    const p=screenPoint(this.center),r=Math.max(50,(this.count-1)*this.spacingLambda*this.wavelength*Scale*zoom/2+30);
    return [p[0]+r*Math.cos(this.axisAngle),p[1]-r*Math.sin(this.axisAngle)];
  }
  getSelectionPoints() { return [screenPoint(this.center),this.getAxisHandle()]; }
}


// Passive triangular axial-current model. Positive current points A -> B.
// Cylindrical self kernel; reciprocal Galerkin mutual interactions.
class PassiveWire extends Antenna {
  constructor(wavelength,a,b) {
    super(wavelength,1,0);
    this.endPointA=[...a]; this.endPointB=[...b];
    this.length=length2D(a,b); this.radius=.06; this.targetLength=pecMaxSegmentLength;
    this.tangent=[(b[0]-a[0])/this.length,(b[1]-a[1])/this.length];
    this.rebuild();
  }
  setDl() {} // Display quality must not change the passive discretization.
  rebuild() {
    this.length=length2D(this.endPointA,this.endPointB);
    if(!(this.length>1e-9))throw Error('Passive wire must have nonzero length');
    this.tangent=this.endPointA.map((v,i)=>(this.endPointB[i]-v)/this.length);
    const multiple=this.meshMultiple||1;
    this.meshCount=multiple*Math.ceil(Math.max(2,this.length/this.targetLength)/multiple);
    this.meshLength=this.length/this.meshCount;
    // Composite Gauss quadrature resolves the regularized kernel on the radius
    // scale. These integration samples are NOT independent current unknowns.
    const subdivisions=Math.max(1,Math.ceil(this.meshLength/this.radius));
    this.samples=[];
    for(let e=0;e<this.meshCount;e++)for(let p=0;p<subdivisions;p++)for(let q=0;q<4;q++) {
      const u=(p+(1+WIRE_GAUSS_NODES[q])/2)/subdivisions;
      this.samples.push({p:this.point((e+u)/this.meshCount),e,u,
        weight:this.meshLength*WIRE_GAUSS_WEIGHTS[q]/(2*subdivisions)});
    }
    this.segments=this.samples.map(q=>q.p);
    this.segmentLengths=Float64Array.from(this.samples,q=>q.weight);
    this.nodeCurrents=Array.from({length:this.meshCount+1},()=>new Float64Array(4));
    this.refreshCurrents();
  }
  currentAt(e,u) {
    return this.nodeCurrents[e].map((v,d)=>(1-u)*v+u*this.nodeCurrents[e+1][d]);
  }
  refreshCurrents() {
    this.currentSegments=this.samples.map(q=>this.currentAt(q.e,q.u));
    this.displayCurrents=Array.from({length:4*this.meshCount},(_,i)=>this.currentAt(Math.floor(i/4),(i%4+.5)/4));
  }
  point(f) { return this.endPointA.map((v,i)=>v+f*(this.endPointB[i]-v)); }
  getProperties() { return [
    {key:'radius',label:'Wire radius',min:.008,max:.1,step:.002,get:()=>this.radius,set:v=>{this.radius=v;this.rebuild();}}
  ]; }
  getReadouts() { return [['Length',this.length.toFixed(3)],['Segments',String(this.meshCount)],['Unknowns',String(this.meshCount-1)],
    ['Peak current',Math.max(...this.nodeCurrents.map(v=>Math.hypot(...v))).toPrecision(4)]]; }
  getNotes() {
    const notes=[
      {text:'Separate wires must not overlap or touch; electrical junctions and end caps are not modeled.'}];
    if(this.meshLength/this.wavelength>.1) notes.push({warning:true,text:'Segments exceed λ/10. Reduce the shared maximum segment length in Advanced.'});
    if(this.radius>this.length/10 || this.radius>this.wavelength/20) notes.push({warning:true,text:'Wire is not thin relative to its length or wavelength; the axial-current approximation may be inaccurate.'});
    if(passiveSolveInfo.error) notes.push({warning:true,text:passiveSolveInfo.message});
    return notes;
  }
  getDisplayEdges() { return this.displayCurrents.map((_,i)=>({a:screenPoint(this.point(i/this.displayCurrents.length)),b:screenPoint(this.point((i+1)/this.displayCurrents.length)),current:i,width:Math.max(3,2*this.radius*Scale*zoom)})); }
  getHitEdges() { return [{a:screenPoint(this.endPointA),b:screenPoint(this.endPointB),width:6}]; }
  getSelectionPoints() { return [screenPoint(this.endPointA),screenPoint(this.endPointB)]; }
}


// Voltage-fed thin PEC rod. I0 remains unity: solved currents already include
// ALL incident fields and feed phases. amp/phase describe the peak gap voltage.
class Dipole extends PassiveWire {
  constructor(wavelength,a,b,amp=DEFAULT_WIRE_FEED_VOLTAGE,phase=0) {
    super(wavelength,a,b);
    this.amp=amp; this.phase=phase; this.I0=new ComplexNum(1,0);
    this.feedFraction=.5; this.meshMultiple=2;
    this.radius=.06; this.targetLength=pecMaxSegmentLength;
    this.feedMode='voltage';this.openVoltage=[0,0];
    this.sep=Math.min(.02,this.maxFeedSeparation());
    this.rebuild();
  }
  setAmp(v){this.amp=v;}
  setPhase(v){this.phase=v;}
  maxFeedSeparation(){return Math.max(0,Math.min(.1,.02*this.wavelength,.05*this.length,.5*this.length*Math.min(this.feedFraction,1-this.feedFraction)));}
  feedSeparation(){return Math.min(this.sep||0,this.maxFeedSeparation());}
  setSep(v){this.sep=Math.max(0,Math.min(v,this.maxFeedSeparation()));}
  setWavelength(v){this.wavelength=v;this.setSep(this.sep);}
  // Uniform impressed E=V/g across a narrow feed interval. Galerkin weights
  // are exact integrals of the current hats; the conjugate port current uses
  // the SAME weights, preserving P=Re(V I*)/2. g=0 is the delta-gap limit.
  feedWeights(){
    const weights=new Float64Array(this.meshCount-1),g=this.feedSeparation(),h=this.meshLength,f=this.feedFraction*this.length;
    if(g<1e-12){weights[this.feedNode()-1]=1;return weights;}
    const lo=f-g/2,hi=f+g/2;
    for(let i=1;i<this.meshCount;i++){
      const x=i*h;
      let a=Math.max(lo,x-h),b=Math.min(hi,x),area=0;
      if(b>a)area+=((b-x+h)**2-(a-x+h)**2)/(2*h);
      a=Math.max(lo,x);b=Math.min(hi,x+h);
      if(b>a)area+=((x+h-a)**2-(x+h-b)**2)/(2*h);
      weights[i-1]=Math.max(0,area/g);
    }
    return weights;
  }
  feedNode(){return Math.round(this.feedFraction*this.meshCount);}
  setFeedMode(mode){this.feedMode=mode==='open'?'open':'voltage';this.openVoltage=[0,0];}
  feedVoltage(){return this.feedMode==='open'?this.openVoltage:[this.amp*Math.cos(this.phase),this.amp*Math.sin(this.phase)];}
  feedCurrent(){const weights=this.feedWeights(),out=[0,0];for(let j=0;j<weights.length;j++){const v=this.nodeCurrents[j+1],w=weights[j];out[0]+=w*(v[0]*this.tangent[0]+v[1]*this.tangent[1]);out[1]+=w*(v[2]*this.tangent[0]+v[3]*this.tangent[1]);}return out;}
  getDisplayEdges(){
    const count=this.displayCurrents.length,g=this.feedSeparation()/this.length,lo=this.feedFraction-g/2,hi=this.feedFraction+g/2,edges=[];
    const add=(a,b,i)=>{if(b>a)edges.push({a:screenPoint(this.point(a)),b:screenPoint(this.point(b)),current:i,width:Math.max(3,2*this.radius*Scale*zoom)});};
    for(let i=0;i<count;i++){const a=i/count,b=(i+1)/count;add(a,Math.min(b,lo),i);add(Math.max(a,hi),b,i);}
    return edges;
  }
  getProperties(){return [
    {key:'feedMode',label:'Feed termination',options:[['voltage','Voltage source'],['open','Open circuit']],get:()=>this.feedMode,set:v=>this.setFeedMode(v)},
    ...(this.feedMode==='open'?[]:[
    {key:'amp',label:'Feed voltage · peak',min:0,max:500,step:.1,scale:'log',get:()=>this.amp,set:v=>this.setAmp(v)},
    {key:'phase',label:'Voltage phase (°)',min:0,max:360,step:1,get:()=>this.phase*180/Math.PI,set:v=>this.setPhase(v*Math.PI/180)}]),
    {key:'gap',label:'Feed separation',min:0,max:this.maxFeedSeparation(),step:.001,get:()=>this.feedSeparation(),set:v=>this.setSep(v)},
    ...super.getProperties().map(p=>p.key==='radius'?{...p,min:.002,step:.001}:p)
  ];}
  getReadouts(){const i=this.feedCurrent();return [
    ['Feed',this instanceof EndFedAntenna?'End feed with short counterpoise':'Balanced centre feed'],
    ['Length / wavelength · L/λ',(this.length/this.wavelength).toFixed(4)],
    ['Feed separation',this.feedSeparation().toFixed(4)],
    ...(this.feedMode==='open'?[
      ['Induced feed voltage · peak',fieldTiles.dirtyPhysics||passiveSolveInfo.error?'Updating…':Math.hypot(...this.openVoltage).toPrecision(5)],
      ['Induced voltage phase (°)',fieldTiles.dirtyPhysics||passiveSolveInfo.error?'Updating…':(Math.atan2(this.openVoltage[1],this.openVoltage[0])*180/Math.PI).toFixed(1)]
    ]:[]),
    ['Feed current · peak',passiveSolveInfo.error?'Unavailable':Math.hypot(...i).toPrecision(4)],
    ['Current phase (°)',passiveSolveInfo.error?'Unavailable':(Math.atan2(i[1],i[0])*180/Math.PI).toFixed(1)],
    ...super.getReadouts()];}
  getNotes(){return [
    ...(this.feedMode==='open'?[{text:'Open-circuit feed: net port current is constrained to zero and the induced terminal voltage is solved from all sources and scattering bodies. It is distinct from setting a voltage source to zero, which shorts the feed.'}]:[{text:'Ideal voltage source across a narrow feed region; zero source impedance. Voltage and current amplitudes are peak phasors in simulation units.'}]),
    {text:'The feed uses a uniform impressed electric field over a short region. An equivalent axial electric current is retained through that region; detailed feed geometry and gap capacitance are not resolved.'},
    ...super.getNotes()];}
}
// A physically closed port requires a return conductor. The short A-side arm
// is explicit and participates in the same solve, rather than an invisible ground.
class EndFedAntenna extends Dipole {
  constructor(wavelength,a,b,amp=DEFAULT_WIRE_FEED_VOLTAGE,phase=0){
    super(wavelength,a,b,amp,phase);this.feedFraction=.05;this.meshMultiple=20;this.rebuild();
  }
  getProperties(){return [...super.getProperties(),
    {key:'counterpoise',label:'Counterpoise · % of total length',options:[['5','5%'],['10','10%'],['15','15%'],['20','20%'],['25','25%']],get:()=>String(Math.round(100*this.feedFraction)),set:v=>{this.feedFraction=Number(v)/100;this.rebuild();}}
  ];}
  getReadouts(){return [...super.getReadouts(),['Counterpoise length',(this.length*this.feedFraction).toFixed(4)],['Radiating arm length',(this.length*(1-this.feedFraction)).toFixed(4)]];}
  getNotes(){return [{text:'First endpoint = counterpoise tip; second endpoint = long-arm tip. The feed is at the marked junction. This is an unbalanced two-arm antenna; it does not assume an invisible ground, matching transformer, or coax shield.'},...super.getNotes()];}
}

// The user draws the trace of an INFINITE PEC plane. The plane is perpendicular
// to the XY screen (its normal is in XY), and extends indefinitely in z.
class PECPlane extends Antenna {
  constructor(wavelength,a,b) {
    super(wavelength,0,0);
    this.endPointA=[...a]; this.endPointB=[...b];
    const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);
    if(!(L>.08))throw Error('Choose two distinct points for the PEC plane');
    this.tangent=[dx/L,dy/L];this.normal=[-dy/L,dx/L];
  }
  signedDistance(p){return (p[0]-this.endPointA[0])*this.normal[0]+(p[1]-this.endPointA[1])*this.normal[1];}
  side(p){const d=this.signedDistance(p);return d>0?1:d<0?-1:0;}
  mirrorPoint(p){const d=2*this.signedDistance(p);return [p[0]-d*this.normal[0],p[1]-d*this.normal[1]];}
  // For a PEC electric CURRENT image, Jimage = (2*n*n^T - I)*J.
  mirrorCurrent(v){
    const n=this.normal;
    const a=2*(n[0]*v[0]+n[1]*v[1]),b=2*(n[0]*v[2]+n[1]*v[3]);
    return [a*n[0]-v[0],a*n[1]-v[1],b*n[0]-v[2],b*n[1]-v[3]];
  }
  getProperties(){return [];}
  getReadouts(){return [['Model','Infinite PEC plane'],['Drawn trace length',length2D(this.endPointA,this.endPointB).toFixed(3)],['Plane normal (°)',(Math.atan2(this.normal[1],this.normal[0])*180/Math.PI).toFixed(1)]];}
  getNotes(){return [{text:'The two points define an infinite, zero-thickness perfect electric conductor, perpendicular to the canvas.'},
    {text:'The intact screen uses electric-current images. Finite slots transmit through coupled equivalent magnetic currents; all wires and slots on both sides participate in the solve.'},
    {text:'The displayed arrows on the conductor trace show the induced sheet-current density in the simulation slice. For the mirror-symmetric 3D sources and slots used here it is tangent to the trace, and is computed from the magnetic-field jump across the two sides of the plane.'},
    {warning:true,text:'Sources and passive wires must remain entirely on one side.'}];}
  getHitEdges(){
    const trace=planeScreenTrace(this,16);
    return trace?[{a:trace.slice(0,2),b:trace.slice(2,4),width:16}]:[];
  }
  getSelectionPoints(){return [screenPoint(this.endPointA),screenPoint(this.endPointB)];}
  getDisplayEdges(){return [];}
}
// Finite z-directed narrow slots in the zero-thickness screen. Q=M/c is the
// equivalent magnetic line current on the +normal side, before the image factor
// two. Physical magnetic-current density is NOT an animated electric current.
// A strip of width w uses the thin-strip equivalent cylindrical radius w/4.
// This matches the wire basis/kernel family, not an exact aperture-edge model.
class PECSlot extends Antenna {
  constructor(wavelength,plane,p){
    super(wavelength,1,0);this.plane=plane;
    this.along=(p[0]-plane.endPointA[0])*plane.tangent[0]+(p[1]-plane.endPointA[1])*plane.tangent[1];
    this.slotWidth=Math.min(.12,.04*wavelength);this.length=.45*wavelength;this.targetLength=pecMaxSegmentLength;this.rebuild();
  }
  center(){return this.plane.endPointA.map((v,i)=>v+this.along*this.plane.tangent[i]);}
  rebuild(){
    this.radius=this.slotWidth/4;
    this.proxy=new PassiveWire(this.wavelength,[this.along,-this.length/2],[this.along,this.length/2]);
    this.proxy.radius=this.radius;this.proxy.targetLength=this.targetLength;this.proxy.rebuild();
    this.meshCount=this.proxy.meshCount;this.meshLength=this.proxy.meshLength;
    this.farSamples=null;this.coefficients=Array.from({length:this.meshCount+1},()=>[0,0]);
    this.segments=[];this.segmentLengths=new Float64Array(0);this.currentSegments=[];
    this.refreshMagnetic();
  }
  setDl(){}
  setWavelength(v){this.wavelength=v;if(this.proxy)this.proxy.wavelength=v;this.farSamples=null;}
  refreshMagnetic(){
    const p=this.center();
    this.magnetic=this.proxy.samples.map(q=>{
      const a=this.coefficients[q.e],b=this.coefficients[q.e+1];
      return [p[0],p[1],q.p[1],q.weight*((1-q.u)*a[0]+q.u*b[0]),q.weight*((1-q.u)*a[1]+q.u*b[1]),this.radius];
    });
  }
  getProperties(){return [
    {key:'slotLength',label:'Slot length · perpendicular to screen',min:.2,max:12,step:.02,get:()=>this.length,set:v=>{this.length=v;this.rebuild();}},
    {key:'slotWidth',label:'Slot width · along plane trace',min:.016,max:.4,step:.004,get:()=>this.slotWidth,set:v=>{this.slotWidth=v;this.rebuild();}},
    {key:'slotAlong',label:'Position along plane',min:-30,max:30,step:.05,get:()=>this.along,set:v=>{this.along=v;this.rebuild();}}
  ];}
  getReadouts(){return [['Length / λ',(this.length/this.wavelength).toFixed(4)],['Width',this.slotWidth.toFixed(3)],['Unknowns',String(this.meshCount-1)],['Model',' Narrow-slot dual MoM · approximate']];}
  getNotes(){return [
    {text:'Finite slot centered on z=0; its long axis points out of the screen. The slanted opening is an illustrative projection.'},
    {text:'Triangular axial basis and cylindrical self kernel, with equivalent radius width/4. All slots and wires on both sides are solved together.'},
    {warning:true,text:'Thin-slot approximation: fields within about one slot width of the aperture and sharp edges are not quantitatively resolved. Use width much smaller than length and wavelength. The screen has zero physical thickness.'},
    ...(this.slotWidth>this.length/10||this.slotWidth>this.wavelength/20?[{warning:true,text:'This slot is too wide for the narrow-slot approximation; reduce width.'}]:[]),
    ...(passiveSolveInfo.error?[{warning:true,text:passiveSolveInfo.message}]:[])
  ];}
  getHitEdges(){const g=slotGlyph(this);return [{a:g.a,b:g.b,width:g.w}];}
  getSelectionPoints(){return [screenPoint(this.center())];}
}
function currentPECSlots(){return antennas.filter(a=>a instanceof PECSlot);}
function slotModelKey(){return currentPECSlots().map(s=>[s.along,s.length,s.slotWidth,s.meshCount]);}
function slotAtTrace(plane,x,y,padding=0){
  const along=(x-plane.endPointA[0])*plane.tangent[0]+(y-plane.endPointA[1])*plane.tangent[1];
  return antennas.some(s=>s instanceof PECSlot&&s.plane===plane&&Math.abs(along-s.along)<s.slotWidth/2+padding);
}
function slotGeometryError(plane,components){
  const slots=components.filter(s=>s instanceof PECSlot);
  for(let i=0;i<slots.length;i++){
    const s=slots[i];if(!plane||s.plane!==plane)return 'A slot must belong to the existing PEC plane';
    if(s.length<4*s.slotWidth)return 'Slot length must be at least four times its width';
    for(let j=0;j<i;j++)if(Math.abs(s.along-slots[j].along)<=(s.slotWidth+slots[j].slotWidth)/2)return 'Slots overlap or touch; separate their openings';
  }
  return null;
}
// Dual electric-current kernel for a z-directed magnetic source. Same exp(+iwt)
// convention and reduced-radius field kernel as electric display elements.
function addSlotElementField(out,x,y,e,side,z=0){
  const dx=x-e[0],dy=y-e[1],dz=z-e[2],g=greenData(dx,dy,e[5],dz),qre=2*side*e[3],qim=2*side*e[4];
  const hr=g[2]*qre-g[3]*qim,hi=g[2]*qim+g[3]*qre;
  out[0]-=c*dy*hr;out[1]-=c*dy*hi;out[2]+=c*dx*hr;out[3]+=c*dx*hi;
  const tr=g[0]+(g[2]+g[4]*dz*dz)/(k*k),ti=g[1]+(g[3]+g[5]*dz*dz)/(k*k),w=2*Math.PI*freq/c;
  out[4]+=w*(tr*qim+ti*qre);out[5]-=w*(tr*qre-ti*qim);
}
function addAllSlotFields(out,x,y,side,z=0){for(const s of currentPECSlots())for(const e of s.magnetic)addSlotElementField(out,x,y,e,side,z);}
// Mixed electric/magnetic reaction: test the full curl kernel, not the electric
// EFIE Hessian. A reduced radius is consistent with the excitation/display path.
// Reciprocity supplies the transpose block with the slot row scaled by -c.
function momWireSlotBlock(w,s){
  const a=momTestSamples(w,Math.min(w.meshLength,c/freq/12),4),b=momTestSamples(s.proxy,Math.min(s.meshLength,c/freq/12),4);
  const n=w.meshCount-1,m=s.meshCount-1,re=new Float64Array(n*m),im=new Float64Array(n*m),center=s.center(),side=s.plane.side(w.endPointA);
  for(const x of a)for(const y of b){
    const dx=x.p[0]-center[0],dy=x.p[1]-center[1],g=greenData(dx,dy,Math.hypot(w.radius,s.radius),y.p[1]);
    const v=2*side*c*(-dy*w.tangent[0]+dx*w.tangent[1])*x.weight*y.weight;
    for(const [i,fi] of x.hats)for(const [j,fj] of y.hats){const q=i*m+j;re[q]+=v*fi*fj*g[2];im[q]+=v*fi*fj*g[3];}
  }
  return {rows:n,cols:m,re,im};
}
function momAssemble(wires){
  const base=momAssembleWires(wires),slots=currentPECSlots();if(!slots.length)return base;
  let n=base.n;for(const s of slots){s.solveOffset=n;n+=s.meshCount-1;}
  if(n>MAX_PASSIVE_UNKNOWNS)throw Error('Limit '+MAX_PASSIVE_UNKNOWNS+' coupled wire/slot unknowns; increase segment length');
  const ar=new Float64Array(n*n),ai=new Float64Array(n*n);
  for(let i=0;i<base.n;i++)for(let j=0;j<base.n;j++){ar[i*n+j]=base.ar[i*base.n+j];ai[i*n+j]=base.ai[i*base.n+j];}
  function insert(block,a,b,factor){for(let i=0;i<block.rows;i++)for(let j=0;j<block.cols;j++){
    const q=i*block.cols+j,row=a.solveOffset+i,col=b.solveOffset+j;
    ar[row*n+col]=factor*block.re[q];ai[row*n+col]=factor*block.im[q];
    if(a!==b){ar[col*n+row]=ar[row*n+col];ai[col*n+row]=ai[row*n+col];}
  }}
  // H+ - H- = 0, multiplied by -c. Two half-spaces, each with image factor 2.
  for(let a=0;a<slots.length;a++)for(let b=a;b<slots.length;b++)insert(a===b?momSelfBlock(slots[a].proxy):momMutualBlock(slots[a].proxy,slots[b].proxy),slots[a],slots[b],-4);
  for(const w of wires)for(const s of slots)insert(momWireSlotBlock(w,s),w,s,1);
  return {ar,ai,n};
}
function momExcitation(wires){
  const base=momExcitationWires(wires),slots=currentPECSlots();if(!slots.length)return base;
  const n=base.br.length+slots.reduce((v,s)=>v+s.meshCount-1,0),br=new Float64Array(n),bi=new Float64Array(n);br.set(base.br);bi.set(base.bi);
  const active=antennas.filter(a=>!(a instanceof PassiveWire)&&!(a instanceof PECPlane)&&!(a instanceof PECSlot));
  for(const s of slots){const p=s.center();for(const q of momTestSamples(s.proxy,Math.min(s.meshLength,c/freq/12),8)){
    let rr=0,ii=0;
    for(const a of active)for(let j=0;j<a.segments.length;j++){
      const src=a.segments[j],v=a.currentSegments[j],d=a.I0,L=a.segmentLengths[j],dx=p[0]-src[0],dy=p[1]-src[1],g=greenData(dx,dy,sourceRadius(a),q.p[1]);
      const jr=L*(v[0]*d.a-v[2]*d.b),ji=L*(v[0]*d.b+v[2]*d.a),yr=L*(v[1]*d.a-v[3]*d.b),yi=L*(v[1]*d.b+v[3]*d.a);
      const cr=dx*yr-dy*jr,ci=dx*yi-dy*ji,factor=2*c*s.plane.side(src);
      rr+=factor*(g[2]*cr-g[3]*ci);ii+=factor*(g[2]*ci+g[3]*cr);
    }
    for(const [i,f] of q.hats){br[s.solveOffset+i]+=q.weight*f*rr;bi[s.solveOffset+i]+=q.weight*f*ii;}
  }}
  return {br,bi};
}

function currentPECPlane(){return antennas.find(a=>a instanceof PECPlane)||null;}
function planeGeometryError(plane,components){
  const slotError=slotGeometryError(plane,components);if(slotError)return slotError;
  if(!plane)return null;
  for(const a of components){
    if(a instanceof PECPlane||a instanceof PECSlot)continue;
    let points=[],clearance=1e-5;
    if(a instanceof PassiveWire){points=[a.endPointA,a.endPointB];clearance=a.radius*1.001;}
    else if(a instanceof Dipole){points=[a.endPointA,a.endPointB];}
    else if(a instanceof HertzianDipole){points=[a.position];}
    else if(a instanceof SmallLoop){points=[a.center];clearance=a.radius+1e-5;}
    else if(a instanceof LinearArray){
      // Array elements are physically separate: elements on both sides are OK,
      // provided none of the actual dipoles/loops intersects the plane.
      if(a.elementType==='smallLoop'){
        for(const element of a.elements){
          if(Math.abs(plane.signedDistance(element.center))<=element.radius+1e-5)
            return (a.label||'Array')+' contains a loop intersecting the PEC plane';
        }
      }else for(const p of a.segments)if(Math.abs(plane.signedDistance(p))<=1e-5)
        return (a.label||'Array')+' contains a dipole on the PEC plane';
      continue;
    }else points=a.segments||[];
    if(!points.length)continue;
    const distances=points.map(p=>plane.signedDistance(p)),min=Math.min(...distances),max=Math.max(...distances);
    if(min<=clearance&&max>=-clearance)return (a.label||'Component')+' intersects or touches the PEC plane';
  }
  return null;
}
// A mirror wire has mirrored GEOMETRY tangent. Electric current image differs by
// an overall minus sign from that mirrored tangent (handled by assembly below).
const mirroredWireCache=new WeakMap();
function momMirroredWire(w,plane){
  const key=JSON.stringify([momWireKey(w),plane.endPointA,plane.endPointB,w.targetLength]);
  const cached=mirroredWireCache.get(w);
  if(cached&&cached.key===key)return cached.wire;
  const mirror=new PassiveWire(w.wavelength,plane.mirrorPoint(w.endPointA),plane.mirrorPoint(w.endPointB));
  mirror.radius=w.radius;mirror.targetLength=w.targetLength;mirror.meshMultiple=w.meshMultiple;mirror.rebuild();
  mirroredWireCache.set(w,{key,wire:mirror});
  return mirror;
}

const WIRE_GAUSS_NODES=[-.8611363115940526,-.3399810435848563,.3399810435848563,.8611363115940526];
const WIRE_GAUSS_WEIGHTS=[.3478548451374538,.6521451548625461,.6521451548625461,.3478548451374538];
const MAX_PASSIVE_UNKNOWNS=320;
let passiveSolveInfo={message:'No passive wires',error:false};
let passiveSignature=null;
// exp(+iωt); A = (I dl) G. Original normalized units omit μ/(4π).
// G=exp(-ikR)/R, R=sqrt(dx²+dy²+a²). Display and active-excitation kernel; passive MoM uses the cylindrical kernel below.
// E=-iω(A + grad(div A)/k²), B=curl A; ω=ck.
function greenData(dx,dy,a,z=0) {
  const R=Math.hypot(dx,dy,a,z), inv=1/R, kr=k*R;
  const gr=Math.cos(kr)*inv, gi=-Math.sin(kr)*inv;
  // grad G = h*r; Hess G = h*identity + q*r*r.
  const hr=-gr*inv*inv+k*gi*inv, hi=-gi*inv*inv-k*gr*inv;
  const qr=(3*inv*inv-k*k)*gr*inv*inv-3*k*gi*inv*inv*inv;
  const qi=(3*inv*inv-k*k)*gi*inv*inv+3*k*gr*inv*inv*inv;
  return [gr,gi,hr,hi,qr,qi];
}
function sourceRadius(a) { return a instanceof PassiveWire?a.radius:.1; }
function addElementField(out,x,y,p,j,a) {
  const dx=x-p[0],dy=y-p[1],g=greenData(dx,dy,a), kk=k*k, omega=2*Math.PI*freq;
  const dr=dx*j[0]+dy*j[1],di=dx*j[2]+dy*j[3];
  const tr=g[0]+g[2]/kk,ti=g[1]+g[3]/kk;
  const ur=(g[4]*dr-g[5]*di)/kk,ui=(g[4]*di+g[5]*dr)/kk;
  out[0]+=omega*(tr*j[2]+ti*j[0]+dx*ui);
  out[1]+=-omega*(tr*j[0]-ti*j[2]+dx*ur);
  out[2]+=omega*(tr*j[3]+ti*j[1]+dy*ui);
  out[3]+=-omega*(tr*j[1]-ti*j[3]+dy*ur);
  const br=dx*j[1]-dy*j[0],bi=dx*j[3]-dy*j[2];
  out[4]+=g[2]*br-g[3]*bi; out[5]+=g[2]*bi+g[3]*br;
}
// Circumferentially averaged cylindrical self kernel, axial triangular currents.
// All matrices use exp(+iωt) and the original normalization (μ/4π omitted).
const MOM_G8_X=[-.9602898564975363,-.7966664774136267,-.5255324099163290,-.1834346424956498,.1834346424956498,.5255324099163290,.7966664774136267,.9602898564975363];
const MOM_G8_W=[.1012285362903763,.2223810344533745,.3137066458778873,.3626837833783620,.3626837833783620,.3137066458778873,.2223810344533745,.1012285362903763];
const MOM_G16_X=[-0.9894009349916499, -0.9445750230732326, -0.8656312023878318, -0.755404408355003, -0.6178762444026438, -0.45801677765722737, -0.2816035507792589, -0.09501250983763744, 0.09501250983763744, 0.2816035507792589, 0.45801677765722737, 0.6178762444026438, 0.755404408355003, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
const MOM_G16_W=[0.027152459411754176, 0.062253523938647456, 0.0951585116824926, 0.12462897125553407, 0.1495959888165767, 0.16915651939500265, 0.18260341504492364, 0.18945061045506864, 0.18945061045506864, 0.18260341504492364, 0.16915651939500265, 0.1495959888165767, 0.12462897125553407, 0.0951585116824926, 0.062253523938647456, 0.027152459411754176];
const MOM_G4_X=WIRE_GAUSS_NODES, MOM_G4_W=WIRE_GAUSS_WEIGHTS;
const momSelfCache=new Map();
let momPairCache=new WeakMap(),momExcitationCache=new WeakMap(),momMatrixCache=null;
let momLastStats={};

function momGauss(fn,lo,hi,n=8) {
  const xs=n===8?MOM_G8_X:MOM_G4_X,ws=n===8?MOM_G8_W:MOM_G4_W;
  const half=(hi-lo)/2,mid=(hi+lo)/2;let re=0,im=0;
  for(let j=0;j<xs.length;j++){const v=fn(mid+half*xs[j]);re+=ws[j]*v[0];im+=ws[j]*v[1];}
  return [half*re,half*im];
}
function momAdaptive(fn,lo,hi,tol,depth=0) {
  const a=momGauss(fn,lo,hi,8),b=momGauss(fn,lo,hi,4);
  if(Math.hypot(a[0]-b[0],a[1]-b[1])<=tol || depth>=16)return a;
  const mid=(lo+hi)/2,l=momAdaptive(fn,lo,mid,tol/2,depth+1),r=momAdaptive(fn,mid,hi,tol/2,depth+1);
  return [l[0]+r[0],l[1]+r[1]];
}
// K(m) evaluated by AGM. Compute sqrt(1-m) directly from geometry to avoid
// cancellation at the logarithmic singularity (s=0 is never sampled).
function momCylinderGreen(s,a) {
  const R0=Math.hypot(s,2*a);let aa=1,bb=Math.abs(s)/R0;
  for(let q=0;q<32;q++){const next=(aa+bb)/2;bb=Math.sqrt(aa*bb);aa=next;if(Math.abs(aa-bb)<1e-15*aa)break;}
  const staticPart=1/(R0*aa);
  // Smooth dynamic correction (exp(-ikR)-1)/R integrated around the ring.
  let re=0,im=0;
  for(let q=0;q<16;q++){
    const angle=(MOM_G16_X[q]+1)*Math.PI/4,R=Math.hypot(s,2*a*Math.sin(angle)),v=k*R;
    re+=MOM_G16_W[q]*(-2*Math.sin(v/2)**2/R);
    im+=MOM_G16_W[q]*(-Math.sin(v)/R);
  }
  return [staticPart+re/2,im/2];
}
// Cross correlations of identical hats and their derivatives, supported on ±2h.
function momHatWeight(s,h) {
  const u=Math.abs(s)/h;if(u>=2)return 0;
  const C=u<=1?h*(2/3-u*u+u*u*u/2):h*(2-u)**3/6;
  const D=u<=1?(2-3*u)/h:(u-2)/h;
  return C-D/(k*k);
}
function momSelfBlock(w) {
  const n=w.meshCount-1,h=w.meshLength,a=w.radius,key=JSON.stringify([n,h,a,k,freq]);
  if(momSelfCache.has(key)){momLastStats.selfHits++;return momSelfCache.get(key);}
  const offsets=[];
  for(let d=0;d<n;d++){
    const distance=d*h;
    // Even Green function: integrate s>=0; split at every polynomial breakpoint.
    const edges=[0];for(let j=-2;j<=2;j++)edges.push(Math.abs(distance+j*h));
    const unique=[...new Set(edges)].sort((a,b)=>a-b);let re=0,im=0;
    for(let q=0;q+1<unique.length;q++){
      const lo=unique[q],hi=unique[q+1];if(hi<=lo)continue;
      const f=s=>{const weight=momHatWeight(s-distance,h)+momHatWeight(-s-distance,h),g=momCylinderGreen(s,a);return [g[0]*weight,g[1]*weight];};
      // s=hi*t² removes the endpoint logarithmic singularity from quadrature.
      const integral=lo===0?momAdaptive(t=>{const s=hi*t*t,v=f(s);return [v[0]*2*hi*t,v[1]*2*hi*t];},0,1,1e-9*(h+1/(k*k*h))):momAdaptive(f,lo,hi,1e-9*(h+1/(k*k*h)));
      re+=integral[0];im+=integral[1];
    }
    const omega=2*Math.PI*freq;offsets.push([omega*im,-omega*re]);
  }
  const block={rows:n,cols:n,re:new Float64Array(n*n),im:new Float64Array(n*n)};
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const v=offsets[Math.abs(i-j)];block.re[i*n+j]=v[0];block.im[i*n+j]=v[1];}
  if(momSelfCache.size>=48)momSelfCache.delete(momSelfCache.keys().next().value);
  momSelfCache.set(key,block);momLastStats.selfBuilds++;return block;
}
function momPointSegmentDistance(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
  const u=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
  return Math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dy);
}
function momWireDistance(a,b){
  const p=a.endPointA,q=b.endPointA,rx=a.endPointB[0]-p[0],ry=a.endPointB[1]-p[1],sx=b.endPointB[0]-q[0],sy=b.endPointB[1]-q[1];
  const cross=rx*sy-ry*sx;
  if(Math.abs(cross)>1e-14){const tx=q[0]-p[0],ty=q[1]-p[1],u=(tx*sy-ty*sx)/cross,v=(tx*ry-ty*rx)/cross;if(u>=0&&u<=1&&v>=0&&v<=1)return 0;}
  return Math.min(momPointSegmentDistance(p,b.endPointA,b.endPointB),momPointSegmentDistance(a.endPointB,b.endPointA,b.endPointB),momPointSegmentDistance(q,a.endPointA,a.endPointB),momPointSegmentDistance(b.endPointB,a.endPointA,a.endPointB));
}
function momWireKey(w){return [w.endPointA[0],w.endPointA[1],w.endPointB[0],w.endPointB[1],w.radius,w.meshCount];}
function momTestSamples(w,maxLength=w.meshLength,order=4){
  const count=Math.max(1,Math.ceil(w.meshLength/maxLength)),xs=order===8?MOM_G8_X:MOM_G4_X,ws=order===8?MOM_G8_W:MOM_G4_W,out=[];
  for(let e=0;e<w.meshCount;e++)for(let p=0;p<count;p++)for(let q=0;q<xs.length;q++){
    const u=(p+(xs[q]+1)/2)/count,hats=[];
    if(e>0)hats.push([e-1,1-u,-1/w.meshLength]);
    if(e+1<w.meshCount)hats.push([e,u,1/w.meshLength]);
    out.push({p:w.point((e+u)/w.meshCount),weight:w.meshLength*ws[q]/(2*count),hats});
  }
  return out;
}
function momRingOffsets(w,count){
  return Array.from({length:count},(_,i)=>{const t=2*Math.PI*(i+.5)/count,r=w.radius;return [-w.tangent[1]*r*Math.cos(t),w.tangent[0]*r*Math.cos(t),r*Math.sin(t)];});
}
function momMutualBlock(a,b){
  const key=JSON.stringify([momWireKey(a),momWireKey(b),k,freq]);
  let map=momPairCache.get(a);if(!map){map=new WeakMap();momPairCache.set(a,map);}
  const old=map.get(b);if(old&&old.key===key){momLastStats.pairHits++;return old.block;}
  const distance=momWireDistance(a,b),gap=distance-a.radius-b.radius;
  if(gap<=0)throw Error('PEC wire bodies overlap or touch; separate them (junctions are not modeled)');
  // Far pairs: reciprocal centerline approximation. Near pairs: average BOTH
  // source and test rings. One block is integrated and its transpose is reused.
  const near=distance<6*Math.max(a.radius,b.radius),ringCount=near?(gap<Math.max(a.radius,b.radius)?16:8):1;
  const ra=near?momRingOffsets(a,ringCount):[[0,0,0]],rb=near?momRingOffsets(b,ringCount):[[0,0,0]];
  const maxLength=near?Math.max(gap,.25*Math.min(a.radius,b.radius)):distance/2;
  const sa=momTestSamples(a,Math.min(maxLength,c/freq/10)),sb=momTestSamples(b,Math.min(maxLength,c/freq/10));
  if(sa.length*sb.length*ringCount*ringCount>12000000)throw Error('Wires are too close for the interactive integration budget; increase their gap');
  const n=a.meshCount-1,m=b.meshCount-1,block={rows:n,cols:m,re:new Float64Array(n*m),im:new Float64Array(n*m)};
  const dot=a.tangent[0]*b.tangent[0]+a.tangent[1]*b.tangent[1],omega=2*Math.PI*freq;
  for(const x of sa)for(const y of sb){
    let gr=0,gi=0;
    for(const u of ra)for(const v of rb){const R=Math.hypot(x.p[0]-y.p[0]+u[0]-v[0],x.p[1]-y.p[1]+u[1]-v[1],u[2]-v[2]);gr+=Math.cos(k*R)/R;gi-=Math.sin(k*R)/R;}
    gr/=ringCount*ringCount;gi/=ringCount*ringCount;
    for(const [i,fi,di] of x.hats)for(const [j,fj,dj] of y.hats){const v=omega*x.weight*y.weight*(dot*fi*fj-di*dj/(k*k)),idx=i*m+j;block.re[idx]+=v*gi;block.im[idx]-=v*gr;}
  }
  map.set(b,{key,block});momLastStats.pairBuilds++;return block;
}
function momAssembleWires(wires){
  let n=0;for(const w of wires){w.solveOffset=n;n+=w.meshCount-1;}
  if(n>MAX_PASSIVE_UNKNOWNS)throw Error('Limit '+MAX_PASSIVE_UNKNOWNS+' wire-current unknowns; increase segment length or remove wires');
  const ar=new Float64Array(n*n),ai=new Float64Array(n*n);
  const plane=currentPECPlane();
  for(let wa=0;wa<wires.length;wa++)for(let wb=wa;wb<wires.length;wb++){
    const a=wires[wa],b=wires[wb];
    // Opposite half-spaces of an infinite PEC plane are fully decoupled.
    if(plane&&plane.side(a.endPointA)!==plane.side(b.endPointA))continue;
    const block=wa===wb?momSelfBlock(a):momMutualBlock(a,b);
    const reflected=plane?momMutualBlock(a,momMirroredWire(b,plane)):null;
    for(let i=0;i<block.rows;i++)for(let j=0;j<block.cols;j++){
      const q=i*block.cols+j,row=a.solveOffset+i,col=b.solveOffset+j;
      // Mirrored wire's positive axial current is geometrically reflected;
      // its PEC image current is the NEGATIVE of that direction.
      const re=block.re[q]-(reflected?reflected.re[q]:0);
      const im=block.im[q]-(reflected?reflected.im[q]:0);
      ar[row*n+col]=re;ai[row*n+col]=im;
      if(wa!==wb){ar[col*n+row]=re;ai[col*n+row]=im;}
    }
  }
  return {ar,ai,n};
}
function momExcitationWires(wires){
  const n=wires.reduce((sum,w)=>sum+w.meshCount-1,0),br=new Float64Array(n),bi=new Float64Array(n);
  const active=antennas.filter(a=>!(a instanceof PassiveWire)&&!(a instanceof PECPlane)&&!(a instanceof PECSlot)),out=new Float64Array(6);
  const plane=currentPECPlane();
  for(const w of wires){
    let map=momExcitationCache.get(w);if(!map){map=new WeakMap();momExcitationCache.set(w,map);}
    const key=JSON.stringify([momWireKey(w),k,freq,plane?[plane.endPointA,plane.endPointB]:null]);
    let samples=null;
    for(const a of active){
      // Infinite PEC sheet: a source across the sheet cannot excite this wire.
      if(plane&&!a.segments.some(p=>plane.side(w.endPointA)===plane.side(p)))continue;
      let unit=map.get(a);
      if(!unit||unit.key!==key||unit.segments!==a.segments||unit.currents!==a.currentSegments||unit.lengths!==a.segmentLengths||unit.radius!==sourceRadius(a)){
        if(!samples)samples=momTestSamples(w,Math.min(w.meshLength,c/freq/10),8);
        unit={key,segments:a.segments,currents:a.currentSegments,lengths:a.segmentLengths,radius:sourceRadius(a),re:new Float64Array(w.meshCount-1),im:new Float64Array(w.meshCount-1)};
        const ring=momRingOffsets(w,8);
        for(const q of samples){
          out.fill(0);
          for(let j=0;j<a.segments.length;j++){
            const v=a.currentSegments[j],L=a.segmentLengths[j]/ring.length,moment=[L*v[0],L*v[1],L*v[2],L*v[3]];
            for(const r of ring){
              const x=q.p[0]+r[0],y=q.p[1]+r[1],src=a.segments[j];
              if(!plane||plane.side([x,y])===plane.side(src)){
                addElementField(out,x,y,src,moment,Math.hypot(sourceRadius(a),r[2]));
                if(plane)addElementField(out,x,y,plane.mirrorPoint(src),plane.mirrorCurrent(moment),Math.hypot(sourceRadius(a),r[2]));
              }
            }
          }
          const re=w.tangent[0]*out[0]+w.tangent[1]*out[2],im=w.tangent[0]*out[1]+w.tangent[1]*out[3];
          for(const [i,f] of q.hats){unit.re[i]-=q.weight*f*re;unit.im[i]-=q.weight*f*im;}
        }
        map.set(a,unit);momLastStats.excitationBuilds=(momLastStats.excitationBuilds||0)+1;
      }else momLastStats.excitationHits=(momLastStats.excitationHits||0)+1;
      for(let i=0;i<unit.re.length;i++){br[w.solveOffset+i]+=a.I0.a*unit.re[i]-a.I0.b*unit.im[i];bi[w.solveOffset+i]+=a.I0.a*unit.im[i]+a.I0.b*unit.re[i];}
    }
  }
  // A is the self-generated E operator (negative circuit impedance).
  // PEC condition: E_scattered + E_incident = -V_gap delta(s-s_feed).
  for(const w of wires)if(w instanceof Dipole&&w.feedMode!=='open'){const weights=w.feedWeights(),v=w.feedVoltage();for(let i=0;i<weights.length;i++){const j=w.solveOffset+i;br[j]-=v[0]*weights[i];bi[j]-=v[1]*weights[i];}}
  return {br,bi};
}
// Open ports add one voltage unknown and one zero-port-current constraint:
// [ A  W ][I] = [b], with A the negative impedance (self-E) operator.
// [ Wt 0 ][V]   [0]  W uses the same finite-gap weights as feedCurrent().
function momPortSystem(wires){
  const base=momAssemble(wires),openWires=wires.filter(w=>w instanceof Dipole&&w.feedMode==='open');
  if(!openWires.length)return {...base,openWires,wireUnknowns:base.n};
  const n=base.n+openWires.length;
  if(n>MAX_PASSIVE_UNKNOWNS)throw Error('Too many current/port unknowns; increase the shared segment length in Advanced');
  const ar=new Float64Array(n*n),ai=new Float64Array(n*n);
  for(let i=0;i<base.n;i++)for(let j=0;j<base.n;j++){ar[i*n+j]=base.ar[i*base.n+j];ai[i*n+j]=base.ai[i*base.n+j];}
  openWires.forEach((w,q)=>{const port=base.n+q;w.feedWeights().forEach((weight,i)=>{const row=w.solveOffset+i;ar[row*n+port]=weight;ar[port*n+row]=weight;});});
  return {ar,ai,n,openWires,wireUnknowns:base.n};
}
function momPortExcitation(wires,n){const raw=momExcitation(wires),br=new Float64Array(n),bi=new Float64Array(n);br.set(raw.br);bi.set(raw.bi);return {br,bi};}
// Standalone assembly entry point for external tests; no diagnostic UI.
function passiveSystem(wires){
  momLastStats={selfHits:0,selfBuilds:0,pairHits:0,pairBuilds:0,factorReused:false};
  const matrix=momPortSystem(wires);return {...matrix,...momPortExcitation(wires,matrix.n)};
}
// Reusable row-equilibrated complex LU with partial pivoting.
function factorComplex(ar,ai,n){
  const re=ar.slice(),im=ai.slice(),scales=new Float64Array(n),pivots=new Int32Array(n);
  for(let i=0;i<n;i++){let scale=0;for(let j=0;j<n;j++)scale=Math.max(scale,Math.hypot(re[i*n+j],im[i*n+j]));if(!scale)throw Error('Singular passive system');scales[i]=scale;for(let j=0;j<n;j++){re[i*n+j]/=scale;im[i*n+j]/=scale;}}
  for(let q=0;q<n;q++){
    let pivot=q;for(let i=q+1;i<n;i++)if(Math.hypot(re[i*n+q],im[i*n+q])>Math.hypot(re[pivot*n+q],im[pivot*n+q]))pivot=i;
    pivots[q]=pivot;if(Math.hypot(re[pivot*n+q],im[pivot*n+q])<1e-12)throw Error('Ill-conditioned passive system; change spacing or mesh');
    if(pivot!==q)for(let j=0;j<n;j++){[re[q*n+j],re[pivot*n+j]]=[re[pivot*n+j],re[q*n+j]];[im[q*n+j],im[pivot*n+j]]=[im[pivot*n+j],im[q*n+j]];}
    const pr=re[q*n+q],pi=im[q*n+q],den=pr*pr+pi*pi;
    for(let i=q+1;i<n;i++){
      const idx=i*n+q,fr=(re[idx]*pr+im[idx]*pi)/den,fi=(im[idx]*pr-re[idx]*pi)/den;re[idx]=fr;im[idx]=fi;
      for(let j=q+1;j<n;j++){re[i*n+j]-=fr*re[q*n+j]-fi*im[q*n+j];im[i*n+j]-=fr*im[q*n+j]+fi*re[q*n+j];}
    }
  }
  return {re,im,n,scales,pivots};
}
function solveFactoredComplex(lu,br,bi){
  const {re,im,n,scales,pivots}=lu,xr=Float64Array.from(br,(v,i)=>v/scales[i]),xi=Float64Array.from(bi,(v,i)=>v/scales[i]);
  for(let q=0;q<n;q++){const p=pivots[q];if(p!==q){[xr[q],xr[p]]=[xr[p],xr[q]];[xi[q],xi[p]]=[xi[p],xi[q]];}}
  for(let i=0;i<n;i++)for(let j=0;j<i;j++){xr[i]-=re[i*n+j]*xr[j]-im[i*n+j]*xi[j];xi[i]-=re[i*n+j]*xi[j]+im[i*n+j]*xr[j];}
  for(let i=n-1;i>=0;i--){let rr=xr[i],ii=xi[i];for(let j=i+1;j<n;j++){rr-=re[i*n+j]*xr[j]-im[i*n+j]*xi[j];ii-=re[i*n+j]*xi[j]+im[i*n+j]*xr[j];}const pr=re[i*n+i],pi=im[i*n+i],d=pr*pr+pi*pi;xr[i]=(rr*pr+ii*pi)/d;xi[i]=(ii*pr-rr*pi)/d;if(!Number.isFinite(xr[i]+xi[i]))throw Error('Non-finite passive solution');}
  return [xr,xi];
}
function solveComplex(ar,ai,br,bi,n){return solveFactoredComplex(factorComplex(ar,ai,n),br,bi);}
function solvePassiveWires(){
  const wires=antennas.filter(a=>a instanceof PassiveWire),plane=currentPECPlane(),sig=antennas.map(a=>[a,a.segments,a instanceof PassiveWire?null:a.currentSegments,a.I0.a,a.I0.b,a.amp,a.phase,a instanceof Dipole?a.feedFraction:null,a instanceof Dipole?a.feedSeparation():null,a instanceof Dipole?a.feedMode:null,sourceRadius(a),a instanceof PECPlane?[...a.endPointA,...a.endPointB].join(','):null]);
  if(passiveSignature&&passiveSignature.k===k&&passiveSignature.freq===freq&&sig.length===passiveSignature.sig.length&&sig.every((v,i)=>v.every((x,j)=>x===passiveSignature.sig[i][j])))return;
  passiveSignature=null;passiveSolveInfo={message:wires.length?'Solving…':'No PEC wires or slots',error:false};
  const slots=currentPECSlots();
  if(!wires.length&&!slots.length){momMatrixCache=null;return;}
  momLastStats={selfHits:0,selfBuilds:0,pairHits:0,pairBuilds:0,factorReused:false};const begin=performance.now();
  try{
    const key=JSON.stringify([k,freq,slotModelKey(),wires.map(w=>[momWireKey(w),w instanceof Dipole&&w.feedMode==='open'?[w.feedFraction,w.feedSeparation()]:null]),plane?[plane.endPointA,plane.endPointB]:null]);let matrix;
    if(momMatrixCache&&momMatrixCache.key===key){matrix=momMatrixCache;let offset=0;for(const w of wires){w.solveOffset=offset;offset+=w.meshCount-1;}for(const s of slots){s.solveOffset=offset;offset+=s.meshCount-1;}momLastStats.factorReused=true;}
    else{matrix=momPortSystem(wires);matrix.lu=factorComplex(matrix.ar,matrix.ai,matrix.n);matrix.key=key;momMatrixCache=matrix;}
    const {ar,ai,n}=matrix,{br,bi}=momPortExcitation(wires,n),[xr,xi]=solveFactoredComplex(matrix.lu,br,bi);
    let err=0,norm=0;for(let i=0;i<n;i++){let rr=-br[i],ii=-bi[i];for(let j=0;j<n;j++){rr+=ar[i*n+j]*xr[j]-ai[i*n+j]*xi[j];ii+=ar[i*n+j]*xi[j]+ai[i*n+j]*xr[j];}err+=rr*rr+ii*ii;norm+=br[i]*br[i]+bi[i]*bi[i];}
    const residual=Math.sqrt(err/Math.max(norm,1e-300));if(!Number.isFinite(residual)||residual>1e-7)throw Error('Passive solve failed residual check');
    for(const w of wires){w.nodeCurrents=Array.from({length:w.meshCount+1},()=>new Float64Array(4));for(let i=1;i<w.meshCount;i++){const j=w.solveOffset+i-1,t=w.tangent;w.nodeCurrents[i]=new Float64Array([t[0]*xr[j],t[1]*xr[j],t[0]*xi[j],t[1]*xi[j]]);}w.refreshCurrents();}
    for(const s of slots){s.coefficients=Array.from({length:s.meshCount+1},(_,i)=>i===0||i===s.meshCount?[0,0]:[xr[s.solveOffset+i-1],xi[s.solveOffset+i-1]]);s.refreshMagnetic();}
    wires.filter(w=>w instanceof Dipole&&w.feedMode==='open').forEach((w,q)=>{w.openVoltage=[xr[matrix.wireUnknowns+q],xi[matrix.wireUnknowns+q]];});
    passiveSignature={k,freq,sig};momLastStats.elapsedMs=performance.now()-begin;
    passiveSolveInfo={message:n+' unknowns · cylindrical kernel'+(slots.length?' · narrow-slot approximation':''),error:false,residual,count:n};
  }catch(e){for(const s of slots){s.coefficients=Array.from({length:s.meshCount+1},()=>[0,0]);s.refreshMagnetic();}for(const w of wires){if(w instanceof Dipole)w.openVoltage=[0,0];w.nodeCurrents=Array.from({length:w.meshCount+1},()=>new Float64Array(4));w.refreshCurrents();}passiveSolveInfo={message:e.message+' (PEC wire fields and power readouts disabled)',error:true};}
}


// Time-average powers use PEAK phasors and the existing omitted μ/(4π)
// normalization: Pfeed=Re(V I*)/2; equivalent far flux integral is
// ∫Re(E×B*)·n r² dΩ/(8π). These are simulation power units, not SI watts.
let sourcePowerState={valid:false,message:'Awaiting solve',values:new Map()};
function powerElements(a){
  // Four Gauss samples per linear-current panel suffice for radiation and
  // separated-source reaction integrals; no radius-scale display oversampling.
  const samples=a instanceof PassiveWire?momTestSamples(a,Math.min(a.meshLength,c/freq/12)):null;
  return (samples||a.segments).map((q,index)=>{
    let p,j,L;
    if(samples){p=q.p;L=q.weight;j=[0,0,0,0];for(const [n,f] of q.hats)for(let d=0;d<4;d++)j[d]+=f*a.nodeCurrents[n+1][d];}
    else {p=q;j=a.currentSegments[index];L=a.segmentLengths[index];}
    const d=a.I0;
    return {p,j:[L*(j[0]*d.a-j[2]*d.b),L*(j[1]*d.a-j[3]*d.b),L*(j[0]*d.b+j[2]*d.a),L*(j[1]*d.b+j[3]*d.a)]};
  }).filter(e=>e.j.some(v=>v!==0));
}
function powerGauss(n){
  const out=[];
  for(let i=0;i<n;i++){
    let z=Math.cos(Math.PI*(i+.75)/(n+.5)),d;
    for(let iter=0;iter<30;iter++){
      let p=1,p0=0;for(let j=1;j<=n;j++){const old=p;p=((2*j-1)*z*p-(j-1)*p0)/j;p0=old;}
      d=n*(z*p-p0)/(z*z-1);const next=z-p/d;if(Math.abs(next-z)<2e-15){z=next;break;}z=next;
    }
    out.push([z,2/((1-z*z)*d*d)]);
  }
  return out;
}
function powerFarAmplitude(elements,nx,ny,plane,side,images){
  const f=[0,0,0,0];
  for(const e of elements){
    if(images&&plane&&plane.side(e.p)!==side)continue;
    const add=(p,j)=>{const t=k*(nx*p[0]+ny*p[1]),co=Math.cos(t),si=Math.sin(t);f[0]+=j[0]*co-j[2]*si;f[1]+=j[1]*co-j[3]*si;f[2]+=j[0]*si+j[2]*co;f[3]+=j[1]*si+j[3]*co;};
    add(e.p,e.j);if(images&&plane)add(plane.mirrorPoint(e.p),plane.mirrorCurrent(e.j));
  }
  return f;
}
function powerTransverseDot(f,g,nx,ny){
  return f.reduce((s,v,i)=>s+v*g[i],0)-(nx*f[0]+ny*f[1])*(nx*g[0]+ny*g[1])-(nx*f[2]+ny*f[3])*(nx*g[2]+ny*g[3]);
}
function slotFarAmplitude(slots,nx,ny,nz,side){
  const f=[0,0,0,0];
  for(const s of slots){const p=s.center();let re=0,im=0;
    // Radiation quadrature need not use the radius-scale near-field samples.
    for(const q of (s.farSamples||(s.farSamples=momTestSamples(s.proxy,Math.min(s.meshLength,c/freq/12))))){
      let qr=0,qi=0;for(const [i,v] of q.hats){qr+=v*s.coefficients[i+1][0];qi+=v*s.coefficients[i+1][1];}
      const phase=k*(nx*p[0]+ny*p[1]+nz*q.p[1]),co=Math.cos(phase),si=Math.sin(phase),L=2*side*q.weight;
      re+=L*(qr*co-qi*si);im+=L*(qr*si+qi*co);
    }
    f[0]-=ny*re;f[1]+=nx*re;f[2]-=ny*im;f[3]+=nx*im;
  }
  return f;
}
function updateSourcePowers(){
  sourcePowerState={valid:false,message:passiveSolveInfo.error?passiveSolveInfo.message:'Awaiting solve',values:new Map()};
  if(passiveSolveInfo.error)return;
  const bodies=antennas.filter(a=>!(a instanceof PECPlane)&&!(a instanceof PECSlot)),plane=currentPECPlane();
  const slots=currentPECSlots();
  const lists=bodies.map(powerElements),values=new Map(bodies.map(a=>[a,{net:0,radiation:0,freeSelf:0}]));
  const points=lists.flat().map(e=>e.p);
  let span=0;if(points.length){let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;for(const p of points){xmin=Math.min(xmin,p[0]);xmax=Math.max(xmax,p[0]);ymin=Math.min(ymin,p[1]);ymax=Math.max(ymax,p[1]);}span=Math.hypot(xmax-xmin,ymax-ymin);}
  // Polar axis normal to a PEC plane places its half-space discontinuity on
  // quadrature boundaries. Include image separation in the angular bandwidth.
  if(plane)for(const p of points)span=Math.max(span,2*Math.abs(plane.signedDistance(p)));
  for(const s of slots)span=Math.max(span,s.length);
  const required=Math.max(12,Math.ceil(k*span+12)),order=Math.min(64,required),gauss=powerGauss(order),phiCount=2*order;
  let totalRadiated=0;
  const coeff=(2*Math.PI*freq)**2/(8*Math.PI*c);
  for(const [u,wu] of gauss)for(const half of (plane?[-1,1]:[0])){
    const z=plane?half*(u+1)/2:u,weight=wu*(plane?.5:1)*2*Math.PI/phiCount*coeff,r=Math.sqrt(Math.max(0,1-z*z));
    for(let j=0;j<phiCount;j++){
      const phi=2*Math.PI*(j+.5)/phiCount;
      const nx=plane?z*plane.normal[0]+r*Math.cos(phi)*plane.tangent[0]:r*Math.cos(phi);
      const ny=plane?z*plane.normal[1]+r*Math.cos(phi)*plane.tangent[1]:r*Math.sin(phi);
      const fs=lists.map(e=>powerFarAmplitude(e,nx,ny,plane,half,true)),total=[0,0,0,0];
      for(const f of fs)for(let d=0;d<4;d++)total[d]+=f[d];
      if(slots.length){const sf=slotFarAmplitude(slots,nx,ny,r*Math.sin(phi),half);for(let d=0;d<4;d++)total[d]+=sf[d];}
      totalRadiated+=weight*powerTransverseDot(total,total,nx,ny);
      bodies.forEach((a,i)=>{
        const v=values.get(a);v.radiation+=weight*powerTransverseDot(fs[i],total,nx,ny);
        if(!(a instanceof PassiveWire)){
          const f=plane?powerFarAmplitude(lists[i],nx,ny,null,0,false):fs[i];
          v.freeSelf+=weight*powerTransverseDot(f,f,nx,ny);
        }
      });
    }
  }
  for(let i=0;i<bodies.length;i++){
    const a=bodies[i],v=values.get(a);
    if(a instanceof Dipole){if(a.feedMode==='open'){v.net=0;continue;}const voltage=a.feedVoltage(),current=a.feedCurrent();v.net=.5*(voltage[0]*current[0]+voltage[1]*current[1]);continue;}
    if(a instanceof PassiveWire)continue;
    v.net=v.freeSelf;
    // Work against the fields from other actual currents, plus all images
    // including this source's own image. The direct singular self term is
    // replaced by its finite radiative work (freeSelf) above.
    for(const target of lists[i]){
      const field=new Float64Array(6);
      for(let j=0;j<bodies.length;j++)for(const e of lists[j]){
        if(plane&&plane.side(target.p)!==plane.side(e.p))continue;
        // Ideal sources have no physical 0.1-unit wire radius: that is a
        // display regularizer. Use the unsmoothed reaction between distinct
        // ideal elements, preserving interference power (e.g. a quadrupole).
        const radius=bodies[j] instanceof PassiveWire?bodies[j].radius:0;
        const directRadius=Math.hypot(target.p[0]-e.p[0],target.p[1]-e.p[1])<1e-9?.1:radius;
        if(j!==i)addElementField(field,target.p[0],target.p[1],e.p,e.j,directRadius);
        if(plane)addElementField(field,target.p[0],target.p[1],plane.mirrorPoint(e.p),plane.mirrorCurrent(e.j),radius);
      }
      if(slots.length)addAllSlotFields(field,target.p[0],target.p[1],plane.side(target.p));
      v.net-=.5*(target.j[0]*field[0]+target.j[2]*field[1]+target.j[1]*field[2]+target.j[3]*field[3]);
    }
  }
  const totalSupplied=[...values.values()].reduce((sum,v)=>sum+v.net,0);
  const scale=Math.max(totalRadiated,[...values.values()].reduce((sum,v)=>sum+Math.abs(v.net),0),1e-30);
  sourcePowerState={valid:true,values,totalRadiated,totalSupplied,balanceError:Math.abs(totalSupplied-totalRadiated)/scale,angularLimited:required>order};
}
function sourcePowerReadouts(a){
  if(a instanceof PECPlane||a instanceof PECSlot||(a instanceof PassiveWire&&!(a instanceof Dipole)))return [];
  const unavailable=fieldTiles.dirtyPhysics||passiveSolveInfo.error||!sourcePowerState.valid,v=sourcePowerState.values.get(a);
  const value=unavailable||!v?(passiveSolveInfo.error?'Unavailable':'Updating…'):formatAveragePower(v.net);
  return [['Average power contribution',value]];
}
function formatAveragePower(x){return Math.abs(x)<1e-12?'0':(x>0?'+':'')+x.toPrecision(5);}
function sourcePowerNotes(a){
  if(a instanceof PECPlane||a instanceof PECSlot||(a instanceof PassiveWire&&!(a instanceof Dipole)))return [];
  return [{text:'Average power contribution: positive supplies net power to the electromagnetic field; negative absorbs net power into the source. Values are in simulation units, not watts.'}];
}
function updateScenePowerReadouts(){
  const total=document.getElementById('em-scene-radiated-power'),balance=document.getElementById('em-power-balance'),note=document.getElementById('em-power-diagnostic-note');
  const ready=!fieldTiles.dirtyPhysics&&!passiveSolveInfo.error&&sourcePowerState.valid;
  const pending=passiveSolveInfo.error?'Unavailable':'Updating…';
  if(total)total.textContent=ready?formatAveragePower(sourcePowerState.totalRadiated).replace(/^\+/,''):pending;
  if(balance)balance.textContent=ready?(100*sourcePowerState.balanceError).toFixed(2)+'%':pending;
  if(note){
    const notes=[];
    if(ready&&sourcePowerState.balanceError>.03)notes.push('Power balance differs by more than 3%. Refine the wire mesh and check close source spacing.');
    if(ready&&sourcePowerState.angularLimited)notes.push('Scene exceeds the angular-integration budget; radiation may be under-resolved.');
    notes.push('Comparison of net source power with total 3D radiation. Near-field smoothing, thin-wire approximations and quadrature can cause a discrepancy.');
    note.textContent=notes.join(' ');note.className='model-note'+(ready&&(sourcePowerState.balanceError>.03||sourcePowerState.angularLimited)?' warning':'');
  }
}

// Converted ComplexNum class from Java to JavaScript

class ComplexNum {
  constructor(a, b) {
    this.a = a;
    this.b = b;
    this.absVal = Math.sqrt(a * a + b * b);

    this.phase = Math.atan2(b, a);
  }

  getA() {
    return this.a;
  }

  getB() {
    return this.b;
  }

  getAbsVal() {
    return this.absVal;
  }

  getPhase() {
    return this.phase;
  }

  toString() {
    return `${this.getA()} + ${this.getB()}i`;
  }

  add(num) {
    return new ComplexNum(this.getA() + num.getA(), this.getB() + num.getB());
  }

  subtract(num) {
    return new ComplexNum(this.getA() - num.getA(), this.getB() - num.getB());
  }

  product(num) {
    if (typeof num === "number") {
      return new ComplexNum(this.a * num, this.b * num);
    } else {
      const a = this.a;
      const b = this.b;
      const x = num.getA();
      const y = num.getB();
      return new ComplexNum(a * x - b * y, a * y + b * x);
    }
  }

  static cis(phase) {
    return new ComplexNum(Math.cos(phase), Math.sin(phase));
  }
}
////

//grid square side length
let sLength = 5;
const dl_hr = 0.04;
const dl_mr = 0.1;
const dl_lr = 0.2;

//spacial scaling factor
const Scale = 50; // Fixed physics scale; camera magnification is independent.
let zoom = 1;
const MIN_ZOOM = 0.5, MAX_ZOOM = 4;
let zoomRebuildAfter = 0;

function gridView() {
  const cell = sLength * zoom * 2**fieldCameraLevel();
  const x0 = Math.floor(-orig[0] / cell);
  const y0 = Math.ceil(orig[1] / cell);
  const drawX = orig[0] + x0 * cell;
  const drawY = orig[1] - y0 * cell;
  return {x0, y0, drawX, drawY, cell,
    cols: Math.ceil((width - drawX) / cell),
    rows: Math.ceil((height - drawY) / cell)};
}

function setViewZoom(value, screenX, screenY) {
  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  if (!Number.isFinite(next) || next === zoom) return;
  // Preserve the exact world coordinate beneath the cursor (without snapping).
  const ratio = next / zoom;
  orig[0] = screenX - (screenX - orig[0]) * ratio;
  orig[1] = screenY - (screenY - orig[1]) * ratio;
  zoom = next;
  requestCameraUpdate();
}

let width = 1000;
let height = 800;

let N = Math.ceil(height / sLength);
let M = Math.ceil(width / sLength);

let orig = [500.1, 400.1];

let resolution = 2;

//paramaters used for squiz functions

const k1 = 1;
const k1B = 5;

const k2 = 2.2;

const k3 = 0.3;
const k4 = 0.075;

const k5 = 1;
const k6 = 0.2;

const k7 = 6;

const k8 = 0.25;

//total elapsed time
let time = 0;

let timeSim = 0;
//temporal scaling factor
const timeScale = 8000;

//list of antenna objects
let antennas = [];

//electric field phasor
let E_phasor = [];

//magnetic field phasor
let B_phasor;

//EM field phasor
// World-coordinate cache for setup/panning only; values are Cartesian phasors.
let EM_phase_amp_map = new Map();

let A_map = new Map();

let waitProcess = true;
let simulate = false;
let pause = false;

//field GUI states
let show_BField = false;
let show_EField = true;
let show_EnergyFlux = false;
let show_EnergyDensity = false;
const displayGamma = {heatmap:1, arrows:1, current:0.2};
let fieldArrowDensity=1,currentArrowDensity=1,simulationClockRate=1,pecMaxSegmentLength=.2;
function setPECMaxSegmentLength(v){
  if(!Number.isFinite(v))return;
  pecMaxSegmentLength=Math.max(.02,Math.min(1,v));
  for(const a of antennas)if(a instanceof PassiveWire||a instanceof PECSlot){a.targetLength=pecMaxSegmentLength;a.rebuild();}
}
function advanceSimulationClock(now){if(!pause&&simulate)timeSim+=(now-time)*simulationClockRate;time=now;}

function heatTransfer(value, scale) { return Math.pow(squiz(value,scale),displayGamma.heatmap); }
// In the solver's normalized units mu=1 and epsilon=1/c^2.
function energyDensity(ex,ey,b) { return 0.5*((ex*ex+ey*ey)/(c*c)+b*b); }

// Frequency and wave-speed defaults/bounds scaled together by 1.25; λ is unchanged.
const minFreq = 0.0125;
const maxFreq = 1.25;
let freq = 0.5 * (minFreq + maxFreq);


const minSpeed = 1.25;
const maxSpeed = 8.75;
let c = 0.8 * minSpeed + 0.2 * maxSpeed;
let k = (2 * Math.PI * freq) / c;

//maximum current amplitude
const maxAmp = 25;

//default current magnitude
const defAmp = 10;
const DEFAULT_WIRE_FEED_VOLTAGE = 100; 

//
const maxSep = 0.4;
const defaultDipoleSep = 0.2;

const ARROW_SPACING_PX = 20;
const maxArrowLen = 14;
const thickDipole = 10;

//storage
segments = [];
currentSegments = [];
currents = [];
current = [];
r = [];
currentSegement = [];

tempE1 = [];
tempE2 = [];

tempE = [];
tempB1 = new ComplexNum(0, 0);
tempB2 = new ComplexNum(0, 0);

let zero = new ComplexNum(0, 0);

let processingScheduled = false;

let const_rFactor1 = (Scale * Scale) / (sLength * sLength);
let const_rFactor2 = Scale / (2 * sLength);

function squiz(l, k, levels = 256) {
  if (l <= 0) {
    return 0;
  }

  // Step 1: compute the squiz output (same as original)
  let ans = (k * l) / (1 + k * l);

  return ans;
}

function length2D(p1, p2) {
  return Math.sqrt(
    (p1[0] - p2[0]) * (p1[0] - p2[0]) + (p1[1] - p2[1]) * (p1[1] - p2[1])
  );
}

function conMyX(x) {
  return (sLength / Scale) * Math.round((x - orig[0]) / (sLength * zoom));
}

function conMyY(y) {
  return (sLength / Scale) * Math.round((orig[1] - y) / (sLength * zoom));
}

function conScreenX(x) {
  return x * Scale * zoom + orig[0];
}

function conScreenY(y) {
  return orig[1] - y * Scale * zoom;
}

function thickLine(p1, p2, thickness, c) {
  let dN = [];

  let A = [];
  let B = [];
  let C = [];
  let D = [];

  dN[0] = p2[1] - p1[1];
  dN[1] = p1[0] - p2[0];

  let len = Math.sqrt(dN[0] * dN[0] + dN[1] * dN[1]);

  dN[0] *= thickness / len;
  dN[1] *= thickness / len;

  A[0] = Math.round(p1[0] + 0.5 * dN[0]);
  A[1] = Math.round(p1[1] + 0.5 * dN[1]);

  B[0] = Math.round(p2[0] + 0.5 * dN[0]);
  B[1] = Math.round(p2[1] + 0.5 * dN[1]);

  C[0] = Math.round(p2[0] - 0.5 * dN[0]);
  C[1] = Math.round(p2[1] - 0.5 * dN[1]);

  D[0] = Math.round(p1[0] - 0.5 * dN[0]);
  D[1] = Math.round(p1[1] - 0.5 * dN[1]);

  stroke(c[0], c[1], c[2]);
  fill(c[0], c[1], c[2]);

  beginShape();

  vertex(A[0], A[1]);
  vertex(B[0], B[1]);
  vertex(C[0], C[1]);
  vertex(D[0], D[1]);

  endShape();
}

// Potential diagnostic using the same reduced-radius kernel as the field solver.
// Allocate only the two result objects, never inside the segment loop.
function calcA(myX, myY) {
  let axRe = 0, axIm = 0, ayRe = 0, ayIm = 0;
  for (let i = 0; i < antennas.length; i++) {
    const antenna = antennas[i];
    const {positions: segments, currents, lengths} = antenna.getCurrentElements();
    const drive = antenna.getI0();
    const driveRe = drive.a, driveIm = drive.b;
    for (let j = 0; j < segments.length; j++) {
      const dx = myX - segments[j][0];
      const dy = myY - segments[j][1];
      const distance = Math.hypot(dx, dy, sourceRadius(antenna));
      const invR = 1 / distance;
      const gRe = Math.cos(-k * distance) * invR;
      const gIm = Math.sin(-k * distance) * invR;
      const jx = currents[j][0] * lengths[j], jy = currents[j][1] * lengths[j];
      const ix = currents[j][2] * lengths[j], iy = currents[j][3] * lengths[j];
      const jxRe = jx * driveRe - ix * driveIm, jxIm = jx * driveIm + ix * driveRe;
      const jyRe = jy * driveRe - iy * driveIm, jyIm = jy * driveIm + iy * driveRe;
      axRe += jxRe * gRe - jxIm * gIm;
      axIm += jxRe * gIm + jxIm * gRe;
      ayRe += jyRe * gRe - jyIm * gIm;
      ayIm += jyRe * gIm + jyIm * gRe;
    }
  }
  return [new ComplexNum(axRe, axIm), new ComplexNum(ayRe, ayIm)];
}

// Progressive world-space phasor tiles. The worker is embedded to keep sketch.js
// a drop-in file. Browser-policy/Worker failures fall back to 2ms cooperative jobs.
function fieldWorkerMain(scope) {
  let scene=null,job=null;
  function tick() {
    const j=job;if(!j||!scene)return;
    const deadline=performance.now()+j.budget,e=scene.elements,kk=scene.k*scene.k,omega=scene.omega;
    do {
      const col=j.index%33,row=Math.floor(j.index/33),x=(j.tx*32+col)*j.step,y=(j.ty*32+row)*j.step;
      let exr=0,exi=0,eyr=0,eyi=0,br=0,bi=0;
      const side=scene.plane?(scene.plane.nx*(x-scene.plane.x)+scene.plane.ny*(y-scene.plane.y)>=0?1:-1):0;
      for(let n=0;n<e.length;n+=8){
        if(scene.plane&&side!==e[n+7])continue;
        const dx=x-e[n],dy=y-e[n+1],R=Math.hypot(dx,dy,e[n+6]),inv=1/R,kr=scene.k*R;
        const gr=Math.cos(kr)*inv,gi=-Math.sin(kr)*inv;
        const hr=-gr*inv*inv+scene.k*gi*inv,hi=-gi*inv*inv-scene.k*gr*inv;
        const qr=(3*inv*inv-kk)*gr*inv*inv-3*scene.k*gi*inv*inv*inv;
        const qi=(3*inv*inv-kk)*gi*inv*inv+3*scene.k*gr*inv*inv*inv;
        const jx=e[n+2],jy=e[n+3],ix=e[n+4],iy=e[n+5],dr=dx*jx+dy*jy,di=dx*ix+dy*iy;
        const tr=gr+hr/kk,ti=gi+hi/kk,ur=(qr*dr-qi*di)/kk,ui=(qr*di+qi*dr)/kk;
        exr+=omega*(tr*ix+ti*jx+dx*ui);exi-=omega*(tr*jx-ti*ix+dx*ur);
        eyr+=omega*(tr*iy+ti*jy+dy*ui);eyi-=omega*(tr*jy-ti*iy+dy*ur);
        const crossr=dx*jy-dy*jx,crossi=dx*iy-dy*ix;br+=hr*crossr-hi*crossi;bi+=hr*crossi+hi*crossr;
      }
      const magnetic=scene.magnetic;
      if(magnetic)for(let n=0;n<magnetic.length;n+=6){
        const dx=x-magnetic[n],dy=y-magnetic[n+1],dz=-magnetic[n+2],R=Math.hypot(dx,dy,dz,magnetic[n+5]),iv=1/R,kr=scene.k*R;
        const gr=Math.cos(kr)*iv,gi=-Math.sin(kr)*iv;
        const hr=-gr*iv*iv+scene.k*gi*iv,hi=-gi*iv*iv-scene.k*gr*iv;
        const qr=(3*iv*iv-kk)*gr*iv*iv-3*scene.k*gi*iv*iv*iv,qi=(3*iv*iv-kk)*gi*iv*iv+3*scene.k*gr*iv*iv*iv;
        const mr=2*side*magnetic[n+3],mi=2*side*magnetic[n+4],vr=hr*mr-hi*mi,vi=hr*mi+hi*mr;
        exr-=scene.c*dy*vr;exi-=scene.c*dy*vi;eyr+=scene.c*dx*vr;eyi+=scene.c*dx*vi;
        const tr=gr+(hr+qr*dz*dz)/kk,ti=gi+(hi+qi*dz*dz)/kk;
        br+=omega/scene.c*(tr*mi+ti*mr);bi-=omega/scene.c*(tr*mr-ti*mi);
      }
      j.data.set([exr,exi,eyr,eyi,br,bi],j.index*6);j.index++;
    }while(j.index<1089&&performance.now()<deadline);
    if(job!==j)return;
    if(j.index===1089){job=null;scope.postMessage({kind:'tile',epoch:j.epoch,id:j.id,level:j.level,tx:j.tx,ty:j.ty,data:j.data},[j.data.buffer]);}
    else setTimeout(tick,0);
  }
  scope.onmessage=event=>{
    const m=event.data;
    if(m.kind==='scene'){job=null;scene=m;scope.postMessage({kind:'ready',epoch:m.epoch});}
    else if(m.kind==='cancel'){if(!m.id||job?.id===m.id)job=null;}
    else if(m.kind==='tile'&&scene&&m.epoch===scene.epoch){job={...m,index:0,data:new Float64Array(1089*6)};setTimeout(tick,0);}
  };
}
const FIELD_TILE_SIZE=32,FIELD_TILE_LIMIT=1024; // ~51 MiB of phasor buffers.
let lastProcessingStats=null;
const fieldTiles={epoch:0,previous:0,baseStep:0,previousStep:0,previousFreq:0,ready:false,dirtyPhysics:true,
  cache:new Map(),queue:[],pending:null,serial:0,revision:0,worker:null,fallback:false,scene:null,
  viewKey:'',ring:1,jobTimer:null,viewTimer:null,frameMs:16.7,lastFrame:0,clock:0,
  received:0,cacheHits:0,lastCameraX:0,lastCameraY:0,panX:0,panY:0,progress:0,preview:false,currentComplete:false};
function fieldTileKey(epoch,level,tx,ty){return epoch+':'+level+':'+tx+':'+ty;}
// Camera-only LOD: never changes sLength, element dl, MoM mesh, or scene epoch.
const adaptiveFields={enabled:true,level:0,penalty:0,slowSince:0,fastSince:0,
  changedAt:0,cameraAt:0,lastZoom:1,baselineMs:0,baselineSince:0,baselineSum:0,baselineSamples:0};
function fieldCameraLevel(){
  let level=adaptiveFields.enabled?Math.min(0,adaptiveFields.level):0;
  // Bound raster cost as well as tile memory; CSS pixels, not device pixels.
  const maxCells=typeof navigator!=='undefined'&&/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent||'')?90000:180000;
  // Both modes obey the same safety limits. Starting adaptive at level <= 0
  // keeps it at least as fine as the fixed grid at this zoom, including its cap.
  while(width*height/(sLength*zoom*2**level)**2>maxCells ||
    Math.ceil(width/(sLength*zoom*2**level)/32+2)*Math.ceil(height/(sLength*zoom*2**level)/32+2)>600)level++;
  return level;
}
function updateAdaptiveFieldResolution(now=performance.now()){
  const a=adaptiveFields;if(!a.enabled||!simulate||fieldTiles.dirtyPhysics||document.hidden)return;
  const old=fieldCameraLevel();
  if(zoom!==a.lastZoom){a.lastZoom=zoom;a.cameraAt=now;a.fastSince=0;}
  const moving=!!pointerGesture||now-a.cameraAt<180;
  // Calibrate on completed, stationary frames before adding detail. A stable
  // 30 Hz device must not be permanently blocked by a hard-coded 45 FPS gate.
  if(!a.baselineMs){
    if(moving||waitProcess){a.baselineSince=0;a.baselineSum=0;a.baselineSamples=0;}
    else{
      if(!a.baselineSince)a.baselineSince=now;
      a.baselineSum+=fieldTiles.frameMs;a.baselineSamples++;
      if(now-a.baselineSince>=600)a.baselineMs=Math.max(16.7,a.baselineSum/a.baselineSamples);
    }
  }
  const baseline=a.baselineMs||16.7;
  // Camera motion and rebuilding tiles are transient costs, not steady load.
  // Do not let a zoom or preset change accumulate a lasting quality penalty.
  if(moving||waitProcess||!a.baselineMs){a.slowSince=0;a.fastSince=0;}
  // Sustained slowdown backs off quickly; recovery needs several steady seconds.
  else if(fieldTiles.frameMs>baseline*1.45){
    a.fastSince=0;if(!a.slowSince)a.slowSince=now;
    if(now-a.slowSince>900&&now-a.changedAt>1200){a.penalty=Math.min(3,a.penalty+1);a.slowSince=now;a.changedAt=now;}
  }else{
    a.slowSince=0;
    if(fieldTiles.frameMs<baseline*1.12&&!moving&&!waitProcess){
      if(!a.fastSince)a.fastSince=now;
      if(now-a.fastSince>5000&&now-a.changedAt>5000){a.penalty=Math.max(0,a.penalty-1);a.fastSince=now;a.changedAt=now;}
    }else a.fastSince=0;
  }
  // Hysteresis around powers of two avoids flickering between grids at a boundary.
  const targetPixels=sLength*2**a.penalty;
  let next=Math.min(0,a.level);
  while(sLength*zoom*2**next<targetPixels*.70&&next<0)next++;
  if(a.baselineMs&&!moving&&!waitProcess&&fieldTiles.frameMs<baseline*1.3&&now-a.changedAt>450&&sLength*zoom*2**next>targetPixels*1.55&&next>-3)next--;
  a.level=next;
  if(fieldCameraLevel()!==old){
    a.changedAt=now;a.fastSince=0;
    fieldTiles.revision++;fieldTiles.viewKey='';resetTemporalCache();fieldPlan(true);
  }
}
function resetAdaptiveFieldController(){
  const a=adaptiveFields;
  a.level=0;a.penalty=0;a.slowSince=0;a.fastSince=0;
  a.baselineMs=0;a.baselineSince=0;a.baselineSum=0;a.baselineSamples=0;
  a.changedAt=performance.now();a.lastZoom=zoom;
  a.cameraAt=a.changedAt;
  fieldTiles.lastFrame=0;fieldTiles.frameMs=16.7;
}
function setAdaptiveFieldResolution(enabled){
  adaptiveFields.enabled=!!enabled;resetAdaptiveFieldController();
  fieldTiles.viewKey='';requestCameraUpdate();resetTemporalCache();
}
function fieldTileBounds(level){
  const size=32*sLength*zoom*2**level;
  return {x0:Math.floor(-orig[0]/size),x1:Math.floor((width-orig[0])/size),y0:Math.floor((orig[1]-height)/size),y1:Math.floor(orig[1]/size)};
}
function fieldWorkerFallback(){
  if(fieldTiles.worker)fieldTiles.worker.terminate();
  fieldTiles.fallback=true;fieldTiles.pending=null;fieldTiles.ready=false;
  const scope={postMessage:m=>setTimeout(()=>fieldWorkerMessage(m),0)};fieldWorkerMain(scope);
  fieldTiles.worker={postMessage:m=>scope.onmessage({data:m}),terminate:()=>scope.onmessage({data:{kind:'cancel'}})};
  if(fieldTiles.scene)fieldTiles.worker.postMessage(fieldTiles.scene);
}
function fieldWorkerInit(){
  if(fieldTiles.worker)return;
  try{
    const url=URL.createObjectURL(new Blob(['('+fieldWorkerMain.toString()+')(self);'],{type:'text/javascript'}));
    const worker=new Worker(url);URL.revokeObjectURL(url);fieldTiles.worker=worker;
    worker.onmessage=e=>fieldWorkerMessage(e.data);worker.onerror=e=>{e.preventDefault();fieldWorkerFallback();};
  }catch(e){fieldWorkerFallback();}
}
function fieldWorkerMessage(m){
  if(m.epoch!==fieldTiles.epoch)return;
  if(m.kind==='ready'){fieldTiles.ready=true;fieldTiles.pending=null;fieldSchedule();return;}
  if(m.kind!=='tile'||!fieldTiles.pending||m.id!==fieldTiles.pending.id)return;
  fieldTiles.pending=null;
  const key=fieldTileKey(m.epoch,m.level,m.tx,m.ty);
  fieldTiles.cache.set(key,{...m,lastUsed:++fieldTiles.clock});
  // Only arrivals overlapping the sampled viewport can change visible phasors.
  const view=gridView(),step=sLength/Scale*2**fieldCameraLevel(),ts=fieldTiles.baseStep*2**m.level;
  const xmin=view.x0*step,xmax=(view.x0+view.cols-1)*step,ymax=view.y0*step,ymin=(view.y0-view.rows+1)*step;
  if((m.tx+1)*32*ts>=xmin&&m.tx*32*ts<=xmax&&(m.ty+1)*32*ts>=ymin&&m.ty*32*ts<=ymax)fieldTiles.revision++;
  fieldTiles.received++;
  fieldEvict();fieldPlan(false);fieldSchedule();
}
function fieldEvict(){
  if(fieldTiles.cache.size<=FIELD_TILE_LIMIT)return;
  const level=fieldCameraLevel(),b=fieldTileBounds(level),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
  const entries=Array.from(fieldTiles.cache.entries());
  function score(t){
    if(t.epoch!==fieldTiles.epoch)return 1e9-t.lastUsed;
    const ratio=2**(t.level-level),x=(t.tx+.5)*ratio,y=(t.ty+.5)*ratio;
    const visible=x>=b.x0-1&&x<=b.x1+2&&y>=b.y0-1&&y<=b.y1+2;
    return (visible?-1e8:0)+Math.hypot(x-cx,y-cy)*1000-t.lastUsed*.001;
  }
  entries.sort((a,b)=>score(b[1])-score(a[1]));
  for(let i=0;fieldTiles.cache.size>FIELD_TILE_LIMIT;i++)fieldTiles.cache.delete(entries[i][0]);
}
function fieldPlan(force=false){
  if(!fieldTiles.scene||fieldTiles.dirtyPhysics)return;
  const level=fieldCameraLevel(),b=fieldTileBounds(level),key=[fieldTiles.epoch,level,b.x0,b.x1,b.y0,b.y1].join(',');
  if(key!==fieldTiles.viewKey){
    fieldTiles.viewKey=key;fieldTiles.ring=1;
    const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;fieldTiles.panX=cx-fieldTiles.lastCameraX;fieldTiles.panY=cy-fieldTiles.lastCameraY;fieldTiles.lastCameraX=cx;fieldTiles.lastCameraY=cy;
  }
  const queue=[],seen=new Set();let visible=0,complete=0;
  function add(l,x,y,priority){
    const key=fieldTileKey(fieldTiles.epoch,l,x,y);if(seen.has(key)||fieldTiles.cache.has(key))return;seen.add(key);
    queue.push({key,level:l,tx:x,ty:y,priority,step:fieldTiles.baseStep*2**l});
  }
  // A small preview grid fills newly exposed space quickly; exact fine tiles
  // replace it without interpolating colors or magnitudes.
  const coarse=fieldTileBounds(level+2);
  for(let y=coarse.y0;y<=coarse.y1;y++)for(let x=coarse.x0;x<=coarse.x1;x++)add(level+2,x,y,-100000+Math.hypot(x-(coarse.x0+coarse.x1)/2,y-(coarse.y0+coarse.y1)/2));
  for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++){
    visible++;if(fieldTiles.cache.has(fieldTileKey(fieldTiles.epoch,level,x,y)))complete++;
    else add(level,x,y,Math.hypot(x-(b.x0+b.x1)/2,y-(b.y0+b.y1)/2));
  }
  fieldTiles.progress=visible?complete/visible:1;waitProcess=complete<visible;
  if(!waitProcess)fieldTiles.currentComplete=true;
  // Prefetch growing rings, with a bias in the most recent pan direction.
  if(!waitProcess&&fieldTiles.cache.size<FIELD_TILE_LIMIT-8){
    const limit=Math.min(12,Math.max(b.x1-b.x0,b.y1-b.y0)+1);
    for(;fieldTiles.ring<=limit;fieldTiles.ring++){
      const r=fieldTiles.ring,before=queue.length;
      for(let y=b.y0-r;y<=b.y1+r;y++)for(let x=b.x0-r;x<=b.x1+r;x++){
        if(x!==b.x0-r&&x!==b.x1+r&&y!==b.y0-r&&y!==b.y1+r)continue;
        add(level,x,y,100000+r*100-Math.max(-50,Math.min(50,(x-fieldTiles.lastCameraX)*fieldTiles.panX+(y-fieldTiles.lastCameraY)*fieldTiles.panY)));
      }
      if(queue.length>before)break;
    }
  }
  queue.sort((a,b)=>a.priority-b.priority);fieldTiles.queue=queue;
  // Let a visible tile finish. Cancel obsolete background work promptly.
  const p=fieldTiles.pending;
  if(p&&queue.length&&queue[0].priority<100000&&p.priority>=100000){fieldTiles.worker.postMessage({kind:'cancel',id:p.id});fieldTiles.pending=null;}
  if(force)fieldSchedule();
}
function fieldSchedule(){
  if(fieldTiles.jobTimer)return;
  fieldTiles.jobTimer=setTimeout(()=>{
    fieldTiles.jobTimer=null;
    if(!fieldTiles.ready||fieldTiles.pending||fieldTiles.dirtyPhysics||document.hidden)return;
    while(fieldTiles.queue.length&&fieldTiles.cache.has(fieldTiles.queue[0].key))fieldTiles.queue.shift();
    const task=fieldTiles.queue[0];if(!task)return;
    const background=task.priority>=100000;
    if(background&&(pointerGesture||fieldTiles.frameMs>22)){fieldTiles.jobTimer=setTimeout(()=>{fieldTiles.jobTimer=null;fieldSchedule();},120);return;}
    fieldTiles.queue.shift();const id=++fieldTiles.serial;
    fieldTiles.pending={...task,id};
    fieldTiles.worker.postMessage({kind:'tile',epoch:fieldTiles.epoch,id,...task,budget:fieldTiles.fallback?(fieldTiles.frameMs>22?1:2):background?2:fieldTiles.frameMs>22?3:6});
  },fieldTiles.queue[0]?.priority>=100000?24:0);
}
function requestCameraUpdate(){
  // Camera changes never invalidate physics or the world-space tiles.
  adaptiveFields.cameraAt=performance.now();
  fieldTiles.revision++;
  if(fieldTiles.viewTimer)return;
  fieldTiles.viewTimer=setTimeout(()=>{fieldTiles.viewTimer=null;fieldPlan(true);},35);
}
// Compare model identities before rendering: component edits must invalidate
// physics even when a UI callback exits before requestFieldUpdate().
let solvedFieldModel=null;
function captureFieldModel() {
  return [freq,c,sLength,resolution,...antennas.flatMap(a=>[
    a,a.segments,a instanceof PassiveWire?null:a.currentSegments,
    a.segmentLengths,a.I0.a,a.I0.b,a.amp,a.phase,a instanceof Dipole?a.feedFraction:null,a instanceof Dipole?a.feedSeparation():null,a instanceof Dipole?a.feedMode:null,sourceRadius(a),a instanceof PECPlane?[...a.endPointA,...a.endPointB].join(','):null
  ])];
}
function ensureFieldModelCurrent() {
  if(fieldTiles.dirtyPhysics)return;
  const model=captureFieldModel();
  if(!solvedFieldModel||model.length!==solvedFieldModel.length||
      model.some((v,i)=>v!==solvedFieldModel[i]))requestFieldUpdate();
}
function startProcessingNewSetup(){
  const begin=performance.now(),dl=resolution===1?dl_lr:resolution===2?dl_mr:dl_hr;
  for(const a of antennas)a.setDl(dl);
  k=2*Math.PI*freq/c;
  const plane=currentPECPlane();
  const geometryError=planeGeometryError(plane,antennas);
  if(geometryError){
    // Retain the previous display and expose the geometry error rather than
    // attempting an invalid half-space image solution on every frame.
    fieldTiles.dirtyPhysics=false;processingScheduled=false;waitProcess=false;
    simulate=false;resetTemporalCache();
    passiveSolveInfo={message:geometryError,error:true};
    solvedFieldModel=captureFieldModel();
    if(selectedComponent)renderInspector();
    return;
  }
  solvePassiveWires();
  updateSourcePowers();
  const elements=[];
  for(const a of antennas){
    if(a instanceof PECPlane||a instanceof PECSlot)continue;
    const drive=a.I0;
    for(let i=0;i<a.segments.length;i++){
      const v=a.currentSegments[i],L=a.segmentLengths[i],jr=L*(v[0]*drive.a-v[2]*drive.b),yr=L*(v[1]*drive.a-v[3]*drive.b),ji=L*(v[0]*drive.b+v[2]*drive.a),yi=L*(v[1]*drive.b+v[3]*drive.a);
      if(jr||yr||ji||yi){
        const p=a.segments[i],radius=sourceRadius(a),side=plane?plane.side(p):0;
        elements.push(p[0],p[1],jr,yr,ji,yi,radius,side);
        if(plane){
          const mp=plane.mirrorPoint(p),mj=plane.mirrorCurrent([jr,yr,ji,yi]);
          elements.push(mp[0],mp[1],mj[0],mj[1],mj[2],mj[3],radius,side);
        }
      }
    }
  }
  if(fieldTiles.currentComplete||!fieldTiles.previous){
    fieldTiles.previous=fieldTiles.epoch;fieldTiles.previousStep=fieldTiles.baseStep;fieldTiles.previousFreq=fieldTiles.scene?fieldTiles.scene.omega/(2*Math.PI):freq;
  }
  fieldTiles.currentComplete=false;
  adaptiveFields.slowSince=0;adaptiveFields.fastSince=0;
  fieldTiles.epoch++;fieldTiles.baseStep=sLength/Scale;fieldTiles.dirtyPhysics=false;fieldTiles.ready=false;fieldTiles.pending=null;fieldTiles.queue=[];fieldTiles.viewKey='';
  for(const [key,t] of fieldTiles.cache)if(t.epoch!==fieldTiles.previous)fieldTiles.cache.delete(key);
  fieldTiles.scene={kind:'scene',epoch:fieldTiles.epoch,k,omega:2*Math.PI*freq,
    plane:plane?{x:plane.endPointA[0],y:plane.endPointA[1],nx:plane.normal[0],ny:plane.normal[1]}:null,
    elements:new Float64Array(elements),magnetic:new Float64Array(currentPECSlots().flatMap(s=>s.magnetic.flat())),c};
  fieldTiles.revision++;fieldTiles.received=0;fieldWorkerInit();fieldTiles.worker.postMessage(fieldTiles.scene);
  solvedFieldModel=captureFieldModel();
  simulate=true;processingScheduled=false;waitProcess=true;
  // Only reset the adaptive work-budget estimator. The independent frameTiming
  // clock is never reset by a solve, so reported FPS includes this stall.
  fieldTiles.lastFrame=0;
  lastProcessingStats={solveMs:performance.now()-begin,sources:elements.length/8,hasPEC:!!plane};
  fieldPlan(true);if(selectedComponent)renderInspector();
}
let visibleFields=null,fieldImage=null,visibleStamp='',frameCos=1,frameSin=0,lastFramePhase=NaN;
function updateFramePhase(){
  const theta=timeSim*(fieldTiles.scene?fieldTiles.scene.omega:2*Math.PI*freq);
  if(theta!==lastFramePhase){frameCos=Math.cos(theta);frameSin=Math.sin(theta);lastFramePhase=theta;}
}
function refreshVisibleFields(force=false){
  const view=gridView(),level=fieldCameraLevel(),stamp=[view.x0,view.y0,view.cols,view.rows,level,fieldTiles.revision].join(',');
  if(visibleFields){visibleFields.drawX=view.drawX;visibleFields.drawY=view.drawY;visibleFields.cell=view.cell;}
  if(!force&&visibleStamp===stamp)return;visibleStamp=stamp;
  const size=view.cols*view.rows;
  if(!visibleFields||visibleFields.cols!==view.cols||visibleFields.rows!==view.rows){
    visibleFields={...view,ExRe:new Float64Array(size),ExIm:new Float64Array(size),EyRe:new Float64Array(size),EyIm:new Float64Array(size),BRe:new Float64Array(size),BIm:new Float64Array(size),valid:new Uint8Array(size),stale:new Uint8Array(size)};
    fieldImage=createImage(view.cols,view.rows);fieldImage.loadPixels();
  }
  const f=visibleFields,arrays=[f.ExRe,f.ExIm,f.EyRe,f.EyIm,f.BRe,f.BIm],memos=new Map(),usedTiles=new Set();let previews=0,stale=0,missing=0;
  const epochs=[{epoch:fieldTiles.epoch,step:fieldTiles.baseStep,old:false},{epoch:fieldTiles.previous,step:fieldTiles.previousStep,old:true}];
  function lookup(ep,l,x,y){
    const key=ep+':'+l;let memo=memos.get(key);
    if(memo&&memo.x===x&&memo.y===y)return memo.tile;
    const tile=fieldTiles.cache.get(fieldTileKey(ep,l,x,y));if(tile)tile.lastUsed=fieldTiles.clock;
    memos.set(key,{x,y,tile});return tile;
  }
  const worldStep=sLength/Scale*2**level,levels=[...new Set([level,level+1,level+2,level+3,0,1,2,3,4,5])];
  const plane=fieldTiles.scene?.plane;
  for(let row=0;row<view.rows;row++)for(let col=0;col<view.cols;col++){
    const idx=row*view.cols+col,wx=(view.x0+col)*worldStep,wy=(view.y0-row)*worldStep;let chosen=null,gx=0,gy=0,old=false,chosenLevel=level,chosenStep=worldStep;
    for(const ep of epochs){if(!ep.epoch||!ep.step)continue;
      // Fine first, then coarser previews. Other levels retain pan/zoom history.
      for(const l of levels){const step=ep.step*2**l,x=wx/step,y=wy/step,tx=Math.floor(x/32),ty=Math.floor(y/32),tile=lookup(ep.epoch,l,tx,ty);
        if(tile){chosen=tile;gx=x-tx*32;gy=y-ty*32;old=ep.old;chosenLevel=l;chosenStep=step;break;}}
      if(chosen)break;
    }
    f.valid[idx]=chosen?1:0;f.stale[idx]=old?1:0;
    if(!chosen){missing++;for(const a of arrays)a[idx]=0;continue;}
    usedTiles.add(fieldTileKey(chosen.epoch,chosenLevel,chosen.tx,chosen.ty));
    if(old)stale++;if(chosenLevel!==level||old)previews++;
    const x0=Math.max(0,Math.min(31,Math.floor(gx))),y0=Math.max(0,Math.min(31,Math.floor(gy))),u=Math.max(0,Math.min(1,gx-x0)),v=Math.max(0,Math.min(1,gy-y0)),d=chosen.data;
    const p=(y0*33+x0)*6,q=p+6,r=p+33*6,s=r+6;
    let a=(1-v)*(1-u),b=(1-v)*u,cc=v*(1-u),dd=v*u;
    // Do not bilinearly blend field samples from opposite half-spaces:
    // that would create spurious transmission across the ideal PEC boundary.
    if(plane){
      const planeSide=(px,py)=>((px-plane.x)*plane.nx+(py-plane.y)*plane.ny>=0?1:-1);
      const side=planeSide(wx,wy),x0w=(chosen.tx*32+x0)*chosenStep,y0w=(chosen.ty*32+y0)*chosenStep;
      if(planeSide(x0w,y0w)!==side)a=0;
      if(planeSide(x0w+chosenStep,y0w)!==side)b=0;
      if(planeSide(x0w,y0w+chosenStep)!==side)cc=0;
      if(planeSide(x0w+chosenStep,y0w+chosenStep)!==side)dd=0;
      const total=a+b+cc+dd;
      if(total>1e-12){a/=total;b/=total;cc/=total;dd/=total;}
      // Very close to a plane with no same-side lattice corner, a nearest
      // original corner is the best available preview until finer tiles arrive.
      else {a=(1-v)*(1-u);b=(1-v)*u;cc=v*(1-u);dd=v*u;}
    }
    for(let c=0;c<6;c++)arrays[c][idx]=a*d[p+c]+b*d[q+c]+cc*d[r+c]+dd*d[s+c];
  }
  f.previousFreq=fieldTiles.previousFreq;
  f.cacheSignature=[view.x0,view.y0,level,fieldTiles.epoch,fieldTiles.previousFreq,...[...usedTiles].sort()].join('|');
  fieldTiles.preview=!!previews;fieldTiles.stalePixels=stale;fieldTiles.missingPixels=missing;
}

// Sample the animated field on a screen-space lattice independent of field quality.
// Phase each corner before interpolation so retained scenes use their own frequency.
function sampleArrowField(f, screenX, screenY, ct, st, oldCos, oldSin, out) {
  const gx=Math.max(0,Math.min(f.cols-1,(screenX-f.drawX)/f.cell));
  const gy=Math.max(0,Math.min(f.rows-1,(screenY-f.drawY)/f.cell));
  const x=Math.floor(gx),y=Math.floor(gy),u=gx-x,v=gy-y;
  out.fill(0);
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const weight=(dx?u:1-u)*(dy?v:1-v);
    if(weight===0)continue;
    const idx=Math.min(y+dy,f.rows-1)*f.cols+Math.min(x+dx,f.cols-1);
    if(!f.valid[idx])return false;
    const pc=f.stale[idx]?oldCos:ct,ps=f.stale[idx]?oldSin:st;
    out[0]+=weight*(f.ExRe[idx]*pc-f.ExIm[idx]*ps);
    out[1]+=weight*(f.EyRe[idx]*pc-f.EyIm[idx]*ps);
    out[2]+=weight*(f.BRe[idx]*pc-f.BIm[idx]*ps);
  }
  return true;
}

// Bucketed, bounded, lazy temporal image cache. The images are ONLY the costly
// heatmap, not the wires, chevrons or selection/UI (which stay phase-accurate).
// Adjacent cached phases are alpha-blended to avoid quantization judder.
const temporalCache={enabled:true,key:'',frames:[],count:0,hits:0,misses:0,
  rasterMs:0,cacheMs:0,rasterCount:0,drawCount:0,reason:'Warming up'};
function resetTemporalCache(){if(temporalCache.timer)clearTimeout(temporalCache.timer);temporalCache.timer=null;temporalCache.job=null;temporalCache.cursor=0;temporalCache.key='';temporalCache.frames=[];temporalCache.count=0;
  temporalCache.hits=0;temporalCache.misses=0;temporalCache.rasterMs=0;
  temporalCache.cacheMs=0;temporalCache.rasterCount=0;temporalCache.drawCount=0;
}
function updateTemporalCacheConfig(f){
  // p5 Images may keep both CPU pixels and canvas backing store. Conservatively
  // account for both, and prevent a partially populated LRU that never warms.
  const bytes=Math.max(1,f.cols*f.rows*8);
  const budget=typeof navigator!=='undefined'&&/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)?48*1048576:176*1048576;
  const bins=Math.min(192,Math.floor(budget/bytes));
  const count=bins>=48?bins:0;
  const mode=show_EField?'E':show_BField?'B':show_EnergyDensity?'U':'S';
  const key=[f.cacheSignature,fieldTiles.scene?.omega,mode,displayGamma.heatmap,f.cols,f.rows,count].join(';');
  if(temporalCache.key!==key){resetTemporalCache();temporalCache.key=key;temporalCache.count=count;temporalCache.frames=new Array(count);}
  return count;
}
function paintFieldImage(f,ct,st,target,rowStart=0,rowEnd=f.rows,commit=true) {
    const fieldPixels = target.pixels;
    const oldCos=Math.cos(timeSim*2*Math.PI*f.previousFreq),oldSin=Math.sin(timeSim*2*Math.PI*f.previousFreq);

    for (let j = rowStart; j < rowEnd; j++) {
      for (let i = 0; i < f.cols; i++) {
        const idx = j * f.cols + i;
        const pc=f.stale[idx]?oldCos:ct,ps=f.stale[idx]?oldSin:st;
        const Ex_t = f.ExRe[idx] * pc - f.ExIm[idx] * ps;
        const Ey_t = f.EyRe[idx] * pc - f.EyIm[idx] * ps;
        const B_t = f.BRe[idx] * pc - f.BIm[idx] * ps;

        // Color calculation
        let r, g, b, a;

        if (show_BField) {
          let colorSizeB_Blue = 255 * heatTransfer(-B_t * Math.abs(B_t), k1, 256);
          let colorSizeB_Red = 255 * heatTransfer(B_t * Math.abs(B_t), k1, 256);
          let colorSizeMag = heatTransfer(Math.abs(B_t), k1B, 256);

          r = Math.round(colorSizeB_Red);
          g = 0;
          b = Math.round(colorSizeB_Blue);
          a = colorSizeMag;
        } else if (show_EField || show_EnergyDensity) {
          let E_mag_2 = show_EnergyDensity ? energyDensity(Ex_t,Ey_t,B_t) : Ex_t * Ex_t + Ey_t * Ey_t;
          let colorSizeEA = heatTransfer(E_mag_2, k3, 256);
          let colorSizeEB = 255 * heatTransfer(E_mag_2, k4, 256);

          // Convert HSB to RGB
          let hue = (255 - colorSizeEB) / 500;
          let sat = 1.0;
          let bright = 1.0;
          let c_val = bright * sat;
          let x_val = c_val * (1 - Math.abs(((hue * 6) % 2) - 1));
          let m_val = bright - c_val;

          let r1, g1, b1;
          let h = hue * 6;
          if (h < 1) {
            r1 = c_val;
            g1 = x_val;
            b1 = 0;
          } else if (h < 2) {
            r1 = x_val;
            g1 = c_val;
            b1 = 0;
          } else if (h < 3) {
            r1 = 0;
            g1 = c_val;
            b1 = x_val;
          } else if (h < 4) {
            r1 = 0;
            g1 = x_val;
            b1 = c_val;
          } else if (h < 5) {
            r1 = x_val;
            g1 = 0;
            b1 = c_val;
          } else {
            r1 = c_val;
            g1 = 0;
            b1 = x_val;
          }

          r = Math.round((r1 + m_val) * 255);
          g = Math.round((g1 + m_val) * 255);
          b = Math.round((b1 + m_val) * 255);
          a = colorSizeEA;
        } else if (show_EnergyFlux) {
          let Energy_flux_mag = Math.sqrt(Ex_t * Ex_t + Ey_t * Ey_t)*Math.abs(B_t);
          let colorSizeEnergyA = heatTransfer(Energy_flux_mag, k5, 256);
          let colorSizeEnergyB = 255 * heatTransfer(Energy_flux_mag, k6, 256);

          let hue = (255 - colorSizeEnergyB) / 500;
          let sat = 1.0;
          let bright = 1.0;
          let c_val = bright * sat;
          let x_val = c_val * (1 - Math.abs(((hue * 6) % 2) - 1));
          let m_val = bright - c_val;

          let r1, g1, b1;
          let h_val = hue * 6;
          if (h_val < 1) {
            r1 = c_val;
            g1 = x_val;
            b1 = 0;
          } else if (h_val < 2) {
            r1 = x_val;
            g1 = c_val;
            b1 = 0;
          } else if (h_val < 3) {
            r1 = 0;
            g1 = c_val;
            b1 = x_val;
          } else if (h_val < 4) {
            r1 = 0;
            g1 = x_val;
            b1 = c_val;
          } else if (h_val < 5) {
            r1 = x_val;
            g1 = 0;
            b1 = c_val;
          } else {
            r1 = c_val;
            g1 = 0;
            b1 = x_val;
          }

          r = Math.round((r1 + m_val) * 255);
          g = Math.round((g1 + m_val) * 255);
          b = Math.round((b1 + m_val) * 255);
          a = colorSizeEnergyA;
        }

        // One pixel per field cell. RGB already includes the original brightness.
        const pixelIndex = idx * 4;
        fieldPixels[pixelIndex] = r * a;
        fieldPixels[pixelIndex + 1] = g * a;
        fieldPixels[pixelIndex + 2] = b * a;
        fieldPixels[pixelIndex + 3] = 255;
      }
    }
    if(commit)target.updatePixels();
}
function cachedHeatmap(f) {
  if(!temporalCache.enabled){temporalCache.reason='Off';return null;}
  if(waitProcess||fieldTiles.dirtyPhysics||fieldTiles.preview||fieldTiles.stalePixels||fieldTiles.missingPixels){
    temporalCache.reason='Waiting for stable fields';return null;
  }
  const count=updateTemporalCacheConfig(f);
  if(!count){temporalCache.reason='Viewport exceeds cache memory budget';return null;}
  const theta=timeSim*fieldTiles.scene.omega;
  const position=((theta/(2*Math.PI))%1+1)%1*count;
  const lo=Math.floor(position),hi=(lo+1)%count,alpha=position-lo;
  queueTemporalWarmup(f,lo);
  const first=temporalCache.frames[lo],second=temporalCache.frames[hi];
  if(first&&(alpha<.001||second)){
    temporalCache.hits++;temporalCache.reason='Active';return [first,second,alpha];
  }
  temporalCache.misses++;temporalCache.reason='Warming up';
  // At most the ordinary live raster is generated in the animation callback.
  return null;
}
function queueTemporalWarmup(f,preferred){
  if(temporalCache.timer||document.hidden)return;
  const key=temporalCache.key;
  temporalCache.timer=setTimeout(()=>{
    temporalCache.timer=null;
    if(key!==temporalCache.key||f!==visibleFields||fieldTiles.dirtyPhysics||waitProcess||fieldTiles.preview||fieldTiles.stalePixels||fieldTiles.missingPixels||pointerGesture||!temporalCache.enabled)return;
    let job=temporalCache.job;
    if(!job){
      let index=preferred;
      if(temporalCache.frames[index]){
        index=temporalCache.cursor||0;
        while(index<temporalCache.count&&temporalCache.frames[index])index++;
        temporalCache.cursor=index;
      }
      if(index>=temporalCache.count)return;
      const bitmap=createImage(f.cols,f.rows);bitmap.loadPixels();
      const phase=2*Math.PI*index/temporalCache.count;
      job=temporalCache.job={index,bitmap,row:0,ct:Math.cos(phase),st:Math.sin(phase)};
    }
    const start=performance.now();
    do{const end=Math.min(f.rows,job.row+2);paintFieldImage(f,job.ct,job.st,job.bitmap,job.row,end,false);job.row=end;}
    while(job.row<f.rows&&performance.now()-start<1.5);
    temporalCache.rasterMs+=performance.now()-start;
    if(job.row===f.rows){job.bitmap.updatePixels();temporalCache.frames[job.index]=job.bitmap;temporalCache.job=null;temporalCache.rasterCount++;}
    // One bounded job between frames; subsequent frames schedule more work.
  },0);
}

function renderFields() {
  if (simulate) {

    updateFramePhase();
    refreshVisibleFields();
    const f = visibleFields;
    const cached=cachedHeatmap(f);
    if(!cached) {
      const before=performance.now();
      paintFieldImage(f,frameCos,frameSin,fieldImage);
      temporalCache.rasterMs+=performance.now()-before;
      temporalCache.rasterCount++;
    }

    // Preserve exact cell size and clip partial edge cells rather than stretching.
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(0, 0, width, height);
    drawingContext.clip();
    drawingContext.imageSmoothingEnabled = false;
    if(cached){
      image(cached[0],f.drawX,f.drawY,f.cols*f.cell,f.rows*f.cell);
      if(cached[2]>0.001){
        drawingContext.globalAlpha=cached[2];
        image(cached[1],f.drawX,f.drawY,f.cols*f.cell,f.rows*f.cell);
        drawingContext.globalAlpha=1;
      }
    } else image(fieldImage, f.drawX, f.drawY, f.cols * f.cell, f.rows * f.cell);
    drawingContext.restore();
  }

  
  
  
  
  // Original field vectors and animated wire currents.

  if (simulate && (show_EField || show_EnergyFlux)) {
    push();
    drawingContext.beginPath();
    drawingContext.rect(0, 0, width, height);
    drawingContext.clip();
    updateFramePhase();
    refreshVisibleFields();
    const f = visibleFields;
    const oldCos=Math.cos(timeSim*2*Math.PI*f.previousFreq),oldSin=Math.sin(timeSim*2*Math.PI*f.previousFreq);
    const ct = frameCos, st = frameSin;
    const vector = new Float64Array(3);
    const ctx=drawingContext;
    ctx.strokeStyle='#000';ctx.fillStyle='#000';ctx.lineWidth=1;
    ctx.beginPath();
    const arrowSpacing=fieldArrowDensity>0?ARROW_SPACING_PX/Math.sqrt(fieldArrowDensity):Infinity;
    for (let screenX = arrowSpacing / 2; screenX < width; screenX += arrowSpacing) {
      for (let screenY = arrowSpacing / 2; screenY < height; screenY += arrowSpacing) {
        if (!sampleArrowField(f, screenX, screenY, ct, st, oldCos, oldSin, vector)) continue;
        const [Ex_t, Ey_t, B_t] = vector;

        // === Draw E field arrows ===
        if (show_EField) {
          let E_mag = Math.sqrt(Ex_t * Ex_t + Ey_t * Ey_t);
          if (E_mag > 1e-8) {
            let arrow_l = maxArrowLen * Math.pow(squiz(E_mag, k2),displayGamma.arrows);

            let dx = Ex_t * (arrow_l / E_mag);
            let dy = Ey_t * (arrow_l / E_mag);

            ctx.moveTo(screenX+1,screenY);
            ctx.arc(screenX,screenY,1,0,2*Math.PI);
            ctx.moveTo(screenX,screenY);
            ctx.lineTo(screenX+dx,screenY-dy);
          }
        }

        // === Draw Energy Flux arrows ===
        if (show_EnergyFlux) {
          let E_flux_mag = Math.sqrt(Ex_t * Ex_t + Ey_t * Ey_t) * Math.abs(B_t);
          if (E_flux_mag > 1e-8) {
            let arrow_l = maxArrowLen * Math.pow(squiz(E_flux_mag, k7),displayGamma.arrows);

            // Poynting vector direction (S ~ E × B)
            let dx = Ey_t * B_t;
            let dy = -(Ex_t * B_t);

            dx *= arrow_l / E_flux_mag;
            dy *= arrow_l / E_flux_mag;

            ctx.moveTo(screenX+1,screenY);
            ctx.arc(screenX,screenY,1,0,2*Math.PI);
            ctx.moveTo(screenX,screenY);
            ctx.lineTo(screenX+dx,screenY-dy);
          }
        }
      }
    }
    ctx.stroke();ctx.fill();
    pop();
  }

}
// Component palette and inspector share model-supplied geometry/properties.
// Self-contained drop-in sketch: native HTML/CSS are mounted by setup().
let selectedComponent = null;
let activeTool = 'select';
let placementType = null;
let placementStart = null;
let pointerGesture = null;
let hoverPoint = null;
let componentSerial = 0;
let ui = {};

// Descriptors own placement; the solver sees only complex current elements.
const componentTypes = {

  hertzian: {
    name:'Hertzian dipole', description:'Position + direction · ideal current element',
    firstHint:'Click the source position', secondHint:'Click to set direction (symbol length is not physical)',
    validate:(a,b)=>length2D(a,b)>.001,
    invalidHint:'Choose a different point to set the direction',
    create:(a,b)=>configureSource(new HertzianDipole(c/freq,a,Math.atan2(b[1]-a[1],b[0]-a[0]),10,0),'hertzian','Hertzian')
  },
  smallLoop: {
    name:'Small circular loop', description:'Click a center · uniform circulating current', oneClick:true,
    firstHint:'Click the loop center; adjust radius in Properties',
    create:a=>configureSource(new SmallLoop(c/freq,a,.08*(c/freq)/(2*Math.PI),100*defAmp,0),'smallLoop','Loop')
  },

  dipole: {
    name:'Center-fed dipole', description:'Thin PEC body · prescribed feed voltage',
    firstHint:'Click the first endpoint', secondHint:'Click the second endpoint',
    validate:(a,b)=>length2D(a,b)>defaultDipoleSep+.01,
    invalidHint:'Choose endpoints more than 0.21 units apart',
    create:(a,b)=>configureSource(new Dipole(c/freq,a,b,DEFAULT_WIRE_FEED_VOLTAGE,0,thickDipole/Scale),'dipole','Dipole')
  },
  
  endFed: {
    name:'End-fed antenna', description:'Voltage-fed long arm + explicit short counterpoise',
    firstHint:'Click the counterpoise tip', secondHint:'Click the long-arm tip (feed near the first endpoint)',
    validate:(a,b)=>length2D(a,b)>.4, invalidHint:'Choose endpoints more than 0.4 units apart',
    create:(a,b)=>configureSource(new EndFedAntenna(c/freq,a,b,DEFAULT_WIRE_FEED_VOLTAGE,0),'endFed','End-fed')
  },
  linearArray: {
    name:'Linear array', description:'Center + axis · dipoles or circular loops',
    firstHint:'Click the array center', secondHint:'Click to set the positive array axis',
    validate:(a,b)=>length2D(a,b)>.001, invalidHint:'Choose a different point to set the axis',
    create:(a,b)=>configureSource(new LinearArray(c/freq,a,Math.atan2(b[1]-a[1],b[0]-a[0])),'linearArray','Array')
  },

  passiveWire: {
    name:'Passive PEC wire', description:'Two endpoints · coupled induced currents',
    firstHint:'Click the first wire endpoint', secondHint:'Click the second wire endpoint',
    validate:(a,b)=>length2D(a,b)>=.08, invalidHint:'Wire must be at least 0.08 units long',
    create:(a,b)=>configureSource(new PassiveWire(c/freq,a,b),'passiveWire','PEC wire')
  },
  pecPlane: {
    name:'Infinite PEC plane', description:'Two points define its trace · image method on both sides · one plane only',
    firstHint:'Click the first point on the infinite PEC plane', secondHint:'Click another point to set its direction',
    validate:(a,b)=>length2D(a,b)>.08&&!currentPECPlane()&&!planeGeometryError(new PECPlane(c/freq,a,b),antennas),
    invalidHint:'Plane already present, too short, or intersects an existing component',
    create:(a,b)=>configureSource(new PECPlane(c/freq,a,b),'pecPlane','PEC plane')
  },
  pecSlot: {
    name:'Slot in PEC plane',description:'Click the plane · finite z-length and opening width',oneClick:true,
    firstHint:'Click the PEC plane to poke a finite slot; adjust length and width in Properties',
    create:p=>configureSource(new PECSlot(c/freq,currentPECPlane(),p),'pecSlot','PEC slot')
  }
  
};
function configureSource(source,type,name) {
  source.setDl(resolution===1?dl_lr:resolution===2?dl_mr:dl_hr);
  source.componentType=type; source.label=`${name} ${++componentSerial}`;
  return source;
}

// Example scenes use the exact same component classes and coupled passive solve
// as manually placed components. Distances are measured relative to lambda.
const exampleScenes = {
  rotating: 'Rotating dipoles · spiral waves',
  halfwave: 'Half-wave center-fed dipole',
  yagi: 'Yagi–Uda · rear suppression',
  quadrupole: 'Electric quadrupole · two Hertzian dipoles'
};

function makeRotatingDipoleScene() {
  const wavelength = c / freq, moment = 10;
  return [
    configureSource(new HertzianDipole(wavelength,[0,0],0,moment,0),'hertzian','Hertzian'),
    configureSource(new HertzianDipole(wavelength,[0,0],Math.PI/2,moment,Math.PI/2),'hertzian','Hertzian')
  ];
}

function makeHalfWaveDipoleScene() {
  const wavelength=c/freq,half=wavelength/4;
  const source=configureSource(new Dipole(wavelength,[0,-half],[0,half],
    DEFAULT_WIRE_FEED_VOLTAGE,0,thickDipole/Scale),'dipole','Dipole');
  source.setSep(Math.min(.05,.01*wavelength));
  source.label='Half-wave dipole · center fed';
  return [source];
}

function makeElectricQuadrupoleScene() {
  const wavelength=c/freq,d=.04*wavelength,moment=25;
  // Equal, opposite current moments, separated along their common X axis.
  // Net electric dipole and r cross J vanish. The quadrupole is leading;
  // higher multipoles remain at finite separation.
  return [[[-d,0],Math.PI,'Quadrupole · left −X'],
    [[d,0],0,'Quadrupole · right +X']].map(([position,angle,label])=>{
    const source=configureSource(new HertzianDipole(wavelength,position,angle,moment,0),'hertzian','Hertzian');
    source.label=label;
    source.getNotes=()=>[{text:'This preset starts with two equal, opposite Hertzian dipoles separated along their common axis by 0.08λ. The electric quadrupole is the leading contribution; finite separation retains higher multipoles. Editing a source can change the cancellation.'}];
    return source;
  });
}

function makeYagiUdaScene() {
  const wavelength = c / freq;
  // Boom follows +X; all four rods are parallel to Y. Locally optimized
  // with this voltage-fed MoM solver at the default λ = 2.75 / 0.63125.
  // Objective: rear-hemisphere power fraction + 0.30 * rear peak / forward
  // power, with penalties for a displaced main beam or directivity < 4.
  // Minimized the worse objective at shared segment lengths 0.20 and 0.04;
  // checked intermediate meshes and 0.03. This is not an impedance match
  // or a broadband optimum. Radii and finite feed gap remain as below.
  const geometry = {
    reflectorLength: 0.503881,
    drivenLength: 0.519881,
    director1Length: 0.459147,
    director2Length: 0.405487,
    reflectorSpacing: 0.211900,
    director1Spacing: 0.100113,
    director2Spacing: 0.307410,
  };
  const drivenPosition = -.20;
  const rod = (xLambda,lengthLambda,label) => {
    const x=xLambda*wavelength, half=.5*lengthLambda*wavelength;
    const wire=configureSource(new PassiveWire(wavelength,[x,-half],[x,half]),'passiveWire','PEC wire');
    wire.radius=Math.max(.008,Math.min(.03,.004*wavelength));
    wire.targetLength=pecMaxSegmentLength;
    wire.rebuild();
    wire.label=label;
    return wire;
  };
  const reflector=rod(drivenPosition-geometry.reflectorSpacing,geometry.reflectorLength,'Reflector · passive PEC');
  const drivenX=drivenPosition*wavelength, drivenHalf=.5*geometry.drivenLength*wavelength;
  const driven=configureSource(new Dipole(wavelength,
    [drivenX,-drivenHalf],[drivenX,drivenHalf],60,0,thickDipole/Scale),
    'dipole','Dipole');
  driven.setSep(Math.min(.05,.012*wavelength));
  driven.label='Driven dipole · active';
  const director1=rod(drivenPosition+geometry.director1Spacing,geometry.director1Length,'Director 1 · passive PEC');
  const director2=rod(drivenPosition+geometry.director1Spacing+geometry.director2Spacing,geometry.director2Length,'Director 2 · passive PEC');
  return [reflector,driven,director1,director2];
}

// Scene replacement must not reuse the previous scene as a field preview.
// Advance the epoch before cancellation so already-posted worker replies are stale.
function clearSceneFieldCaches() {
  fieldTiles.epoch++;
  fieldTiles.dirtyPhysics=true;
  fieldTiles.ready=false;
  if(fieldTiles.worker)fieldTiles.worker.postMessage({kind:'cancel'});
  if(fieldTiles.jobTimer!==null)clearTimeout(fieldTiles.jobTimer);
  if(fieldTiles.viewTimer!==null)clearTimeout(fieldTiles.viewTimer);
  fieldTiles.jobTimer=null;fieldTiles.viewTimer=null;
  fieldTiles.pending=null;fieldTiles.queue=[];fieldTiles.cache.clear();
  fieldTiles.scene=null;fieldTiles.previous=0;fieldTiles.previousStep=0;fieldTiles.previousFreq=0;
  fieldTiles.currentComplete=false;fieldTiles.viewKey='';fieldTiles.progress=0;
  fieldTiles.preview=false;fieldTiles.stalePixels=0;fieldTiles.missingPixels=0;
  fieldTiles.received=0;fieldTiles.cacheHits=0;fieldTiles.revision++;
  visibleFields=null;fieldImage=null;visibleStamp='';lastFramePhase=NaN;
  EM_phase_amp_map.clear();A_map.clear();
  resetTemporalCache();
  radiationCache.scene=null;radiationCache.power=null;radiationCache.peak=0;radiationCache.stamp='';
  pecSurfaceCache.epoch=-1;pecSurfaceCache.stamp='';pecSurfaceCache.samples=[];pecSurfaceCache.peak=0;
  solvedFieldModel=null;lastProcessingStats=null;
  sourcePowerState={valid:false,message:'Awaiting solve',values:new Map()};
  simulate=false;waitProcess=true;
}

function loadExampleScene(key,askBeforeReplacing=true) {
  if (!(key in exampleScenes)) return false;
  if (askBeforeReplacing && antennas.length &&
      !window.confirm('Replace the current scene with "'+exampleScenes[key]+'"? Current edits will be lost.')) return false;
  const factories={rotating:makeRotatingDipoleScene,yagi:makeYagiUdaScene,halfwave:makeHalfWaveDipoleScene,quadrupole:makeElectricQuadrupoleScene};
  antennas=factories[key]();
  clearSceneFieldCaches();
  requestFieldUpdate();
  // Put the new configuration back in view even after user panning/zooming.
  zoom=1; orig=[width/2+.1,height/2+.1];
  setTool('pan');
  selectComponent(key==='yagi'?antennas[1]:antennas[0]);
  requestFieldUpdate();
  return true;
}

const interfaceCSS = `
html,body {margin:0!important;padding:0!important;width:100%;height:100%;overflow:hidden;background:#090d13;}
#em-app {--panel:#121923;--line:#283340;--muted:#93a3b6;--accent:#77e2c3;position:fixed;inset:0;z-index:10;display:grid;grid-template-rows:auto minmax(0,1fr) auto;color:#e6edf5;background:#090d13;font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark;}
#em-app * {box-sizing:border-box;}
#em-app [hidden] {display:none!important;}
#em-app button,#em-app input,#em-app select {font:inherit;}
#em-app button,#em-app select,#em-app input[type=number] {color:inherit;background:#1a2431;border:1px solid #344252;border-radius:7px;min-height:34px;padding:6px 10px;}
#em-app button {cursor:pointer;white-space:nowrap;}
#em-app button:hover {background:#293849;border-color:#62798f;}
#em-app button[aria-pressed=true],#em-app .primary {color:#0b2520;background:var(--accent);border-color:var(--accent);}
#em-app button:focus-visible,#em-app input:focus-visible,#em-app select:focus-visible {outline:2px solid var(--accent);outline-offset:3px;}
#em-app button:disabled {opacity:.4;cursor:default;}
#em-app .topbar {display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:12px 18px;background:var(--panel);border-bottom:1px solid var(--line);}
#em-app .brand {display:flex;align-items:center;gap:10px;margin-right:auto;min-width:170px;}
#em-app .brand-mark {color:var(--accent);font-size:27px;line-height:1;}
#em-app .brand strong {display:block;font-size:16px;letter-spacing:-.3px;}
#em-app .brand small {display:block;color:var(--muted);font-size:10px;letter-spacing:1.6px;text-transform:uppercase;}
#em-app .top-control {display:flex;align-items:center;gap:7px;color:var(--muted);font-size:12px;}
#em-app .top-control input {width:76px;}
#em-app .body {display:grid;grid-template-columns:66px minmax(0,1fr) 280px;min-height:0;}
#em-app .tools {display:flex;flex-direction:column;align-items:stretch;gap:9px;padding:14px 7px;background:var(--panel);border-right:1px solid var(--line);}
#em-app .tool {display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 2px;font-size:10px;}
#em-app .tool svg {width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}
#em-app .divider {height:1px;background:var(--line);margin:5px 0;}
#em-app .workspace {position:relative;min-width:0;min-height:0;overflow:hidden;background:#000;}
#em-app .workspace canvas {display:block;touch-action:none;outline:none;}
#em-app .workspace canvas:focus-visible {outline:1px solid var(--accent);outline-offset:-2px;}
#em-app .canvas-tag {position:absolute;left:18px;top:15px;pointer-events:none;color:#c4d2dc;font-size:10px;text-transform:uppercase;letter-spacing:1.4px;background:#091019c9;padding:5px 8px;border-radius:4px;}
#em-app .hint {position:absolute;bottom:16px;left:50%;transform:translateX(-50%);max-width:90%;padding:8px 13px;border:1px solid #334354;border-radius:8px;background:#111b27e8;color:#c2d0de;font-size:12px;text-align:center;pointer-events:none;}
#em-app .palette {position:absolute;top:14px;left:14px;width:min(280px,calc(100% - 28px));max-height:calc(100% - 28px);overflow-y:auto;overscroll-behavior:contain;z-index:2;background:#151e2a;border:1px solid #405368;border-radius:11px;padding:14px;box-shadow:0 12px 40px #0008;}
#em-app .eyebrow {text-transform:uppercase;letter-spacing:1.5px;font-size:10px;font-weight:650;color:var(--muted);margin:0 0 12px;}
#em-app .palette button {width:100%;text-align:left;padding:12px;white-space:normal;}
#em-app .palette button + button {margin-top:8px;}
#em-app .model-note {font-size:11px;line-height:1.6;color:var(--muted);margin:10px 0;}
#em-app .model-note.warning {color:#f5c781;}
#em-app .palette small {display:block;color:var(--muted);margin-top:4px;}
#em-app .inspector {min-height:0;overflow:auto;background:var(--panel);border-left:1px solid var(--line);padding:20px 18px;}
#em-app h2 {font-size:18px;margin:0 0 4px;letter-spacing:-.4px;}
#em-app .muted {color:var(--muted);font-size:12px;}
#em-app .section {padding-top:18px;margin-top:18px;border-top:1px solid var(--line);}
#em-app .property {display:block;margin:0 0 16px;}
#em-app .property-head {display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
#em-app .property-head input {width:90px;text-align:right;font-variant-numeric:tabular-nums;}
#em-app input[type=range] {display:block;width:100%;margin:0;accent-color:var(--accent);cursor:pointer;}
#em-app .readout {display:flex;justify-content:space-between;color:var(--muted);margin:8px 0;font-size:12px;}
#em-app .readout output {color:#e6edf5;font-variant-numeric:tabular-nums;}
#em-app .danger {color:#ffaba7;background:transparent;border-color:#654046;width:100%;}
#em-app .scene-list {display:grid;gap:6px;margin-top:10px;}
#em-app .scene-list button {text-align:left;font-size:12px;overflow:hidden;text-overflow:ellipsis;}
#em-app .footer {display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px;padding:8px 16px;color:var(--muted);background:var(--panel);border-top:1px solid var(--line);font-size:11px;}
#em-app .footer .status {margin-right:auto;}
#em-app .status-dot {display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-right:7px;}
#em-app .zoom-controls {display:flex;gap:5px;align-items:center;}
#em-app .zoom-controls button {min-height:26px;padding:2px 8px;font-size:11px;}
#em-app .empty {padding:18px 0;line-height:1.7;color:var(--muted);}
@media(max-width:1000px) {#em-app .topbar {gap:8px;padding:9px 12px;}#em-app .body {grid-template-columns:58px minmax(0,1fr) 240px;}#em-app .brand {min-width:145px;}#em-app .brand strong{font-size:14px;}#em-app .top-control{font-size:11px;}}

#em-app .floating-panel {position:absolute;z-index:5;right:16px;top:72px;width:min(360px,calc(100% - 24px));max-height:calc(100% - 90px);overflow:auto;padding:16px;border:1px solid #405368;border-radius:12px;background:#121923f5;box-shadow:0 12px 40px #0009;}
#em-app .panel-heading {display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;}
#em-app .radiation-panel {width:min(470px,calc(100% - 24px));}
#em-app #em-radiation-canvas {display:block;width:100%;height:auto;aspect-ratio:1;max-height:58dvh;}
#em-app .tools {overflow-y:auto;min-height:0;}
#em-app .mobile-only {display:none;}
#em-app .desktop-controls {display:contents;}
#em-app #em-mobile-controls-dialog {box-sizing:border-box;width:min(420px,calc(100% - 24px));max-height:calc(100dvh - 24px);padding:16px;overflow:auto;overscroll-behavior:contain;border:1px solid #405368;border-radius:12px;background:#121923;color:#e6edf5;}
#em-mobile-controls-dialog::backdrop {background:#0009;}
#em-app #em-mobile-controls-dialog .desktop-controls {display:grid;gap:12px;}
#em-app #em-mobile-controls-dialog .top-control {display:flex;justify-content:space-between;font-size:13px;gap:10px;}
#em-app #em-mobile-controls-dialog select {max-width:240px;min-width:0;}
#em-app #em-mobile-controls-dialog input[type=checkbox] {width:22px;}
@media (max-width:680px), (max-width:1000px) and (pointer:coarse) {
 html,body {-webkit-text-size-adjust:100%;text-size-adjust:100%;}
 #em-app {height:100dvh;bottom:auto;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);}
 #em-app .mobile-only {display:block;}
 #em-app .topbar {display:flex;flex-wrap:nowrap;gap:6px;padding:6px 8px;min-width:0;overflow:visible;}
 #em-app .brand {min-width:0;flex:1;margin:0;gap:5px;}
 #em-app .brand strong {font-size:13px;}
 #em-app .brand small {display:none;}
 #em-app .brand-mark {font-size:20px;}
 #em-app button,#em-app select,#em-app input[type=number] {min-height:44px;flex-shrink:0;touch-action:manipulation;}
 #em-app input[type=number],#em-app select {font-size:16px;}
 #em-app .top-control input[type=number] {width:90px;}
 #em-app .body {position:relative;grid-template-columns:minmax(0,1fr);grid-template-rows:54px minmax(0,1fr);}
 #em-app .workspace {grid-column:1;grid-row:2;}
 #em-app .tools {grid-column:1;grid-row:1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:44px;gap:6px;padding:5px 8px;overflow:hidden;border-right:0;border-bottom:1px solid var(--line);}
 #em-app .tools > .divider {display:none;}
 #em-app .tools > .tool {display:flex;flex-direction:row;justify-content:center;align-items:center;gap:4px;width:100%;min-width:0;height:44px;min-height:44px;margin:0;padding:4px;font-size:11px;line-height:1;}
 #em-app .tools > .tool svg {flex:none;width:18px;height:18px;pointer-events:none;}
 #em-app .inspector {display:none;position:absolute;z-index:4;right:0;top:54px;bottom:0;width:min(320px,100%);padding:12px;border:1px solid var(--line);box-shadow:0 8px 24px #0009;overflow:auto;}
 #em-app .inspector.mobile-inspector-open {display:block;}
 #em-app .footer {flex-wrap:nowrap;justify-content:space-between;gap:6px;padding:5px 8px;min-width:0;}
 #em-app .footer > span {display:none;}
 #em-app .zoom-controls button {min-width:44px;min-height:44px;}
 #em-app .floating-panel {top:8px;right:8px;max-height:calc(100% - 16px);}
 #em-app .hint {font-size:11px;bottom:8px;}
}


`;

function icon(paths) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`; }
// Move the same controls between desktop header and a phone dialog: no duplicate
// IDs, stale handlers or orientation-specific copies of the controls.
function mountMobileControls(root) {
  const bar=root.querySelector('.topbar');
  const group=document.createElement('div');group.className='desktop-controls';
  for(const child of [...bar.children])if(!child.classList.contains('brand')&&child.id!=='em-play')group.appendChild(child);
  bar.appendChild(group);
  const toggle=document.createElement('button');toggle.className='mobile-only';toggle.textContent='Controls';toggle.type='button';
  toggle.setAttribute('aria-haspopup','dialog');toggle.setAttribute('aria-controls','em-mobile-controls-dialog');bar.appendChild(toggle);
  const dialog=document.createElement('dialog');dialog.id='em-mobile-controls-dialog';dialog.setAttribute('aria-labelledby','em-mobile-controls-title');
  dialog.innerHTML='<div class="panel-heading"><strong id="em-mobile-controls-title">Simulation controls</strong><button type="button" aria-label="Close simulation controls">Close</button></div>';
  root.appendChild(dialog);
  toggle.onclick=()=>{if(!dialog.open)dialog.showModal();};
  dialog.querySelector('button').onclick=()=>dialog.close();
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  dialog.addEventListener('close',()=>{if(mobile.matches)toggle.focus();});
  // These open their own panels, which would otherwise be behind the modal.
  for(const id of ['em-advanced','em-radiation'])root.querySelector('#'+id).addEventListener('click',()=>{if(dialog.open)dialog.close();});
  const inspector=root.querySelector('.inspector');
  const properties=document.createElement('button');properties.type='button';properties.className='tool mobile-only';properties.textContent='Edit';properties.title='Properties and scene';properties.setAttribute('aria-expanded','false');
  inspector.id='em-inspector';properties.setAttribute('aria-controls',inspector.id);root.querySelector('.tools').appendChild(properties);
  const close=document.createElement('button');close.type='button';close.className='mobile-only';close.textContent='Close properties';inspector.prepend(close);
  const showInspector=open=>{inspector.classList.toggle('mobile-inspector-open',open);properties.setAttribute('aria-expanded',String(open));};
  properties.onclick=()=>{closePalette();showInspector(!inspector.classList.contains('mobile-inspector-open'));};
  for(const id of ['em-select','em-pan','em-add'])root.querySelector('#'+id).addEventListener('click',()=>showInspector(false));
  close.onclick=()=>{showInspector(false);properties.focus();};
  const mobile=window.matchMedia('(max-width:680px), (max-width:1000px) and (pointer:coarse)');
  const sync=()=>{
    if(dialog.open)dialog.close();
    if(mobile.matches)dialog.appendChild(group);else bar.insertBefore(group,toggle);
    showInspector(false);
  };
  mobile.addEventListener('change',sync);sync();
}

function mountInterface() {
  if(!document.querySelector('meta[name=viewport]')){const viewport=document.createElement('meta');viewport.name='viewport';viewport.content='width=device-width, initial-scale=1';document.head.appendChild(viewport);}
  const style = document.createElement('style');
  style.textContent = interfaceCSS;
  document.head.appendChild(style);
  const root = document.createElement('main');
  root.id = 'em-app';
  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">∿</span><div><strong>EM Simulator</strong><small>Electromagnetic sandbox</small></div></div>
      <button id="em-play" title="Pause / resume (Space)">Ⅱ Pause</button>
      <label class="top-control">Examples <select id="em-example" aria-label="Load example scene">
        <option value="">Load example…</option>
        <option value="rotating">Rotating dipoles</option>
	<option value="halfwave">Half-wave center-fed dipole</option>
        <option value="yagi">Yagi–Uda antenna</option>        
        <option value="quadrupole">Electric quadrupole (2 dipoles)</option>
      </select></label>
      <label class="top-control">Field <select id="em-field"><option value="E">Electric field</option><option value="B">Magnetic field</option><option value="S">Energy flux</option><option value="U">Energy density</option></select></label>
      <label class="top-control">Frequency <input id="em-frequency" type="number" min="${minFreq}" max="${maxFreq}" step="0.00625" value="${freq}" title="Simulation frequency"></label>
      <label class="top-control">Wave speed <input id="em-speed" type="number" min="${minSpeed}" max="${maxSpeed}" step="0.125" value="${c}" title="Simulation wave speed"></label>
      <label class="top-control">Quality <select id="em-quality"><option value="1">Low</option><option value="2" selected>Medium</option><option value="3">High</option></select></label>
      <label class="top-control" title="Cache phase-indexed field heatmaps; arrows and currents remain continuous"><input id="em-temporal" type="checkbox" checked> Temporal cache</label>
      <button id="em-advanced" aria-expanded="false" aria-controls="em-advanced-panel">Advanced</button>
      <button id="em-radiation" aria-expanded="false" aria-controls="em-radiation-panel">Radiation pattern</button>
    </header>
    <div class="body">
      <nav class="tools" aria-label="Workspace tools">
        <button class="tool" id="em-select" title="Select component (V)" aria-pressed="true">${icon('<path d="M5 3l14 9-7 1-3 7z"/>')}Select</button>
        <button class="tool" id="em-pan" title="Pan (H); middle-drag also pans" aria-pressed="false">${icon('<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>')}Pan</button>
        <div class="divider"></div>
        <button class="tool" id="em-add" title="Add component (A)" aria-expanded="false" aria-controls="em-palette">${icon('<path d="M12 5v14M5 12h14"/>')}Add</button>
      </nav>
      <section class="workspace" id="em-workspace" aria-label="Simulation workspace">
        <div class="canvas-tag" id="em-field-tag">Electric field · XY plane</div>
        <div class="palette" id="em-palette" hidden><p class="eyebrow">Add component</p><div id="em-palette-items"></div></div>
        <div class="hint" id="em-hint"></div>
      </section>
      <aside class="inspector" aria-label="Component properties">
        <p class="eyebrow">Properties</p>
        <div id="em-properties"></div>
        <div class="section"><p class="eyebrow">Scene <span id="em-count"></span></p><div class="scene-list" id="em-scene"></div><div class="readout"><span>Total average radiated power</span><output id="em-scene-radiated-power">Updating…</output></div><p class="muted">Whole scene · 3D radiation · simulation units</p></div>
        <div class="section"><button class="danger" id="em-clear">Clear scene</button></div>
        <div class="section muted">Wheel to zoom · 0 to reset<br>V select · H pan · A add<br>Esc cancel · Delete selected<br><br><br><br><span style="color:#ffff00">› Yellow wire chevrons: current I(t)</span><br>Direction reverses with the instantaneous conventional current.</div>
      </aside>
    </div>
    <section id="em-advanced-panel" class="floating-panel" hidden aria-label="Advanced settings">
      <div class="panel-heading"><strong>Advanced settings</strong><button id="em-advanced-close" aria-label="Close advanced settings">×</button></div>
      <p class="muted">Gamma is applied after intensity compression. Below 1 reveals weaker values; above 1 emphasizes stronger values.</p>
      ${Object.entries(displayGamma).map(([key,value])=>`<label class="property">${{heatmap:'Heatmap gamma',arrows:'Arrow-length gamma',current:'Current-color gamma'}[key]} <output id="em-gamma-${key}-value">${value}</output><input id="em-gamma-${key}" type="range" min="0.1" max="3" step="0.05" value="${value}"></label>`).join('')}
      <button id="em-gamma-reset">Reset display settings</button>
      <div class="section"><strong>Animation and arrows</strong>
      <label class="property">Field arrow density <output id="em-field-arrow-density-value">1×</output><input id="em-field-arrow-density" type="range" min="0" max="3" step="0.1" value="1"></label>
      <label class="property">Wire / plane current arrow density <output id="em-current-arrow-density-value">1×</output><input id="em-current-arrow-density" type="range" min="0" max="3" step="0.1" value="1"></label>
      <p class="muted">Set a density to zero to hide those arrows.</p>
      <label class="property">Simulation clock speed <output id="em-clock-rate-value">1×</output><input id="em-clock-rate" type="range" min="0" max="4" step="0.1" value="1"></label>
      <p class="muted">Changes animation time only; wave speed and frequency are unchanged.</p></div>
      <div class="section"><strong>Field resolution</strong>
      <label><input id="em-adaptive-fields" type="checkbox" checked> Enable adaptive field resolution</label>
      <p class="muted">Optional. Refines field sampling with zoom and sustained frame rate, with hysteresis. Never uses a coarser grid than fixed mode at the same zoom and selected Low, Medium, or High resolution. Both modes share the same sample and tile safety limits. Refinement waits for camera motion to settle. Antenna currents and the PEC mesh are unchanged.</p>
      <div class="readout"><span>Field sampling</span><output id="em-adaptive-fields-status">Adaptive</output></div></div>
      <div class="section"><strong>Coupled PEC wire / slot solver</strong>
      <label class="property">Maximum segment length · PEC wires and slots <input id="em-pec-mesh" type="number" min="0.02" max="1" step="0.01" value="${pecMaxSegmentLength}"></label>
      <div class="readout"><span>Coupled solve</span><output id="em-coupled-solve">Awaiting solve</output></div><div id="em-pec-segment-ratios"></div></div>
      <div class="section"><strong>Power diagnostics</strong><div class="readout"><span>Scene power-balance discrepancy</span><output id="em-power-balance">Updating…</output></div><p id="em-power-diagnostic-note" class="model-note"></p></div>
    </section>
    <section id="em-radiation-panel" class="floating-panel radiation-panel" hidden aria-label="Far-field radiation pattern">
      <div class="panel-heading"><strong>Far-field · XY cut</strong><button id="em-radiation-close" aria-label="Close radiation pattern">×</button></div>
      <label>Power scale <select id="em-radiation-scale"><option value="db">Log · −40 to 0 dB</option><option value="log1p">log1p · normalized power</option></select></label>
      <canvas id="em-radiation-canvas" aria-label="Normalized angular radiation power"></canvas>
      <p class="muted" id="em-radiation-note"></p>
      <p class="muted">Peak-normalized power, averaged over a cycle. Includes solved passive currents and PEC images. Angles follow the simulation axes; this is a 2D cut of the 3D pattern.</p>
    </section>
    <footer class="footer"><span class="status" role="status" id="em-status"></span><span id="em-grid"></span><span id="em-wavelength"></span><span id="em-fps">FPS —</span><span id="em-temporal-stats" title="Compare with Temporal cache unchecked"></span><div class="zoom-controls"><button id="em-zoom-out" aria-label="Zoom out">−</button><button id="em-zoom-reset" title="Reset zoom (0)">100%</button><button id="em-zoom-in" aria-label="Zoom in">+</button></div></footer>`;
  document.body.appendChild(root);
  ui.root = root;
  mountMobileControls(root);
  const find = id => root.querySelector(`#em-${id}`);
  for (const id of ['workspace','properties','scene','palette','hint','status','count','grid','wavelength']) ui[id] = find(id);
  ui.fps = find('fps');
  ui.play = find('play');
  ui.select = find('select'); ui.pan = find('pan'); ui.add = find('add');
  ui.select.onclick = () => setTool('select');
  ui.pan.onclick = () => setTool('pan');
  ui.add.onclick = togglePalette;
  for (const [type, descriptor] of Object.entries(componentTypes)) {
    const button = document.createElement('button');
    button.innerHTML = `<strong>${descriptor.name}</strong><small>${descriptor.description}</small>`;
    button.onclick = () => { placementType = type; setTool('add'); ui.canvas.focus(); };
    find('palette-items').appendChild(button);
  }
  ui.play.onclick = togglePause;
  for(const name of ['advanced','radiation']) {
    const panel=find(name+'-panel'),button=find(name);
    const toggle=open=>{panel.hidden=!open;button.setAttribute('aria-expanded',String(open)); if(open){const other=name==='advanced'?'radiation':'advanced';find(other+'-panel').hidden=true;find(other).setAttribute('aria-expanded','false');} };
    button.onclick=()=>toggle(panel.hidden);
    find(name+'-close').onclick=()=>{toggle(false);button.focus();};
  }
  for(const key of Object.keys(displayGamma)) find('gamma-'+key).oninput=e=>{
    displayGamma[key]=+e.target.value;find('gamma-'+key+'-value').textContent=e.target.value;resetTemporalCache();
  };
  find('gamma-reset').onclick=()=>{
    // Account for elapsed time at the old rate before restoring normal speed.
    advanceSimulationClock(millis()/timeScale);
    for(const [key,value] of Object.entries({heatmap:1,arrows:1,current:.2})){
      displayGamma[key]=value;find('gamma-'+key).value=value;find('gamma-'+key+'-value').textContent=value;
    }
    fieldArrowDensity=1;currentArrowDensity=1;simulationClockRate=1;
    setAdaptiveFieldResolution(true);find('adaptive-fields').checked=true;
    for(const id of ['field-arrow-density','current-arrow-density','clock-rate']){
      find(id).value=1;find(id+'-value').textContent='1×';
    }
    resetTemporalCache();
  };
  find('field-arrow-density').oninput=e=>{fieldArrowDensity=+e.target.value;find('field-arrow-density-value').textContent=fieldArrowDensity?fieldArrowDensity+'×':'Off';};
  find('current-arrow-density').oninput=e=>{currentArrowDensity=+e.target.value;find('current-arrow-density-value').textContent=currentArrowDensity?currentArrowDensity+'×':'Off';};
  find('clock-rate').oninput=e=>{advanceSimulationClock(millis()/timeScale);simulationClockRate=+e.target.value;find('clock-rate-value').textContent=simulationClockRate?simulationClockRate+'×':'Stopped';};
  find('adaptive-fields').onchange=e=>setAdaptiveFieldResolution(e.target.checked);
  find('pec-mesh').onchange=e=>{setPECMaxSegmentLength(e.target.valueAsNumber);e.target.value=pecMaxSegmentLength;requestFieldUpdate();if(selectedComponent)renderInspector();};
  // High is automatic only on desktop-class devices with at least 16 logical cores
  // and 8 GB reported memory. Unknown capabilities default to Medium; manual selection wins.
  const nav=window.navigator;
  resolution=nav.hardwareConcurrency>=16 && nav.deviceMemory>=8 &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !nav.connection?.saveData ? 3 : 2;
  sLength=resolution===3?2:4;
  find('quality').value=String(resolution);
  find('example').onchange = e => {
    const key=e.target.value;
    if (key) loadExampleScene(key);
    // Keep the dropdown an action, not a misleading persistent scene selection.
    e.target.value='';
  };
  find('field').onchange = e => {
    show_EField = e.target.value === 'E'; show_BField = e.target.value === 'B'; show_EnergyFlux = e.target.value === 'S'; show_EnergyDensity = e.target.value === 'U';
    find('field-tag').textContent = e.target.selectedOptions[0].textContent + ' · XY plane';
  };
  function bindNumber(id, read, write) {
    const el = find(id);
    el.onchange = () => {
      const value = el.valueAsNumber;
      if (!Number.isFinite(value)) { el.value = read(); return; }
      const next = Math.max(+el.min, Math.min(+el.max, value));
      write(next); el.value = read();
      for (const a of antennas) a.setWavelength(c / freq);
      renderInspector(); requestFieldUpdate();
    };
  }
  bindNumber('frequency', () => freq, v => { freq = v; });
  bindNumber('speed', () => c, v => { c = v; });
  find('temporal').onchange=e=>{temporalCache.enabled=e.target.checked;resetTemporalCache();};
  find('quality').onchange = e => {
    resolution = +e.target.value;
    sLength = resolution === 3 ? 2 : resolution === 2 ? 4 : 5;
    resetAdaptiveFieldController();
    renderInspector(); requestFieldUpdate();
  };
  find('clear').onclick = () => {
    antennas = []; selectedComponent = null; setTool('select');
    renderInspector(); renderScene(); requestFieldUpdate();
  };
  find('zoom-out').onclick = () => setViewZoom(zoom / 1.25, width / 2, height / 2);
  find('zoom-in').onclick = () => setViewZoom(zoom * 1.25, width / 2, height / 2);
  find('zoom-reset').onclick = () => setViewZoom(1, width / 2, height / 2);
  document.addEventListener('keydown', handleKeyboard);
  document.addEventListener('visibilitychange',()=>{frameTiming.last=0;if(!document.hidden){fieldTiles.lastFrame=0;fieldTiles.frameMs=16.7;fieldPlan(true);}});
  root.addEventListener('pointerdown', e => {
    if (!ui.palette.hidden && !ui.palette.contains(e.target) && !ui.add.contains(e.target)) closePalette();
  });
}

function requestFieldUpdate(delay = 0) {
  fieldTiles.dirtyPhysics=true;
  if(fieldTiles.pending&&fieldTiles.worker)fieldTiles.worker.postMessage({kind:'cancel',id:fieldTiles.pending.id});
  fieldTiles.pending=null;
  waitProcess = true;
  processingScheduled = false;
  zoomRebuildAfter = millis() + delay;
}
function closePalette() { ui.palette.hidden = true; ui.add.setAttribute('aria-expanded','false'); }
function togglePalette() {
  const open = ui.palette.hidden;
  setTool('select');
  ui.palette.hidden = !open;
  ui.add.setAttribute('aria-expanded', String(open));
  if (open) ui.palette.querySelector('button').focus();
}
function setTool(tool) {
  activeTool = tool; placementStart = null;
  closePalette();
  ui.select.setAttribute('aria-pressed',String(tool === 'select'));
  ui.pan.setAttribute('aria-pressed',String(tool === 'pan'));
  ui.add.setAttribute('aria-pressed',String(tool === 'add'));
  if (ui.canvas) ui.canvas.style.cursor = tool === 'pan' ? 'grab' : tool === 'add' ? 'crosshair' : 'default';
  updateHint();
}
function updateHint(message) {
  const descriptor=componentTypes[placementType];
  ui.hint.textContent = message || (activeTool==='add' && descriptor ? `${placementStart?descriptor.secondHint:descriptor.firstHint} · Esc to cancel` : activeTool==='pan' ? 'Drag to pan · Wheel to zoom' : 'Select a component to edit · Add to place a source or passive wire');
}
function selectComponent(component) {
  selectedComponent = component;
  renderInspector(); renderScene();
}
function renderScene() {
  ui.scene.replaceChildren();
  ui.count.textContent = `(${antennas.length})`;
  ui.root.querySelector('#em-clear').disabled = !antennas.length;
  for (const a of antennas) {
    const b = document.createElement('button');
    b.textContent = a.label;
    b.setAttribute('aria-pressed',String(a === selectedComponent));
    b.onclick = () => { setTool('select'); selectComponent(a); };
    ui.scene.appendChild(b);
  }
  if (!antennas.length) ui.scene.innerHTML = '<span class="muted">No components. Choose Add to begin.</span>';
}
function renderInspector() {
  const a = selectedComponent;
  ui.properties.replaceChildren();
  if (!a) { ui.properties.innerHTML = '<h2>No selection</h2><div class="empty">Select a component in the workspace or the scene list to edit its properties.</div>'; return; }
  const title = document.createElement('h2'); title.textContent = a.label;
  ui.properties.appendChild(title);
  const subtitle = document.createElement('div'); subtitle.className = 'muted'; subtitle.textContent = componentTypes[a.componentType].name;
  ui.properties.appendChild(subtitle);
  const section = document.createElement('div'); section.className = 'section'; ui.properties.appendChild(section);
  // A shared inspector consumes property descriptors; no per-source floating boxes.
  const properties = a.getProperties();
  for (const property of properties) {
    const row = document.createElement('div'); row.className = 'property';
    if(property.options) {
      const label=document.createElement('label'); label.textContent=property.label;
      const select=document.createElement('select'); select.id='em-prop-'+property.key; label.htmlFor=select.id;
      for(const [value,text] of property.options) { const option=document.createElement('option'); option.value=value; option.textContent=text; select.appendChild(option); }
      select.value=property.get();
      select.onchange=()=>{ if(selectedComponent!==a || !antennas.includes(a)) return; property.set(select.value); requestFieldUpdate(); renderInspector(); };
      row.append(label,select); section.appendChild(row); continue;
    }
    row.innerHTML = `<div class="property-head"><label for="em-prop-${property.key}">${property.label}</label><input id="em-prop-${property.key}" type="number" min="${property.min}" max="${property.max}" step="${property.step}"></div><input type="range" min="${property.min}" max="${property.max}" step="${property.step}" aria-label="${property.label} slider">`;
    const [number, range] = row.querySelectorAll('input');
    const logarithmic=property.scale==='log';
    if(logarithmic) { range.min=0; range.max=1000; range.step=1; range.setAttribute('aria-label',property.label+' logarithmic slider'); }
    const fromRange=()=>logarithmic?Math.expm1(range.valueAsNumber/1000*Math.log1p(property.max)):range.valueAsNumber;
    const syncInputs=value=>{
      number.value=Number(value.toFixed(4));
      range.value=logarithmic?1000*Math.log1p(value)/Math.log1p(property.max):value;
      range.setAttribute('aria-valuetext',String(Number(value.toFixed(4))));
    };
    syncInputs(property.get());
    range.oninput = () => { number.value=Number(fromRange().toFixed(4)); range.setAttribute('aria-valuetext',number.value); };
    const commit = input => {
      if (selectedComponent !== a || !antennas.includes(a)) return;
      let value = input===range?fromRange():input.valueAsNumber;
      if (!Number.isFinite(value)) { syncInputs(property.get()); return; }
      value = Math.max(property.min, Math.min(property.max,value));
      property.set(value); syncInputs(property.get());
      requestFieldUpdate();
      renderModelReadouts(a,readout);
    };
    number.onchange = () => commit(number); range.onchange = () => commit(range);
    section.appendChild(row);
  }
  const readout = document.createElement('div');
  renderModelReadouts(a,readout);
  section.appendChild(readout);
  const del = document.createElement('button'); del.className = 'danger'; del.textContent = 'Delete component';
  del.onclick = deleteSelected; section.appendChild(del);
}
function renderModelReadouts(source,container) {
  container.replaceChildren();
  for(const [label,value] of [...source.getReadouts(),...sourcePowerReadouts(source)]) {
    const row=document.createElement('div'); row.className='readout';
    const caption=document.createElement('span'); caption.textContent=label;
    const output=document.createElement('output'); output.textContent=value;
    row.append(caption,output); container.appendChild(row);
  }
  for(const note of [...source.getNotes(),...sourcePowerNotes(source)]) {
    const el=document.createElement('p'); el.className='model-note'+(note.warning?' warning':''); el.textContent=note.text; container.appendChild(el);
  }
}
function deleteSelected() {
  if (!selectedComponent) return;
  antennas = antennas.filter(a => a !== selectedComponent && !(a instanceof PECSlot && a.plane===selectedComponent));
  selectComponent(null); requestFieldUpdate();
}
function togglePause() { pause = !pause; time = millis()/timeScale; ui.play.textContent = pause ? '▶ Resume' : 'Ⅱ Pause'; }
function handleKeyboard(e) {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
  switch (e.key.toLowerCase()) {
    case 'escape': setTool('select'); break;
    case 'v': setTool('select'); break;
    case 'h': setTool('pan'); break;
    case 'a': togglePalette(); break;
    case '0': setViewZoom(1,width/2,height/2); break;
    case 'delete': case 'backspace': deleteSelected(); break;
    case ' ': if (e.target.tagName === 'BUTTON') return; togglePause(); break;
    default: return;
  }
  e.preventDefault();
}
function pointerLocation(e) {
  const rect = ui.canvas.getBoundingClientRect();
  return [(e.clientX-rect.left)*width/rect.width,(e.clientY-rect.top)*height/rect.height];
}
function hitComponent(point) {
  for (let i=antennas.length-1;i>=0;i--) {
    const a=antennas[i];
    for(const edge of a.getHitEdges()) {
      const p=edge.a,q=edge.b,dx=q[0]-p[0],dy=q[1]-p[1],d=dx*dx+dy*dy;
      const t=d?Math.max(0,Math.min(1,((point[0]-p[0])*dx+(point[1]-p[1])*dy)/d)):0;
      if(Math.hypot(point[0]-p[0]-t*dx,point[1]-p[1]-t*dy)<=Math.max(9,edge.width/2+4)) return a;
    }
  }
  return null;
}
function bindCanvasEvents() {
  const canvas=ui.canvas;
  const touches=new Map(); let pinch=null, multiTouch=false;
  ui.cancelCanvasGesture=()=>{
    const ids=new Set(touches.keys());if(pointerGesture)ids.add(pointerGesture.id);
    const rotated=!!pointerGesture?.rotate;
    touches.clear();pinch=null;multiTouch=false;pointerGesture=null;hoverPoint=null;
    for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    canvas.style.cursor=activeTool==='pan'?'grab':activeTool==='add'?'crosshair':'default';
    if(rotated)requestFieldUpdate();
  };
  const geometry=()=>{const [a,b]=[...touches.values()];return {x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,d:Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1]))};};
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    touches.set(e.pointerId,pointerLocation(e));canvas.setPointerCapture(e.pointerId);
    if(touches.size>=2){multiTouch=true;pinch=geometry();pointerGesture=null;e.preventDefault();e.stopImmediatePropagation();}
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(!touches.has(e.pointerId))return;
    touches.set(e.pointerId,pointerLocation(e));
    if(!multiTouch)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(touches.size>=2){const next=geometry();
      if(pinch){setViewZoom(zoom*next.d/pinch.d,pinch.x,pinch.y);orig[0]+=next.x-pinch.x;orig[1]+=next.y-pinch.y;requestCameraUpdate();}
      pinch=next;
    }
  },true);
  const endTouch=e=>{
    if(!touches.has(e.pointerId))return;
    touches.delete(e.pointerId);
    if(multiTouch){e.preventDefault();e.stopImmediatePropagation();pointerGesture=null;pinch=touches.size>=2?geometry():null;
      if(!touches.size){multiTouch=false;canvas.style.cursor=activeTool==='pan'?'grab':'default';}requestCameraUpdate();}
  };
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,endTouch,true);
  canvas.tabIndex=0; canvas.setAttribute('aria-label','Electromagnetic field. Choose a source from Add and follow the placement hint.');
  canvas.addEventListener('pointerdown',e=>{
    if (pointerGesture || (e.button!==0 && e.button!==1)) return;
    e.preventDefault(); canvas.focus(); closePalette();
    const point=pointerLocation(e);
    pointerGesture={id:e.pointerId, start:point, last:point, pan:activeTool==='pan'||e.button===1, moved:false};
    canvas.setPointerCapture(e.pointerId);
    if (pointerGesture.pan) canvas.style.cursor='grabbing';
    else if(activeTool==='select' && selectedComponent instanceof LinearArray && length2D(point,selectedComponent.getAxisHandle())<=12) {
      pointerGesture.rotate=selectedComponent;
    }
  });
  canvas.addEventListener('pointermove',e=>{
    const point=pointerLocation(e); hoverPoint=point;
    if (!pointerGesture || pointerGesture.id!==e.pointerId) return;
    const g=pointerGesture;
    if (Math.hypot(point[0]-g.start[0],point[1]-g.start[1])>4) g.moved=true;
    if(g.rotate) {
      const world=[conMyX(point[0]),conMyY(point[1])],a=g.rotate;
      if(length2D(world,a.center)>.001) a.setAxisAngle(Math.atan2(world[1]-a.center[1],world[0]-a.center[0]));
      return;
    }
    if (g.pan) { orig[0]+=point[0]-g.last[0]; orig[1]+=point[1]-g.last[1]; requestCameraUpdate(); }
    g.last=point;
  });
  canvas.addEventListener('pointerup',e=>{
    if (!pointerGesture || pointerGesture.id!==e.pointerId) return;
    const g=pointerGesture, point=pointerLocation(e); pointerGesture=null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    canvas.style.cursor=activeTool==='pan'?'grab':activeTool==='add'?'crosshair':'default';
    if (g.rotate) { renderInspector(); requestFieldUpdate(); return; }
    if (g.pan) { requestCameraUpdate(); return; }
    if (g.moved || point[0]<0 || point[0]>width || point[1]<0 || point[1]>height) return;
    if (activeTool==='add') {
      const world=[conMyX(point[0]),conMyY(point[1])];
      const descriptor=componentTypes[placementType];
      if (!descriptor){updateHint('Choose a component from the Add palette');return;}
      if(placementType==='pecSlot'){const plane=currentPECPlane();if(!plane){updateHint('Add a PEC plane first');return;}if(Math.abs(plane.signedDistance(world))*Scale*zoom>24){updateHint('Click on the PEC plane to place the slot');return;}}
      if (!descriptor.oneClick && !placementStart) { placementStart=world; updateHint(); return; }
      if (!descriptor.oneClick && !descriptor.validate(placementStart,world)) { updateHint(descriptor.invalidHint); return; }
      if(!descriptor){updateHint('Choose a component from the Add palette');return;}
      if(placementType==='pecPlane'&&currentPECPlane()){updateHint('Only one PEC plane is allowed. Delete the existing plane first.');return;}
      const a=descriptor.oneClick?descriptor.create(world):descriptor.create(placementStart,world);
      const error=planeGeometryError(currentPECPlane()||(a instanceof PECPlane?a:null),[...antennas,a]);
      if(error){updateHint(error+' · choose a different location');return;}
      antennas.push(a); requestFieldUpdate(); setTool('select'); selectComponent(a);
    } else selectComponent(hitComponent(point));
  });
  const cancel=e=>{
    if (!pointerGesture || pointerGesture.id!==e.pointerId) return;
    const wasPan=pointerGesture.pan,wasRotate=!!pointerGesture.rotate; pointerGesture=null;
    canvas.style.cursor=activeTool==='pan'?'grab':activeTool==='add'?'crosshair':'default';
    if (wasRotate) requestFieldUpdate(); else if (wasPan) requestCameraUpdate();
  };
  canvas.addEventListener('pointercancel',cancel); canvas.addEventListener('lostpointercapture',cancel);
  canvas.addEventListener('pointerleave',()=>{ if (!pointerGesture) hoverPoint=null; });
  canvas.addEventListener('wheel',e=>{
    e.preventDefault(); if (pointerGesture || placementStart) return;
    const point=pointerLocation(e);
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);
    setViewZoom(zoom*Math.exp(-Math.max(-500,Math.min(500,delta))*.0015),...point);
  },{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
}

function setup() {
  mountInterface();
  width=Math.max(1,ui.workspace.clientWidth); height=Math.max(1,ui.workspace.clientHeight);
  const canvas=createCanvas(width,height); canvas.parent(ui.workspace); ui.canvas=canvas.elt;
  pixelDensity(1); frameRate(60);
  orig=[width/2+.1,height/2+.1];
  // Keep the visually distinctive 90°-phase rotating dipole as the default.
  loadExampleScene('rotating', false);
  setTool('pan');
  bindCanvasEvents();
  const orientationChanged=()=>{
    ui.cancelCanvasGesture();
    // A formerly valid scroll offset can hide controls after the viewport turns.
    for(const selector of ['.topbar','.footer','.tools']){
      const panel=ui.root.querySelector(selector);panel.scrollTop=0;panel.scrollLeft=0;
    }
  };
  if(window.screen?.orientation?.addEventListener)window.screen.orientation.addEventListener('change',orientationChanged);
  else window.addEventListener('orientationchange',orientationChanged);
  time=millis()/timeScale;
}
function draw() {
  ensureFieldModelCurrent();
  const w=Math.max(1,ui.workspace.clientWidth), h=Math.max(1,ui.workspace.clientHeight);
  if (w!==width || h!==height) {
    ui.cancelCanvasGesture?.();
    orig[0]+=(w-width)/2; orig[1]+=(h-height)/2;
    resizeCanvas(w,h); width=w; height=h; requestCameraUpdate();
  }
  const frameNow=performance.now();
  // The controller estimates steady animation cost; FPS below measures ALL intervals.
  if(fieldTiles.lastFrame){const dt=frameNow-fieldTiles.lastFrame;if(dt<250)fieldTiles.frameMs=.9*fieldTiles.frameMs+.1*dt;}
  recordPresentedFrame(frameNow);
  fieldTiles.lastFrame=frameNow;
  updateAdaptiveFieldResolution(frameNow);
  fieldSchedule();
  const now=millis()/timeScale;
  advanceSimulationClock(now);
  background(0);
  renderFields();
  drawComponentOverlay();
  renderRadiationPattern();
  updateStatus();
  // Allow a painted "Updating" state before the synchronous coupled solve.
  if (fieldTiles.dirtyPhysics && !pointerGesture && millis()>=zoomRebuildAfter) {
    if (!processingScheduled) processingScheduled=true;
    else startProcessingNewSetup();
  }
}
function screenPoint(p) { return [conScreenX(p[0]),conScreenY(p[1])]; }
// Same opaque silver-grey as the main PEC-plane stroke. Blending yellow
// over this base is equivalent to an opacity overlay without a second draw.
const PEC_WIRE_GREY=[167,177,190];
function currentOpacity(source,index){
  if(!simulate||source instanceof PECPlane)return 0;
  const j=(source.displayCurrents||source.currentSegments)[index],drive=source.I0;
  if(!j)return 0;
  const re=drive.a*frameCos-drive.b*frameSin,im=drive.a*frameSin+drive.b*frameCos;
  const magnitude=Math.hypot(j[0]*re-j[2]*im,j[1]*re-j[3]*im);
  return Math.max(0,Math.min(1,Math.pow(squiz(magnitude,k8,256),displayGamma.current)));
}
function currentColor(source,index){
  const alpha=currentOpacity(source,index);
  if(source instanceof PassiveWire)return PEC_WIRE_GREY.map((v,i)=>v*(1-alpha)+(i<2?255:0)*alpha);
  if(!simulate||source instanceof PECPlane)return [200,213,226];
  return [255*alpha,255*alpha,0];
}
// Current markers use a separate wire-bound visual language from field vectors.
const CURRENT_CHEVRON_SPACING = 32; // screen pixels, independent of quality/zoom
const PEC_SURFACE_SPACING = 40;
const PEC_SURFACE_OFFSET = 0.002; // sample just off each side of the mathematical plane
const pecSurfaceCache = {epoch:-1,stamp:'',samples:[],peak:0};

function clipLineToRect(x1,y1,x2,y2,xmin=0,ymin=0,xmax=width,ymax=height){
  let u1=0,u2=1,dx=x2-x1,dy=y2-y1;
  const tests=[[-dx,x1-xmin],[dx,xmax-x1],[-dy,y1-ymin],[dy,ymax-y1]];
  for(const [p,q] of tests){
    if(Math.abs(p)<1e-12){ if(q<0) return null; continue; }
    const r=q/p;
    if(p<0){ if(r>u2) return null; if(r>u1) u1=r; }
    else { if(r<u1) return null; if(r<u2) u2=r; }
  }
  return [x1+u1*dx,y1+u1*dy,x1+u2*dx,y1+u2*dy];
}
// Clip the infinite PEC trace to the viewport. Project the VIEWPORT CENTER onto
// the line first: endpoints around the original placement point may be entirely
// off-screen after large pan/zoom, even while the true infinite line is visible.
function planeScreenTrace(plane,margin=16){
  if(!plane)return null;
  const p=screenPoint(plane.endPointA);
  const dx=plane.tangent[0],dy=-plane.tangent[1]; // world y points up
  const along=(width/2-p[0])*dx+(height/2-p[1])*dy;
  const cx=p[0]+along*dx,cy=p[1]+along*dy;
  const reach=2*Math.hypot(width,height)+2*margin;
  return clipLineToRect(cx-reach*dx,cy-reach*dy,cx+reach*dx,cy+reach*dy,
                        -margin,-margin,width+margin,height+margin);
}
function evalPlaneSideB(scene,side,x,y){
  const e=scene?.elements; if(!e) return [0,0];
  let br=0,bi=0;
  for(let n=0;n<e.length;n+=8){
    if(side!==e[n+7]) continue;
    const dx=x-e[n],dy=y-e[n+1],R=Math.hypot(dx,dy,e[n+6]),inv=1/R,kr=scene.k*R;
    const gr=Math.cos(kr)*inv,gi=-Math.sin(kr)*inv;
    const hr=-gr*inv*inv+scene.k*gi*inv,hi=-gi*inv*inv-scene.k*gr*inv;
    const crossr=dx*e[n+3]-dy*e[n+2],crossi=dx*e[n+5]-dy*e[n+4];
    br+=hr*crossr-hi*crossi; bi+=hr*crossi+hi*crossr;
  }
  if(scene.magnetic?.length){const out=new Float64Array(6);for(let i=0;i<scene.magnetic.length;i+=6)addSlotElementField(out,x,y,scene.magnetic.subarray(i,i+6),side);br+=out[4];bi+=out[5];}
  return [br,bi];
}
function getPECSurfaceSamples(plane){
  const scene=fieldTiles.scene;
  if(!plane||!scene||!simulate) return [];
  const clipped=planeScreenTrace(plane,4);
  if(!clipped) return [];
  const stamp=[scene.epoch,currentArrowDensity,width,height,orig[0].toFixed(2),orig[1].toFixed(2),zoom.toFixed(4),clipped.map(v=>v.toFixed(2)).join(',')].join('|');
  if(pecSurfaceCache.epoch===scene.epoch && pecSurfaceCache.stamp===stamp) return pecSurfaceCache.samples;
  const [x1,y1,x2,y2]=clipped,dx=x2-x1,dy=y2-y1,total=Math.hypot(dx,dy);
  const count=Math.max(1,Math.floor(total*currentArrowDensity/PEC_SURFACE_SPACING));
  const n=plane.normal,tan=plane.tangent,eps=PEC_SURFACE_OFFSET;
  const samples=[]; let peak=0;
  for(let i=0;i<count;i++){
    const u=(i+0.5)/count,sx=x1+u*dx,sy=y1+u*dy,wx=(sx-orig[0])/(Scale*zoom),wy=(orig[1]-sy)/(Scale*zoom);
    if(slotAtTrace(plane,wx,wy))continue; // No electric sheet current in the hole.
    const plus=evalPlaneSideB(scene,1,wx+eps*n[0],wy+eps*n[1]);
    const minus=evalPlaneSideB(scene,-1,wx-eps*n[0],wy-eps*n[1]);
    const kr=plus[0]-minus[0],ki=plus[1]-minus[1],amp=Math.hypot(kr,ki);
    peak=Math.max(peak,amp);
    samples.push({sx,sy,wx,wy,kr,ki,amp,tx:tan[0],ty:-tan[1]});
  }
  pecSurfaceCache.epoch=scene.epoch; pecSurfaceCache.stamp=stamp; pecSurfaceCache.samples=samples; pecSurfaceCache.peak=peak;
  return samples;
}
function drawPECSurfaceCurrentDensity(plane){
  if(!simulate||!fieldTiles.scene||currentArrowDensity===0) return;
  const samples=getPECSurfaceSamples(plane); if(!samples.length) return;
  const ctx=drawingContext;
  ctx.save(); ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath(); ctx.rect(0,0,width,height); ctx.clip();
  for(const s of samples){
    const inst=s.kr*frameCos-s.ki*frameSin;
    if(!(s.amp>0)||!Number.isFinite(inst))continue;
    const mag=Math.abs(inst),rel=mag/s.amp;
    const v=Math.max(0,Math.min(1,(rel-0.025)/0.18));
    if(v<=0)continue;
    const fade=v*v*(3-2*v);
    const dir=inst>=0?1:-1;
    const ux=dir*s.tx,uy=dir*s.ty;
    const nx=-uy,ny=ux;
    // Larger *filled* arrowheads and an orange-to-yellow magnitude ramp make
    // the instantaneous sign and amplitude visible against the silver trace.
    const strength=Math.pow(squiz(mag,0.24),0.5*displayGamma.current/0.35);
    const arrowStrength=Math.pow(squiz(mag,0.24),0.5*displayGamma.arrows);
    const length=20+12*arrowStrength;
    const head=10+2*arrowStrength;
    const wing=5.7;
    const half=length/2;
    const tx=s.sx-half*ux,ty=s.sy-half*uy;
    const ex=s.sx+half*ux,ey=s.sy+half*uy;
    const baseX=ex-head*ux,baseY=ey-head*uy;
    const r=Math.round(246+9*strength);
    const g=Math.round(148+86*strength);
    const b=Math.round(24+23*strength);
    const alpha=.22+.78*fade;
    // A subtle dark silhouette separates the current marker from the plane.
    ctx.globalAlpha=alpha;
    ctx.strokeStyle='rgba(40,23,4,0.97)'; ctx.lineWidth=6;
    ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(baseX,baseY);ctx.stroke();
    ctx.fillStyle='rgba(40,23,4,0.97)';
    ctx.beginPath();ctx.moveTo(ex+1.5*ux,ey+1.5*uy);
    ctx.lineTo(baseX+1.5*nx*wing,baseY+1.5*ny*wing);
    ctx.lineTo(baseX-1.5*nx*wing,baseY-1.5*ny*wing);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle=`rgb(${r},${g},${b})`;ctx.lineWidth=3.3;
    ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(baseX,baseY);ctx.stroke();
    ctx.fillStyle=`rgb(${r},${g},${b})`;
    ctx.beginPath();ctx.moveTo(ex,ey);
    ctx.lineTo(baseX+wing*nx,baseY+wing*ny);
    ctx.lineTo(baseX-wing*nx,baseY-wing*ny);
    ctx.closePath();ctx.fill();
    ctx.globalAlpha=alpha*.85;
    ctx.strokeStyle='rgba(255,242,157,0.95)';ctx.lineWidth=1.1;
    ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(baseX,baseY);ctx.stroke();
  }
  ctx.restore();
}
const chevronGeometryCache=new WeakMap();
function currentChevronMarkers(edges){
  const old=chevronGeometryCache.get(edges);if(old&&old.density===currentArrowDensity)return old.markers;
  const markers=[];let run=[],total=0,last=null;
  function flush(){
    if(total>=12){const count=Math.max(1,Math.floor(total*currentArrowDensity/CURRENT_CHEVRON_SPACING));let index=0,offset=0;
      for(let n=0;n<count;n++){const distance=(n+.5)*total/count;while(index<run.length-1&&offset+run[index].length<distance)offset+=run[index++].length;
        const {edge,length}=run[index],t=(distance-offset)/length,x=edge.a[0]+t*(edge.b[0]-edge.a[0]),y=edge.a[1]+t*(edge.b[1]-edge.a[1]);
        if(x>=-10&&y>=-10&&x<=width+10&&y<=height+10)markers.push({x,y,current:edge.current});
      }
    }run=[];total=0;
  }
  for(const edge of edges){const length=length2D(edge.a,edge.b);if(edge.currentDirection===false||length<1e-10)continue;if(last&&length2D(last,edge.a)>.5)flush();run.push({edge,length});total+=length;last=edge.b;}flush();
  chevronGeometryCache.set(edges,{density:currentArrowDensity,markers});return markers;
}
function drawCurrentChevrons(source,edges){
  if(!simulate||currentArrowDensity===0)return;
  const drive=source.I0,re=drive.a*frameCos-drive.b*frameSin,im=drive.a*frameSin+drive.b*frameCos,currents=source.displayCurrents||source.currentSegments,ctx=drawingContext;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  for(const {x,y,current} of currentChevronMarkers(edges)){
    const j=currents[current];if(!j)continue;
    const ix=j[0]*re-j[2]*im,iy=j[1]*re-j[3]*im,mag=Math.hypot(ix,iy),env=Math.hypot(...j)*Math.hypot(drive.a,drive.b);
    if(!(env>0)||!Number.isFinite(mag)||!mag)continue;
    const f=Math.max(0,Math.min(1,(mag/env-.02)/.18));if(!f)continue;
    const opacity=currentOpacity(source,current),isPEC=source instanceof PassiveWire,bright=isPEC?255:255*opacity,dx=ix/mag,dy=-iy/mag;
    ctx.globalAlpha=f*f*(3-2*f)*(isPEC?opacity:1);ctx.beginPath();ctx.moveTo(x-4*dx-4*dy,y-4*dy+4*dx);ctx.lineTo(x+4*dx,y+4*dy);ctx.lineTo(x-4*dx+4*dy,y-4*dy-4*dx);
    ctx.strokeStyle='rgba(0,0,0,0.85)';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='rgb('+bright+','+bright+',0)';ctx.lineWidth=2;ctx.stroke();
  }ctx.restore();
}

const componentGeometryCache=new WeakMap();
function cachedDisplayEdges(a){
  const key=[orig[0],orig[1],width,height,zoom,Scale,a.radius,a.meshCount,a.endPointA?.join(','),a.endPointB?.join(',')].join('|');
  const old=componentGeometryCache.get(a);
  if(old&&old.key===key&&old.segments===a.segments)return old.edges;
  const edges=a.getDisplayEdges();componentGeometryCache.set(a,{key,segments:a.segments,edges});return edges;
}
function slotGlyph(s){
  const p=screenPoint(s.center()),t=[s.plane.tangent[0],-s.plane.tangent[1]],n=[-t[1],t[0]],scale=Scale;
  const dz=Math.max(7,.15*s.length*scale),w=Math.max(5,s.slotWidth*scale);
  const d=[dz*(.32*t[0]+.95*n[0]),dz*(.32*t[1]+.95*n[1])];
  return {a:[p[0]-d[0]/2,p[1]-d[1]/2],b:[p[0]+d[0]/2,p[1]+d[1]/2],w,t};
}
function drawSlotGlyph(s){
  const {a,b,w,t}=slotGlyph(s),ctx=drawingContext;
  const corners=[[a[0]-w*t[0]/2,a[1]-w*t[1]/2],[a[0]+w*t[0]/2,a[1]+w*t[1]/2],[b[0]+w*t[0]/2,b[1]+w*t[1]/2],[b[0]-w*t[0]/2,b[1]-w*t[1]/2]];
  ctx.save();ctx.lineJoin='round';
  // A small projected patch of the same screen makes the opening read as a
  // hole in sheet metal rather than as a second wire crossing the plane.
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],pad=4;
  const outer=[[a[0]-pad*u[0]-(w/2+pad)*t[0],a[1]-pad*u[1]-(w/2+pad)*t[1]],
    [a[0]-pad*u[0]+(w/2+pad)*t[0],a[1]-pad*u[1]+(w/2+pad)*t[1]],
    [b[0]+pad*u[0]+(w/2+pad)*t[0],b[1]+pad*u[1]+(w/2+pad)*t[1]],
    [b[0]+pad*u[0]-(w/2+pad)*t[0],b[1]+pad*u[1]-(w/2+pad)*t[1]]];
  ctx.beginPath();ctx.moveTo(...outer[0]);for(let i=1;i<4;i++)ctx.lineTo(...outer[i]);ctx.closePath();ctx.fillStyle='#a7b1be';ctx.fill();ctx.strokeStyle='#d7dfe8';ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();ctx.moveTo(...corners[0]);for(let i=1;i<4;i++)ctx.lineTo(...corners[i]);ctx.closePath();
  ctx.fillStyle='#060d17';ctx.fill();ctx.strokeStyle='#3a4655';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.moveTo(...corners[0]);ctx.lineTo(...corners[3]);ctx.lineTo(...corners[2]);ctx.strokeStyle='#d9e8f4';ctx.lineWidth=1.2;ctx.stroke();
  ctx.restore();
}
function planeTracePath(ctx,plane,trace){
  const [x1,y1,x2,y2]=trace,dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy),cuts=[];
  for(const s of currentPECSlots())if(s.plane===plane){const p=screenPoint(s.center()),u=((p[0]-x1)*dx+(p[1]-y1)*dy)/(L*L),h=s.slotWidth*Scale*zoom/(2*L);if(u+h>0&&u-h<1)cuts.push([Math.max(0,u-h),Math.min(1,u+h)]);}
  cuts.sort((a,b)=>a[0]-b[0]);ctx.beginPath();let from=0;
  for(const [lo,hi] of [...cuts,[1,1]]){if(lo>from){ctx.moveTo(x1+from*dx,y1+from*dy);ctx.lineTo(x1+lo*dx,y1+lo*dy);}from=Math.max(from,hi);}
}
function drawComponentOverlay() {
  push();
  for(const a of antennas) {
    if(a instanceof PECPlane){
      // Draw the infinite plane trace, leaving finite-width slot openings.
      // Its ends are defined only by the viewport; the two placement points
      // remain selectable via the standard endpoint handles below.
      const trace=planeScreenTrace(a,16);
      if(trace){
        const [x1,y1,x2,y2]=trace,ctx=drawingContext;
        ctx.save();ctx.lineCap='butt';ctx.setLineDash([]);
        planeTracePath(ctx,a,trace);
        ctx.strokeStyle='#353e4b';ctx.lineWidth=14;ctx.stroke();
        ctx.strokeStyle='#a7b1be';ctx.lineWidth=10;ctx.stroke();
        ctx.strokeStyle='#d7dfe8';ctx.lineWidth=4;ctx.stroke();
        ctx.restore();
        drawPECSurfaceCurrentDensity(a);
      }
      continue;
    }
    if(a instanceof PECSlot){drawSlotGlyph(a);continue;}
    const edges=cachedDisplayEdges(a);
    for(const edge of edges) {
      if(length2D(edge.a,edge.b)>1e-10){
        if(a instanceof PassiveWire){const color=currentColor(a,edge.current),ctx=drawingContext;ctx.lineCap='butt';ctx.lineWidth=edge.width;ctx.strokeStyle=`rgb(${color[0]},${color[1]},${color[2]})`;ctx.beginPath();ctx.moveTo(...edge.a);ctx.lineTo(...edge.b);ctx.stroke();}
        else thickLine(edge.a,edge.b,edge.width,currentColor(a,edge.current));
      }
    }
    drawCurrentChevrons(a,edges);
    if(a instanceof Dipole){
      const p=screenPoint(a.point(a.feedFraction)),ctx=drawingContext;
      ctx.save();ctx.fillStyle='#172231';ctx.strokeStyle='#77e2c3';ctx.lineWidth=2;
      if(a.feedSeparation()===0){ctx.beginPath();ctx.arc(p[0],p[1],4,0,2*Math.PI);ctx.stroke();}
      ctx.fillStyle='#e4fff6';ctx.font='11px system-ui';ctx.fillText(a.feedMode==='open'?'Open':'V',p[0]+9,p[1]-7);ctx.restore();
    }
  }
  if (selectedComponent) {
    stroke(119,226,195); strokeWeight(1.5); noFill();
    if(selectedComponent instanceof LinearArray) {
      const p=screenPoint(selectedComponent.center),handle=selectedComponent.getAxisHandle();
      drawingContext.setLineDash([4,4]); line(...p,...handle); drawingContext.setLineDash([]);
      circle(handle[0],handle[1],16);
    }
    for (const p of selectedComponent.getSelectionPoints()) circle(p[0],p[1],10);
  }
  if(activeTool==='add' && placementStart && hoverPoint) {
    const end=[conMyX(hoverPoint[0]),conMyY(hoverPoint[1])];
    stroke(119,226,195); strokeWeight(2); drawingContext.setLineDash([6,5]);
    if(placementType==='hertzian') {
      const center=screenPoint(placementStart),angle=Math.atan2(end[1]-placementStart[1],end[0]-placementStart[0]);
      line(center[0]-18*Math.cos(angle),center[1]+18*Math.sin(angle),center[0]+18*Math.cos(angle),center[1]-18*Math.sin(angle));
    } else line(conScreenX(placementStart[0]),conScreenY(placementStart[1]),conScreenX(end[0]),conScreenY(end[1]));
    drawingContext.setLineDash([]); noFill(); circle(conScreenX(placementStart[0]),conScreenY(placementStart[1]),10);
  }
  pop();
}
let advancedMeshStamp='';
function updateAdvancedFieldReadouts(){
  const status=document.getElementById('em-adaptive-fields-status');
  if(status)status.textContent=(adaptiveFields.enabled?'Adaptive':'Fixed')+' · grid '+(sLength/Scale*2**fieldCameraLevel()).toPrecision(3);
  const container=document.getElementById('em-pec-segment-ratios');if(!container)return;
  const wires=antennas.filter(a=>a instanceof PassiveWire||a instanceof PECSlot),stamp=JSON.stringify(wires.map(w=>[w.label,w.meshLength,w.wavelength]));
  if(stamp===advancedMeshStamp)return;advancedMeshStamp=stamp;container.replaceChildren();
  if(!wires.length){const p=document.createElement('p');p.className='muted';p.textContent='No PEC wires or slots';container.appendChild(p);return;}
  for(const w of wires){const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('output');row.className='readout';label.textContent=(w.label||'PEC wire')+' · segment / λ';value.textContent=(w.meshLength/w.wavelength).toFixed(4);row.append(label,value);container.appendChild(row);}
}
// Wall-clock frame intervals, independent of the adaptive controller. Never
// discard long intervals; only a hidden-tab pause starts a new interval.
const frameTiming={last:0,intervals:[],sum:0};
function recordPresentedFrame(now){
  const f=frameTiming;
  if(f.last){const dt=now-f.last;f.intervals.push(dt);f.sum+=dt;
    while(f.intervals.length>1&&f.sum-f.intervals[0]>=2000)f.sum-=f.intervals.shift();}
  f.last=now;
}
let fpsLabelUpdate=0,lastStatusUpdate=-Infinity;
function updateStatus() {
  const now=performance.now();if(now-lastStatusUpdate<250)return;lastStatusUpdate=now;
  updateScenePowerReadouts();
  updateAdvancedFieldReadouts();
  const solveReadout=document.getElementById('em-coupled-solve');if(solveReadout)solveReadout.textContent=fieldTiles.dirtyPhysics?'Updating…':passiveSolveInfo.message;
  // Update the readout twice per second instead of causing DOM churn at 60 FPS.
  if(performance.now()-fpsLabelUpdate>500){
    fpsLabelUpdate=performance.now();
    const f=frameTiming;ui.fps.textContent=f.sum?'FPS '+Math.round(1000*f.intervals.length/f.sum)+' · max '+Math.round(Math.max(...f.intervals))+' ms':'FPS —';
    ui.fps.title='Frames per elapsed second and longest frame interval over approximately two seconds; includes solve stalls.';
  }
  const state=fieldTiles.dirtyPhysics?'Updating setup…':passiveSolveInfo.error&&!simulate?'Invalid geometry':waitProcess?'Refining fields '+Math.round(fieldTiles.progress*100)+'%'+(fieldTiles.stalePixels?' · previous setup visible':''):pause?'Paused':'Running';
  const status=`${state} · ${antennas.length} components${passiveSolveInfo.error?' · '+passiveSolveInfo.message:''}${currentPECPlane()?' · PEC plane':''}`;
  if(ui.status.dataset.text!==status) { ui.status.textContent=status; ui.status.dataset.text=status; }
  ui.grid.textContent=`Grid ${(sLength/Scale*2**fieldCameraLevel()).toFixed(2)}${fieldTiles.preview?' · preview':''}`;
  ui.wavelength.textContent=`λ ${(c/freq).toFixed(2)}`;
  const total=temporalCache.hits+temporalCache.misses;
  ui.root.querySelector('#em-temporal-stats').textContent=temporalCache.enabled
    ?`Time cache: ${temporalCache.reason}${total?' · '+Math.round(100*temporalCache.hits/total)+'% hits':''}${temporalCache.count?' · '+temporalCache.frames.filter(Boolean).length+'/'+temporalCache.count+' phases':''}`
    :'Time cache: off';
  ui.root.querySelector('#em-zoom-reset').textContent=`${Math.round(zoom*100)}%`;
}


// Radiation limit of the same exp(+i omega t), exp(-ikr)/r Green function.
// Its common omega/r factor cancels when power is peak-normalized.
function farFieldPower(scene,theta) {
  const nx=Math.cos(theta),ny=Math.sin(theta),p=scene.plane;
  const side=p?nx*p.nx+ny*p.ny:0;
  // The mathematical PEC plane itself has no exterior observation half-space.
  if(p&&Math.abs(side)<1e-12)return 0;
  let re=0,im=0;const e=scene.elements;
  for(let i=0;i<e.length;i+=8){
    if(p&&side*e[i+7]<=0)continue;
    const phase=scene.k*(nx*e[i]+ny*e[i+1]),co=Math.cos(phase),si=Math.sin(phase);
    const jr=-ny*e[i+2]+nx*e[i+3],ji=-ny*e[i+4]+nx*e[i+5];
    re+=jr*co-ji*si;im+=jr*si+ji*co;
  }
  const magnetic=scene.magnetic;
  if(magnetic)for(let i=0;i<magnetic.length;i+=6){const phase=scene.k*(nx*magnetic[i]+ny*magnetic[i+1]),co=Math.cos(phase),si=Math.sin(phase),factor=2*Math.sign(side);re+=factor*(magnetic[i+3]*co-magnetic[i+4]*si);im+=factor*(magnetic[i+3]*si+magnetic[i+4]*co);}
  return re*re+im*im;
}
const radiationCache={scene:null,power:null,peak:0,stamp:''};
function renderRadiationPattern() {
  const panel=document.getElementById('em-radiation-panel');
  if(!panel||panel.hidden)return;
  const canvas=document.getElementById('em-radiation-canvas'),scene=fieldTiles.scene;
  const scale=document.getElementById('em-radiation-scale').value;
  const note=document.getElementById('em-radiation-note');
  const pending=fieldTiles.dirtyPhysics||!simulate||passiveSolveInfo.error;
  if(pending||!scene){note.textContent=passiveSolveInfo.error?passiveSolveInfo.message:'Updating currents…';canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);radiationCache.stamp='';return;}
  if(radiationCache.scene!==scene){
    const power=new Float64Array(720);let peak=0;
    for(let i=0;i<power.length;i++){power[i]=farFieldPower(scene,2*Math.PI*i/power.length);peak=Math.max(peak,power[i]);}
    radiationCache.scene=scene;radiationCache.power=power;radiationCache.peak=peak;radiationCache.stamp='';
  }
  const rect=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
  const stamp=[w,h,scale].join(':');if(stamp===radiationCache.stamp)return;radiationCache.stamp=stamp;
  const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const cx=w/2,cy=h/2,R=Math.max(1,Math.min(w,h)/2-32);
  ctx.font='11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  const radial=q=>scale==='db'?Math.max(0,(10*Math.log10(Math.max(q,1e-4))+40)/40):Math.log1p(99*q)/Math.log(100);
  ctx.lineWidth=1;ctx.strokeStyle='#394658';ctx.fillStyle='#aebccd';
  for(const db of [-30,-20,-10,0]){const r=R*radial(10**(db/10));ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.stroke();ctx.fillText(scale==='db'?db+' dB':(10**(db/10)).toFixed(db===0?0:3),cx+4,cy-r+9);}
  for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a),y=-Math.sin(a);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+R*x,cy+R*y);ctx.stroke();ctx.fillText(i*45+'°',cx+(R+19)*x,cy+(R+19)*y);}
  const peak=radiationCache.peak;
  note.textContent=peak>0?(scale==='db'?'Outer ring: 0 dB; center: −40 dB or below.':'Radius = log(1 + 99 P/Pmax) / log(100).'):'No radiating current in this cut.';
  if(!peak)return;
  ctx.strokeStyle='#77e2c3';ctx.lineWidth=2;ctx.beginPath();
  const power=radiationCache.power;
  for(let i=0;i<=power.length;i++){const a=i*2*Math.PI/power.length,r=R*radial(power[i%power.length]/peak);const x=cx+r*Math.cos(a),y=cy-r*Math.sin(a);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
  ctx.closePath();ctx.stroke();
}
