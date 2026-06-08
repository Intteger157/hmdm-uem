package com.hmdm.inventory;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Starts the service when MDM installs or updates the APK.
 */
public class PackageUpdateReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getData() == null) {
            return;
        }
        String pkg = intent.getData().getSchemeSpecificPart();
        if (context.getPackageName().equals(pkg)) {
            InventoryService.start(context);
        }
    }
}
