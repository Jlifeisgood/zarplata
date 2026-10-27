package uz.zarplata.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.OutputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final int REQ_FILE = 11;
    private WebView web;
    private ValueCallback<Uri[]> chooser;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setHorizontalScrollBarEnabled(false);
        web.setVerticalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);          // /android_asset доступен всегда, остальные файлы — нет
        s.setAllowContentAccess(true);        // выбор файла копии через системный диалог (content://)
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = cb;
                try { startActivityForResult(p.createIntent(), REQ_FILE); }
                catch (Exception e) { chooser = null; return false; }
                return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String msg, final JsResult r) {
                new AlertDialog.Builder(MainActivity.this).setMessage(msg).setCancelable(false)
                        .setPositiveButton("OK", (d, w) -> r.confirm())
                        .setNegativeButton("Отмена", (d, w) -> r.cancel()).show();
                return true;
            }
            @Override public boolean onJsAlert(WebView v, String url, String msg, final JsResult r) {
                new AlertDialog.Builder(MainActivity.this).setMessage(msg).setCancelable(false)
                        .setPositiveButton("OK", (d, w) -> r.confirm()).show();
                return true;
            }
        });
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE && chooser != null) {
            chooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            chooser = null;
        } else super.onActivityResult(req, res, data);
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(window.handleBack && window.handleBack())", v -> {
            if (!"true".equals(v)) finish();
        });
    }

    private class Bridge {
        /** Напоминания о сроках отчёта: включить/выключить (на Android 13+ сначала просим разрешение на уведомления). */
        @JavascriptInterface public void setReminders(final boolean on) {
            runOnUiThread(() -> {
                if (on && Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != 0)
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 12);
                Reminders.setEnabled(MainActivity.this, on);
            });
        }

        @JavascriptInterface public boolean remindersOn() { return Reminders.enabled(MainActivity.this); }

        /** Язык интерфейса (ru / uz) — для текста уведомлений. */
        @JavascriptInterface public void setLang(String l) { Reminders.prefs(MainActivity.this).edit().putString("lang", "uz".equals(l) ? "uz" : "ru").apply(); }

        @JavascriptInterface public String appVersion() {
            try {
                PackageInfo p = getPackageManager().getPackageInfo(getPackageName(), 0);
                return p.versionName;
            } catch (Exception e) { return "?"; }
        }

        /** Сохраняет файл (содержимое в base64) в «Загрузки». Возвращает "ok:<uri>" или "err:...". */
        @JavascriptInterface public String saveFile(String name, String mime, String base64) {
            try {
                String safe = name.replaceAll("[\\\\/:*?\"<>|]", "_");
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                v.put(MediaStore.Downloads.MIME_TYPE, mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return "err:insert";
                OutputStream o = getContentResolver().openOutputStream(uri);
                try { o.write(Base64.decode(base64, Base64.DEFAULT)); } finally { o.close(); }
                return "ok:" + uri;
            } catch (Exception e) { return "err:" + e.getMessage(); }
        }

        /** Окно «Поделиться» для уже сохранённого файла. */
        @JavascriptInterface public void shareFile(String uri, String mime, String title) {
            try {
                Intent i = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, Uri.parse(uri))
                        .putExtra(Intent.EXTRA_SUBJECT, title).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent c = Intent.createChooser(i, title);
                c.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(c);
            } catch (Exception ignored) { }
        }

        @JavascriptInterface public void shareText(String title, String text) {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_SUBJECT, title).putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(i, title));
        }

        /** Цвет системных панелей под тему страницы: color — "rgb(r, g, b)". */
        @JavascriptInterface public void setBars(final String color, final boolean dark) {
            runOnUiThread(() -> {
                Matcher m = Pattern.compile("(\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)").matcher(color == null ? "" : color);
                if (!m.find()) return;
                int c = Color.rgb(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
                getWindow().setStatusBarColor(c);
                getWindow().setNavigationBarColor(c);
                View d = getWindow().getDecorView();
                int f = d.getSystemUiVisibility();
                int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                d.setSystemUiVisibility(dark ? (f & ~light) : (f | light));
            });
        }
    }
}
