export const left=['3V3','3V3','RST',4,5,6,7,15,16,17,18,8,3,46,9,10,11,12,13,14,'5V','GND'];
export const right=['GND',43,44,1,2,42,41,40,39,38,37,36,35,0,45,48,47,21,20,19,'GND','GND'];
export const pins=[...new Set([...left,...right].filter(x=>typeof x==='number'))].sort((a,b)=>a-b);
export function describe(p){if(!p||(p.bits&32)===0)return ['Unavailable','—','—','—','—','—'];const b=p.bits;return [b&2?'Output enabled':'Output disabled',b&1?'HIGH':'LOW',b&16?'HIGH':'LOW',[b&4?'Up':'',b&8?'Down':''].filter(Boolean).join(' + ')||'None',p.adc<0?'No sample':String(p.adc),p.pwmHz<0?'Inactive / unavailable':`${p.pwmHz.toFixed(1)} Hz · ${(p.duty/65535*100).toFixed(1)}%`];}
