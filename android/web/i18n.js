/* Интерфейс на узбекском (латиница). Перевод делается на лету: фразы и фрагменты из словаря подставляются в текст на экране,
   всё, чего в словаре нет, остаётся по-русски. Перевод выполнен без носителя языка — термины стоит проверить.
   Официальные формы для налоговой (файл приложения 4 и 5) остаются как в шаблоне кабинета. */
(function () {
  const PAIRS = [
    // навигация и вкладки
    ["Зарплата", "Ish haqi"], ["Сотрудники", "Xodimlar"], ["Отчёты", "Hisobotlar"], ["Настройки", "Sozlamalar"],
    ["Компании", "Kompaniyalar"], ["Компания", "Kompaniya"], ["Организация", "Tashkilot"], ["Напоминания", "Eslatmalar"],
    // общие кнопки и действия
    ["Сохранить резервную копию", "Zaxira nusxasini saqlash"], ["Восстановить из копии", "Nusxadan tiklash"], ["Сохранить", "Saqlash"],
    ["Записать", "Yozish"], ["Добавить в начисления", "Hisob-kitoblarga qo'shish"], ["Добавить компанию", "Kompaniya qo'shish"],
    ["Добавить сотрудника", "Xodim qo'shish"], ["Добавить", "Qo'shish"], ["Создать", "Yaratish"], ["Начать", "Boshlash"], ["Готово", "Tayyor"],
    ["Удалить сотрудника", "Xodimni o'chirish"], ["Удалить эту компанию", "Bu kompaniyani o'chirish"], ["Удалить", "O'chirish"],
    ["Стереть все компании и данные", "Barcha kompaniya va ma'lumotlarni o'chirish"], ["Стереть все данные", "Barcha ma'lumotlarni o'chirish"],
    ["Посмотреть на примере", "Namunada ko'rish"], ["Вернуть стандартные", "Standart qiymatlarni qaytarish"], ["Вернуть стандартную", "Standart summani qaytarish"],
    ["Текстом", "Matn sifatida"], ["показать", "ko'rsatish"], ["скрыть", "yashirish"],
    // приветствие
    ["Считает НДФЛ, ИНПС и ЕСП, показывает сумму «на руки» и готовит отчёты. Данные хранятся только на вашем телефоне.",
      "JShDS, INPS va ijtimoiy soliqni hisoblaydi, «qo'lga tegadigan» summani ko'rsatadi va hisobotlarni tayyorlaydi. Ma'lumotlar faqat telefoningizda saqlanadi."],
    ["Название компании", "Kompaniya nomi"], ["Например, ООО «Ромашка»", "Masalan, «Romashka» MChJ"], ["ИНН (по желанию)", "STIR (ixtiyoriy)"], ["9 цифр", "9 ta raqam"],
    ["Есть производство", "Ishlab chiqarish bor"], ["Делить сотрудников и отчёты на АУП и производство", "Xodim va hisobotlarni boshqaruv apparati va ishlab chiqarishga ajratish"],
    ["Разделять сотрудников на АУП и производство", "Xodimlarni boshqaruv apparati va ishlab chiqarishga ajratish"],
    // вкладка «Зарплата»
    ["текущий месяц", "joriy oy"], ["Предыдущий месяц", "Oldingi oy"], ["Следующий месяц", "Keyingi oy"],
    ["К выплате на руки · ", "Qo'lga beriladigan · "], ["чел.", "kishi"], ["Чел.", "Kishi"], ["сум", "so'm"],
    ["Начислено", "Hisoblangan"], ["начислено", "hisoblangan"], ["НДФЛ в бюджет", "Byudjetga JShDS"], ["НДФЛ", "JShDS"], ["ИНПС", "INPS"],
    ["ЕСП (работодатель)", "Ijtimoiy soliq (ish beruvchi)"], ["Всего расход компании: ", "Kompaniyaning jami xarajati: "], ["Расход компании", "Kompaniya xarajati"],
    ["Расход", "Xarajat"], ["Выплачено", "To'langan"], ["из", "dan"], ["осталось", "qoldi"], ["Осталось выплатить", "To'lash qoldi"], ["Осталось ", "Qoldi: "],
    ["Выплачено лишнего", "Ortiqcha to'langan"], ["выплачено", "to'langan"], ["АУП", "Boshqaruv apparati"], ["Производство", "Ishlab chiqarish"], ["Все", "Hammasi"],
    ["Сотрудники", "Xodimlar"], ["нажмите, чтобы изменить сумму", "summani o'zgartirish uchun bosing"], ["на руки", "qo'lga"], ["На руки", "Qo'lga tegadigan"],
    ["неполный месяц: ", "to'liq bo'lmagan oy: "], ["неполный", "to'liq emas"], ["изменено", "o'zgartirilgan"], ["раб. дн.", "ish kuni"],
    ["не начисляется в этом месяце", "bu oyda hisoblanmaydi"], ["отпускные", "ta'til pullari"], ["больничный", "kasallik nafaqasi"],
    ["Реестр выплат (Excel)", "To'lovlar reyestri (Excel)"], ["Реестр выплат", "To'lovlar reyestri"],
    ["Пока никого нет", "Hozircha hech kim yo'q"], ["Добавьте сотрудника — укажите ФИО и начисление, остальное посчитается само.", "Xodim qo'shing — F.I.Sh. va hisoblangan summani kiriting, qolganini o'zi hisoblaydi."],
    ["В этом месяце никого", "Bu oyda hech kim yo'q"], ["Все сотрудники работают в другие месяцы.", "Barcha xodimlar boshqa oylarda ishlaydi."],
    ["Осталось ", "Qoldi "], ["дн.: ", "kun: "], ["Сегодня последний день: ", "Bugun oxirgi kun: "],
    ["отчёт по НДФЛ и соцналогу за ", "JShDS va ijtimoiy soliq bo'yicha hisobot: "], [" и уплата (до 15 числа).", " va to'lov (15-sanagacha)."],
    [" Годовой отчёт за ", " Yillik hisobot: "], [" год — тоже до 15 февраля.", " yil — shuningdek 15-fevralgacha."],
    // карточка месяца
    ["Сумма начисления", "Hisoblangan summa"], ["Сумма на руки", "Qo'lga tegadigan summa"], ["Начислено: ", "Hisoblangan: "], ["Начисление в месяц", "Oylik hisoblash"],
    ["Сумма на руки в месяц", "Oyiga qo'lga tegadigan summa"], ["Введите сумму — ниже появится расчёт.", "Summani kiriting — pastda hisob-kitob paydo bo'ladi."],
    ["Оплата труда за месяц", "Oy uchun mehnat haqi"], ["Оплата труда", "Mehnat haqi"], ["Материальная помощь (без налога ", "Moddiy yordam (soliqsiz "],
    ["Больничный (за счёт работодателя)", "Kasallik nafaqasi (ish beruvchi hisobidan)"], ["Не облагается (ст. 380 НК)", "Soliqqa tortilmaydi (SK 380-modda)"],
    ["Соцналог (ЕСП) ", "Ijtimoiy soliq "], [", за счёт работодателя", ", ish beruvchi hisobidan"], [" (из НДФЛ)", " (JShDSdan)"],
    ["Расчётный листок", "Hisob varaqasi"], ["Не начислять в этом месяце", "Bu oyda hisoblamaslik"], ["Начислять в этом месяце", "Bu oyda hisoblash"],
    ["Сохранено в «Загрузки»: ", "«Yuklamalar»ga saqlandi: "], ["Сохранено в «Файлы» → «Зарплата»: ", "«Fayllar» → «Zarplata» papkasiga saqlandi: "],
    ["Уведомления запрещены. Разрешите их: Настройки iPhone → Уведомления → Зарплата", "Bildirishnomalar taqiqlangan. Ruxsat bering: iPhone sozlamalari → Bildirishnomalar → Zarplata"], ["Сохранено", "Saqlandi"], ["Введите сумму", "Summani kiriting"],
    ["Начисление меньше МРОТ (", "Hisoblangan summa MHEKMdan kam ("], ["Неполный месяц: оклад пересчитан на ", "To'liq bo'lmagan oy: oklad qayta hisoblandi — "],
    [" рабочих дней (по графику ", " ish kuni ("], ["-дневной недели, праздники не считаются). Введите сумму вручную, если нужно иначе.", " kunlik hafta, bayramlar hisobga olinmaydi). Boshqacha bo'lsa, summani qo'lda kiriting."],
    [" из ", " / "], [" · ", " · "],
    // выплаты и удержания
    ["Выплаты и удержания", "To'lovlar va ushlab qolishlar"], ["На руки по расчёту", "Hisob bo'yicha qo'lga tegadigan"], ["К выплате", "To'lanadigan"],
    ["Удержания", "Ushlab qolishlar"], ["Удержание…", "Ushlab qolish…"], ["Удержание записано", "Ushlab qolish yozildi"], ["Удержание", "Ushlab qolish"],
    ["Выплата…", "To'lov…"], ["Выплата записана", "To'lov yozildi"], ["Выплата", "To'lov"], ["Аванс", "Avans"], ["Алименты", "Aliment"], ["Ссуда / долг", "Qarz"],
    ["Штраф", "Jarima"], ["Другое", "Boshqa"], ["Дата выплаты", "To'lov sanasi"], ["Комментарий", "Izoh"], ["Вид дохода", "Daromad turi"], ["Вид", "Turi"],
    ["Удерживается из суммы «на руки»; НДФЛ, ИНПС и соцналог не меняются.", "«Qo'lga tegadigan» summadan ushlab qolinadi; JShDS, INPS va ijtimoiy soliq o'zgarmaydi."],
    ["Уже выплачено", "Allaqachon to'langan"], ["К перечислению", "O'tkaziladigan"], ["Карта / счёт", "Karta / hisob raqami"], ["Карта или счёт для выплаты", "To'lov uchun karta yoki hisob raqami"],
    ["для реестра выплат", "to'lovlar reyestri uchun"], ["Нет начислений за месяц", "Oy uchun hisoblash yo'q"],
    // отпуск, больничный, увольнение
    ["Отпуск и больничный", "Ta'til va kasallik nafaqasi"], ["Отпускные…", "Ta'til pullari…"], ["Больничный…", "Kasallik nafaqasi…"], ["Отпускные", "Ta'til pullari"],
    ["Первый день отпуска", "Ta'tilning birinchi kuni"], ["Календарных дней отпуска", "Ta'til kalendar kunlari"], ["Средняя месячная зарплата, сум", "O'rtacha oylik ish haqi, so'm"],
    ["Посчитана за 12 месяцев до месяца отпуска из начислений в приложении (ТК, ст. 257); можно изменить.", "Ta'til oyidan oldingi 12 oy uchun ilovadagi hisoblashlardan olingan (MK, 257-modda); o'zgartirish mumkin."],
    ["Отпуск", "Ta'til"], ["Воскресенья (не оплачиваются)", "Yakshanbalar (to'lanmaydi)"], ["Праздничные дни (не оплачиваются)", "Bayram kunlari (to'lanmaydi)"],
    ["Оплачиваемых дней", "To'lanadigan kunlar"], ["Средний дневной заработок (÷ 25,3)", "O'rtacha kunlik ish haqi (÷ 25,3)"],
    ["Начислятся в ", "Hisoblanadi: "], [" (НДФЛ, ИНПС и соцналог — как с зарплаты); оклад за дни отпуска в месяце уменьшится сам.", " (JShDS, INPS va ijtimoiy soliq — ish haqidagidek); ta'til kunlari uchun oklad o'zi kamayadi."],
    ["Укажите дату начала, дни и среднюю зарплату.", "Boshlanish sanasi, kunlar va o'rtacha ish haqini kiriting."],
    ["Больничный", "Kasallik nafaqasi"], ["Начало листка", "Varaqa boshlanishi"], ["Конец листка", "Varaqa tugashi"], ["Страховой стаж", "Sug'urta staji"],
    ["6 мес – 8 лет (60%)", "6 oy – 8 yil (60%)"], ["Более 8 лет (80%)", "8 yildan ortiq (80%)"], ["+20 п.п. к коэффициенту", "+20 foiz punkt koeffitsiyentga"],
    ["Инвалид I–II группы, 4+ детей до 18 лет или ребёнок-инвалид в семье", "I–II guruh nogironi, 18 yoshgacha 4+ farzand yoki oilada nogiron bola"],
    ["Листок", "Varaqa"], ["Коэффициент стажа", "Staj koeffitsiyenti"], ["Средняя зарплата в расчёте", "Hisobdagi o'rtacha ish haqi"], [" (предел 10 МРОТ)", " (chegara 10 MHEKM)"],
    ["Пособие за весь период", "Butun davr uchun nafaqa"], ["За счёт работодателя (", "Ish beruvchi hisobidan ("], ["За счёт Фонда соцстрахования (", "Ijtimoiy sug'urta jamg'armasi hisobidan ("],
    ["Воскресенья и праздники не оплачиваются (", "Yakshanba va bayramlar to'lanmaydi ("],
    [" дн.). Первые 5 календарных дней в году платит работодатель, дальше — Фонд напрямую сотруднику. Свыше 77 дней в году коэффициент меньше на 10 п.п., оплата — не более 182 дней в году.",
      " kun). Yilning dastlabki 5 kalendar kunini ish beruvchi to'laydi, keyingisini Jamg'arma xodimning o'ziga to'laydi. Yiliga 77 kundan oshsa koeffitsiyent 10 foiz punktga kamayadi, to'lov yiliga 182 kundan oshmaydi."],
    ["Часть работодателя начислится в ", "Ish beruvchi qismi hisoblanadi: "], [": НДФЛ и ИНПС — да, соцналог — нет. В приложение 4 она не попадает (это не оплата труда) — отразите отдельно.", ": JShDS va INPS — ha, ijtimoiy soliq — yo'q. 4-ilovaga tushmaydi (mehnat haqi emas) — alohida aks ettiring."],
    ["Новый порядок больничных действует с 01.07.2026. За более ранние даты расчёт здесь не ведётся.", "Yangi tartib 01.07.2026 dan amal qiladi. Undan oldingi sanalar uchun bu yerda hisob-kitob qilinmaydi."],
    ["Укажите даты листка (дд.мм.гггг) и среднюю зарплату.", "Varaqa sanalarini (kk.oo.yyyy) va o'rtacha ish haqini kiriting."],
    ["При увольнении…", "Ishdan bo'shaganda…"], ["Расчёт при увольнении", "Ishdan bo'shatishdagi hisob-kitob"], ["Дата увольнения (последний рабочий день)", "Ishdan bo'shash sanasi (oxirgi ish kuni)"],
    ["Дата увольнения", "Ishdan bo'shash sanasi"], ["Отпуск в год, дн.", "Yillik ta'til, kun"], ["Использовано в этом году, дн.", "Bu yil foydalanilgan, kun"],
    ["Неиспользовано за прошлые годы, дн.", "O'tgan yillardan foydalanilmagan, kun"], ["Полных месяцев в последнем рабочем году", "Oxirgi ish yilidagi to'liq oylar"],
    ["Дней отпуска за этот год", "Shu yil uchun ta'til kunlari"], ["К ним прошлые годы, минус использовано", "O'tgan yillar bilan, foydalanilgani ayrilgan"],
    ["Компенсация при увольнении ", "Ishdan bo'shaganda kompensatsiya "], ["Компенсация", "Kompensatsiya"], ["компенсация ", "kompensatsiya "],
    ["Дата увольнения и компенсация записаны", "Ishdan bo'shash sanasi va kompensatsiya yozildi"],
    ["Остаток от месяца 15 дней и больше считается за месяц, меньше — нет; дробные дни от 0,5 округляются вверх (ст. 224 ТК). Начислится в ",
      "Oyning 15 va undan ortiq kunlik qoldig'i oy hisoblanadi, kamrog'i hisoblanmaydi; 0,5 dan boshlab kasr kun yuqoriga yaxlitlanadi (MK 224-modda). Hisoblanadi: "],
    [" с НДФЛ, ИНПС и соцналогом. Выплатить нужно в день увольнения (ст. 254 ТК).", " JShDS, INPS va ijtimoiy soliq bilan. Ishdan bo'shagan kuni to'lash kerak (MK 254-modda)."],
    ["Отпуск использован авансом: за неотработанные дни удерживается ", "Ta'til oldindan ishlatilgan: ishlanmagan kunlar uchun ushlab qolinadi: "],
    [" сум (п. 6 ч. 2 ст. 269 ТК, кроме ряда оснований увольнения). Внесите это как «Удержание».", " so'm (MK 269-modda 2-qism 6-band, ayrim asoslardan tashqari). Buni «Ushlab qolish» sifatida kiriting."],
    ["Укажите дату увольнения (дд.мм.гггг, не раньше приёма) и среднюю зарплату.", "Ishdan bo'shash sanasini (kk.oo.yyyy, ishga qabuldan oldin emas) va o'rtacha ish haqini kiriting."],
    // табель
    ["Табель месяца…", "Oy tabeli…"], ["Табель", "Tabel"], ["Нажимайте на день: прогул → за свой счёт → командировка → рабочий. Выходные и праздники отмечены сами, отпуск и больничный берутся из карточки.",
      "Kunni bosing: sababsiz kelmagan → o'z hisobidan → xizmat safari → ish kuni. Dam olish va bayram kunlari o'zi belgilanadi, ta'til va kasallik kartochkadan olinadi."],
    ["Прогулов", "Sababsiz kelmaganlar"], ["прогул", "sababsiz kelmagan"], ["Прогул", "Sababsiz kelmagan"], ["За свой счёт", "O'z hisobidan"], ["за свой счёт", "o'z hisobidan"],
    ["Командировка (оплачивается)", "Xizmat safari (to'lanadi)"], ["Командировка", "Xizmat safari"], ["командировка", "xizmat safari"], ["отпуск", "ta'til"],
    ["Рабочих дней по графику (", "Jadval bo'yicha ish kunlari ("], ["-дневка)", " kunlik)"], ["Оплачивается дней", "To'lanadigan kunlar"], ["Оклад за месяц", "Oy uchun oklad"],
    ["Вне периода работы", "Ish davridan tashqari"], ["Выходной или праздничный день", "Dam olish yoki bayram kuni"],
    ["Это отпуск или больничный — измените в карточке сотрудника", "Bu ta'til yoki kasallik — xodim kartochkasida o'zgartiring"],
    // учёт по часам
    ["Учёт времени", "Vaqt hisobi"], ["По дням", "Kunlar bo'yicha"], ["По часам", "Soatlar bo'yicha"], [" · по часам", " · soatlar bo'yicha"],
    ["Оклад в месяц", "Oyiga oklad"], ["За каждый час", "Har bir soat uchun"], ["Оплата", "To'lov"], ["Ставка за час *", "Soatlik stavka *"],
    ["Накануне праздника рабочий день на 1 час короче (ст. 187 ТК) — учитывается автоматически. Сверхурочные, работа в выходные и ночью доплачиваются по табелю (ст. 262–264).",
      "Bayram arafasida ish kuni 1 soatga qisqa (MK 187-modda) — avtomatik hisobga olinadi. Ish vaqtidan tashqari, dam olish kunlari va tungi ish tabel bo'yicha qo'shimcha to'lanadi (MK 262–264-moddalar)."],
    ["Неделя: ", "Hafta: "], [" ч — больше 40 ч — выше нормы (ст. 182 ТК)", " soat — 40 soatdan ko'p — me'yordan yuqori (MK 182-modda)"], [" ч", " soat"],
    ["Пример за ", "Misol: "], [" ч нормы.", " soat me'yor."],
    ["Нажмите на день, чтобы записать отработанные часы, ночные или отметить прогул. В клетке — часы за день (по графику, если ничего не вводили). Праздники и выходные отмечены сами, отпуск и больничный берутся из карточки.",
      "Ishlangan soatlarni, tungi soatlarni yozish yoki sababsiz kelmaganlikni belgilash uchun kunni bosing. Katakda — kunlik soatlar (hech narsa kiritilmasa, jadval bo'yicha). Bayram va dam olish kunlari o'zi belgilanadi, ta'til va kasallik kartochkadan olinadi."],
    ["Работал", "Ishladi"], ["Отработано, ч", "Ishlangan, soat"], ["Из них ночью (22–06), ч", "Shundan tunda (22–06), soat"], ["Записать день", "Kunni yozish"], ["По графику", "Jadval bo'yicha"],
    ["Больше графика — сверхурочные (первые 2 часа ×1,5, дальше ×2); в выходной или праздник — доплата за каждый час; ночные — +50%.",
      "Jadvaldan ko'p — ish vaqtidan tashqari (dastlabki 2 soat ×1,5, keyin ×2); dam olish yoki bayram kuni — har soat uchun qo'shimcha; tungi — +50%."],
    ["Часы — число от 0 до 24", "Soat — 0 dan 24 gacha son"], ["Ночных часов больше, чем отработано", "Tungi soatlar ishlangandan ko'p"],
    ["Записано. Сверхурочных больше 4 ч за два дня подряд — это выше предела (ст. 190 ТК)", "Yozildi. Ketma-ket ikki kunda 4 soatdan ko'p qo'shimcha ish — chegaradan yuqori (MK 190-modda)"], ["Записано", "Yozildi"],
    ["(выходной)", "(dam olish kuni)"], ["по графику ", "jadval bo'yicha "],
    ["Норма часов в месяце", "Oydagi soat me'yori"], ["Не оплачивается (прогул, за свой счёт, недоработка)", "To'lanmaydi (sababsiz kelmagan, o'z hisobidan, kam ishlangan)"],
    ["Оплачивается по ставке", "Stavka bo'yicha to'lanadi"], ["Оплачивается по окладу", "Oklad bo'yicha to'lanadi"], ["Оплата по ставке", "Stavka bo'yicha to'lov"],
    ["Сверхурочные", "Ish vaqtidan tashqari"], ["В выходные и праздники", "Dam olish va bayram kunlari"], ["Ночные", "Tungi"], ["Доплаты за часы (сверхурочные, выходные, ночные)", "Soatlar uchun qo'shimcha to'lovlar (ortiqcha, dam olish, tungi)"],
    ["Доплаты за часы", "Soatlar uchun qo'shimcha to'lovlar"], [" · доплаты", " · qo'shimcha to'lovlar"], ["Оплачено часов по окладу", "Oklad bo'yicha to'langan soatlar"],
    ["Оплачено по ставке ", "Stavka bo'yicha to'langan "], ["Сверхурочные: ", "Ish vaqtidan tashqari: "], ["Работа в выходной/праздник: ", "Dam olish/bayram kunidagi ish: "], ["Ночные: ", "Tungi: "],
    ["Часы берутся из табеля. Сумму выше можно задать вручную — доплаты за сверхурочные и выходные всё равно добавятся.", "Soatlar tabeldan olinadi. Yuqoridagi summani qo'lda kiritish mumkin — ortiqcha va dam olish kunlari uchun qo'shimcha to'lovlar baribir qo'shiladi."],
    // облако и доступы
    ["Напоминания о сроках работают в установленном приложении для Android и iPhone. Срок отчёта — до 15 числа (годовой — до 15 февраля), он показан на главном экране.", "Muddatlar haqida eslatmalar Android va iPhone uchun o'rnatilgan ilovada ishlaydi. Hisobot muddati — 15-sanagacha (yillik — 15-fevralgacha), u bosh ekranda ko'rsatilgan."],
    ["Вход", "Kirish"], ["Директор — по e-mail, сотрудник и бухгалтер — по логину, который выдал директор.", "Direktor — e-mail orqali, xodim va buxgalter — direktor bergan login orqali."],
    ["Логин или e-mail", "Login yoki e-mail"], ["Пароль", "Parol"], ["Войти", "Kirish"], ["Забыли пароль?", "Parolni unutdingizmi?"], ["Я директор, аккаунта ещё нет", "Men direktorman, akkauntim hali yo'q"],
    ["Аккаунт директора", "Direktor akkaunti"], ["Нужен, чтобы выдавать доступ сотрудникам и работать с разных устройств. На e-mail придёт письмо, если забудете пароль.", "Xodimlarga kirish huquqini berish va turli qurilmalardan ishlash uchun kerak. Parolni unutsangiz, e-mailga xat keladi."],
    ["Пароль (не меньше 6 символов)", "Parol (kamida 6 ta belgi)"], ["Пароль ещё раз", "Parolni takrorlang"], ["Создать аккаунт", "Akkaunt yaratish"], ["Введите логин и пароль", "Login va parolni kiriting"], ["Вы вошли", "Siz kirdingiz"],
    ["Проверьте e-mail", "E-mailni tekshiring"], ["Слишком короткий пароль: нужно не меньше 6 символов", "Parol juda qisqa: kamida 6 ta belgi kerak"], ["Пароли не совпадают", "Parollar mos kelmadi"], ["Аккаунт создан", "Akkaunt yaratildi"],
    ["Сотруднику новый доступ выдаёт директор. Директор: введите e-mail.", "Xodimga yangi kirish huquqini direktor beradi. Direktor: e-mailni kiriting."], ["Письмо для смены пароля отправлено на ", "Parolni o'zgartirish xati yuborildi: "],
    ["Выйти из аккаунта?", "Akkauntdan chiqilsinmi?"], ["Новый пароль", "Yangi parol"], ["Ещё раз", "Yana bir marta"], ["Пароль изменён", "Parol o'zgartirildi"],
    ["Доступ сотрудников и облако", "Xodimlar kirishi va bulut"], ["Директор видит всё, а сотрудник входит по своему логину и видит только свои листки, выплаты, табель и заявления.", "Direktor hammasini ko'radi, xodim esa o'z logini bilan kirib, faqat o'z varaqalari, to'lovlari, tabeli va arizalarini ko'radi."],
    ["Вы вошли: ", "Siz kirdingiz: "], ["Вы директор этой компании. ", "Siz bu kompaniya direktorisiz. "], ["Вы бухгалтер этой компании. ", "Siz bu kompaniya buxgalterisiz. "], ["Не отправлено: ", "Yuborilmadi: "],
    ["Есть изменения, ещё не отправленные на сервер.", "Serverga hali yuborilmagan o'zgarishlar bor."], ["Все изменения на сервере.", "Barcha o'zgarishlar serverda."], ["Доступы сотрудников", "Xodimlar kirish huquqlari"], ["Заявления сотрудников, новых: ", "Xodimlar arizalari, yangi: "], ["Заявления", "Arizalar"], [" (новых: ", " (yangi: "],
    ["Отключить компанию от облака", "Kompaniyani bulutdan uzish"], ["Подключить «", "Bulutga ulash: «"], ["» к облаку", "»"], ["Сменить пароль", "Parolni o'zgartirish"], ["Выйти", "Chiqish"], ["У меня есть логин: войти", "Mening loginim bor: kirish"],
    ["Данные компании будут храниться на серверах Google за пределами Узбекистана. По ст. 27¹ закона о персональных данных это допускается при выполнении её условий, отвечает за это компания. Подключить?", "Kompaniya ma'lumotlari O'zbekistondan tashqaridagi Google serverlarida saqlanadi. Shaxsga doir ma'lumotlar to'g'risidagi qonunning 27¹-moddasiga ko'ra, bunga uning shartlari bajarilganda yo'l qo'yiladi, bunga kompaniya javob beradi. Ulansinmi?"],
    ["Компания в облаке. Теперь можно выдавать доступы.", "Kompaniya bulutda. Endi kirish huquqlarini berish mumkin."], ["Отключить компанию от облака? Данные на сервере удалятся, доступы сотрудников перестанут работать. На этом телефоне всё останется.", "Kompaniya bulutdan uzilsinmi? Serverdagi ma'lumotlar o'chiriladi, xodimlar kira olmaydi. Shu telefonda hammasi qoladi."],
    ["Компания отключена от облака", "Kompaniya bulutdan uzildi"], ["Компания подключена к облаку. Сначала отключите её: Настройки → Доступ сотрудников и облако.", "Kompaniya bulutga ulangan. Avval uni uzing: Sozlamalar → Xodimlar kirishi va bulut."],
    ["Другое устройство уже изменило данные компании «", "Boshqa qurilma kompaniya ma'lumotlarini allaqachon o'zgartirgan: «"], ["». Нажмите OK, чтобы загрузить их версию (ваши последние изменения пропадут), или Отмена — чтобы записать вашу версию поверх.", "». Ularning versiyasini yuklash uchun OK ni bosing (oxirgi o'zgarishlaringiz yo'qoladi) yoki o'z versiyangizni ustidan yozish uchun Bekor qilish ni bosing."],
    ["Данные обновлены с сервера", "Ma'lumotlar serverdan yangilandi"], ["Данные обновлены", "Ma'lumotlar yangilandi"], ["Доступ отозван директором", "Kirish huquqi direktor tomonidan bekor qilindi"], ["Компания «", "Kompaniya «"], ["» больше не в облаке, данные остались на телефоне", "» endi bulutda emas, ma'lumotlar telefonda qoldi"],
    ["Доступы", "Kirish huquqlari"], ["Сотрудник видит только свои листки, выплаты, табель и заявления. Бухгалтер работает со всеми данными компании.", "Xodim faqat o'z varaqalari, to'lovlari, tabeli va arizalarini ko'radi. Buxgalter kompaniyaning barcha ma'lumotlari bilan ishlaydi."],
    ["логин: ", "login: "], ["нет доступа", "kirish yo'q"], ["есть", "bor"], ["выдать", "berish"], ["Бухгалтеры", "Buxgalterlar"], ["Добавить бухгалтера", "Buxgalter qo'shish"], ["Бухгалтер", "Buxgalter"], ["Сначала добавьте сотрудников.", "Avval xodimlarni qo'shing."],
    ["Логин: ", "Login: "], [". Пароль знает только сотрудник.", ". Parolni faqat xodim biladi."], ["Новый логин и пароль", "Yangi login va parol"], ["Отозвать доступ бухгалтера «", "Buxgalter kirishi bekor qilinsin: «"], ["Отозвать доступ? Сотрудник больше не сможет войти и увидеть свои данные.", "Kirish bekor qilinsinmi? Xodim boshqa kira olmaydi va o'z ma'lumotlarini ko'ra olmaydi."], ["Отозвать доступ", "Kirishni bekor qilish"], ["Доступ отозван", "Kirish bekor qilindi"], ["Назад", "Orqaga"],
    ["Старый логин перестанет работать. Выдать новый?", "Eski login ishlamay qoladi. Yangisi berilsinmi?"], ["Доступ выдан", "Kirish huquqi berildi"], ["Логин", "Login"], ["Пароль показывается один раз. Отправьте его сотруднику сейчас, он сможет сменить его в приложении.", "Parol bir marta ko'rsatiladi. Uni hozir xodimga yuboring, u ilovada o'zgartirishi mumkin."],
    ["Отправить", "Yuborish"], ["К списку доступов", "Ro'yxatga qaytish"], ["Вход в «Зарплату»", "«Zarplata»ga kirish"], ["Доступ к приложению «Зарплата»", "«Zarplata» ilovasiga kirish"], ["Открыть: ", "Ochish: "], ["Пароль можно сменить в приложении: раздел «Ещё».", "Parolni ilovada o'zgartirish mumkin: «Yana» bo'limi."],
    ["Сможет считать зарплату, вести сотрудников и готовить отчёты. Добавлять бухгалтеров и отключать компанию может только директор.", "Ish haqini hisoblaydi, xodimlarni yuritadi va hisobotlar tayyorlaydi. Buxgalter qo'shish va kompaniyani uzish faqat direktorga mumkin."], ["ФИО *", "F.I.Sh. *"], ["Выдать доступ", "Kirish huquqini berish"],
    ["Сотрудник увидит ваш ответ у себя в приложении.", "Xodim javobingizni o'z ilovasida ko'radi."], ["Заявлений пока нет.", "Arizalar hozircha yo'q."], ["Одобрить", "Tasdiqlash"], ["Отклонить", "Rad etish"], ["на рассмотрении", "ko'rib chiqilmoqda"], ["одобрено", "tasdiqlandi"], ["отклонено", "rad etildi"],
    ["Одобрено. Сразу посчитать отпускные?", "Tasdiqlandi. Ta'til pulini hozir hisoblaymizmi?"], ["Одобрено. Сразу посчитать больничный?", "Tasdiqlandi. Kasallik puli hozir hisoblansinmi?"], ["Одобрено", "Tasdiqlandi"], ["Отклонено", "Rad etildi"],
    // кабинет сотрудника
    [" дн.", " kun"], [" ч · ", " soat · "],
    ["Мой кабинет", "Mening kabinetim"], ["Листки", "Varaqalar"], ["Ещё", "Yana"], ["Начислений пока нет", "Hisoblashlar hozircha yo'q"], ["Они появятся здесь, когда директор рассчитает зарплату.", "Direktor ish haqini hisoblagach, shu yerda ko'rinadi."], ["Он появится здесь, когда директор рассчитает зарплату.", "Direktor ish haqini hisoblagach, shu yerda ko'rinadi."],
    ["Обновить данные", "Ma'lumotlarni yangilash"], ["Обновить", "Yangilash"], ["Обновлено: ", "Yangilandi: "], ["На руки за ", "Qo'lga: "], ["Осталось", "Qoldi"], ["По месяцам", "Oylar bo'yicha"], ["нажмите, чтобы раскрыть", "ochish uchun bosing"], ["не выплачено", "to'lanmagan"], ["осталось ", "qoldi "], ["Не облагается", "Soliqqa tortilmaydi"],
    ["Удержание: ", "Ushlab qolish: "], ["Текущий месяц: суммы ещё могут измениться.", "Joriy oy: summalar hali o'zgarishi mumkin."], ["Табеля пока нет", "Tabel hozircha yo'q"], ["Норма часов", "Soat me'yori"], ["Рабочих дней по графику", "Jadval bo'yicha ish kunlari"], ["Оплачивается", "To'lanadi"], ["Положено в год", "Yiliga belgilangan"], ["Накоплено", "To'plangan"], ["Использовано", "Ishlatilgan"], ["Поправка", "Tuzatish"], ["Остаток", "Qoldiq"],
    ["Примерный расчёт по дате приёма. Точный остаток уточняйте у директора.", "Ishga qabul sanasi bo'yicha taxminiy hisob. Aniq qoldiqni direktordan so'rang."], ["Отпуска и больничные", "Ta'til va kasalliklar"], ["Новое заявление", "Yangi ariza"], ["Мои заявления", "Mening arizalarim"], ["Здесь можно попросить отпуск, сообщить о больничном или написать директору.", "Bu yerda ta'til so'rash, kasallik haqida xabar berish yoki direktorga yozish mumkin."],
    ["Директор увидит его в приложении и ответит.", "Direktor uni ilovada ko'rib, javob beradi."], ["Что нужно", "Nima kerak"], ["С какого числа", "Qaysi sanadan"], ["По какое число", "Qaysi sanagacha"], ["Укажите дату", "Sanani kiriting"], ["Напишите, что нужно", "Nima kerakligini yozing"], ["Дата окончания раньше начала", "Tugash sanasi boshlanishidan oldin"], ["Заявление отправлено", "Ariza yuborildi"], ["Отозвать заявление?", "Ariza bekor qilinsinmi?"], ["Аккаунт", "Akkaunt"],
    ["Поправка остатка отпуска, дн.", "Ta'til qoldig'iga tuzatish, kun"], ["Поправка — если на начало учёта уже был остаток (+) или отпуск отгулян вне приложения (−). Остаток виден сотруднику в его кабинете.", "Tuzatish — hisob boshida qoldiq bo'lgan bo'lsa (+) yoki ta'til ilovadan tashqari olingan bo'lsa (−). Qoldiqni xodim o'z kabinetida ko'radi."],
    ["Данные компании хранятся на этом телефоне и на сервере (Google Firebase).", "Kompaniya ma'lumotlari shu telefonda va serverda (Google Firebase) saqlanadi."], ["Данные хранятся только на этом телефоне.", "Ma'lumotlar faqat shu telefonda saqlanadi."], [" В интернет приложение выходит, только если вы войдёте в аккаунт.", " Ilova faqat akkauntga kirsangiz internetga chiqadi."], [" Приложение не выходит в интернет.", " Ilova internetga chiqmaydi."],
    [" Делайте резервную копию — при очистке данных приложения записи пропадут. Расчёты справочные: сверяйте ставки с Налоговым кодексом.", " Zaxira nusxa oling — ilova ma'lumotlari tozalansa yozuvlar yo'qoladi. Hisob-kitoblar yo'riqnoma: stavkalarni Soliq kodeksi bilan solishtiring."],
    ["Нет связи с сервером. Проверьте интернет.", "Server bilan aloqa yo'q. Internetni tekshiring."], ["Неверный логин или пароль", "Login yoki parol noto'g'ri"], ["Доступ отключён", "Kirish o'chirilgan"], ["Такой e-mail уже зарегистрирован. Войдите или восстановите пароль.", "Bu e-mail allaqachon ro'yxatdan o'tgan. Kiring yoki parolni tiklang."], ["Проверьте логин или e-mail", "Login yoki e-mailni tekshiring"], ["Введите пароль", "Parolni kiriting"],
    ["Слишком много попыток. Попробуйте позже.", "Urinishlar juda ko'p. Keyinroq urinib ko'ring."], ["Нет прав на это действие", "Bu amal uchun huquq yo'q"], ["Войдите заново", "Qaytadan kiring"], ["На сегодня исчерпан бесплатный лимит сервера. Попробуйте завтра.", "Serverning bugungi bepul limiti tugadi. Ertaga urinib ko'ring."], ["Для этого логина нет доступа. Обратитесь к директору.", "Bu login uchun kirish yo'q. Direktorga murojaat qiling."], ["Не удалось прочитать данные с сервера. Попробуйте ещё раз.", "Serverdan ma'lumotlarni o'qib bo'lmadi. Yana urinib ko'ring."], ["Ошибка сервера: ", "Server xatosi: "],
    // материальная помощь и прочие доходы
    ["Материальная помощь…", "Moddiy yordam…"], ["Материальная помощь", "Moddiy yordam"], ["Материальная помощь: ", "Moddiy yordam: "],
    ["Предел без налога за ", "Soliqsiz chegara: "], [" год (4,22 МРОТ)", " yil (4,22 MHEKM)"], ["Уже выплачено в этом году", "Bu yil allaqachon to'langan"],
    ["Не облагается налогом", "Soliqqa tortilmaydi"], ["Не облагается (до 4,22 МРОТ в год)", "Soliqqa tortilmaydi (yiliga 4,22 MHEKMgacha)"], [" с остатка", " qoldiqdan"],
    ["Материальная помощь облагается только НДФЛ, ИНПС и соцналога нет (ст. 377, 378 НК). Предел считается по МРОТ на 1 января.",
      "Moddiy yordamdan faqat JShDS olinadi, INPS va ijtimoiy soliq yo'q (SK 377, 378-moddalar). Chegara 1-yanvardagi MHEKM bo'yicha hisoblanadi."],
    ["Аренда, материальная помощь и другие доходы физлиц…", "Ijara, moddiy yordam va jismoniy shaxslarning boshqa daromadlari…"],
    ["Прочие доходы физлиц", "Jismoniy shaxslarning boshqa daromadlari"], ["Прочие доходы", "Boshqa daromadlar"], ["Кому", "Kimga"],
    ["Выберите получателя…", "Oluvchini tanlang…"], ["+ Новое физлицо", "+ Yangi jismoniy shaxs"], ["Физлица", "Jismoniy shaxslar"],
    ["Аренда (не через E-ijara)", "Ijara (E-ijara orqali emas)"], ["Имущественный доход (ст. 375)", "Mulkiy daromad (SK 375-modda)"], ["Материальная выгода (ст. 376)", "Moddiy naf (SK 376-modda)"],
    ["Прочий доход (ст. 377)", "Boshqa daromad (SK 377-modda)"], ["Сумма, сум", "Summa, so'm"], ["Получатель получит", "Oluvchi oladi"],
    ["Аренда, поставленная на учёт в E-ijara, в отчёт вручную не вносится — налоговая берёт её сама.", "E-ijarada ro'yxatga olingan ijara hisobotga qo'lda kiritilmaydi — soliq organi o'zi oladi."],
    [" · НДФЛ с них считается отдельно, соцналога и ИНПС нет", " · ulardan JShDS alohida hisoblanadi, ijtimoiy soliq va INPS yo'q"],
    ["Выберите получателя", "Oluvchini tanlang"], ["Введите ФИО", "F.I.Sh. kiriting"], ["Доходы физлиц без трудового договора · ", "Mehnat shartnomasiz jismoniy shaxslar daromadi · "],
    ["Выплачено с начала года", "Yil boshidan to'langan"], ["НДФЛ за месяц (платится сверх зарплатного)", "Oy uchun JShDS (ish haqi JShDSidan tashqari to'lanadi)"], ["НДФЛ с начала года", "Yil boshidan JShDS"],
    ["Нерезидент (иностранец, меньше 183 дней в году)", "Norezident (chet ellik, yiliga 183 kundan kam)"], ["Нерезидент", "Norezident"], ["нерезидент", "norezident"], ["Резидент IT Park", "IT Park rezidenti"], ["Резидент", "Rezident"],
    // карточка сотрудника
    ["Новый сотрудник", "Yangi xodim"], ["Заполните основное — остальное можно добавить позже.", "Asosiyni to'ldiring — qolganini keyin qo'shish mumkin."],
    ["Изменения суммы действуют с текущего месяца, прошлые месяцы не пересчитываются.", "Summa o'zgarishlari joriy oydan amal qiladi, o'tgan oylar qayta hisoblanmaydi."],
    ["Фамилия *", "Familiya *"], ["Имя *", "Ism *"], ["Отчество", "Otasining ismi"], ["ПИНФЛ (14 цифр)", "JShShIR (14 ta raqam)"], ["ПИНФЛ — ровно 14 цифр", "JShShIR — roppa-rosa 14 ta raqam"],
    ["ПИНФЛ", "JShShIR"], ["нужен для отчёта по НДФЛ", "JShDS hisoboti uchun kerak"], ["Должность", "Lavozim"], ["Отдел", "Bo'lim"], ["Договор", "Shartnoma"], ["Трудовой", "Mehnat"], ["Трудовые", "Mehnat"],
    ["ГПХ", "FHSh"], ["Как вводите сумму", "Summani qanday kiritasiz"], ["На руки (обратный расчёт)", "Qo'lga tegadigan (teskari hisob)"], ["Начислено", "Hisoblangan"],
    ["Дата принятия *", "Ishga qabul sanasi *"], ["Дату увольнения заполняйте, когда сотрудник уходит — начисления будут по месяц увольнения включительно.", "Xodim ketganda ishdan bo'shash sanasini kiriting — hisoblash bo'shagan oygacha davom etadi."],
    ["Для отчёта в налоговую", "Soliq hisoboti uchun"], ["Статус", "Holat"], ["График работы (для неполного месяца, отпуска, больничного)", "Ish grafigi"], ["График работы в компании", "Kompaniyada ish grafigi"],
    ["График работы", "Ish grafigi"], ["5-дневка", "5 kunlik"], ["6-дневка", "6 kunlik"],
    ["Нужен для неполного месяца, отпуска и больничного: считаются только рабочие дни по графику (5 — пн–пт, 6 — пн–сб).", "To'liq bo'lmagan oy, ta'til va kasallik uchun kerak: jadval bo'yicha faqat ish kunlari hisoblanadi (5 — du–ju, 6 — du–sha)."],
    ["Для новых сотрудников; у каждого сотрудника график можно поменять в его карточке.", "Yangi xodimlar uchun; har bir xodimning grafigini kartochkasida o'zgartirish mumkin."],
    ["Форма контракта (для трудовых)", "Shartnoma shakli (mehnat uchun)"], ["Основной", "Asosiy"], ["Совместитель", "O'rindosh"], ["Надомник", "Uyda ishlovchi"],
    ["Рабочее время, ставок (1; 0,5; 0,25…)", "Ish vaqti, stavka (1; 0,5; 0,25…)"], ["Рабочее место", "Ish o'rni"], ["Постоянное", "Doimiy"], ["Сезонное", "Mavsumiy"],
    ["Дата создания рабочего места", "Ish o'rni yaratilgan sana"], ["Номер льготы (ID) из кабинета — если есть льгота ст. 380", "Kabinetdagi imtiyoz raqami (ID) — SK 380-modda imtiyozi bo'lsa"],
    ["Льгота по доходу (ст. 380 НК)", "Daromad bo'yicha imtiyoz (SK 380-modda)"], ["Нет", "Yo'q"], ["Работает", "Ishlaydi"], ["Уволенные · ", "Bo'shaganlar · "],
    ["1,41 МРОТ — ветераны, инвалиды войны, одинокие матери и др.", "1,41 MHEKM — faxriylar, urush nogironlari, yolg'iz onalar va b."], ["3 МРОТ — инвалиды с детства, I–II группы", "3 MHEKM — bolalikdan nogironlar, I–II guruh"],
    ["Только трудовой договор по основному месту работы; нужны документы, подтверждающие льготу.", "Faqat asosiy ish joyidagi mehnat shartnomasi; imtiyozni tasdiqlovchi hujjatlar kerak."],
    ["Фамилия, имя и сумма — этого достаточно. ПИНФЛ можно добавить позже.", "Familiya, ism va summa — yetarli. JShShIRni keyin qo'shish mumkin."], ["Добавьте первого сотрудника", "Birinchi xodimni qo'shing"],
    ["Укажите дату принятия: дд.мм.гггг", "Ishga qabul sanasini kiriting: kk.oo.yyyy"], ["Заполните отмеченные поля", "Belgilangan maydonlarni to'ldiring"], ["Дата в формате дд.мм.гггг", "Sana kk.oo.yyyy formatida"],
    ["Дата увольнения раньше даты принятия", "Ishdan bo'shash sanasi qabul sanasidan oldin"], ["дд.мм.гггг", "kk.oo.yyyy"],
    // отчёты
    ["Ведомость", "Qaydnoma"], ["НДФЛ и взносы", "JShDS va badallar"], ["Свод", "Yig'ma"], ["Месяц", "Oy"], ["Квартал", "Chorak"], ["Год", "Yil"], [" квартал ", "-chorak "],
    ["Нет данных за период", "Davr uchun ma'lumot yo'q"], ["Добавьте сотрудников и начисления — отчёт соберётся сам.", "Xodimlar va hisoblashlarni qo'shing — hisobot o'zi tuziladi."],
    ["Таблицу можно листать вбок →", "Jadvalni yon tomonga surish mumkin →"], ["Сотрудник", "Xodim"], ["Доход", "Daromad"], ["ИТОГО", "JAMI"], ["ВСЕГО", "BARCHASI"], ["Итого ", "Jami "],
    ["К перечислению за период", "Davr uchun o'tkaziladigan"], ["Файл для my.soliq.uz (приложение 4)", "my.soliq.uz uchun fayl (4-ilova)"], ["Excel", "Excel"],
    ["Вносится вручную в основной расчёт · ", "Asosiy hisobga qo'lda kiritiladi · "], ["Количество работников", "Xodimlar soni"], ["ИНПС за месяц", "Oy uchun INPS"], ["ИНПС с начала года", "Yil boshidan INPS"],
    ["Ставка социального налога", "Ijtimoiy soliq stavkasi"], [" (у IT Park по трудовым — льгота)", " (IT Parkda mehnat shartnomalari bo'yicha — imtiyoz)"],
    ["Приложение 1 — льгота по соцналогу IT Park, код 10230090", "1-ilova — IT Park ijtimoiy soliq imtiyozi, kod 10230090"], ["Оплата труда за месяц", "Oy uchun mehnat haqi"], ["Оплата труда с начала года", "Yil boshidan mehnat haqi"],
    ["Как загрузить файл в my.soliq.uz", "Faylni my.soliq.uz ga qanday yuklash"],
    ["1. Кабинет → «Отправка отчётности ЮЛ» → «Электронные формы» → налог на доходы физлиц → расчёт 11101_20 (код 46), год и месяц.", "1. Kabinet → «YuT hisobot yuborish» → «Elektron shakllar» → jismoniy shaxslardan daromad solig'i → 11101_20 hisob-kitobi (kod 46), yil va oy."],
    ["2. В разделе «Проактивный» выберите файл из приложения и нажмите «Загрузить в отчёт». Приложения 4 и 5 заполнятся автоматически.", "2. «Proaktiv» bo'limida ilovadagi faylni tanlang va «Hisobotga yuklash»ni bosing. 4 va 5-ilovalar avtomatik to'ladi."],
    ["3. Впишите количество работников, ставку соцналога и сумму ИНПС (см. выше), при льготе IT Park — Приложение 1.", "3. Xodimlar soni, ijtimoiy soliq stavkasi va INPS summasini kiriting (yuqoriga qarang), IT Park imtiyozi bo'lsa — 1-ilova."],
    ["4. «Отправить» — отчёт принят сразу. «Сохранить» — черновик: 5 дней на правки, без правок принимается сам.", "4. «Yuborish» — hisobot darhol qabul qilinadi. «Saqlash» — qoralama: 5 kun tuzatish uchun, tuzatilmasa o'zi qabul qilinadi."],
    ["Код льготы по соцналогу (УП-5099, п. 5) взят из видеоразбора формы — выберите в списке «Приложение 1» в кабинете и сверьте.", "Ijtimoiy soliq imtiyoz kodi (PF-5099, 5-band) shakl video tahlilidan olingan — kabinetdagi «1-ilova» ro'yxatidan tanlab, solishtiring."],
    ["Справочно.", "Ma'lumot uchun."], ["Приложение готовит цифры для сверки; отчётность подаётся и корректируется в личном кабинете my.soliq.uz (по НК: ежемесячно, до 15 числа следующего месяца; итог за год — до 15 февраля). Ставки проверьте в «Настройки → Правила».",
      "Ilova solishtirish uchun raqamlarni tayyorlaydi; hisobot my.soliq.uz shaxsiy kabinetida topshiriladi va tuzatiladi (SK bo'yicha: har oy, keyingi oyning 15-sanasigacha; yillik — 15-fevralgacha). Stavkalarni «Sozlamalar → Qoidalar»da tekshiring."],
    ["У ", "Sizda "], [" сотр. не указан ПИНФЛ — без него отчёт по НДФЛ не подать. Добавьте в разделе «Сотрудники».", " xodimda JShShIR ko'rsatilmagan — usiz JShDS hisobotini topshirib bo'lmaydi. «Xodimlar» bo'limida qo'shing."],
    ["Графы 11 и 13 — нарастающим итогом с января (или с даты принятия) по выбранный месяц. Если в прошлых месяцах начисляли по-другому, поправьте суммы в этих месяцах на вкладке «Зарплата».",
      "11 va 13-ustunlar — yanvardan (yoki qabul sanasidan) tanlangan oygacha yig'ma jami. O'tgan oylarda boshqacha hisoblangan bo'lsa, o'sha oylarning summalarini «Ish haqi» bo'limida to'g'rilang."],
    ["Расчётная ведомость", "Hisob qaydnomasi"], ["НДФЛ, ИНПС и соцналог по сотрудникам", "Xodimlar bo'yicha JShDS, INPS va ijtimoiy soliq"], ["Свод по отделам и договорам", "Bo'limlar va shartnomalar bo'yicha yig'ma"],
    ["По отделам", "Bo'limlar bo'yicha"], ["По видам договора", "Shartnoma turlari bo'yicha"], ["К перечислению и выплате за период", "Davr uchun o'tkaziladigan va to'lanadigan"],
    ["Выплатить сотрудникам (на руки)", "Xodimlarga to'lash (qo'lga)"], ["ИНПС (на накопительные счета)", "INPS (jamg'arma hisobvaraqlariga)"], ["Соцналог (ЕСП)", "Ijtimoiy soliq"], ["ЕСП", "Ijtimoiy soliq"],
    ["Сформировано в приложении «Зарплата» ", "«Ish haqi» ilovasida shakllantirildi "], [". Данные справочные — сверяйте с личным кабинетом my.soliq.uz.", ". Ma'lumotlar yo'riqnoma — my.soliq.uz shaxsiy kabineti bilan solishtiring."],
    ["Нет данных за период", "Davr uchun ma'lumot yo'q"], ["Нет данных", "Ma'lumot yo'q"], ["нет данных", "ma'lumot yo'q"], ["нет ПИНФЛ", "JShShIR yo'q"],
    // настройки
    ["Название *", "Nomi *"], ["Название", "Nomi"], ["ИНН", "STIR"], ["Бюджетная организация", "Byudjet tashkiloti"], ["ЕСП по повышенной ставке ", "Ijtimoiy soliq oshirilgan stavkada "],
    ["Правила ", "Qoidalar "], [" года", " yil"], ["О сроках отчёта", "Hisobot muddatlari haqida"], ["12 и 15 числа в 09:00: НДФЛ и соцналог — до 15 числа, годовой отчёт — до 15 февраля", "12 va 15-sanalarda 09:00: JShDS va ijtimoiy soliq — 15-sanagacha, yillik hisobot — 15-fevralgacha"],
    ["Напоминания включены", "Eslatmalar yoqildi"], ["Напоминания выключены", "Eslatmalar o'chirildi"], ["Оформление", "Ko'rinish"], ["Авто", "Avto"], ["Светлая", "Yorug'"], ["Тёмная", "Qorong'i"], ["Данные", "Ma'lumotlar"],
    ["Зарплата ", "Ish haqi "], ["Данные хранятся только на этом телефоне, приложение не выходит в интернет. Делайте резервную копию — при очистке данных приложения записи пропадут. Расчёты справочные: сверяйте ставки с Налоговым кодексом.",
      "Ma'lumotlar faqat shu telefonda saqlanadi, ilova internetga chiqmaydi. Zaxira nusxa oling — ilova ma'lumotlari tozalansa yozuvlar yo'qoladi. Hisob-kitoblar yo'riqnoma: stavkalarni Soliq kodeksi bilan solishtiring."],
    ["Компании (", "Kompaniyalar ("], ["): сменить или добавить", "): almashtirish yoki qo'shish"], ["У каждой компании свои сотрудники, начисления и правила.", "Har bir kompaniyaning o'z xodimlari, hisoblashlari va qoidalari bor."],
    ["открыта сейчас", "hozir ochiq"], ["нажмите, чтобы открыть", "ochish uchun bosing"], ["Открыта: ", "Ochildi: "], ["Новая компания", "Yangi kompaniya"], ["Сотрудников можно добавить после создания.", "Xodimlarni yaratilgandan keyin qo'shish mumkin."],
    ["Введите название", "Nomini kiriting"], ["Компания создана", "Kompaniya yaratildi"], ["Компания удалена", "Kompaniya o'chirildi"], ["Компания добавлена", "Kompaniya qo'shildi"], ["Без названия", "Nomsiz"], ["без названия", "nomsiz"],
    ["Данные восстановлены", "Ma'lumotlar tiklandi"], ["Это не файл резервной копии", "Bu zaxira nusxa fayli emas"], ["Не удалось сохранить данные", "Ma'lumotlarni saqlab bo'lmadi"], ["Не удалось сохранить файл", "Faylni saqlab bo'lmadi"],
    ["Поменялся закон — поправьте здесь. Действует с текущего месяца, прошлые месяцы не пересчитываются.", "Qonun o'zgardi — shu yerda tuzating. Joriy oydan amal qiladi, o'tgan oylar qayta hisoblanmaydi."],
    ["Проект нового Налогового кодекса (ЕСП → «социальный налог», отмена 25% для бюджетных, новые сроки) пока не вступил в силу — в расчёте не учтён.", "Yangi Soliq kodeksi loyihasi (ЕСП → «ijtimoiy soliq», byudjet uchun 25% bekor qilinishi, yangi muddatlar) hali kuchga kirmagan — hisobda hisobga olinmagan."],
    ["Стандартные ставки", "Standart stavkalar"], ["Ставки сохранены", "Stavkalar saqlandi"], ["Проверьте числа", "Raqamlarni tekshiring"], ["НДФЛ, %", "JShDS, %"], ["ИНПС, %", "INPS, %"], ["ЕСП, %", "Ijtimoiy soliq, %"], ["ЕСП бюджет, %", "Ijtimoiy soliq (byudjet), %"],
    ["МРОТ, сум (для подсказки и льготы ст. 380)", "MHEKM, so'm (maslahat va SK 380-modda imtiyozi uchun)"], ["Доп. праздничные дни (дд.мм.гггг через запятую)", "Qo'shimcha bayram kunlari (kk.oo.yyyy, vergul bilan)"],
    ["Уже учтены 1 января, 8 марта, 21 марта, 9 мая, 1 сентября, 1 октября, 8 декабря. Дни Хайита и переносы добавьте здесь — они не считаются рабочими.", "1-yanvar, 8-mart, 21-mart, 9-may, 1-sentyabr, 1-oktyabr, 8-dekabr hisobga olingan. Hayit kunlari va ko'chirishlarni shu yerga qo'shing — ular ish kuni hisoblanmaydi."],
    ["ИНПС входит в НДФЛ", "INPS JShDSga kiradi"], ["На руки = начислено − НДФЛ. Выключите, если ИНПС удерживается сверху НДФЛ", "Qo'lga = hisoblangan − JShDS. INPS JShDSdan tashqari ushlansa, o'chiring"],
    ["Удерживать ИНПС с ГПХ", "FHSh dan INPS ushlash"], ["По ПП-4086 (п. 5) — 0,1% от всех доходов, облагаемых НДФЛ, в том числе по ГПХ", "PQ-4086 (5-band) bo'yicha — JShDS solinadigan barcha daromaddan 0,1%, jumladan FHSh dan"],
    ["Включён в реестр IT Park", "IT Park reyestriga kiritilgan"], ["Статус до (если утрачен)", "Holat qadar (yo'qotilgan bo'lsa)"], ["Резидент IT Park (трудовые договоры)", "IT Park rezidenti (mehnat shartnomalari)"],
    ["Трудовые договоры: НДФЛ ", "Mehnat shartnomalari: JShDS "], [". ГПХ — по обычным ставкам. Действует до 01.01.2028 (УП-5099, п. 5 и 8)", ". FHSh — oddiy stavkalarda. 01.01.2028 gacha amal qiladi (PF-5099, 5 va 8-bandlar)"],
    ["Льгота считается по месяцам: если дата — 1-е число, то с этого месяца, иначе со следующего (льготы действуют с 1-го числа месяца, следующего за включением в реестр). Пусто — льгота для всех месяцев.",
      "Imtiyoz oylar bo'yicha hisoblanadi: sana 1-son bo'lsa shu oydan, aks holda keyingi oydan (imtiyozlar reyestrga kiritilgan oydan keyingi oyning 1-sanasidan amal qiladi). Bo'sh bo'lsa — barcha oylar uchun."],
    ["Льготы резидентов IT Park по УП-5099 действуют до 01.01.2028 — проверьте режим на этот период.", "IT Park rezidentlari imtiyozlari PF-5099 bo'yicha 01.01.2028 gacha amal qiladi — shu davr uchun rejimni tekshiring."],
    ["Правила на ", "Qoidalar: "], [" год ещё не утверждены — расчёт идёт по правилам ", " yil uchun hali tasdiqlanmagan — hisob-kitob qoidalar bo'yicha: "],
    ["ID льготы НДФЛ: IT Park (для файла в кабинет)", "JShDS imtiyoz ID: IT Park (kabinet fayli uchun)"], ["ID льготы НДФЛ: материальная помощь (приложение 5)", "JShDS imtiyoz ID: moddiy yordam (5-ilova)"],
    ["ID льготы НДФЛ: ст. 380 по умолчанию (если не указан у сотрудника)", "JShDS imtiyoz ID: SK 380-modda (xodimda ko'rsatilmagan bo'lsa)"], ["по умолчанию ", "standart: "],
    ["ИНПС ", "INPS "], [" засчитывается в НДФЛ", " JShDSga kiradi"], [" удерживается сверху", " JShDSdan tashqari ushlanadi"], ["засчитывается в НДФЛ", "JShDSga kiradi"], ["удерживается сверху", "JShDSdan tashqari ushlanadi"],
    ["Применить график ", "Grafikni qo'llash: "], ["-дневной недели ко всем сотрудникам?", " kunlik hafta barcha xodimlarga?"],
    ["Стереть ВСЕ компании, сотрудников и начисления? Это нельзя отменить.", "BARCHA kompaniya, xodim va hisoblashlar o'chirilsinmi? Buni bekor qilib bo'lmaydi."], ["Точно стереть всё? Сначала можно сохранить резервную копию.", "Rostdan hammasini o'chirasizmi? Avval zaxira nusxa olish mumkin."],
    ["Удалить компанию «", "Kompaniyani o'chirish «"], ["» со всеми сотрудниками и начислениями? Это нельзя отменить.", "» barcha xodim va hisoblashlari bilan? Buni bekor qilib bo'lmaydi."], ["Точно удалить «", "Rostdan o'chirasizmi «"], ["»? Сначала можно сохранить резервную копию.", "»? Avval zaxira nusxa olish mumkin."],
    ["Удалить «", "O'chirish «"], ["» вместе с историей начислений? Для увольнения лучше указать дату увольнения в карточке.", "» hisoblash tarixi bilan birga? Ishdan bo'shatish uchun kartochkada bo'shash sanasini ko'rsatgan ma'qul."],
    ["Удалить эту запись об отпуске/больничном из начислений?", "Ta'til/kasallik yozuvi hisoblashlardan o'chirilsinmi?"], ["Удалить материальную помощь из начислений?", "Moddiy yordam hisoblashlardan o'chirilsinmi?"], ["Удалить эту запись о доходе?", "Bu daromad yozuvi o'chirilsinmi?"],
    ["Ошибка приложения", "Ilova xatosi"], ["Скопировано", "Nusxalandi"], ["Добавлено в начисления", "Hisoblashlarga qo'shildi"], ["Добавлено", "Qo'shildi"], ["Удалено", "O'chirildi"], ["Заполните поля", "Maydonlarni to'ldiring"],
    ["Месяц", "Oy"], ["Период: ", "Davr: "], ["Сотрудник: ", "Xodim: "], ["Компания: ", "Kompaniya: "], ["К выплате: ", "To'lanadigan: "], ["Уже выплачено: ", "Allaqachon to'langan: "], ["Осталось выплатить: ", "To'lash qoldi: "],
    ["Удержано (", "Ushlab qolindi ("], ["Расход компании: ", "Kompaniya xarajati: "], ["Сотрудников: ", "Xodimlar: "], ["На руки: ", "Qo'lga tegadigan: "], ["ИНПС: ", "INPS: "], ["НДФЛ в бюджет: ", "Byudjetga JShDS: "],
    // месяцы
    ["Январь", "Yanvar"], ["Февраль", "Fevral"], ["Март", "Mart"], ["Апрель", "Aprel"], ["Май", "May"], ["Июнь", "Iyun"], ["Июль", "Iyul"], ["Август", "Avgust"], ["Сентябрь", "Sentyabr"], ["Октябрь", "Oktyabr"], ["Ноябрь", "Noyabr"], ["Декабрь", "Dekabr"],
    ["января", "yanvar"], ["февраля", "fevral"], ["марта", "mart"], ["апреля", "aprel"], ["мая", "may"], ["июня", "iyun"], ["июля", "iyul"], ["августа", "avgust"], ["сентября", "sentyabr"], ["октября", "oktyabr"], ["ноября", "noyabr"], ["декабря", "dekabr"],
    ["январь", "yanvar"], ["февраль", "fevral"], ["апрель", "aprel"], ["июнь", "iyun"], ["июль", "iyul"], ["август", "avgust"], ["сентябрь", "sentyabr"], ["октябрь", "oktyabr"], ["ноябрь", "noyabr"], ["декабрь", "dekabr"],
    ["Пн", "Du"], ["Вт", "Se"], ["Ср", "Ch"], ["Чт", "Pa"], ["Пт", "Ju"], ["Сб", "Sh"], ["Вс", "Ya"],
    // остальное
    ["Скопировано", "Nusxalandi"], ["В приложении 5 у некоторых получателей нет ПИНФЛ", "5-ilovada ba'zi oluvchilarda JShShIR yo'q"], ["У", "Sizda"], ["Льгота ст. 380: впишите номер льготы из кабинета (карточка сотрудника)", "SK 380-modda imtiyozi: kabinetdagi imtiyoz raqamini kiriting (xodim kartochkasi)"],
    [" сотр. нет ПИНФЛ — допишите в файле или в приложении", " xodimda JShShIR yo'q — faylda yoki ilovada to'ldiring"],
    ["Нет", "Yo'q"], ["Да", "Ha"],
    ["нажмите, чтобы изменить", "o'zgartirish uchun bosing"], ["за счёт работодателя", "ish beruvchi hisobidan"], ["выплата", "to'lov"], ["удержание", "ushlab qolish"],
    [" · принят ", " · qabul qilingan "], [" работает", " ishlaydi"], [" уволено", " bo'shagan"]
  ];

  // длинные фразы подставляются раньше коротких; короткие слова (до 4 букв) — только как отдельные слова
  const LIST = PAIRS.slice().sort((a, b) => b[0].length - a[0].length);
  const CYR = "А-Яа-яЁё";
  const rx = LIST.map(([a, b]) => {
    const esc = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // без lookbehind (?<!…): его нет в Safari до 16.4 — предшествующий символ захватываем группой и возвращаем при замене
    return [a.length <= 4 ? new RegExp("(^|[^" + CYR + "])" + esc + "(?![" + CYR + "])", "g") : null, a, b];
  });
  let lang = "ru";
  const tr = s => {
    if (lang !== "uz" || !s || !/[А-Яа-яЁё]/.test(s)) return s;
    let out = s;
    for (const [re, a, b] of rx) {
      if (!out.includes(a)) continue;
      out = re ? out.replace(re, (m, p) => p + b) : out.split(a).join(b);
      if (!/[А-Яа-яЁё]/.test(out)) break;
    }
    return out;
  };
  let busy = false;
  const orig = new WeakMap();   // исходный (русский) текст узлов, чтобы вернуть его при переключении языка
  function walk(root) {
    if (lang !== "uz" || !root) return;
    busy = true;
    try {
      const w = document.createTreeWalker(root.nodeType === 3 ? root.parentNode : root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) { if (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) continue; const t = tr(n.nodeValue); if (t !== n.nodeValue) { orig.set(n, n.nodeValue); n.nodeValue = t; } }
      const el = root.nodeType === 1 ? root : root.parentNode;
      if (el && el.querySelectorAll) el.querySelectorAll("[placeholder],[aria-label],[title]").forEach(x => ["placeholder", "aria-label", "title"].forEach(a => { const v = x.getAttribute(a); if (v) { const t = tr(v); if (t !== v) x.setAttribute(a, t); } }));
    } finally { busy = false; }
  }
  const mo = new MutationObserver(recs => {
    if (busy || lang !== "uz") return;
    recs.forEach(r => { if (r.type === "characterData") walk(r.target); else r.addedNodes.forEach(n => walk(n)); });
  });
  window.I18N = {
    tr, get lang() { return lang; },
    setLang(l) {
      lang = l === "uz" ? "uz" : "ru";
      document.documentElement.lang = lang === "uz" ? "uz" : "ru";
      mo.disconnect();
      if (lang === "ru") {          // вернуть русский текст в узлах, которые не перерисовываются (меню)
        busy = true;
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) if (orig.has(n)) n.nodeValue = orig.get(n);
        busy = false;
      }
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
      if (lang === "uz") walk(document.body);
    }
  };
})();
