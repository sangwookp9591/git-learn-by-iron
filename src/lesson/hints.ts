import { matches, supportedAssertions, type Snapshot } from './assert.ts';
import type { AssertionValue } from './schema.ts';

export interface HintContext { state: Snapshot; baseline?: Snapshot; idleMs: number; requested?: boolean }
type Value = AssertionValue | undefined;

function splitOutside(expression: string, operator: string): string[] {
  let depth = 0;
  let quote = '';
  let start = 0;
  const parts: string[] = [];
  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0 && expression.startsWith(operator, i)) {
      parts.push(expression.slice(start, i).trim());
      i += operator.length - 1;
      start = i + 1;
    }
    if (depth < 0) throw new Error('괄호를 확인하세요.');
  }
  if (depth || quote) throw new Error('조건식이 닫히지 않았습니다.');
  parts.push(expression.slice(start).trim());
  return parts;
}

function literal(text: string): AssertionValue {
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).replace(/\\([\\'"])/g, '$1');
  }
  if (text === 'true' || text === 'false') return text === 'true';
  if (/^\d+(\.\d+)?s$/.test(text)) return parseFloat(text) * 1000;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function evaluate(expression: string, context: HintContext, depth = 0): Value {
  if (depth > 20 || expression.length > 2000) return undefined;
  expression = expression.trim();
  for (const operator of ['||', '&&']) {
    const parts = splitOutside(expression, operator);
    if (parts.length > 1) {
      const values = parts.map((part) => evaluate(part, context, depth + 1));
      if (values.some((value) => typeof value !== 'boolean')) return undefined;
      return operator === '||' ? values.some(Boolean) : values.every(Boolean);
    }
  }
  for (const operator of ['==', '!=', '>=', '<=', '>', '<']) {
    const parts = splitOutside(expression, operator);
    if (parts.length === 2) {
      const left = evaluate(parts[0], context, depth + 1);
      const right = literal(parts[1]);
      if (left === undefined) return undefined;
      if (operator === '==') return left === right;
      if (operator === '!=') return left !== right;
      if (typeof left !== 'number' || typeof right !== 'number') return undefined;
      if (operator === '>=') return left >= right;
      if (operator === '<=') return left <= right;
      if (operator === '>') return left > right;
      return left < right;
    }
  }
  if (expression.startsWith('!')) {
    const value = evaluate(expression.slice(1), context, depth + 1);
    return typeof value === 'boolean' ? !value : undefined;
  }
  if (expression.startsWith('(') && expression.endsWith(')')) return evaluate(expression.slice(1, -1), context, depth + 1);
  const idle = /^idle\((\d+(?:\.\d+)?)s\)$/.exec(expression);
  if (idle) return context.idleMs >= Number(idle[1]) * 1000;
  if (expression === 'idle') return context.idleMs;
  if (expression === 'requested') return context.requested ?? false;
  if (expression === 'head.on' || expression === 'branch.current') return context.state.branch ?? undefined;
  if (expression === 'commit.count') return context.state.commits.length;
  const call = /^([a-z]+\.[a-z_.]+)\((.+)\)$/.exec(expression);
  if (call && !supportedAssertions.has(call[1])) return undefined;
  if (call) return matches(call[1], literal(call[2].trim()), context.state, context.baseline);
  const booleanKeys = ['index.empty', 'index.has_staged', 'worktree.clean', 'worktree.dirty', 'head.moved', 'head.detached'];
  if (booleanKeys.includes(expression)) return matches(expression, true, context.state, context.baseline);
  return undefined;
}

/** A bounded state expression language. No eval, shell execution or command-history predicates. */
export function evaluateHint(condition: string, context: HintContext): boolean {
  try { return evaluate(condition, context) === true; }
  catch { return false; }
}
