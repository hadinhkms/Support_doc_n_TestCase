import { sha256 } from './evidence-integrity';

/**
 * Mutation engine tối giản cho TS (PLAN-16 Phase 5, T5.2/T5.4 — Stryker còn là candidate, B4).
 * Chỉ sinh mutant trên BẢN SAO trong sandbox, không bao giờ sửa file repo. Operator chỉ áp vào
 * vùng code (bỏ qua comment/string/template) và toán tử có khoảng trắng hai bên (tránh generic `<T>`).
 * Mỗi mutant có ID ổn định = hash(file, vị trí, operator, thay thế) và diff dòng trước/sau.
 */
export interface Mutant {
  id: string;
  file: string;
  line: number;
  column: number;
  operator: string;
  original: string;
  replacement: string;
  diff: { before: string; after: string };
}

const SWAPS: [string, RegExp, (m: string) => string][] = [
  ['relational', / (<=|>=|<|>) /g, (m) => ({ ' <= ': ' < ', ' < ': ' <= ', ' >= ': ' > ', ' > ': ' >= ' })[m] as string],
  ['equality', / (===|!==) /g, (m) => (m === ' === ' ? ' !== ' : ' === ')],
  ['logical', / (&&|\|\|) /g, (m) => (m === ' && ' ? ' || ' : ' && ')],
  ['arithmetic', / ([+\-*/]) /g, (m) => ({ ' + ': ' - ', ' - ': ' + ', ' * ': ' / ', ' / ': ' * ' })[m] as string],
  ['boolean', /\b(true|false)\b/g, (m) => (m === 'true' ? 'false' : 'true')],
  ['math', /\bMath\.(ceil|floor|min|max)\b/g, (m) => ({ 'Math.ceil': 'Math.floor', 'Math.floor': 'Math.ceil', 'Math.min': 'Math.max', 'Math.max': 'Math.min' })[m] as string],
  ['update', /\+\+|--/g, (m) => (m === '++' ? '--' : '++')],
  ['off-by-one', /(?<![\w.])(0|1|2)(?![\w.])/g, (m) => String(Number(m) + 1)],
];

/** true tại vị trí là code (không phải comment, string, template literal). */
export function codeMask(src: string): boolean[] {
  const mask = new Array<boolean>(src.length).fill(true);
  let i = 0;
  const mark = (from: number, to: number) => mask.fill(false, from, Math.min(to, src.length));
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      const end = src.indexOf('\n', i);
      mark(i, end < 0 ? src.length : end);
      i = end < 0 ? src.length : end;
    } else if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      mark(i, end < 0 ? src.length : end + 2);
      i = end < 0 ? src.length : end + 2;
    } else if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
      const quote = src[i];
      let j = i + 1;
      while (j < src.length && src[j] !== quote) j += src[j] === '\\' ? 2 : 1;
      mark(i, j + 1);
      i = j + 1;
    } else i += 1;
  }
  return mask;
}

export function generateMutants(source: string, opts: { file: string; startLine?: number; endLine?: number; operators?: string[] }): Mutant[] {
  const mask = codeMask(source);
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1);
  const lineOf = (offset: number) => {
    let lo = 0;
    while (lo + 1 < lineStarts.length && lineStarts[lo + 1] <= offset) lo += 1;
    return lo + 1;
  };
  const lines = source.split('\n');
  const mutants: Mutant[] = [];
  for (const [operator, pattern, swap] of SWAPS) {
    if (opts.operators && !opts.operators.includes(operator)) continue;
    for (const match of source.matchAll(pattern)) {
      const offset = match.index ?? 0;
      const line = lineOf(offset);
      if ((opts.startLine && line < opts.startLine) || (opts.endLine && line > opts.endLine)) continue;
      if (!mask.slice(offset, offset + match[0].length).every(Boolean)) continue;
      const replacement = swap(match[0]);
      const column = offset - lineStarts[line - 1];
      const before = lines[line - 1];
      const after = before.slice(0, column) + replacement + before.slice(column + match[0].length);
      const id = sha256(`${opts.file}:${offset}:${operator}:${replacement}`).slice(0, 12);
      mutants.push({ id, file: opts.file, line, column: column + 1, operator, original: match[0], replacement, diff: { before, after } });
    }
  }
  return mutants.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function applyMutant(source: string, m: Mutant): string {
  const lines = source.split('\n');
  if (lines[m.line - 1] !== m.diff.before) throw new Error(`STALE_MUTANT: ${m.id} source line changed`);
  lines[m.line - 1] = m.diff.after;
  return lines.join('\n');
}
