function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatSupportPhone(value: string): string {
  const digits = phoneDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length === 1) return `(${digits}`;
  if (digits.length === 2) return `(${digits})`;

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  const mobile = number.startsWith("9");

  if (mobile) {
    if (number.length <= 5) return `(${ddd}) ${number}`;
    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }

  if (number.length <= 4) return `(${ddd}) ${number}`;
  return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
}

export function isCompleteSupportPhone(value: string): boolean {
  const digits = phoneDigits(value);
  return digits.length === 10 || digits.length === 11;
}
