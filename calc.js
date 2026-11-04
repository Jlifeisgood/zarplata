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
    itFrom: '',         // дата включения в реестр IT Park (ГГГГ-ММ-ДД): льгота с этого месяца (1-е число) или со следующего; пусто — всегда
    itTo: '',           // дата, до которой статус действовал (ГГГГ-ММ-ДД); пусто — без ограничения
    pitIt: 7.5,         // НДФЛ работников резидента IT Park, %
    espIt: 0,           // соцналог резидента IT Park, %
    benId: '',          // ID льготы НДФЛ по ст. 380 в кабинете my.soliq.uz (графа «Номер льготы» приложения 4), вводит пользователь
    benIdIt: '103847',  // ID льготы НДФЛ резидента IT Park в кабинете my.soliq.uz (дал пользователь)
    holExtra: [],       // дополнительные нерабочие праздничные дни (ГГГГ-ММ-ДД), например дни Хайита — по постановлению
    benIdAid: '102901', // ID льготы НДФЛ для материальной помощи (ст. 378 ч. 1 п. 1, абз. 3) — по видеоразбору формы и форме 2025 года
    mrot: 1360000       // МРОТ с 01.09.2026 (УП-115 от 23.06.2026): подсказка, льгота ст. 380, предел для больничных
  };

  function r0(x) { return Math.round(x + 1e-9); }
  function r2(x) { return Math.round(x * 100 + (x < 0 ? -1e-7 : 1e-7)) / 100; } // до тийина

  /** Действующие ставки НДФЛ и ЕСП (в %) для вида договора. Льготы IT Park — только для трудовых договоров. */
  function rates(R, type) {
    R = R || DEFAULT_RULES;
    if (R.itpark && type !== 'gph') return { pit: R.pitIt, esp: R.espIt };
    return { pit: R.pit, esp: R.budget ? R.espBudget : R.esp };
  }

  /**
   * o: { amount, mode: 'gross'|'net', type: 'trud'|'gph', benefit: 0 | 1.41 | 3, extra, sick }
   * benefit — льгота ст. 380 НК: из дохода месяца не облагается benefit × МРОТ (только трудовой договор).
   * extra — доп. оплата труда за месяц (отпускные и т. п.): НДФЛ, ИНПС и соцналог как с зарплаты (ст. 374 НК).
   * sick  — пособие по временной нетрудоспособности за счёт работодателя: НДФЛ и ИНПС, без соцналога (ст. 369 п. 7, ст. 371, 404 НК).
   * Режим «на руки» (net) относится только к основной сумме; extra и sick добавляются сверху по начисленному.
   * Возвращает суммы в сумах с точностью до тийина (0,01).
   */
  function calc(o, rules) {
    var R = rules || DEFAULT_RULES;
    var rt = rates(R, o.type);
    var pit = rt.pit / 100;
    var inpsRate = (o.type === 'gph' && !R.inpsGph) ? 0 : R.inps / 100;
    var espRate = rt.esp / 100;
    var outside = !R.inpsInsidePit;
    // все вычисления — в тийинах (целые числа), на выходе суммы в сумах с точностью до 2 знаков
    var c = function (v) { return Math.round((Number(v) || 0) * 100 + 1e-7); };
    var rd = function (x) { return Math.round(x + 1e-6); };
    var amount = Math.max(0, c(o.amount));
    var extra = Math.max(0, c(o.extra)), sick = Math.max(0, c(o.sick));
    var E = (o.type !== 'gph' && Number(o.benefit) > 0) ? c(Number(o.benefit) * R.mrot) : 0; // необлагаемая часть
    function taxable(g) { return Math.max(0, g - E); }
    function netOf(g) { var t = taxable(g); return g - rd(t * pit) - (outside ? rd(t * inpsRate) : 0); }
    var base;
    if (o.mode === 'net') {
      var k = pit + (outside ? inpsRate : 0);
      base = amount <= E ? amount : rd((amount - k * E) / (1 - k));
      // подгоняем до тийина: на руки должно получиться ровно введённое
      for (var i = 0; i < 20 && netOf(base) < amount; i++) base++;
      for (var j = 0; j < 20 && base > 0 && netOf(base - 1) >= amount; j++) base--;
    } else base = amount;
    // материальная помощь (ст. 377, 378 НК): только НДФЛ по общей ставке с суммы сверх необлагаемой части, без ИНПС и соцналога
    var aid = Math.max(0, c(o.aid)), aidEx = Math.min(aid, Math.max(0, c(o.aidExempt)));
    var aidPit = rd((aid - aidEx) * R.pit / 100);
    var gross = base + extra + sick;
    var t = taxable(gross);
    var pitAmt = rd(t * pit);
    var inpsAmt = rd(t * inpsRate);
    var esp = rd((base + extra) * espRate);
    // доля налога, приходящаяся на пособие: льгота сначала уменьшает оплату труда
    var laborTaxable = taxable(base + extra), sickTaxable = t - laborTaxable;
    var sickPit = rd(sickTaxable * pit), sickInps = rd(sickTaxable * inpsRate);
    // IT Park: льготная ставка в отчёте выражается «необлагаемой» долей дохода: налог по полной ставке с остатка = налог по ставке IT Park
    var itEx = (R.itpark && o.type !== 'gph' && R.pit > 0) ? laborTaxable - rd(laborTaxable * R.pitIt / R.pit) : 0;
    pitAmt += aidPit;
    var q = function (x) { return x / 100; };
    return {
      gross: q(gross + aid),
      aid: q(aid), aidEx: q(aidEx), aidPit: q(aidPit),   // из начисленного: материальная помощь, её необлагаемая часть и НДФЛ с неё
      sick: q(sick),                                     // из начисленного: пособие по ВН (не оплата труда)
      exempt: q(gross - t),                              // не облагаемая налогом часть (ст. 380)
      itExempt: q(itEx),                                 // доля дохода, не облагаемая «по полной ставке» из-за льготы IT Park
      pit: q(pitAmt),                                    // НДФЛ начислено
      sickPit: q(sickPit),                               // из них с пособия
      inps: q(inpsAmt),                                  // ИНПС
      sickInps: q(sickInps),
      pitBudget: q(outside ? pitAmt : pitAmt - inpsAmt), // НДФЛ к уплате в бюджет
      esp: q(esp),
      net: q(gross + aid - pitAmt - (outside ? inpsAmt : 0)), // на руки
      cost: q(gross + aid + esp)                         // полная стоимость для работодателя
    };
  }

  var api = { DEFAULT_RULES: DEFAULT_RULES, calc: calc, rates: rates, r0: r0, r2: r2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : this);
