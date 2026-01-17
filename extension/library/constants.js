export const BATTERIES = {
    BAT0: '/sys/class/power_supply/BAT0/',
    BAT1: '/sys/class/power_supply/BAT1/',
    BAT2: '/sys/class/power_supply/BAT2/',
};

export const MAX_CALLS_PER_SECOND = 100;
export const CACHE_AGE_MS = 5 * 60 * 1000;
export const PURGE_INTERVAL_MS = 60 * 1000;
export const CACHE_MAX_ENTRIES = 64;
export const SVG_COLOR_QUANT = 0.05;

export const CIRCLE = {
    MIN_SIZE: 24,
    CHARGING_ICON_SCALE: 2.1,
    CHARGING_ICON_SPACING: 1.05,
    RING_OUTER_PADDING: 2,
    RING_INNER_RATIO: 0.9,
    DEGREES_PER_PERCENT: 3.6,
    ARC_START_ANGLE: -Math.PI / 2,
    FONT_SIZE_RATIO: 0.42,
};

export const BATTERY = {
    MIN_SIZE: 24,
};
