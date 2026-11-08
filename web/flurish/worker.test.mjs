import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const base=new URL('../wasm/fw/',import.meta.url);
test('Worker run, pause, reset and step use the same chip state', {timeout:15000},async()=>{
 const bridge=`import {parentPort} from 'node:worker_threads';import {readFile} from 'node:fs/promises';globalThis.self=globalThis;globalThis.postMessage=m=>parentPort.postMessage(m);globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>{const b=await readFile(new URL(${JSON.stringify(new URL('../wasm/esp32sim.wasm',import.meta.url).href)}));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});await import(${JSON.stringify(new URL('./worker.mjs',import.meta.url).href)});parentPort.on('message',data=>self.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge)),{type:'module'});const messages=[];worker.on('message',m=>messages.push(m));
 const waitFor=predicate=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.off('message',handler);reject(Error('Worker response timeout'));},5000);const handler=m=>{if(m.error||predicate(m)){clearTimeout(timer);worker.off('message',handler);m.error?reject(Error(m.error)):resolve(m);}};worker.on('message',handler);});
 try{
 const files=await Promise.all([[0,'esp32s3_rev0_rom.elf'],[1,'public/hello-bootloader.bin'],[2,'public/hello-ptable.bin'],[3,'public/hello_world.bin']].map(async([k,p])=>[k,new Uint8Array(await readFile(k===0&&process.env.ESP32SIM_ROM_DIR?join(process.env.ESP32SIM_ROM_DIR,p):new URL(p,base)))]));
 let receipt=waitFor(m=>m.ready);worker.postMessage({op:'load',files});await receipt;
 receipt=waitFor(m=>m.running&&m.snapshot.cycles>0);worker.postMessage({op:'run'});await receipt;
 receipt=waitFor(m=>m.snapshot&&!m.running);worker.postMessage({op:'pause'});const paused=await receipt;assert.ok(paused.snapshot.cycles>0);
 const count=messages.length;await new Promise(resolve=>setTimeout(resolve,50));assert.equal(messages.length,count);
 receipt=waitFor(m=>m.snapshot&&!m.running);worker.postMessage({op:'step'});const stepped=await receipt;assert.ok(stepped.snapshot.cycles>paused.snapshot.cycles);
 receipt=waitFor(m=>m.snapshot&&!m.running);worker.postMessage({op:'reset'});const reset=await receipt;assert.equal(reset.snapshot.cycles,0);
 }finally{await worker.terminate();}
});
