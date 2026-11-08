// This wrapper deliberately supports the standard ESP-IDF flash layout only.
export function validateFirmware(files){
 if(!Array.isArray(files)||files.length!==4)throw Error('Load ROM, bootloader, partition table and application together');
 const map=new Map(files);if(map.size!==4||![0,1,2,3].every(k=>map.get(k) instanceof Uint8Array))throw Error('Invalid firmware file set');
 const rom=map.get(0),boot=map.get(1),table=map.get(2),app=map.get(3);
 if(rom.length>8*1024*1024||rom.length<4||rom[0]!==127||rom[1]!==69||rom[2]!==76||rom[3]!==70)throw Error('Invalid ROM ELF');
 for(const image of [boot,app])if(image.length<24||image[0]!==0xe9||image[12]!==9||image[13]!==0)throw Error('Requires ESP32-S3 image binaries');
 if(boot.length>0x8000||table.length>0x1000||table.length<32)throw Error('Firmware does not fit the standard flash layout');
 const view=new DataView(table.buffer,table.byteOffset,table.byteLength);let fits=false;
 for(let i=0;i+32<=table.length;i+=32){if(view.getUint16(i,true)!==0x50aa)break;const offset=view.getUint32(i+4,true),size=view.getUint32(i+8,true);if(offset+size>16*1024*1024)throw Error('Partition exceeds 16 MB flash');if(table[i+2]===0&&offset===0x10000&&app.length<=size)fits=true;}
 if(!fits)throw Error('Application must fit a partition at 0x10000');
}
