package uz.zarplata.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import java.util.Calendar;

/** Напоминания о сроках отчёта по НДФЛ и соцналогу: 12-го числа (за 3 дня) и 15-го в 09:00; 15 февраля — ещё и годовой отчёт. */
public class Reminders extends BroadcastReceiver {
    private static final String CHANNEL = "deadlines";
    private static final String[] MONTHS = {"январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"};
    private static final String[] MONTHS_UZ = {"yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"};

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("app", Context.MODE_PRIVATE); }

    static boolean enabled(Context c) { return prefs(c).getBoolean("reminders", false); }

    static void setEnabled(Context c, boolean on) {
        prefs(c).edit().putBoolean("reminders", on).apply();
        if (on) schedule(c); else cancel(c);
    }

    private static PendingIntent pending(Context c) {
        return PendingIntent.getBroadcast(c, 7, new Intent(c, Reminders.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancel(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(c));
    }

    /** Ближайшие 12-е или 15-е число в 09:00 после текущего момента. */
    static Calendar next(Calendar from) {
        Calendar best = null;
        for (int add = 0; add < 3; add++) {
            for (int day : new int[]{12, 15}) {
                Calendar t = (Calendar) from.clone();
                t.set(Calendar.DAY_OF_MONTH, 1);
                t.add(Calendar.MONTH, add);
                t.set(Calendar.DAY_OF_MONTH, day);
                t.set(Calendar.HOUR_OF_DAY, 9); t.set(Calendar.MINUTE, 0); t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
                if (t.after(from) && (best == null || t.before(best))) best = t;
            }
        }
        return best;
    }

    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar t = next(Calendar.getInstance());
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t.getTimeInMillis(), pending(c));
    }

    @Override public void onReceive(Context c, Intent i) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) { if (enabled(c)) schedule(c); return; }
        if (!enabled(c)) return;
        Calendar now = Calendar.getInstance();
        int day = now.get(Calendar.DAY_OF_MONTH);
        Calendar prev = (Calendar) now.clone();
        prev.add(Calendar.MONTH, -1);
        boolean uz = "uz".equals(prefs(c).getString("lang", "ru"));
        String period = (uz ? MONTHS_UZ : MONTHS)[prev.get(Calendar.MONTH)] + " " + prev.get(Calendar.YEAR);
        String title, text;
        if (uz) {
            title = day >= 15 ? "Bugun hisobot topshirish muddati" : "Hisobot topshirishga 3 kun qoldi";
            text = "JShDS va ijtimoiy soliq, " + period + ": hisobotni topshiring va 15-sanagacha to'lang.";
            if (now.get(Calendar.MONTH) == Calendar.FEBRUARY) text += " Yillik hisobot (" + prev.get(Calendar.YEAR) + ") ni unutmang.";
        } else {
            title = day >= 15 ? "Сегодня срок сдачи отчёта" : "Через 3 дня срок сдачи отчёта";
            text = "НДФЛ и соцналог за " + period + ": сдать отчёт и заплатить до 15 числа.";
            if (now.get(Calendar.MONTH) == Calendar.FEBRUARY) text += " Не забудьте годовой отчёт за " + prev.get(Calendar.YEAR) + " год.";
        }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL, uz ? "Hisobot muddatlari" : "Сроки отчётности", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent open = PendingIntent.getActivity(c, 8, new Intent(c, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        android.app.Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new android.app.Notification.Builder(c, CHANNEL) : new android.app.Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(title).setContentText(text).setStyle(new android.app.Notification.BigTextStyle().bigText(text))
                .setContentIntent(open).setAutoCancel(true);
        try { nm.notify(day >= 15 ? 15 : 12, b.build()); } catch (Exception ignored) { }
        schedule(c);
    }
}
