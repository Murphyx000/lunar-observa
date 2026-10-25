const results=[];
function test(name,fn){try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}}
function assert(value,message='assertion failed'){if(!value)throw Error(message);}
function throws(fn){let caught=false;try{fn();}catch{caught=true;}assert(caught,'expected rejection');}
function fixture(shape=(x,y)=>(x-64)**2+(y-64)**2<25**2,fg=[75,45,30],bg=[195,150,125]){const w=128,h=128,data=new Uint8ClampedArray(w*h*4),mask=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x,inside=shape(x,y),c=inside?fg:bg;mask[p]=inside?1:0;data.set([...c,255],p*4);}return {data,mask,w,h};}
const roi={x:8,y:8,w:112,h:112},seed={x:64,y:64};
function iou(a,b){let union=0,intersection=0;for(let i=0;i<a.length;i++){if(a[i]||b[i])union++;if(a[i]&&b[i])intersection++;}return intersection/union;}
test('Lab conversion: black, white, neutral',()=>{assert(Math.abs(rgbToLab(0,0,0)[0])<.01);assert(Math.abs(rgbToLab(255,255,255)[0]-100)<.01);assert(Math.abs(rgbToLab(100,100,100)[1])<.01);});
test('Otsu separates a bimodal histogram',()=>{const h=new Array(256).fill(0);h[15]=100;h[180]=30;const t=otsu(h);assert(t>=15&&t<180);});
test('synthetic dark circle segmentation overlaps reference',()=>{const f=fixture();const r=segment(f.data,128,128,roi,seed);assert(iou(r.mask,f.mask)>.92,`IoU ${iou(r.mask,f.mask)}`);});
test('synthetic lighter region on dark background',()=>{const f=fixture(undefined,[180,135,110],[80,52,40]);const r=segment(f.data,128,128,roi,seed);assert(iou(r.mask,f.mask)>.9);});
test('uniform image has no invented contour',()=>{const f=fixture(()=>false);throws(()=>segment(f.data,128,128,roi,seed));});
test('seed outside ROI is rejected',()=>{const f=fixture();throws(()=>segment(f.data,128,128,roi,{x:1,y:1}));});
test('ROI cutting across lesion is rejected',()=>{const f=fixture();throws(()=>segment(f.data,128,128,{x:50,y:40,w:60,h:60},seed));});
test('circle symmetry and diameter',()=>{const f=fixture();const r=measure(f.data,128,128,f.mask);assert(r.asymmetry<.02,`${r.asymmetry}`);assert(r.diameter>47&&r.diameter<51);assert(r.compactness>.8&&r.compactness<=1);});
test('rotated symmetric ellipse remains approximately symmetric',()=>{const f=fixture((x,y)=>{const u=(x-64)*.8+(y-64)*.6,v=-(x-64)*.6+(y-64)*.8;return u*u/900+v*v/225<1;});assert(measure(f.data,128,128,f.mask).asymmetry<.06);});
test('a connected asymmetric shape differs from circle',()=>{const f=fixture((x,y)=>(x-60)**2+(y-64)**2<25**2||((x-85)**2+(y-45)**2<15**2));assert(measure(f.data,128,128,f.mask).asymmetry>.04);});
test('uniform lesion color dispersion is zero',()=>{const f=fixture();assert(measure(f.data,128,128,f.mask).colorVariation<.001);});
test('multiple colors increase color dispersion',()=>{const f=fixture();for(let y=0;y<128;y++)for(let x=64;x<128;x++)if(f.mask[y*128+x])f.data[(y*128+x)*4]+=80;assert(measure(f.data,128,128,f.mask).colorVariation>5);});
test('disconnected masks are rejected',()=>{const f=fixture();f.mask[10*128+10]=1;throws(()=>measure(f.data,128,128,f.mask));});
test('clipped mask is rejected',()=>{const f=fixture((x,y)=>x<50&&y>20&&y<90);throws(()=>measure(f.data,128,128,f.mask));});
test('empty masks are rejected',()=>{const f=fixture(()=>false);throws(()=>measure(f.data,128,128,f.mask));});
test('brush adds a continuous stroke and eraser removes it',()=>{const m=new Uint8Array(128*128);paint(m,128,128,{x:20,y:50},{x:100,y:50},5,true);assert(m[50*128+60]===1);assert(validateMask(m,128,128)>200);paint(m,128,128,{x:20,y:50},{x:100,y:50},6,false);assert(!m.some(Boolean));});
test('scale requires a valid reference, never guessed millimeters',()=>{assert(scaleFactor([],10)===null);assert(scaleFactor([{x:0,y:0},{x:100,y:0}],10)===.1);assert(scaleFactor([{x:0,y:0},{x:10,y:0}],10)===null);assert(scaleFactor([{x:0,y:0},{x:100,y:0}],0)===null);assert(scaleFactor([{x:0,y:0},{x:100,y:0}],NaN)===null);});
test('quality warns on very small ROI',()=>{const f=fixture();assert(imageQuality(f.data,128,128,{x:10,y:10,w:60,h:60}).some(x=>x.includes('píxeles')));});
return results;
