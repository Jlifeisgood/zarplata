package uz.zarplata.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.WebResourceResponse;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Iterator;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Автообновление. Интерфейс и расчёты (папка web) обновляются сами: новые файлы скачиваются с сайта приложения, проверяются подписью
 * (update.json подписан ключом разработчика, в нём SHA-256 каждого файла) и подставляются вместо файлов из APK — адрес страницы и её данные не меняются.
 * Если новая версия не запустилась, приложение возвращается к последней рабочей. Новый APK нужен, только если менялся Java-код: о нём сообщаем на экране.
 */
final class Updater {
    /** Уровень Java-части: обновление с большим minApi требует сначала поставить новый APK */
    static final int API = 1;
    private static final String BASE = "https://jlifeisgood.github.io/zarplata/";
    private static final String PUB_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/1VvFtdkw7t6Wj8c9bfMzTNXAIBR3OvM7uTksVuaus9OiLB6Iv3azVv1lz8h+TmntxJsWTTa48E7cskpwbgqOg==";
    private static final long CHECK_EVERY_MS = 6 * 3600 * 1000L;
    private static final String ASSET_PREFIX = "/android_asset/";
    private static final String SAFE_NAME = "[A-Za-z0-9._-]+";

    private static volatile File servingDir = null;   // откуда берутся файлы для текущей загрузки страницы
    private static volatile int serving = 0;
    private static volatile boolean okThisLoad = false;
    private static final AtomicBoolean checking = new AtomicBoolean(false);

    private Updater() { }

    private static SharedPreferences prefs(Context c) { return Reminders.prefs(c); }
    private static File root(Context c) { return new File(c.getFilesDir(), "web"); }
    private static File dir(Context c, int v) { return new File(root(c), String.valueOf(v)); }
    private static int active(Context c) { return prefs(c).getInt("webVer", 0); }

    /** Версия web из самого APK */
    private static int bundled(Context c) {
        try (InputStream in = c.getAssets().open("update.json")) {
            return new JSONObject(new String(readAll(in, 1 << 20), "UTF-8")).getInt("version");
        } catch (Exception e) { return 0; }
    }
    private static int current(Context c) { return Math.max(active(c), bundled(c)); }
    static int loaded(Context c) { return serving != 0 ? serving : bundled(c); }

    /** Перед загрузкой страницы: решаем, какую версию показывать. Новый APK отменяет более старое обновление. */
    static void beginLoad(Context c) {
        int v = active(c);
        if (v != 0 && (v <= bundled(c) || !dir(c, v).isDirectory())) {
            deleteRec(root(c));
            prefs(c).edit().remove("webVer").remove("webGood").apply();
            v = 0;
        }
        serving = v;
        servingDir = v != 0 ? dir(c, v) : null;
        okThisLoad = false;
    }
    static boolean newerReady(Context c) { return active(c) != serving; }

    /** Страница запустилась: эта версия рабочая, старые можно удалить */
    static void markGood(Context c) {
        okThisLoad = true;
        int v = serving;
        if (v == 0) return;
        prefs(c).edit().putInt("webGood", v).apply();
        File[] all = root(c).listFiles();
        if (all == null) return;
        int newest = active(c);
        for (File f : all) if (!f.getName().equals(String.valueOf(v)) && !f.getName().equals(String.valueOf(newest)) && !f.getName().equals("tmp")) deleteRec(f);
    }

    /** Новая версия не сообщила о запуске: откатываемся. true — страницу нужно загрузить заново. */
    static boolean rollbackIfBad(Context c) {
        int v = serving;
        SharedPreferences p = prefs(c);
        if (v == 0 || okThisLoad || v == p.getInt("webGood", 0)) return false;
        int good = p.getInt("webGood", 0);
        SharedPreferences.Editor e = p.edit().putInt("webBad", v);
        if (good != 0 && dir(c, good).isDirectory()) e.putInt("webVer", good); else e.remove("webVer");
        e.apply();
        deleteRec(dir(c, v));
        return true;
    }

