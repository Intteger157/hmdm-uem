package com.hmdm.inventory;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import com.hmdm.HeadwindMDM;

import org.json.JSONArray;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class InventoryService extends Service implements HeadwindMDM.EventHandler {

    private static Context appContext;
    private static InventoryPushHandler pushHandler;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private HeadwindMDM headwindMDM;
    private boolean pushRegistered;

    public static void start(Context context) {
        Intent intent = new Intent(context, InventoryService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static Context getAppContext() {
        return appContext;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        appContext = getApplicationContext();
        headwindMDM = HeadwindMDM.getInstance();
        if (!Const.API_KEY.isEmpty()) {
            headwindMDM.setApiKey(Const.API_KEY);
        }
        startForeground(1, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!headwindMDM.isConnected()) {
            if (!headwindMDM.connect(this, this)) {
                Log.w(Const.LOG_TAG, "Headwind MDM launcher not found");
            }
        } else {
            onHeadwindMDMConnected();
        }

        if (intent != null && Const.ACTION_SCAN.equals(intent.getAction())) {
            runScan();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (pushHandler != null) {
            pushHandler.unregister(this);
            pushHandler = null;
            pushRegistered = false;
        }
        headwindMDM.disconnect(this);
        executor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onHeadwindMDMConnected() {
        registerPushHandler();
        runScan();
        ScanScheduler.schedule(this);
    }

    @Override
    public void onHeadwindMDMDisconnected() {
        Log.w(Const.LOG_TAG, "Disconnected from Headwind MDM");
    }

    @Override
    public void onHeadwindMDMConfigChanged() {
        runScan();
    }

    private void registerPushHandler() {
        if (pushRegistered) {
            return;
        }
        pushHandler = new InventoryPushHandler();
        pushHandler.register(Const.PUSH_TYPE_INVENTORY_SCAN, this);
        pushRegistered = true;
    }

    private void runScan() {
        executor.execute(() -> {
            String deviceId = headwindMDM.getDeviceId();
            String serverUrl = headwindMDM.getServerUrl();
            if (deviceId == null || deviceId.isEmpty()) {
                Log.w(Const.LOG_TAG, "Scan skipped: deviceId not available yet");
                return;
            }
            JSONArray apps = PackageCollector.collect(this);
            boolean ok = InventoryUploader.upload(serverUrl, deviceId, apps);
            mainHandler.post(() -> Log.i(Const.LOG_TAG, ok ? "Scan uploaded" : "Scan upload failed"));
        });
    }

    private Notification buildNotification() {
        String channelId = "inventory";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "Inventory sync",
                    NotificationManager.IMPORTANCE_MIN
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, channelId)
                : new Notification.Builder(this);
        return builder
                .setContentTitle("HMDM Inventory")
                .setContentText("Syncing installed apps")
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .build();
    }
}
