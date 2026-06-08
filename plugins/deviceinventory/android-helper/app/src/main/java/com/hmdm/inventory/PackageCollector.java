package com.hmdm.inventory;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

import org.json.JSONArray;
import org.json.JSONObject;

public final class PackageCollector {

    private PackageCollector() {
    }

    public static JSONArray collect(Context context) {
        JSONArray apps = new JSONArray();
        PackageManager pm = context.getPackageManager();
        for (ApplicationInfo info : pm.getInstalledApplications(PackageManager.GET_META_DATA)) {
            try {
                JSONObject app = new JSONObject();
                app.put("pkg", info.packageName);
                app.put("name", pm.getApplicationLabel(info).toString());
                String version = "";
                try {
                    PackageInfo pkgInfo = pm.getPackageInfo(info.packageName, 0);
                    if (pkgInfo.versionName != null) {
                        version = pkgInfo.versionName;
                    }
                } catch (PackageManager.NameNotFoundException ignored) {
                }
                app.put("version", version);
                boolean system = (info.flags & ApplicationInfo.FLAG_SYSTEM) != 0
                        || (info.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0;
                app.put("system", system);
                apps.put(app);
            } catch (Exception e) {
                android.util.Log.w(Const.LOG_TAG, "Skip package " + info.packageName, e);
            }
        }
        return apps;
    }
}
