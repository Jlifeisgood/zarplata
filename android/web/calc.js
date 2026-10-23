/* Ядро расчёта зарплаты (Узбекистан). Без зависимостей от интерфейса — проверяется в dev-test.html */
(function (root) {
  // Ставки по умолчанию. Всё редактируется в «Настройки → Правила», чтобы не ждать обновления приложения.
  var DEFAULT_RULES = {
    pit: 12,            // НДФЛ, % (ст. 381 НК)
    inps: 0.1,          // ИНПС, % от доходов, облагаемых НДФЛ (ПП-4086 от 26.12.2018, п. 5)
    esp: 12,            // соцналог (ЕСП), % за счёт работодателя (ст. 405 НК)
    espBudget: 25,      // соцналог бюджетных организаций, % (ст. 405 НК)
    inpsInsidePit: true,// ИНПС уменьшает НДФЛ к уплате (ст. 385 ч. 7 НК, ПП-4086 п. 5); false — удерживается сверху
    inpsGph: true,      // ИНПС и с договоров ГПХ: они тоже доход, облагаемый НДФЛ (ст. 371 НК, ПП-4086 п. 5)
    budget: false,      // организация бюджетная (соцналог по повышенной ставке)
    itpark: false,      // резидент IT Park: льготные ставки для трудовых договоров (УП-5099, п. 5 и 8, до 01.01.2028)
    pitIt: 7.5,         // НДФЛ работников резидента IT Park, %
    espIt: 0,           // соцналог резидента IT Park, %
    benId: '',          // ID льготы НДФЛ по ст. 380 в кабинете my.soliq.uz (графа «Номер льготы» приложения 4), вводит пользователь
    benIdIt: '103847',  // ID льготы НДФЛ резидента IT Park в кабинете my.soliq.uz (дал пользователь)
    mrot: 1360000       // МРОТ с 01.09.2026 (УП-115 от 23.06.2026): подсказка и льгота ст. 380
  };

  function r0(x) { return Math.round(x + 1e-9); }

  /** Действующие ставки НДФЛ и ЕСП (в %) для вида договора. Льготы IT Park — только для трудовых договоров. */
  function rates(R, type) {
    R = R || DEFAULT_RULES;
    if (R.itpark && type !== 'gph') return { pit: R.pitIt, esp: R.espIt };
    return { pit: R.pit, esp: R.budget ? R.espBudget : R.esp };
  }

  /**
   * o: { amount, mode: 'gross'|'net', type: 'trud'|'gph', benefit: 0 | 1.41 | 3 }
   * benefit — льгота ст. 380 НК: из дохода месяца не облагается benefit × МРОТ (только трудовой договор).
   * Возвращает суммы в целых сумах.
   */
  function calc(o, rules) {
    var R = rules || DEFAULT_RULES;
    var rt = rates(R, o.type);
    var pit = rt.pit / 100;
    var inpsRate = (o.type === 'gph' && !R.inpsGph) ? 0 : R.inps / 100;
    var espRate = rt.esp / 100;
    var outside = !R.inpsInsidePit;
    var amount = Math.max(0, Number(o.amount) || 0);
    var E = (o.type !== 'gph' && Number(o.benefit) > 0) ? r0(Number(o.benefit) * R.mrot) : 0; // необлагаемая часть
    function taxable(g) { return Math.max(0, g - E); }
    function netOf(g) { var t = taxable(g); return g - r0(t * pit) - (outside ? r0(t * inpsRate) : 0); }
    var gross;
    if (o.mode === 'net') {
      var k = pit + (outside ? inpsRate : 0);
      gross = amount <= E ? r0(amount) : r0((amount - k * E) / (1 - k));
      // подгоняем до сума: на руки должно получиться ровно введённое
      for (var i = 0; i < 6 && netOf(gross) < amount; i++) gross++;
      for (var j = 0; j < 6 && gross > 0 && netOf(gross - 1) >= amount; j++) gross--;
    } else gross = r0(amount);
    var t = taxable(gross);
    var pitAmt = r0(t * pit);
    var inpsAmt = r0(t * inpsRate);
    var esp = r0(gross * espRate);
    // IT Park: льготная ставка в отчёте выражается «необлагаемой» долей дохода: налог по полной ставке с остатка = налог по ставке IT Park
    var itEx = (R.itpark && o.type !== 'gph' && R.pit > 0) ? t - r0(t * R.pitIt / R.pit) : 0;
    return {
      gross: gross,
      exempt: gross - t,                             // не облагаемая налогом часть (ст. 380)
      itExempt: itEx,                                // доля дохода, не облагаемая «по полной ставке» из-за льготы IT Park
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
