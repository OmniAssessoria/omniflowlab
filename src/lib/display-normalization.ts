export function normalizedDisplayKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
}

export function uppercaseDisplay(value: string | null | undefined, fallback = "—") {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ");
  return clean ? clean.toLocaleUpperCase("pt-BR") : fallback;
}

export function uniqueNormalizedStrings(values: Array<string | null | undefined>) {
  const map = new Map<string, string>();

  for (const value of values) {
    const clean = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!clean) continue;
    const key = normalizedDisplayKey(clean);
    if (!map.has(key)) map.set(key, clean);
  }

  return Array.from(map.values()).sort((a, b) =>
    uppercaseDisplay(a).localeCompare(uppercaseDisplay(b), "pt-BR"),
  );
}
