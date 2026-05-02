import { describe, it, expect } from "vitest";
import {
  parseMonthParam,
  parseYearParam,
  parseViewParam,
  parseSpanParam,
  parseAnalyticsMonthParam,
  monthKeyToParts,
  partsToMonthKey,
} from "../utils/urlParams";
import { DASHBOARD_VIEWS } from "../features/dashboard/constants";

describe("parseMonthParam", () => {
  it("returns default when value is null", () => {
    expect(parseMonthParam(null, "2026-05")).toBe("2026-05");
  });

  it("returns default when value is empty", () => {
    expect(parseMonthParam("", "2026-05")).toBe("2026-05");
  });

  it("returns default when value is invalid format", () => {
    expect(parseMonthParam("bad", "2026-05")).toBe("2026-05");
    expect(parseMonthParam("2026-13", "2026-05")).toBe("2026-05");
    expect(parseMonthParam("2026-00", "2026-05")).toBe("2026-05");
    expect(parseMonthParam("26-05", "2026-05")).toBe("2026-05");
    expect(parseMonthParam("2026/05", "2026-05")).toBe("2026-05");
  });

  it("returns valid month key", () => {
    expect(parseMonthParam("2026-05", "2026-01")).toBe("2026-05");
    expect(parseMonthParam("2024-12", "2026-01")).toBe("2024-12");
    expect(parseMonthParam("2026-01", "2026-05")).toBe("2026-01");
  });
});

describe("parseYearParam", () => {
  it("returns default when value is null", () => {
    expect(parseYearParam(null, 2026)).toBe(2026);
  });

  it("returns default when value is not a number", () => {
    expect(parseYearParam("bad", 2026)).toBe(2026);
  });

  it("returns default when year is out of range", () => {
    expect(parseYearParam("1999", 2026)).toBe(2026);
    expect(parseYearParam("2101", 2026)).toBe(2026);
  });

  it("returns valid year", () => {
    expect(parseYearParam("2026", 2025)).toBe(2026);
    expect(parseYearParam("2000", 2026)).toBe(2000);
    expect(parseYearParam("2100", 2026)).toBe(2100);
  });
});

describe("parseViewParam", () => {
  it("returns categories when value is null", () => {
    expect(parseViewParam(null)).toBe(DASHBOARD_VIEWS.CATEGORIES);
  });

  it("returns categories when value is empty", () => {
    expect(parseViewParam("")).toBe(DASHBOARD_VIEWS.CATEGORIES);
  });

  it("returns categories when value is invalid", () => {
    expect(parseViewParam("bad")).toBe(DASHBOARD_VIEWS.CATEGORIES);
    expect(parseViewParam("list")).toBe(DASHBOARD_VIEWS.CATEGORIES);
  });

  it("returns valid view", () => {
    expect(parseViewParam("categories")).toBe(DASHBOARD_VIEWS.CATEGORIES);
    expect(parseViewParam("expenses")).toBe(DASHBOARD_VIEWS.EXPENSES);
  });
});

describe("parseSpanParam", () => {
  it("returns 1 when value is null", () => {
    expect(parseSpanParam(null)).toBe(1);
  });

  it("returns 1 when value is invalid", () => {
    expect(parseSpanParam("bad")).toBe(1);
    expect(parseSpanParam("4")).toBe(1);
    expect(parseSpanParam("5")).toBe(1);
    expect(parseSpanParam("10")).toBe(1);
  });

  it("returns valid span", () => {
    expect(parseSpanParam("1")).toBe(1);
    expect(parseSpanParam("2")).toBe(2);
    expect(parseSpanParam("3")).toBe(3);
    expect(parseSpanParam("6")).toBe(6);
    expect(parseSpanParam("12")).toBe(12);
  });
});

describe("parseAnalyticsMonthParam", () => {
  it("returns null when value is null", () => {
    expect(parseAnalyticsMonthParam(null, 11)).toBe(null);
  });

  it("returns null when value is not a number", () => {
    expect(parseAnalyticsMonthParam("bad", 11)).toBe(null);
  });

  it("returns null when month is out of range", () => {
    expect(parseAnalyticsMonthParam("-1", 11)).toBe(null);
    expect(parseAnalyticsMonthParam("12", 11)).toBe(null);
  });

  it("returns null when month exceeds maxMonth", () => {
    expect(parseAnalyticsMonthParam("6", 4)).toBe(null);
  });

  it("returns valid month", () => {
    expect(parseAnalyticsMonthParam("0", 11)).toBe(0);
    expect(parseAnalyticsMonthParam("4", 11)).toBe(4);
    expect(parseAnalyticsMonthParam("11", 11)).toBe(11);
  });
});

describe("monthKeyToParts", () => {
  it("converts month key to parts", () => {
    expect(monthKeyToParts("2026-05")).toEqual({ year: 2026, month: 4 });
    expect(monthKeyToParts("2026-01")).toEqual({ year: 2026, month: 0 });
    expect(monthKeyToParts("2026-12")).toEqual({ year: 2026, month: 11 });
    expect(monthKeyToParts("2024-03")).toEqual({ year: 2024, month: 2 });
  });
});

describe("partsToMonthKey", () => {
  it("converts parts to month key", () => {
    expect(partsToMonthKey(2026, 4)).toBe("2026-05");
    expect(partsToMonthKey(2026, 0)).toBe("2026-01");
    expect(partsToMonthKey(2026, 11)).toBe("2026-12");
    expect(partsToMonthKey(2024, 2)).toBe("2024-03");
  });

  it("roundtrips with monthKeyToParts", () => {
    const key = "2026-05";
    const parts = monthKeyToParts(key);
    expect(partsToMonthKey(parts.year, parts.month)).toBe(key);
  });
});
