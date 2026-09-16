export interface ParsedCommand {
  program: string;
  subcommand: string;
  options: Record<string, string | boolean>;
  paths: string[];
}

/** Tokenize shell-style quotes/escapes without evaluating variables or shell commands. */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote = '';
  let started = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '\\' && quote !== "'") {
      const next = line[++i];
      if (next === undefined) throw new Error('명령 끝의 역슬래시 뒤에 문자가 필요합니다.');
      token += quote === '"' && !['"', '\\', '$', '`', '\n'].includes(next) ? `\\${next}` : next === '\n' ? '' : next;
      started = true;
    } else if (quote) {
      if (char === quote) quote = '';
      else token += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) tokens.push(token);
      token = '';
      started = false;
    } else {
      token += char;
      started = true;
    }
  }
  if (quote) throw new Error('따옴표가 닫히지 않았습니다.');
  if (started) tokens.push(token);
  return tokens;
}

export function parse(line: string): ParsedCommand {
  const [program = '', subcommand = '', ...args] = tokenize(line);
  const options: ParsedCommand['options'] = {};
  const paths: string[] = [];
  let pathsOnly = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--' && !pathsOnly) { pathsOnly = true; continue; }
    if (pathsOnly || !arg.startsWith('-') || arg === '-') { paths.push(arg); continue; }
    const equal = arg.indexOf('=');
    let name = equal > 0 ? arg.slice(0, equal) : arg;
    let value: string | boolean = equal > 0 ? arg.slice(equal + 1) : true;
    const short = /^(-[mcb])(.+)$/.exec(name);
    if (short) { name = short[1]; value = short[2]; }
    const takesValue = (subcommand === 'commit' && ['-m', '--message'].includes(name))
      || (subcommand === 'switch' && name === '-c') || (subcommand === 'checkout' && name === '-b');
    if (value === true && takesValue) {
      if (args[i + 1] === undefined) throw new Error(`'${name}' 옵션에 값이 필요합니다.`);
      value = args[++i];
    }
    if (subcommand === 'commit' && ['-m', '--message'].includes(name) && typeof options[name] === 'string') {
      options[name] += `\n\n${value}`;
      continue;
    }
    if (Object.hasOwn(options, name)) throw new Error(`'${name}' 옵션은 한 번만 입력하세요.`);
    options[name] = value;
  }
  return { program, subcommand, options, paths };
}
