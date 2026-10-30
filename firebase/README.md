# Облако «Зарплаты» (Firebase)

Директор и бухгалтер работают со всеми данными компании, сотрудник видит только свои листки, выплаты, табель и заявления.
Кто что может — в `firestore.rules`, сервера своего нет: приложение обращается к Firebase напрямую (`android/web/cloud.js`, `android/web/team.js`).

## Настройка проекта (один раз, бесплатный тариф Spark)

1. https://console.firebase.google.com → **Create a project**, имя `zarplata`. Google Analytics не нужен.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.** (Вторую галочку, «Email link», не включать.)
3. **Build → Firestore Database → Create database.** Edition — Standard, расположение — любое из `eur3`/`europe-*`, режим — **Production mode**.
4. Там же вкладка **Rules**: заменить весь текст содержимым `firestore.rules` → **Publish**.
5. ⚙ **Project settings → General → Your apps → значок `</>`** (Web app), имя `zarplata`, Hosting не нужен → **Register app**. Из показанного кода нужны `apiKey` и `projectId`.
6. Записать их в `android/web/firebase-config.js`:

   ```js
   window.ZARPLATA_FIREBASE = { apiKey: "AIza…", projectId: "zarplata-xxxxx", appUrl: "https://jlifeisgood.github.io/zarplata/" };
   ```

   `apiKey` у Firebase не секрет: он публичный по замыслу, данные защищают правила. GitHub может прислать письмо о найденном ключе — для этого ключа это ожидаемо.

Пока `firebase-config.js` содержит `null`, приложение работает как раньше — только на телефоне.

При изменении `firestore.rules` их нужно опубликовать снова (шаг 4).

## Где лежат данные

| Путь | Что | Кто читает |
| --- | --- | --- |
| `companies/<cid>`, `companies/<cid>/blob/<n>` | все данные компании (JSON частями до 300 000 знаков) | директор, бухгалтер |
| `members/<uid>_<cid>` | кто к какой компании допущен и с какой ролью | сам человек, директор, бухгалтер |
| `payslips/<cid>_<id сотрудника>` | готовый листок, его считает приложение директора | этот сотрудник, директор, бухгалтер |
| `requests/<id>` | заявления сотрудников | автор, директор, бухгалтер |

Серверы Google находятся за пределами Узбекистана: по ст. 27¹ закона о персональных данных (ред. ЗРУ-1125 от 26.03.2026) такие данные можно хранить за границей при выполнении её условий, отвечает за это компания.

## Проверка на локальном эмуляторе

Нужны Firebase CLI и Java 21. Эмулятор запускается без аккаунта:

```bash
firebase emulators:start --only auth,firestore --project demo-zarplata
```

В браузере на `http://localhost:…` (страница `android/web/index.html`) указать эмулятор и перезагрузить страницу:

```js
localStorage.setItem("zarplata.fbcfg", JSON.stringify({ apiKey: "demo", projectId: "demo-zarplata", emulator: "127.0.0.1" }));
```
