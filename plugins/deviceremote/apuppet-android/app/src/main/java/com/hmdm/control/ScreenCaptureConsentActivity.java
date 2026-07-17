package com.hmdm.control;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.media.projection.MediaProjectionManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.WindowManager;

import androidx.appcompat.app.AppCompatActivity;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

public class ScreenCaptureConsentActivity extends AppCompatActivity {

    /**
     * ColorOS often ignores singleTop for translucent activities and stacks many hosts
     * until "transparent activity is too much" force-stops the process.
     */
    private static volatile boolean instanceActive;

    private boolean consentLaunched;
    private boolean claimedInstance;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (instanceActive) {
            Log.w(Const.LOG_TAG, "ScreenCaptureConsentActivity already active — finishing duplicate");
            finish();
            return;
        }
        instanceActive = true;
        claimedInstance = true;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Defer until the translucent host window is attached — ColorOS sometimes drops
        // MediaProjectionPermissionActivity when started from onCreate of a fresh activity.
        handler.post(this::launchConsentIfNeeded);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Log.i(Const.LOG_TAG, "ScreenCaptureConsentActivity onNewIntent — reusing existing host");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (isFinishing() || !claimedInstance) {
            return;
        }
        handler.post(this::launchConsentIfNeeded);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (claimedInstance) {
            instanceActive = false;
            claimedInstance = false;
        }
        super.onDestroy();
    }

    private void launchConsentIfNeeded() {
        if (consentLaunched || isFinishing()) {
            return;
        }
        consentLaunched = true;
        MediaProjectionManager projectionManager =
                (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        try {
            Intent captureIntent = projectionManager.createScreenCaptureIntent();
            ResolveInfo resolveInfo = getPackageManager()
                    .resolveActivity(captureIntent, PackageManager.MATCH_DEFAULT_ONLY);
            if (resolveInfo != null) {
                Log.i(Const.LOG_TAG, "MediaProjection consent target: "
                        + resolveInfo.activityInfo.packageName + "/" + resolveInfo.activityInfo.name);
            } else {
                Log.w(Const.LOG_TAG, "No activity resolved for MediaProjection consent intent");
            }
            startActivityForResult(captureIntent, Const.REQUEST_SCREEN_SHARE);
        } catch (Exception e) {
            Log.e(Const.LOG_TAG, "Failed to launch MediaProjection consent", e);
            deliverResult(RESULT_CANCELED, null);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == Const.REQUEST_SCREEN_SHARE) {
            deliverResult(resultCode, data);
        } else {
            finish();
        }
    }

    private void deliverResult(int resultCode, Intent data) {
        Intent intent = new Intent(Const.ACTION_SCREEN_CAPTURE_CONSENT_RESULT);
        intent.putExtra(Const.EXTRA_RESULT_CODE, resultCode);
        if (data != null) {
            intent.putExtra(Const.EXTRA_RESULT_DATA, data);
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
        finish();
    }
}
