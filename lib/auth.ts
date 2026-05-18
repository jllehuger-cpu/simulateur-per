export const SIMULATORS_PASSWORD = 'riennesertdecourir';

export function verifyPassword(input: string): boolean {
  return input === SIMULATORS_PASSWORD;
}
