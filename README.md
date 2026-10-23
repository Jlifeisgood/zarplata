# Зарплата (Android)
Расчёт зарплаты по законодательству Узбекистана: НДФЛ, ИНПС, ЕСП, "на руки", обратный расчёт, АУП/производство, отчёты в Excel.
Java + WebView, без Gradle: `powershell -File android\build.ps1` -> `Zarplata.apk`. Интерфейс: `android\web`. Ядро расчёта: `web\calc.js` (тесты: открыть `web\dev-test.html`, заголовок = PASS).
Данные только на телефоне (localStorage), интернет-разрешения нет.
