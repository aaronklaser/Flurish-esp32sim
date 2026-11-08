//! Read-only pin observations for the Flurish wrapper. No register reads with side effects.
use super::Emu;

/// GPIO snapshot bits: valid=32, output latch=1, output enable=2, pull-up=4,
/// pull-down=8, sampled digital input=16. This is not an electrical solver.
/// # Safety
/// `e` must be a live, exclusively borrowed emulator pointer.
#[no_mangle]
pub unsafe extern "C" fn flurish_gpio(e: *mut Emu, pin: u32) -> u32 {
    if pin > 48 { return 0; }
    // SAFETY: The caller provides exclusive access to a live emulator.
    let bus = unsafe { &mut *e }.m.bus();
    match bus.gpio_state(pin as u8) {
        Some(s) => 32 | u32::from(s.output) | (u32::from(s.output_enable) << 1)
            | (u32::from(s.pull_up) << 2) | (u32::from(s.pull_down) << 3)
            | (((bus.gpio_input() >> pin) as u32 & 1) << 4),
        None => 0,
    }
}

/// Last completed ADC conversion, or -1 when no conversion has completed.
/// # Safety
/// `e` must be a live, exclusively borrowed emulator pointer.
#[no_mangle]
pub unsafe extern "C" fn flurish_adc(e: *mut Emu, pin: u32) -> i32 {
    if pin > 48 { return -1; }
    // SAFETY: The caller provides exclusive access to a live emulator.
    unsafe { &mut *e }.m.bus().adc_observation(pin as u8)
        .filter(|s| s.generation != 0).map_or(-1, |s| s.raw as i32)
}

/// PWM frequency, or -1 when unsupported/inactive. This is not an instantaneous level.
/// # Safety
/// `e` must be a live, exclusively borrowed emulator pointer.
#[no_mangle]
pub unsafe extern "C" fn flurish_pwm_hz(e: *mut Emu, pin: u32) -> f64 {
    if pin > 48 { return -1.0; }
    // SAFETY: The caller provides exclusive access to a live emulator.
    unsafe { &mut *e }.m.bus().pwm_output(pin as u8).map_or(-1.0, |s| s.0)
}

/// PWM duty, 0..65535, or -1 when unsupported/inactive.
/// # Safety
/// `e` must be a live, exclusively borrowed emulator pointer.
#[no_mangle]
pub unsafe extern "C" fn flurish_pwm_duty(e: *mut Emu, pin: u32) -> i32 {
    if pin > 48 { return -1; }
    // SAFETY: The caller provides exclusive access to a live emulator.
    unsafe { &mut *e }.m.bus().pwm_output(pin as u8).map_or(-1, |s| s.1 as i32)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{esp32sim_delete, esp32sim_new};
    #[test]
    fn observations_are_read_only_and_distinguish_latch_from_input() {
        let board = b"none";
        // SAFETY: Input bytes are valid, the returned pointer is checked and uniquely owned.
        let e = unsafe { esp32sim_new(board.as_ptr(), board.len(), 16, 8) };
        assert!(!e.is_null());
        // SAFETY: This test owns e until deletion; all borrows are sequential.
        unsafe {
            let bus = (&mut *e).m.bus();
            // ESP-IDF v5.5.4 soc/esp32s3/register/soc/gpio_reg.h: OUT and ENABLE.
            bus.write32(0x6000_4004, 1 << 4).unwrap();
            bus.write32(0x6000_4020, 1 << 4).unwrap();
            let before = bus.cycles();
            let state = flurish_gpio(e, 4);
            assert_eq!(state & 35, 35);
            assert_eq!(flurish_gpio(e, 4), state);
            assert_eq!((&mut *e).m.bus().cycles(), before);
            assert_eq!(flurish_gpio(e, 22), 0);
            assert_eq!(flurish_gpio(e, u32::MAX), 0);
            assert_eq!(flurish_adc(e, 4), -1);
            assert_eq!(flurish_pwm_hz(e, 4), -1.0);
            (&mut *e).m.bus().write32(0x6000_4004, 0).unwrap();
            assert_eq!(flurish_gpio(e, 4) & 1, 0);
            esp32sim_delete(e);
        }
    }
}
