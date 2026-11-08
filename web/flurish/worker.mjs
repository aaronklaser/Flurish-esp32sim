import {createRuntime} from './runtime.mjs';
let runtime=null,timer=null,files=null,running=false,origin=0,startCycles=0,lastReport=0;
const send=data=>postMessage(data);
function stop(){running=false;clearTimeout(timer);timer=null;}
function report(){send({snapshot:runtime.snapshot(),running});}
function tick(){if(!running)return;try{const begin=performance.now();let state=runtime.snapshot();const target=startCycles+(begin-origin)*state.hz/1000;
 while(state.cycles<target&&performance.now()-begin<8){runtime.step(Math.min(240000,Math.max(1,Math.ceil(target-state.cycles))));state.cycles=runtime.cycles();}
 if(performance.now()-lastReport>100){report();lastReport=performance.now();}
 // Do not accumulate a catch-up burst after a backgrounded tab.
 if(target-state.cycles>state.hz*.5){origin=performance.now();startCycles=state.cycles;}
 timer=setTimeout(tick,5);
 }catch(e){stop();send({error:e.message});}}
let queue=Promise.resolve();
self.onmessage=({data:m})=>{queue=queue.then(async()=>{
 if(m.op==='load'){stop();runtime?.destroy();runtime=null;const response=await fetch('../wasm/esp32sim.wasm');if(!response.ok)throw Error('Emulator build unavailable');runtime=await createRuntime(await response.arrayBuffer(),send);files=m.files.map(([k,b])=>[k,new Uint8Array(b)]);runtime.load(files);report();send({ready:true});}
 else if(m.op==='run'){if(!runtime?.snapshot())throw Error('Load firmware first');if(running)return;running=true;origin=performance.now();startCycles=runtime.snapshot().cycles;report();tick();}
 else if(m.op==='pause'){stop();if(runtime)report();}
 else if(m.op==='reset'){stop();if(!files)throw Error('Load firmware first');runtime.load(files);report();}
 else if(m.op==='step'){stop();runtime.step();report();}
 }).catch(e=>{stop();send({error:e.message});});};
