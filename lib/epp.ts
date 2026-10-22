/** Minimum yearly total for a client to qualify for a program tier. Mirrors `calculate_program` in src-tauri/src/commands/epp.rs. */
export const QUALIFIED_MIN_TOTAL = 18000;

export function isQualified(row: { total: number; program: string }): boolean {
  return row.total >= QUALIFIED_MIN_TOTAL && row.program !== "-" && row.program !== "";
}
