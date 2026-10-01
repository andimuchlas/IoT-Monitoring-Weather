export type QualityFlag =
  "good" | "out_of_range" | "sensor_error" | "uncalibrated" | "future_timestamp" | "duplicate";

export interface CalibrationFormula {
  scale?: number | null;
  offset?: number | null;
}

export interface RangeValidationOptions {
  rawValue: number;
  minVal?: number | null;
  maxVal?: number | null;
  timestamp?: Date | number | null;
  serverTime?: Date | number | null;
  maxFutureToleranceMs?: number;
  hasCalibration?: boolean;
}

export interface RainConversionResult {
  rainfallMm: number;
  deltaTips: number;
  isReset: boolean;
}

export function applyCalibration(
  rawValue: number,
  calibration?: CalibrationFormula | null,
  precision = 4
): number {
  if (rawValue === -999) {
    return -999;
  }

  const scale =
    calibration?.scale !== undefined && calibration?.scale !== null ? calibration.scale : 1.0;
  const offset =
    calibration?.offset !== undefined && calibration?.offset !== null ? calibration.offset : 0.0;

  const calibrated = rawValue * scale + offset;
  const factor = Math.pow(10, precision);
  return Math.round(calibrated * factor) / factor;
}

export function evaluateQualityFlag(options: RangeValidationOptions): QualityFlag {
  const {
    rawValue,
    minVal,
    maxVal,
    timestamp,
    serverTime,
    maxFutureToleranceMs = 5 * 60 * 1000,
  } = options;

  if (rawValue === -999) {
    return "sensor_error";
  }

  const resolvedServerTime = serverTime ?? new Date();

  if (timestamp) {
    const tsTime = typeof timestamp === "number" ? timestamp * 1000 : timestamp.getTime();
    const srvTime =
      typeof resolvedServerTime === "number" ? resolvedServerTime : resolvedServerTime.getTime();
    if (tsTime - srvTime > maxFutureToleranceMs) {
      return "future_timestamp";
    }
  }

  if (minVal !== undefined && minVal !== null && rawValue < minVal) {
    return "out_of_range";
  }
  if (maxVal !== undefined && maxVal !== null && rawValue > maxVal) {
    return "out_of_range";
  }

  if (options.hasCalibration === false) {
    return "uncalibrated";
  }

  return "good";
}

export function calculateRainfallMm(
  currentTips: number,
  previousTips: number | null
): RainConversionResult {
  const TIP_FACTOR_MM = 0.2;

  if (previousTips === null || previousTips === undefined) {
    return {
      rainfallMm: 0.0,
      deltaTips: 0,
      isReset: false,
    };
  }

  if (currentTips >= previousTips) {
    const delta = currentTips - previousTips;
    const mm = Number((delta * TIP_FACTOR_MM).toFixed(2));
    return {
      rainfallMm: mm,
      deltaTips: delta,
      isReset: false,
    };
  }

  const delta = currentTips;
  const mm = Number((delta * TIP_FACTOR_MM).toFixed(2));
  return {
    rainfallMm: mm,
    deltaTips: delta,
    isReset: true,
  };
}

export function calculateVectorMeanWindDirection(anglesDeg: number[], speeds?: number[]): number {
  if (anglesDeg.length === 0) return 0;

  let sumSin = 0;
  let sumCos = 0;

  for (let i = 0; i < anglesDeg.length; i++) {
    const angle = anglesDeg[i];
    if (angle === undefined) continue;

    const rad = (angle * Math.PI) / 180.0;
    const speed = speeds ? speeds[i] : undefined;
    const weight = speed !== undefined ? speed : 1.0;

    sumSin += Math.sin(rad) * weight;
    sumCos += Math.cos(rad) * weight;
  }

  let meanRad = Math.atan2(sumSin, sumCos);
  let meanDeg = (meanRad * 180.0) / Math.PI;

  if (meanDeg < 0) {
    meanDeg += 360.0;
  }

  return Math.round(meanDeg % 360);
}
