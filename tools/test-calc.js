const assert = require('assert');
const { calc, DEFAULT_RULES } = require('../android/web/calc.js');
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };

t('прямой расчёт, ИНПС внутри НДФЛ', () => {
  const r = calc({ amount: 5000000, mode: 'gross', type: 'trud' }, DEFAULT_RULES);
  assert.deepStrictEqual(r, { gross: 5000000, pit: 600000, inps: 5000, pitBudget: 595000, esp: 600000, net: 4400000, cost: 5600000 });
});
t('ИНПС сверху', () => {
  const r = calc({ amount: 5000000, mode: 'gross', type: 'trud' }, { ...DEFAULT_RULES, inpsInsidePit: false });
  assert.strictEqual(r.net, 4395000); assert.strictEqual(r.pitBudget, 600000);
});
t('ГПХ без ИНПС по умолчанию', () => {
  const r = calc({ amount: 1000000, mode: 'gross', type: 'gph' }, DEFAULT_RULES);
  assert.strictEqual(r.inps, 0); assert.strictEqual(r.pitBudget, 120000); assert.strictEqual(r.net, 880000);
});
t('обратный расчёт даёт ровно «на руки»', () => {
  for (const inside of [true, false]) for (const type of ['trud', 'gph']) for (let net = 0; net < 20000000; net += 123457) {
    const R = { ...DEFAULT_RULES, inpsInsidePit: inside };
    const r = calc({ amount: net, mode: 'net', type }, R);
    assert.strictEqual(r.net, net, `net=${net} inside=${inside} ${type}`);
    // и это минимальное начисление
    if (r.gross > 0) assert.ok(calc({ amount: r.gross - 1, mode: 'gross', type }, R).net < net);
  }
});
t('бюджетная организация: ЕСП 25%', () => {
  assert.strictEqual(calc({ amount: 1000000, mode: 'gross', type: 'trud' }, { ...DEFAULT_RULES, budget: true }).esp, 250000);
});
t('нули и мусор', () => {
  assert.strictEqual(calc({ amount: 'abc', mode: 'net', type: 'trud' }).gross, 0);
  assert.strictEqual(calc({ amount: -5, mode: 'gross', type: 'trud' }).net, 0);
});
console.log(n + ' tests passed');
