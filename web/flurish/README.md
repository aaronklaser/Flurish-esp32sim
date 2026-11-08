# Flurish ESP32 inspector

Single ESP32-S3, 16 MiB flash / 8 MiB PSRAM, in one dedicated browser Worker and one WASM instance. Based on upstream commit `0437f1485177fb3d8c4ec298c7721476486b72b9`. The wrapper does not connect components or operate physical hardware.

## Run locally

```sh
tools/wasm-build.sh
tools/fetch-rom-elfs.sh web/wasm/fw
python3 -m http.server --directory web 8790
```

Open `http://localhost:8790/flurish/`. Load demo, then Run. Pause freezes execution; Step advances a bounded cycle slice (approximately 1 ms); Reset creates a fresh machine from the retained firmware, restoring the original flash and RAM state. Run after Pause resumes that state. Load replaces the worker and runtime. Closing the page destroys it. UART0 is shown separately from the mirrored USB console to avoid duplicate output.

## Firmware and source

Load an S3 bootloader, partition table and application from the same build. This first wrapper supports offsets 0x0 / 0x8000 / 0x10000 only. Image target, size and application partition fit are checked before execution. ROM comes from the upstream hash-verified Espressif asset fetcher. Uploaded firmware/source stays in the tab; no networking or component input interface is enabled.

The upstream hello_world demo is precompiled, configured for 2 MiB flash, and may print a flash-size warning on this 16 MiB model. Its reference source is copied from `examples/hello_world/main/hello_world_main.c` with its CC0 notice preserved. It has not been rebuilt here to prove source/binary reproducibility. It does not exercise all N16R8 peripherals or PSRAM. The inspector is not a source-level debugger.

Source can be inspected, edited and downloaded, but is explicitly an uncompiled draft. Firmware remains the execution authority. Compile externally and reload the resulting binaries to change execution. A compiler service and reproducible source/build manifest are future work, not implemented behavior.

Export firmware downloads JSON with the exact loaded bootloader, partition and application bytes (base64), SHA-256 per image, target/memory settings, standard offsets and a separately labeled source draft. This is a troubleshooting bundle, not an esptool-ready file or verified deployment release. It excludes the ROM. No automatic flashing, version registry or rollback is implemented.

## Pin semantics

`wasm/src/flurish.rs` reads existing `SocBus` observations, without bus MMIO reads or changes to CPU execution. It exposes output latch, output enable, sampled digital input, pull configuration, last completed ADC count and supported PWM frequency/duty. No ADC conversion is reported until one completes. GPIO22–25 are absent; rails/reset have no fabricated numeric readings. GPIO35–37 are marked for PSRAM on the N16R8 header.

These are simulated registers and peripheral observations. An enabled output latch does not prove a pad's electrical level or multiplexed peripheral waveform. Samples refresh about 10 times per second and may miss fast edges. Default core inputs are not physical measurements. Simulator emulated cycles own time; wall time only paces execution. The wrapper does not introduce a biological/world clock.

## Checks

```sh
cargo test -p esp32sim-wasm --lib flurish
node --test web/flurish/*.test.mjs
```

The JS integration test instantiates the real compiled WASM, boots the S3 hello_world image through the ROM, checks serial output and pin snapshots, checks reset and invalid firmware. `ESP32SIM_ROM_DIR` can override the ROM directory as in upstream CI. Native tests verify GPIO observations track programmed changes without advancing the clock and reject invalid pins. Run the repository's full AGENTS.md/CI checks before merging.

Not established: physical hardware parity, iPhone performance, arbitrary firmware compatibility, complete peripheral emulation, source-level stepping, or source-to-firmware compilation.
