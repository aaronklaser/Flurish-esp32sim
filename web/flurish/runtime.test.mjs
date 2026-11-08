import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const readInput=(url)=>readFile(url.pathname.endsWith('/esp32s3_rev0_rom.elf')&&process.env.ESP32SIM_ROM_DIR?join(process.env.ESP32SIM_ROM_DIR,'esp32s3_rev0_rom.elf'):url);
import {createRuntime} from './runtime.mjs';
import {left,right,describe} from './pins.mjs';
test('Header layout and unavailable states remain explicit',()=>{assert.equal(left.length,22);assert.equal(right.length,22);assert.equal(right[18],20);assert.equal(describe(null)[0],'Unavailable');assert.equal(describe({bits:32,adc:-1,pwmHz:-1,duty:-1})[4],'No sample');assert.equal(describe({bits:35,adc:0,pwmHz:1000,duty:0})[5],'1000.0 Hz · 0.0%');});
test('Real S3 WASM boots hello_world, reports pins, and resets independently',async()=>{
 const base=new URL('../wasm/',import.meta.url),output=[];const bytes=await readFile(new URL('esp32sim.wasm',base));const r=await createRuntime(bytes,m=>output.push(m.text||m.log||''));
 try{const files=await Promise.all([[0,'esp32s3_rev0_rom.elf'],[1,'public/hello-bootloader.bin'],[2,'public/hello-ptable.bin'],[3,'public/hello_world.bin']].map(async([k,p])=>[k,await readInput(new URL('fw/'+p,base))]));r.load(files);for(let i=0;i<400&&!output.join('').includes('Hello world!');i++)r.step(2000000);assert.match(output.join(''),/Hello world!/);const state=r.snapshot();assert.ok(state.instructions>0);assert.equal(state.hz,240000000);assert.equal(state.pins[22].bits,0);assert.ok(state.pins[4].bits&32);assert.equal(state.pins[4].adc,-1);assert.equal(r.snapshot().cycles,state.cycles);r.load(files);assert.ok(r.snapshot().cycles<state.cycles);assert.throws(()=>r.load([[0,new Uint8Array([1,2,3])]]),/Load ROM/);}finally{r.destroy();}
});

import {validateFirmware} from './firmware.mjs';
test('Firmware rejects other chip images and nonstandard application offsets',async()=>{const base=new URL('../wasm/fw/',import.meta.url);const files=await Promise.all([[0,'esp32s3_rev0_rom.elf'],[1,'public/hello-bootloader.bin'],[2,'public/hello-ptable.bin'],[3,'public/hello_world.bin']].map(async([k,p])=>[k,new Uint8Array(await readInput(new URL(p,base)))]));validateFirmware(files);files[3][1][12]=5;assert.throws(()=>validateFirmware(files),/ESP32-S3/);files[3][1][12]=9;files[2][1].fill(0);assert.throws(()=>validateFirmware(files),/partition at/);});
