package uz.zarplata.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/** Ответ системы на установку нового APK: показать окно подтверждения. Приёмник закрыт для других приложений (exported=false). */
public class InstallReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        if (i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE) != PackageInstaller.STATUS_PENDING_USER_ACTION) return;
        Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
        if (confirm == null) return;
        try { c.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
    }
}
