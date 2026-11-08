import {validateFirmware} from './firmware.mjs';
// One WASM instance per board; no component wiring or host-input injection.
import {createJitHost} from '../wasm/jit.mjs';
export async function createRuntime(bytes,emit=()=>{}) {
 let w,e=0,booted=false;const enc=new TextEncoder(),dec=new TextDecoder();
 const jit=createJitHost(()=>w),mem=()=>new Uint8Array(w.memory.buffer);
 const {instance}=await WebAssembly.instantiate(bytes,{env:{...jit.imports,host_profile_now:()=>performance.now(),host_log:(p,n)=>emit({log:dec.decode(mem().subarray(p,p+n))})}});w=instance.exports;
 if(!w.flurish_gpio)throw Error('This WASM build lacks the Flurish pin interface. Rebuild the fork.');
 const put=(bytes,fn)=>{const p=w.esp32sim_alloc(bytes.length);try{mem().set(bytes,p);return fn(p,bytes.length);}finally{w.esp32sim_free(p,bytes.length);}};
 function drain(){const n=w.esp32sim_out_take(e);for(let i=0;i<n;i++){if(w.esp32sim_out_kind(e,i)!==1)continue;const p=w.esp32sim_out_ptr(e,i),l=w.esp32sim_out_len(e,i);emit({text:dec.decode(mem().subarray(p,p+l))});}}
 return {
  load(files){validateFirmware(files);if(e)w.esp32sim_delete(e);booted=false;e=put(enc.encode('none'),(p,n)=>w.esp32sim_new(p,n,16,8));if(!e)throw Error('Could not create ESP32-S3');w.esp32sim_set_jit(e,1);
   for(const [kind,data] of files){if(put(data,(p,n)=>w.esp32sim_load(e,kind,p,n))!==0)throw Error('Invalid firmware image (kind '+kind+')');}
   if(w.esp32sim_boot(e,0)!==0)throw Error('Firmware boot failed');booted=true;drain();
  },
  step(cycles=240000){if(!booted)throw Error('No booted firmware');const rc=w.esp32sim_run(e,cycles,0);drain();if(rc)throw Error('Emulator stopped: '+rc);},
  cycles(){return w.esp32sim_cycles(e);},
  snapshot(){if(!booted)return null;return {cycles:w.esp32sim_cycles(e),instructions:w.esp32sim_insns(e),hz:w.esp32sim_cpu_hz(e),pins:Array.from({length:49},(_,pin)=>({pin,bits:w.flurish_gpio(e,pin),adc:w.flurish_adc(e,pin),pwmHz:w.flurish_pwm_hz(e,pin),duty:w.flurish_pwm_duty(e,pin)}))};},
  destroy(){if(e)w.esp32sim_delete(e);e=0;booted=false;}
 };
}
