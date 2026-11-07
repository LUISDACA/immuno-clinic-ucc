export const passwordRequirementsText = "Al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.";
// Python str.isdigit() also accepts Unicode Digit characters outside category Nd.
const digit = /[\p{Nd}\u{B2}-\u{B3}\u{B9}\u{1369}-\u{1371}\u{19DA}\u{2070}\u{2074}-\u{2079}\u{2080}-\u{2089}\u{2460}-\u{2468}\u{2474}-\u{247C}\u{2488}-\u{2490}\u{24EA}\u{24F5}-\u{24FD}\u{24FF}\u{2776}-\u{277E}\u{2780}-\u{2788}\u{278A}-\u{2792}\u{10A40}-\u{10A43}\u{10E60}-\u{10E68}\u{11052}-\u{1105A}\u{1F100}-\u{1F10A}]/u;
export function validateStrongPassword(value: string): string | null {
  const symbols = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
  return Array.from(value).length >= 8 && /\p{Uppercase}/u.test(value) && /\p{Lowercase}/u.test(value) && digit.test(value) && Array.from(value).some(c => symbols.includes(c))
    ? null : passwordRequirementsText;
}