    /** Файл для страницы: из обновления, если он там есть, иначе из APK */
    static WebResourceResponse intercept(Uri u) {
        File base = servingDir;
        String path = u.getPath();
        if (base == null || path == null || !path.startsWith(ASSET_PREFIX)) return null;
        String name = path.substring(ASSET_PREFIX.length());
        if (!name.matches(SAFE_NAME)) return null;
        File f = new File(base, name);
        if (!f.isFile()) return null;
        try { return new WebResourceResponse(mime(name), "UTF-8", new FileInputStream(f)); }
        catch (IOException e) { return null; }
    }
    private static String mime(String n) {
        if (n.endsWith(".js")) return "application/javascript";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".json") || n.endsWith(".webmanifest")) return "application/json";
        return "application/octet-stream";
    }

    /** Проверка обновлений в фоне, не чаще раза в 6 часов. onChange — появилось обновление или новый APK. */
    static void check(Context ctx, final Runnable onChange) {
        final Context c = ctx.getApplicationContext();
        if (System.currentTimeMillis() - prefs(c).getLong("updChecked", 0) < CHECK_EVERY_MS || !checking.compareAndSet(false, true)) return;
        new Thread(() -> {
            try { if (run(c)) onChange.run(); }
            catch (Exception ignored) { }   // нет сети или файлы ещё публикуются — попробуем в следующий раз
            finally { checking.set(false); }
        }).start();
    }

    private static boolean run(Context c) throws Exception {
        long now = System.currentTimeMillis();
        byte[] manifest = get(BASE + "update.json?t=" + now, 1 << 20), sig = get(BASE + "update.sig?t=" + now, 4096);
        if (!verify(manifest, sig)) throw new IOException("bad signature");
        JSONObject o = new JSONObject(new String(manifest, "UTF-8"));
        SharedPreferences p = prefs(c);
        boolean changed = false;
        int ver = o.getInt("version");
        if (ver > current(c) && ver > p.getInt("webBad", 0) && o.optInt("minApi", 1) <= API) {
            install(c, ver, o.getJSONObject("files"));
            changed = true;
        }
        JSONObject apk = o.optJSONObject("apk");
        String pending = apk != null && apk.getInt("code") > versionCode(c) ? apk.toString() : "";
        if (!pending.equals(p.getString("apkJson", ""))) { p.edit().putString("apkJson", pending).apply(); changed = true; }
        p.edit().putLong("updChecked", now).apply();
        return changed;
    }

    private static void install(Context c, int ver, JSONObject files) throws Exception {
        File tmp = new File(root(c), "tmp");
        deleteRec(tmp);
        if (!tmp.mkdirs()) throw new IOException("mkdir");
        int cur = active(c);
        Iterator<String> it = files.keys();
        while (it.hasNext()) {
            String name = it.next(), sha = files.getString(name);
            if (!name.matches(SAFE_NAME)) throw new IOException("name");
            File old = cur != 0 ? new File(dir(c, cur), name) : null;
            if (old != null && old.isFile() && sha.equals(sha256(readFile(old)))) { write(new File(tmp, name), readFile(old)); continue; }
            if (sha.equals(assetSha(c, name))) continue;    // такой файл уже есть в APK
            byte[] b = get(BASE + name + "?v=" + ver, 30 << 20);
            if (!sha.equals(sha256(b))) throw new IOException("hash " + name);
            write(new File(tmp, name), b);
        }
        File target = dir(c, ver);
        deleteRec(target);
        if (!tmp.renameTo(target)) throw new IOException("rename");
        prefs(c).edit().putInt("webVer", ver).apply();
    }

    /* ---------- новая версия APK ---------- */

    static String apkUpdateName(Context c) {
        try {
            String s = prefs(c).getString("apkJson", "");
            if (s.isEmpty()) return "";
            JSONObject o = new JSONObject(s);
            return o.getInt("code") > versionCode(c) ? o.getString("name") : "";
        } catch (Exception e) { return ""; }
    }

    /** Скачать APK и показать системное окно установки. Сообщения для человека — в say. */
    static void installApk(final Context ctx, final Say say) {
        final Context c = ctx.getApplicationContext();
        if (!c.getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { c.startActivity(i); } catch (Exception ignored) { }
            say.toast("Разрешите установку для «Зарплаты» и нажмите ещё раз");
            return;
        }
        say.toast("Загружаю обновление…");
        new Thread(() -> {
            try {
                JSONObject o = new JSONObject(prefs(c).getString("apkJson", ""));
                byte[] b = get(BASE + o.getString("file") + "?c=" + o.getInt("code"), 100 << 20);
                if (!o.getString("sha256").equals(sha256(b))) throw new IOException("hash");
                PackageInstaller pi = c.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                int id = pi.createSession(params);
                try (PackageInstaller.Session s = pi.openSession(id)) {
                    try (OutputStream out = s.openWrite("app.apk", 0, b.length)) {
                        out.write(b);
                        s.fsync(out);
                    }
                    Intent done = new Intent(c, InstallReceiver.class);
                    PendingIntent pend = PendingIntent.getBroadcast(c, id, done, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
                    s.commit(pend.getIntentSender());
                }
            } catch (Exception e) {
                say.toast("Не удалось загрузить обновление. Проверьте интернет.");
            }
        }).start();
    }
    interface Say { void toast(String text); }

    /* ---------- вспомогательное ---------- */

    private static int versionCode(Context c) {
        try { return (int) c.getPackageManager().getPackageInfo(c.getPackageName(), 0).getLongVersionCode(); }
        catch (PackageManager.NameNotFoundException e) { return 0; }
    }
    private static boolean verify(byte[] data, byte[] sigBase64) throws Exception {
        PublicKey key = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(Base64.decode(PUB_KEY, Base64.DEFAULT)));
        Signature s = Signature.getInstance("SHA256withECDSA");
        s.initVerify(key);
        s.update(data);
        try { return s.verify(Base64.decode(new String(sigBase64, "UTF-8").trim(), Base64.DEFAULT)); }
        catch (Exception e) { return false; }
    }
    private static byte[] get(String url, int maxBytes) throws IOException {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        h.setConnectTimeout(15000);
        h.setReadTimeout(30000);
        h.setUseCaches(false);
        try {
            if (h.getResponseCode() != 200) throw new IOException("HTTP " + h.getResponseCode());
            try (InputStream in = h.getInputStream()) { return readAll(in, maxBytes); }
        } finally { h.disconnect(); }
    }
    private static byte[] readAll(InputStream in, int maxBytes) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n);
            if (out.size() > maxBytes) throw new IOException("too big");
        }
        return out.toByteArray();
    }
    private static byte[] readFile(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) { return readAll(in, 100 << 20); }
    }
    private static void write(File f, byte[] b) throws IOException {
        try (OutputStream out = new FileOutputStream(f)) { out.write(b); }
    }
    private static String assetSha(Context c, String name) {
        try (InputStream in = c.getAssets().open(name)) { return sha256(readAll(in, 100 << 20)); }
        catch (Exception e) { return ""; }
    }
    private static String sha256(byte[] b) throws Exception {
        StringBuilder s = new StringBuilder();
        for (byte x : MessageDigest.getInstance("SHA-256").digest(b)) s.append(String.format("%02x", x & 0xff));
        return s.toString();
    }
    private static void deleteRec(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteRec(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
