// Regex -> AST. Syntax: | union, implicit concatenation, * + ?, ( ), \x escapes. '#' is reserved (use \#);
// an unescaped space is an error (it would silently become an input symbol).
export function parseRegex(src) {
  let i = 0;
  const err = (message, pos = i) => { throw Object.assign(new Error(message), { pos }); };
  const SPECIAL = new Set(['|', '*', '+', '?', '(', ')', '\\']);
  function expr() {
    let left = term();
    while (src[i] === '|') {
      const at = i; i++;
      if (i >= src.length || src[i] === ')' || src[i] === '|') err(`Nothing after "|" at position ${at + 1}.`, at);
      left = { type: 'or', children: [left, term()] };
    }
    return left;
  }
  function term() {
    let left = factor();
    while (i < src.length && src[i] !== '|' && src[i] !== ')') left = { type: 'cat', children: [left, factor()] };
    return left;
  }
  function factor() {
    let node = atom();
    while (src[i] === '*' || src[i] === '+' || src[i] === '?') {
      node = { type: src[i] === '*' ? 'star' : src[i] === '+' ? 'plus' : 'opt', children: [node] };
      i++;
    }
    return node;
  }
  function atom() {
    const c = src[i];
    if (c === undefined) err('Expression ended unexpectedly.');
    if (c === '(') {
      const at = i; i++;
      if (src[i] === ')') err(`Empty group at position ${at + 1}.`, at);
      const e = expr();
      if (src[i] !== ')') err(`The "(" at position ${at + 1} has no closing ")". Close it, or write \\( for a literal parenthesis.`, at);
      i++; return e;
    }
    if (c === ')') err(`Unmatched ")" at position ${i + 1}.`);
    if (c === '*' || c === '+' || c === '?') err(`"${c}" at position ${i + 1} has nothing to repeat.`);
    if (c === '|') err(`Nothing before "|" at position ${i + 1}.`);
    if (c === '#') err(`"#" is reserved for direct-method augmentation. Write \\# for a literal "#".`);
    if (/\s/.test(c)) err(`Space at position ${i + 1}: spaces are not part of the expression. Remove it, or write "\\ " for a literal space.`);
    if (c === '\\') {
      if (i + 1 >= src.length) err('Trailing "\\" has nothing to escape.');
      const lit = src[i + 1]; i += 2; return { type: 'leaf', symbol: lit };
    }
    i++; return { type: 'leaf', symbol: c };
  }
  try {
    if (!src.length) err('Enter a regular expression.');
    const ast = expr();
    if (i < src.length) err(`Unexpected "${src[i]}" at position ${i + 1}.`);
    return { ok: true, ast };
  } catch (e) {
    return { ok: false, error: e.message, position: e.pos };
  }
}
