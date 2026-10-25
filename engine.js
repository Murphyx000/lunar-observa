// Descriptive image geometry only. No diagnostic model or clinical thresholds.
export function rgbToLab(r,g,b) {
  const linear=v=>{v/=255;return v>.04045?((v+.055)/1.055)**2.4:v/12.92;};
  r=linear(r);g=linear(g);b=linear(b);
  const f=v=>v>.008856?Math.cbrt(v):7.787*v+16/116;
  const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047), y=f(.2126729*r+.7151522*g+.072175*b), z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
  return [116*y-16,500*(x-y),200*(y-z)];
}
const median=a=>{a.sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:0;};
export function otsu(hist) {
  const n=hist.reduce((a,b)=>a+b,0);if(!n)return 0;
  let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
  let count=0,left=0,best=-1,threshold=0;
  for(let i=0;i<255;i++){count+=hist[i];left+=i*hist[i];if(!count||count===n)continue;const score=count*(n-count)*(left/count-(sum-left)/(n-count))**2;if(score>best){best=score;threshold=i;}}
  return threshold;
}
export function imageQuality(data,w,h,roi={x:0,y:0,w,h}) {
  let n=0,dark=0,bright=0,lap=0;
  const lum=i=>.2126*data[i*4]+.7152*data[i*4+1]+.0722*data[i*4+2];
  for(let y=Math.max(1,roi.y);y<Math.min(h-1,roi.y+roi.h);y+=2)for(let x=Math.max(1,roi.x);x<Math.min(w-1,roi.x+roi.w);x+=2){const i=y*w+x,v=lum(i);n++;if(v<12)dark++;if(v>245)bright++;const d=4*v-lum(i-1)-lum(i+1)-lum(i-w)-lum(i+w);lap+=d*d;}
  const warnings=[];
  if(Math.min(roi.w,roi.h)<100)warnings.push('Zona con pocos píxeles: toma una foto más cercana y enfocada.');
  if(n&&bright/n>.15)warnings.push('Hay zonas muy claras: comprueba si hay reflejos o sobreexposición.');
  if(n&&dark/n>.25)warnings.push('Hay zonas muy oscuras: comprueba la iluminación y las sombras.');
  if(n&&lap/n<8)warnings.push('Se detecta poco detalle: comprueba el enfoque. Una zona uniforme también puede producir este aviso.');
  return warnings;
}
export function segment(data,w,h,roi,seed,sensitivity=100) {
  if(data.length!==w*h*4)throw Error('Datos de imagen incompletos.');
  const x0=Math.max(1,Math.floor(roi.x)), y0=Math.max(1,Math.floor(roi.y)), x1=Math.min(w-1,Math.floor(roi.x+roi.w)), y1=Math.min(h-1,Math.floor(roi.y+roi.h));
  const rw=x1-x0,rh=y1-y0;
  if(rw<30||rh<30)throw Error('La zona es demasiado pequeña. Incluye el lunar completo y piel alrededor.');
  if(seed.x<=x0||seed.y<=y0||seed.x>=x1||seed.y>=y1)throw Error('Marca el centro dentro de la zona seleccionada.');
  const rim=Math.max(3,Math.floor(Math.min(rw,rh)*.1)), bg=[[],[],[]];
  for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){if(x-x0>=rim&&x1-1-x>=rim&&y-y0>=rim&&y1-1-y>=rim)continue;const i=(y*w+x)*4,c=rgbToLab(data[i],data[i+1],data[i+2]);for(let j=0;j<3;j++)bg[j].push(c[j]);}
  const base=bg.map(median), distances=new Float32Array(w*h), smooth=new Float32Array(w*h), hist=new Array(256).fill(0);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=y*w+x,i=p*4,c=rgbToLab(data[i],data[i+1],data[i+2]);distances[p]=Math.hypot(...c.map((v,j)=>v-base[j]));}
  for(let y=y0+1;y<y1-1;y++)for(let x=x0+1;x<x1-1;x++){const i=y*w+x;let v=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)v+=distances[i+dy*w+dx];v/=9;smooth[i]=v;hist[Math.min(255,Math.round(v*2))]++;}
  const threshold=Math.max(5,(otsu(hist)/2)*100/Math.max(60,Math.min(160,sensitivity)));
  const candidates=new Uint8Array(w*h);
  for(let y=y0+1;y<y1-1;y++)for(let x=x0+1;x<x1-1;x++){const i=y*w+x;if(smooth[i]>threshold)candidates[i]=1;}
  let start=-1,best=Infinity;const maxDistance=Math.min(rw,rh)*.15;
  for(let y=Math.max(y0+1,Math.floor(seed.y-maxDistance));y<Math.min(y1-1,seed.y+maxDistance);y++)for(let x=Math.max(x0+1,Math.floor(seed.x-maxDistance));x<Math.min(x1-1,seed.x+maxDistance);x++){const d=Math.hypot(x-seed.x,y-seed.y);if(candidates[y*w+x]&&d<best){best=d;start=y*w+x;}}
  if(start<0)throw Error('No hay contraste suficiente cerca del centro. Prueba otra foto o dibuja el contorno con el pincel.');
  const mask=new Uint8Array(w*h), queue=new Int32Array(w*h);let read=0,write=1;queue[0]=start;mask[start]=1;let touches=false;
  while(read<write){const i=queue[read++],x=i%w,y=Math.floor(i/w);if(x<=x0+1||x>=x1-2||y<=y0+1||y>=y1-2)touches=true;for(const j of [i-1,i+1,i-w,i+w])if(j>=0&&j<mask.length&&candidates[j]&&!mask[j]){mask[j]=1;queue[write++]=j;}}
  if(write<40)throw Error('La región detectada es demasiado pequeña. Marca el centro del lunar o mejora el encuadre.');
  if(touches||write>rw*rh*.8)throw Error('El contorno alcanza el límite de la zona. Amplía la zona con piel alrededor, ajusta la amplitud o corrige con pincel.');
  // Fill enclosed holes, without joining separate components.
  const exterior=new Uint8Array(w*h);read=0;write=0;
  const push=i=>{if(!mask[i]&&!exterior[i]){exterior[i]=1;queue[write++]=i;}};
  for(let x=x0;x<x1;x++){push(y0*w+x);push((y1-1)*w+x);}for(let y=y0;y<y1;y++){push(y*w+x0);push(y*w+x1-1);}
  while(read<write){const i=queue[read++],x=i%w,y=Math.floor(i/w);if(x>x0)push(i-1);if(x<x1-1)push(i+1);if(y>y0)push(i-w);if(y<y1-1)push(i+w);}
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=y*w+x;if(!exterior[i])mask[i]=1;}
  return {mask,threshold,warnings:imageQuality(data,w,h,roi)};
}
export function paint(mask,w,h,from,to,radius,add) {
  const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.max(1,Math.ceil(distance/Math.max(1,radius*.5)));
  for(let t=0;t<=steps;t++){const cx=from.x+(to.x-from.x)*t/steps,cy=from.y+(to.y-from.y)*t/steps;for(let y=Math.max(0,Math.floor(cy-radius));y<=Math.min(h-1,Math.ceil(cy+radius));y++)for(let x=Math.max(0,Math.floor(cx-radius));x<=Math.min(w-1,Math.ceil(cx+radius));x++)if((x-cx)**2+(y-cy)**2<=radius**2)mask[y*w+x]=add?1:0;}
}
export function validateMask(mask,w,h) {
  if(mask.length!==w*h)throw Error('Contorno incompatible con la imagen.');
  let count=0,start=-1;
  for(let i=0;i<mask.length;i++)if(mask[i]){count++;start=i;const x=i%w,y=Math.floor(i/w);if(x===0||x===w-1||y===0||y===h-1)throw Error('El contorno está cortado por el borde de la foto. Usa una foto con todo el lunar visible.');}
  if(count<40)throw Error('El contorno es demasiado pequeño para medir.');
  const seen=new Uint8Array(mask.length),q=new Int32Array(count);q[0]=start;seen[start]=1;let r=0,n=1;
  while(r<n){const i=q[r++];for(const j of [i-1,i+1,i-w,i+w])if(j>=0&&j<mask.length&&mask[j]&&!seen[j]){seen[j]=1;q[n++]=j;}}
  if(n!==count)throw Error('Hay varias zonas separadas. Conserva un solo lunar o une las partes con el pincel.');
  return count;
}
function hull(points){points.sort((a,b)=>a.x-b.x||a.y-b.y);const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);const lower=[],upper=[];for(const p of points){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(let i=points.length-1;i>=0;i--){const p=points[i];while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}return lower.slice(0,-1).concat(upper.slice(0,-1));}
export function measure(data,w,h,mask) {
  const area=validateMask(mask,w,h),points=[],boundary=[];let cx=0,cy=0;const colorSum=[0,0,0],colorSquare=[0,0,0];
  for(let i=0;i<mask.length;i++)if(mask[i]){const x=i%w,y=Math.floor(i/w);points.push({x,y});cx+=x;cy+=y;const c=rgbToLab(data[i*4],data[i*4+1],data[i*4+2]);for(let j=0;j<3;j++){colorSum[j]+=c[j];colorSquare[j]+=c[j]**2;}if(!mask[i-1]||!mask[i+1]||!mask[i-w]||!mask[i+w])boundary.push({x,y});}
  cx/=area;cy/=area;let xx=0,yy=0,xy=0;
  for(const p of points){xx+=(p.x-cx)**2;yy+=(p.y-cy)**2;xy+=(p.x-cx)*(p.y-cy);}
  const angle=.5*Math.atan2(2*xy,xx-yy),c=Math.cos(angle),s=Math.sin(angle);let missedA=0,missedB=0;
  const inside=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&x<w&&y>=0&&y<h&&mask[y*w+x];};
  for(const p of points){const x=p.x-cx,y=p.y-cy,u=x*c+y*s,v=-x*s+y*c;if(!inside(cx+u*c+v*s,cy+u*s-v*c))missedA++;if(!inside(cx-u*c-v*s,cy-u*s+v*c))missedB++;}
  // Marching-squares perimeter; avoids a four-neighbor Manhattan perimeter.
  const k=Math.SQRT1_2, table=[0,k,k,1,k,2*k,1,k,k,1,2*k,k,1,k,k,0];let perimeter=0;
  for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){const i=y*w+x;perimeter+=table[mask[i]+2*mask[i+1]+4*mask[i+w+1]+8*mask[i+w]];}
  const polygon=hull(boundary);let diameter=0;
  for(let i=0;i<polygon.length;i++)for(let j=i+1;j<polygon.length;j++)diameter=Math.max(diameter,Math.hypot(polygon[i].x-polygon[j].x,polygon[i].y-polygon[j].y));
  const colorVariation=Math.sqrt(colorSum.reduce((total,sum,j)=>total+Math.max(0,colorSquare[j]/area-(sum/area)**2),0));
  return {area,perimeter,asymmetry:(missedA+missedB)/(2*area),compactness:Math.min(1,4*Math.PI*area/perimeter**2),colorVariation,diameter,centroid:{x:cx,y:cy},angle};
}
export function scaleFactor(points,mm){if(points.length!==2||!Number.isFinite(mm)||mm<.1||mm>200)return null;const px=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);return px>=15?mm/px:null;}
