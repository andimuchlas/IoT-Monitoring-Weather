import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";
import { id } from "date-fns/locale";

export type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const date = typeof input === "string" || typeof input === "number" ? new Date(input) : input;
  return isNaN(date.getTime()) ? null : date;
}

export function formatWIB(dateInput: DateInput): string {
  const date = toDate(dateInput);
  if (!date) return "-";
  try {
    return format(date, "dd MMM yyyy, HH:mm 'WIB'", { locale: id });
  } catch {
    return "-";
  }
}

export function formatTimeWIB(dateInput: DateInput): string {
  const date = toDate(dateInput);
  if (!date) return "-";
  try {
    return format(date, "HH:mm:ss 'WIB'");
  } catch {
    return "-";
  }
}

export function formatRelativeTime(dateInput: DateInput): string {
  const date = toDate(dateInput);
  if (!date) return "Belum pernah aktif";
  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: id });
  } catch {
    return "-";
  }
}

export function checkIsOffline(dateInput: DateInput, thresholdMinutes = 15): boolean {
  const date = toDate(dateInput);
  if (!date) return true;
  try {
    const diff = differenceInMinutes(new Date(), date);
    return diff > thresholdMinutes;
  } catch {
    return true;
  }
}

export function formatChartTick(dateInput: DateInput, range: "24h" | "7d" | "30d" = "24h"): string {
  const date = toDate(dateInput);
  if (!date) return "";
  try {
    if (range === "24h") {
      return format(date, "HH:mm");
    }
    if (range === "7d") {
      return format(date, "EEE, HH:mm", { locale: id });
    }
    return format(date, "dd MMM", { locale: id });
  } catch {
    return "";
  }
}
