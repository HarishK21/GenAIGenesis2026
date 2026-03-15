export interface RequestTelemetryContext {
  clientIp?: string;
  geoRegion?: string;
  deviceLabel?: string;
  userAgent?: string;
}

function firstNonEmpty(values: Array<string | null>) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function parseClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded
      .split(",")
      .map((item) => item.trim())
      .find(Boolean);
    if (first) {
      return first;
    }
  }

  return firstNonEmpty([
    request.headers.get("x-real-ip"),
    request.headers.get("cf-connecting-ip")
  ]);
}

function parseGeoRegion(request: Request) {
  const testGeo = firstNonEmpty([request.headers.get("x-test-geo-region")]);
  if (testGeo) {
    return testGeo;
  }

  const city = firstNonEmpty([request.headers.get("x-vercel-ip-city")]);
  const region = firstNonEmpty([
    request.headers.get("x-vercel-ip-country-region"),
    request.headers.get("x-vercel-ip-region")
  ]);
  const country = firstNonEmpty([
    request.headers.get("x-vercel-ip-country"),
    request.headers.get("cf-ipcountry")
  ]);

  if (city && region && country) {
    return `${city}, ${region}, ${country}`;
  }

  if (city && country) {
    return `${city}, ${country}`;
  }

  if (region && country) {
    return `${region}, ${country}`;
  }

  return country;
}

function parseDeviceLabel(request: Request) {
  const testLabel = firstNonEmpty([request.headers.get("x-test-device-label")]);
  if (testLabel) {
    return testLabel;
  }

  const userAgent = firstNonEmpty([request.headers.get("user-agent")]) ?? "";
  const ua = userAgent.toLowerCase();

  const deviceClass = ua.includes("mobile")
    ? "Mobile"
    : ua.includes("tablet") || ua.includes("ipad")
      ? "Tablet"
      : "Desktop";

  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome/")
      ? "Chrome"
      : ua.includes("safari/") && !ua.includes("chrome/")
        ? "Safari"
        : ua.includes("firefox/")
          ? "Firefox"
          : "Browser";

  return `${deviceClass} ${browser}`.trim();
}

export function getRequestTelemetryContext(request: Request): RequestTelemetryContext {
  return {
    clientIp: parseClientIp(request),
    geoRegion: parseGeoRegion(request),
    deviceLabel: parseDeviceLabel(request),
    userAgent: firstNonEmpty([request.headers.get("user-agent")])
  };
}
