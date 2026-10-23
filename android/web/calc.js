/* Ядро расчёта зарплаты (Узбекистан). Без зависимостей от интерфейса — проверяется в tools/test-calc.js */
(function (root) {
  // Ставки по умолчанию. Всё редактируется в «Настройки → Ставки», чтобы не ждать обновления приложения.
  var DEFAULT_RULES = {
    pit: 12,            // НДФЛ, %
    inps: 0.1,          // ИНПС, % (трудовой договор)
    esp: 12,            // ЕСП, % (за счёт работодателя)
    espBudget: 25,      // ЕСП для бюджетных организаций, %
    inpsInsidePit: true,// ИНПС уменьшает НДФЛ к уплате (на руки = начислено − НДФЛ); false — удерживается сверху
    inpsGph: false,     // удерживать ИНПС с договоров ГПХ
    budget: false,      // организация бюджетная (ЕСП по повышенной ставке)
    itpark: false,      // резидент IT Park: льготные ставки для трудовых договоров
    pitIt: 7.5,         // НДФЛ резидента IT Park, %
    espIt: 0,           // ЕСП резидента IT Park, %
    mrot: 1360000       // МРОТ с 01.09.2026 (УП-115) — только для подсказки о слишком маленькой сумме
  };

  function r0(x) { return Math.round(x + 1e-9); }

  /**
   * o: { amount, mode: 'gross'|'net', type: 'trud'|'gph' }
   * Возвращает суммы в целых сумах.
   */
  /** Действующие ставки НДФЛ и ЕСП (в %) для вида договора. Льготы IT Park — только для трудовых договоров. */
  function rates(R, type) {
    R = R || DEFAULT_RULES;
    if (R.itpark && type !== 'gph') return { pit: R.pitIt, esp: R.espIt };
    return { pit: R.pit, esp: R.budget ? R.espBudget : R.esp };
  }

  function calc(o, rules) {
    var R = rules || DEFAULT_RULES;
    var rt = rates(R, o.type);
    var pit = rt.pit / 100;
    var inpsRate = (o.type === 'gph' && !R.inpsGph) ? 0 : R.inps / 100;
    var espRate = rt.esp / 100;
    var outside = !R.inpsInsidePit;
    var amount = Math.max(0, Number(o.amount) || 0);
    var gross;
    function netOf(g) { return g - r0(g * pit) - (outside ? r0(g * inpsRate) : 0); }
    if (o.mode === 'net') {
      gross = r0(amount / (1 - pit - (outside ? inpsRate : 0)));
      // подгоняем до копейки: на руки должно получиться ровно введённое
      for (var i = 0; i < 6 && netOf(gross) < amount; i++) gross++;
      for (var j = 0; j < 6 && gross > 0 && netOf(gross - 1) >= amount; j++) gross--;
    } else gross = r0(amount);
    var pitAmt = r0(gross * pit);
    var inpsAmt = r0(gross * inpsRate);
    var esp = r0(gross * espRate);
    return {
      gross: gross,
      pit: pitAmt,                                   // НДФЛ начислено
      inps: inpsAmt,                                 // ИНПС
      pitBudget: outside ? pitAmt : pitAmt - inpsAmt,// НДФЛ к уплате в бюджет
      esp: esp,
      net: gross - pitAmt - (outside ? inpsAmt : 0), // на руки
      cost: gross + esp                              // полная стоимость для работодателя
    };
  }

  var api = { DEFAULT_RULES: DEFAULT_RULES, calc: calc, rates: rates, r0: r0 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : this);
