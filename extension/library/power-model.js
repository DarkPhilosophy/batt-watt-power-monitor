/**
 * Choose battery wattage (Watts) from raw, already-converted sysfs values.
 *
 * A value of -1 means "unreadable" — either the sysfs file is missing or its
 * async read (see system.js file cache) has not resolved yet on this cycle.
 *
 * Preference order:
 *   1. power_now, when readable (the accurate kernel value);
 *   2. current_now * voltage_now, only when BOTH are readable;
 *   3. otherwise 0 — never a bogus negative produced by multiplying a -1
 *      sentinel by a valid voltage (issue #10: the stuck "-7.7 W").
 *
 * This is re-evaluated on every getPower() call, so a boot-time race where
 * power_now is not cached yet self-corrects on the next cycle instead of being
 * permanently locked in.
 *
 * @param {number} powerNow - power_now in W, or -1 if unreadable
 * @param {number} currentNow - current_now in A, or -1 if unreadable
 * @param {number} voltageNow - voltage_now in V, or -1 if unreadable
 * @returns {number} Power in Watts (>= 0 unless power_now itself is negative, e.g. charging convention)
 */
export function computePower(powerNow, currentNow, voltageNow) {
    if (powerNow !== -1) return powerNow;
    if (currentNow !== -1 && voltageNow !== -1) return currentNow * voltageNow;
    return 0;
}
