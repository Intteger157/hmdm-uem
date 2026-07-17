package com.hmdm.control;

import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.hmdm.control.janus.SharingEngineJanus;

public class MainActivity extends AppCompatActivity implements SharingEngineJanus.EventListener, SharingEngineJanus.StateListener {

    private ImageView imageViewConnStatus;
    private TextView textViewConnStatus;
    private EditText editTextSessionId;
    private EditText editTextPassword;
    private TextView textViewComment;
    private TextView textViewConnect;
    private TextView textViewSendLink;
    private TextView textViewExit;

    private ImageView overlayDot;
    private Handler handler = new Handler();
    private int overlayDotAlpha;
    private int overlayDotDirection = 1;

    private Dialog exitOnIdleDialog;
    private int exitCounter;
    private static final int EXIT_PROMPT_SEC = 10;

    private static final int OVERLAY_DOT_ANIMATION_INCREMENT = 20;
    private static final int OVERLAY_DOT_ANIMATION_DELAY = 200;

    private SharingEngine sharingEngine;

    private SettingsHelper settingsHelper;

    private String sessionId;
    private String password;
    private String adminName;

    private final static String ATTR_SESSION_ID = "sessionId";
    private final static String ATTR_PASSWORD = "password";
    private final static String ATTR_ADMIN_NAME = "adminName";

    private boolean needReconnect = false;

    private static final int ACCESSIBILITY_RETRY_DELAY_MS = 500;
    private static final int ACCESSIBILITY_RETRY_MAX = 30;
    private static final int CONSENT_RETRY_WINDOW_MS = 3000;
    // ICE reconnect / DataChannel backlog can take ~15s; keep share alive across join+leave bursts.
    private static final int SHARE_START_GRACE_MS = 20000;
    private static final int SHARE_LEAVE_DEBOUNCE_MS = 3000;
    private static final int ICE_FAILURE_RECONNECT_MAX = 2;
    private int accessibilityRetryCount = 0;
    private int iceFailureReconnectAttempts = 0;
    private int sessionFetchGeneration = 0;
    private Runnable accessibilityRetryRunnable;
    private Runnable pendingStopSharingRunnable;

    private boolean screenCaptureGranted;
    private boolean screenCaptureRequestPending;
    private boolean screenCaptureConsentRetried;
    private boolean sharingActive;
    private long screenCaptureConsentLaunchTime;
    private long lastShareStartMs;
    private int screenCaptureResultCode;
    private Intent screenCaptureResultData;

    private BroadcastReceiver mSharingServiceReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || intent.getAction() == null) {
                return;
            }
            if (intent.getAction().equals(Const.ACTION_SCREEN_SHARING_START)) {
                sharingActive = true;
                notifySharingStart();

            } else if (intent.getAction().equals(Const.ACTION_SCREEN_SHARING_STOP)) {
                sharingActive = false;
                lastShareStartMs = 0;
                clearScreenCaptureConsent();
                notifySharingStop();
                adminName = null;
                updateUI();
                cancelSharingTimeout();
                scheduleExitOnIdle();

            } else if (intent.getAction().equals(Const.ACTION_SCREEN_SHARING_FAILED)) {
                String message = intent.getStringExtra(Const.EXTRA_MESSAGE);
                if (message != null) {
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
                }
                sharingActive = false;
                lastShareStartMs = 0;
                clearScreenCaptureConsent();
                adminName = null;
                updateUI();
                cancelSharingTimeout();
                scheduleExitOnIdle();

            } else if (intent.getAction().equals(Const.ACTION_CONNECTION_FAILURE)) {
                if (tryReconnectAfterIceFailure()) {
                    return;
                }
                int engineState = sharingEngine.getState();
                if (engineState != Const.STATE_DISCONNECTED && engineState != Const.STATE_DISCONNECTING) {
                    sharingEngine.disconnect(MainActivity.this, (success, errorReason) -> {
                        sharingEngine.setState(Const.STATE_DISCONNECTED);
                        updateUI();
                    });
                } else {
                    sharingEngine.setState(Const.STATE_DISCONNECTED);
                }
                Toast.makeText(MainActivity.this, R.string.connection_failure_hint, Toast.LENGTH_LONG).show();
                updateUI();

            } else if (intent.getAction().equals(Const.ACTION_SCREEN_SHARING_PERMISSION_NEEDED)) {
                if (isScreenShareRunning()) {
                    Log.d(Const.LOG_TAG, "Ignoring PERMISSION_NEEDED while screen share is already running");
                    return;
                }
                screenCaptureGranted = false;
                screenCaptureResultData = null;
                requestScreenCapturePermission();

            } else if (intent.getAction().equals(Const.ACTION_SCREEN_CAPTURE_CONSENT_RESULT)) {
                handleScreenCaptureConsentResult(
                        intent.getIntExtra(Const.EXTRA_RESULT_CODE, 0),
                        intent.getParcelableExtra(Const.EXTRA_RESULT_DATA));
            }
        }
    };

    private boolean isScreenShareRunning() {
        if (sharingActive) {
            return true;
        }
        // Token already handed to ScreenSharingService; VirtualDisplay may still be starting.
        return lastShareStartMs > 0
                && System.currentTimeMillis() - lastShareStartMs < SHARE_START_GRACE_MS;
    }

    private void requestScreenCapturePermission() {
        if (isScreenShareRunning()) {
            Log.d(Const.LOG_TAG, "Skip MediaProjection consent, screen share already running");
            return;
        }
        if (screenCaptureGranted) {
            Log.d(Const.LOG_TAG, "MediaProjection consent already granted");
            return;
        }
        if (screenCaptureRequestPending) {
            Log.d(Const.LOG_TAG, "MediaProjection consent already pending");
            return;
        }
        if (isFinishing() || isDestroyed()) {
            return;
        }
        // Mark pending immediately so a stale admin leave in the same DataChannel burst
        // cannot stopSharing before the consent activity is launched.
        screenCaptureRequestPending = true;
        Log.i(Const.LOG_TAG, "Requesting MediaProjection consent");
        bringAppToForeground();
        handler.post(this::launchScreenCaptureConsent);
    }

    private void bringAppToForeground() {
        // Only moveTaskToFront — relaunching MainActivity (singleTask) finishes
        // ScreenCaptureConsentActivity and kills the system MediaProjection dialog.
        try {
            ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            if (am != null) {
                am.moveTaskToFront(getTaskId(), 0);
            }
        } catch (Exception e) {
            Log.w(Const.LOG_TAG, "moveTaskToFront failed", e);
        }
    }

    private void clearScreenCaptureConsent() {
        screenCaptureGranted = false;
        screenCaptureResultData = null;
        screenCaptureResultCode = 0;
    }

    /**
     * Android 14+: MediaProjection resultData is single-use after createVirtualDisplay.
     * Consume the Intent before starting so a join/leave race cannot reuse it.
     */
    private void consumeAndStartSharing(int resultCode, Intent data) {
        screenCaptureGranted = false;
        screenCaptureResultData = null;
        screenCaptureResultCode = 0;
        lastShareStartMs = System.currentTimeMillis();
        // Mark active before the service confirms so an immediate admin rejoin
        // cannot open a second MediaProjection dialog.
        sharingActive = true;
        ScreenSharingHelper.startSharing(this, resultCode, data);
    }

    private void launchScreenCaptureConsent() {
        if (screenCaptureGranted || isFinishing() || isDestroyed()) {
            screenCaptureRequestPending = false;
            return;
        }
        if (!screenCaptureRequestPending) {
            // Cleared by a real stop path; do not relaunch.
            return;
        }
        screenCaptureConsentLaunchTime = System.currentTimeMillis();
        try {
            startActivity(new Intent(this, ScreenCaptureConsentActivity.class));
        } catch (Exception e) {
            screenCaptureRequestPending = false;
            Log.e(Const.LOG_TAG, "Failed to launch ScreenCaptureConsentActivity", e);
            Toast.makeText(this, R.string.screen_cast_denied, Toast.LENGTH_LONG).show();
        }
    }

    private void handleScreenCaptureConsentResult(int resultCode, Intent data) {
        screenCaptureRequestPending = false;
        if (resultCode == RESULT_OK && data != null) {
            screenCaptureConsentRetried = false;
            Log.i(Const.LOG_TAG, "MediaProjection consent granted");
            // Always start immediately after Accept. Deferring until admin joins
            // delays ACTION_SCREEN_SHARING_START ("Your device is remotely controlled!")
            // by many seconds when consent was prepared on STATE_CONNECTED.
            // Admin rejoin then skips a second prompt via isScreenShareRunning().
            cancelExitOnIdle();
            scheduleSharingTimeout();
            consumeAndStartSharing(resultCode, data);
            return;
        }

        long elapsed = System.currentTimeMillis() - screenCaptureConsentLaunchTime;
        int state = sharingEngine.getState();
        boolean sessionActive = state == Const.STATE_CONNECTED || state == Const.STATE_SHARING;
        if (resultCode != RESULT_OK && !screenCaptureConsentRetried
                && elapsed < CONSENT_RETRY_WINDOW_MS && sessionActive) {
            screenCaptureConsentRetried = true;
            Log.i(Const.LOG_TAG, "MediaProjection consent cancelled quickly, retrying once");
            requestScreenCapturePermission();
            return;
        }

        // Early prep (before admin joins): denial should not tear down the Janus session.
        if (adminName == null && sessionActive) {
            screenCaptureConsentRetried = false;
            Log.w(Const.LOG_TAG, "MediaProjection early consent denied, will retry when admin joins");
            return;
        }

        screenCaptureConsentRetried = false;
        clearScreenCaptureConsent();
        Log.w(Const.LOG_TAG, "MediaProjection consent denied or cancelled, resultCode=" + resultCode);
        Toast.makeText(this, R.string.screen_cast_denied, Toast.LENGTH_LONG).show();
        ScreenSharingHelper.stopSharing(this, true);
        adminName = null;
        updateUI();
        cancelSharingTimeout();
        scheduleExitOnIdle();
    }

    private void prepareScreenCapturePermission() {
        if (screenCaptureGranted) {
            return;
        }
        if (screenCaptureRequestPending) {
            return;
        }
        int state = sharingEngine.getState();
        if (state != Const.STATE_CONNECTED && state != Const.STATE_SHARING) {
            Log.d(Const.LOG_TAG, "Skip screen capture prep, engine state=" + state);
            return;
        }
        Log.i(Const.LOG_TAG, "Preparing screen capture permission, state=" + state);
        requestScreenCapturePermission();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        if (savedInstanceState != null) {
            restoreInstanceState(savedInstanceState);
        }

        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        settingsHelper = SettingsHelper.getInstance(this);
        sharingEngine = SharingEngineFactory.getSharingEngine();
        sharingEngine.setEventListener(this);
        sharingEngine.setStateListener(this);

        DisplayMetrics metrics = new DisplayMetrics();
        ScreenSharingHelper.getRealScreenSize(this, metrics);
        float videoScale = ScreenSharingHelper.adjustScreenMetrics(metrics);
        settingsHelper.setFloat(SettingsHelper.KEY_VIDEO_SCALE, videoScale);
        ScreenSharingHelper.setScreenMetrics(this, metrics.widthPixels, metrics.heightPixels, metrics.densityDpi);

        sharingEngine.setScreenWidth(metrics.widthPixels);
        sharingEngine.setScreenHeight(metrics.heightPixels);

        IntentFilter intentFilter = new IntentFilter(Const.ACTION_SCREEN_SHARING_START);
        intentFilter.addAction(Const.ACTION_SCREEN_SHARING_STOP);
        intentFilter.addAction(Const.ACTION_SCREEN_SHARING_PERMISSION_NEEDED);
        intentFilter.addAction(Const.ACTION_SCREEN_SHARING_FAILED);
        intentFilter.addAction(Const.ACTION_CONNECTION_FAILURE);
        intentFilter.addAction(Const.ACTION_SCREEN_CAPTURE_CONSENT_RESULT);
        LocalBroadcastManager.getInstance(this).registerReceiver(mSharingServiceReceiver, intentFilter);

        initUI();
        setDefaultSettings();
        handleRemoteControlIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRemoteControlIntent(intent);
        if (shouldIgnoreReconnectOnNewIntent(intent)) {
            Log.d(Const.LOG_TAG, "Skipping reconnect onNewIntent during consent or active session");
            return;
        }
        if (Utils.isAccessibilityPermissionGranted(this)) {
            connectRemoteSession();
        }
    }

    private boolean shouldIgnoreReconnectOnNewIntent(Intent intent) {
        if (screenCaptureRequestPending) {
            return true;
        }
        if (intent == null) {
            return false;
        }
        if (Intent.ACTION_MAIN.equals(intent.getAction())
                && intent.hasCategory(Intent.CATEGORY_LAUNCHER)) {
            int state = sharingEngine.getState();
            if (state == Const.STATE_CONNECTED || state == Const.STATE_SHARING
                    || state == Const.STATE_CONNECTING) {
                Log.d(Const.LOG_TAG, "Ignoring LAUNCHER intent during active session");
                return true;
            }
        }
        return false;
    }

    private void handleRemoteControlIntent(Intent intent) {
        if (intent == null) {
            return;
        }
        if (intent.getBooleanExtra("stopRemote", false)) {
            int state = sharingEngine.getState();
            if (state == Const.STATE_DISCONNECTED && adminName == null) {
                Log.d(Const.LOG_TAG, "Ignoring stopRemote while idle");
                return;
            }
            gracefulExit();
            return;
        }
        String remoteSessionId = intent.getStringExtra(Const.EXTRA_REMOTE_SESSION_ID);
        if (remoteSessionId == null) {
            return;
        }
        // Invalidate any in-flight MDM session poll started before launcher delivered credentials.
        sessionFetchGeneration++;
        sessionId = remoteSessionId;
        password = intent.getStringExtra(Const.EXTRA_REMOTE_PASSWORD);
        String serverUrl = intent.getStringExtra(Const.EXTRA_REMOTE_SERVER_URL);
        String secret = intent.getStringExtra(Const.EXTRA_REMOTE_SECRET);
        if (serverUrl != null) {
            settingsHelper.setString(SettingsHelper.KEY_SERVER_URL, serverUrl);
        }
        if (secret != null) {
            settingsHelper.setString(SettingsHelper.KEY_SECRET, secret);
            settingsHelper.setBoolean(SettingsHelper.KEY_USE_DEFAULT, !secret.equals(""));
        }
        String deviceNumber = intent.getStringExtra(Const.EXTRA_MDM_DEVICE_NUMBER);
        if (deviceNumber != null) {
            settingsHelper.setString(SettingsHelper.KEY_MDM_DEVICE_NUMBER, deviceNumber);
        }
        String mdmServerUrl = intent.getStringExtra(Const.EXTRA_MDM_SERVER_URL);
        if (mdmServerUrl != null) {
            settingsHelper.setString(SettingsHelper.KEY_MDM_SERVER_URL, mdmServerUrl);
        }
        String mdmProject = intent.getStringExtra(Const.EXTRA_MDM_SERVER_PROJECT);
        if (mdmProject != null) {
            settingsHelper.setString(SettingsHelper.KEY_MDM_SERVER_PROJECT, mdmProject);
        }
        settingsHelper.setBoolean(SettingsHelper.KEY_AUTO_CONNECT,
                intent.getBooleanExtra(Const.EXTRA_AUTO_CONNECT, true));
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateUI();
        OplusCompat.callGcSupression(getWindow() != null ? getWindow().getDecorView() : null);

        startService(new Intent(MainActivity.this, GestureDispatchService.class));
        ensureAccessibilityPermission();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            OplusCompat.callGcSupression(getWindow() != null ? getWindow().getDecorView() : null);
        }
    }

    @Override
    protected void onPause() {
        cancelAccessibilityRetry();
        super.onPause();
    }

    private void ensureAccessibilityPermission() {
        if (Utils.isAccessibilityPermissionGranted(this)) {
            accessibilityRetryCount = 0;
            onAccessibilityReady();
            return;
        }

        boolean autoConnect = settingsHelper.getBoolean(SettingsHelper.KEY_AUTO_CONNECT, false);
        if (autoConnect && accessibilityRetryCount < ACCESSIBILITY_RETRY_MAX) {
            textViewConnect.setVisibility(View.INVISIBLE);
            accessibilityRetryCount++;
            accessibilityRetryRunnable = this::ensureAccessibilityPermission;
            handler.postDelayed(accessibilityRetryRunnable, ACCESSIBILITY_RETRY_DELAY_MS);
            return;
        }

        showAccessibilitySettingsDialog();
    }

    private void cancelAccessibilityRetry() {
        if (accessibilityRetryRunnable != null) {
            handler.removeCallbacks(accessibilityRetryRunnable);
            accessibilityRetryRunnable = null;
        }
    }

    private void onAccessibilityReady() {
        boolean autoConnect = settingsHelper.getBoolean(SettingsHelper.KEY_AUTO_CONNECT, false);
        if (autoConnect && sessionId != null && password != null) {
            int state = sharingEngine.getState();
            if (state == Const.STATE_DISCONNECTED && sharingEngine.getErrorReason() == null) {
                connect();
            }
        } else if (autoConnect) {
            // Launcher may open the agent after install/update with leftover autoConnect prefs
            // but without remoteSessionId yet. Wait for the real remote-control intent instead of
            // polling /public/session (and showing a false "Failed to connect" toast).
            Log.i(Const.LOG_TAG, "Auto-connect enabled, waiting for remote session credentials from launcher");
            updateUI();
        } else {
            configureAndConnect();
        }
    }

    private void connectRemoteSession() {
        if (sessionId == null || password == null) {
            return;
        }
        int state = sharingEngine.getState();
        if (state == Const.STATE_CONNECTING || state == Const.STATE_DISCONNECTING) {
            return;
        }
        if (state != Const.STATE_DISCONNECTED) {
            Log.i(Const.LOG_TAG, "Reconnecting remote session, state=" + state);
            sharingEngine.disconnect(this, (success, errorReason) -> connect());
            return;
        }
        if (sharingEngine.getErrorReason() == null) {
            connect();
        }
    }

    private void showAccessibilitySettingsDialog() {
        textViewConnect.setVisibility(View.INVISIBLE);
        new AlertDialog.Builder(this)
                .setMessage(R.string.accessibility_hint)
                .setPositiveButton(R.string.continue_button, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        Intent intent = new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS);
                        startActivityForResult(intent, 0);
                    }
                })
                .setCancelable(false)
                .create()
                .show();
    }

    private void configureAndConnect() {
        if (settingsHelper.getString(SettingsHelper.KEY_SERVER_URL) == null) {
            // Not configured yet
            settingsHelper.setString(SettingsHelper.KEY_SERVER_URL, BuildConfig.DEFAULT_SERVER_URL);
            settingsHelper.setString(SettingsHelper.KEY_SECRET, BuildConfig.DEFAULT_SECRET);
            settingsHelper.setBoolean(SettingsHelper.KEY_USE_DEFAULT, !BuildConfig.DEFAULT_SECRET.equals(""));
            Intent intent = new Intent(this, SettingsActivity.class);
            startActivityForResult(intent, Const.REQUEST_SETTINGS);
            return;
        }

        if (needReconnect) {
            // Here we go after changing settings
            needReconnect = false;
            if (sharingEngine.getState() != Const.STATE_DISCONNECTED) {
                sharingEngine.disconnect(MainActivity.this, (success, errorReason) -> connect());
            } else {
                connect();
            }
        } else {
            if (sharingEngine.getState() == Const.STATE_DISCONNECTED && sharingEngine.getErrorReason() == null) {
                connect();
            }
        }
    }

    @Override
    public void onDestroy() {
        cancelAccessibilityRetry();
        try {
            LocalBroadcastManager.getInstance(this).unregisterReceiver(mSharingServiceReceiver);
        } catch (Exception e) {
        }
        super.onDestroy();
    }

    @Override
    public void onSaveInstanceState(Bundle savedInstanceState) {
        savedInstanceState.putString(ATTR_SESSION_ID, sessionId);
        savedInstanceState.putString(ATTR_PASSWORD, password);
        savedInstanceState.putString(ATTR_ADMIN_NAME, adminName);
        super.onSaveInstanceState(savedInstanceState);
    }

    private void restoreInstanceState(Bundle savedInstanceState) {
        sessionId = savedInstanceState.getString(ATTR_SESSION_ID);
        password = savedInstanceState.getString(ATTR_PASSWORD);
        adminName = savedInstanceState.getString(ATTR_ADMIN_NAME);
    }

    @Override
    public void onBackPressed() {
        Toast.makeText(this, R.string.back_pressed, Toast.LENGTH_LONG).show();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Inflate the menu; this adds items to the action bar if it is present.
        getMenuInflater().inflate(R.menu.menu_main, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle action bar item clicks here. The action bar will
        // automatically handle clicks on the Home/Up button, so long
        // as you specify a parent activity in AndroidManifest.xml.
        int id = item.getItemId();

        if (id == R.id.action_settings) {
            if (adminName != null) {
                Toast.makeText(this, R.string.settings_unavailable, Toast.LENGTH_LONG).show();
                return true;
            }
            Intent intent = new Intent(this, SettingsActivity.class);
            startActivityForResult(intent, Const.REQUEST_SETTINGS);
            cancelExitOnIdle();
            return true;
        } else if (id == R.id.action_about) {
            showAbout();
            return true;
        }

        return super.onOptionsItemSelected(item);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == Const.REQUEST_SETTINGS) {
            if (resultCode == Const.RESULT_DIRTY) {
                needReconnect = true;
            } else {
                scheduleExitOnIdle();
            }
        }
    }

    private void initUI() {
        imageViewConnStatus = findViewById(R.id.image_conn_status);
        textViewConnStatus = findViewById(R.id.conn_status);
        editTextSessionId = findViewById(R.id.session_id_edit);
        editTextPassword = findViewById(R.id.password_edit);
        textViewComment = findViewById(R.id.comment);
        textViewConnect = findViewById(R.id.reconnect);
        textViewSendLink = findViewById(R.id.send_link);
        textViewExit = findViewById(R.id.disconnect_exit);

        textViewConnect.setOnClickListener(v -> connect());

        textViewSendLink.setOnClickListener(v -> sendLink());

        textViewExit.setOnClickListener(v -> gracefulExit());
    }

    private void gracefulExit() {
        if (adminName != null) {
            notifySharingStop();
            ScreenSharingHelper.stopSharing(MainActivity.this, true);
        }
        sharingEngine.disconnect(MainActivity.this, (success, errorReason) -> exitApp());
        // 5 sec timeout to exit
        handler.postDelayed(() -> exitApp(), 5000);
    }

    private void exitApp() {
        screenCaptureGranted = false;
        screenCaptureRequestPending = false;
        screenCaptureConsentRetried = false;
        screenCaptureResultData = null;
        Intent intent = new Intent(MainActivity.this, ScreenSharingService.class);
        stopService(intent);
        intent = new Intent(MainActivity.this, GestureDispatchService.class);
        stopService(intent);
        finishAffinity();
        System.exit(0);
    }

    private void updateUI() {
        int[] stateLabels = {R.string.state_disconnected, R.string.state_connecting, R.string.state_connected, R.string.state_sharing, R.string.state_disconnecting};
        int[] stateImages = {R.drawable.ic_disconnected, R.drawable.ic_connecting, R.drawable.ic_connected, R.drawable.ic_sharing, R.drawable.ic_connecting};

        int state = sharingEngine.getState();
        if (state == Const.STATE_CONNECTED && adminName != null) {
            imageViewConnStatus.setImageDrawable(getDrawable(stateImages[Const.STATE_SHARING]));
            textViewConnStatus.setText(stateLabels[Const.STATE_SHARING]);
        } else {
            imageViewConnStatus.setImageDrawable(getDrawable(stateImages[state]));
            textViewConnStatus.setText(stateLabels[state]);
        }
        String serverUrl = Utils.prepareDisplayUrl(settingsHelper.getString(SettingsHelper.KEY_SERVER_URL));

        textViewSendLink.setVisibility(state == Const.STATE_CONNECTED ? View.VISIBLE : View.INVISIBLE);
        textViewConnect.setVisibility(state == Const.STATE_DISCONNECTED ? View.VISIBLE : View.INVISIBLE);
        switch (state) {
            case Const.STATE_DISCONNECTED:
                editTextSessionId.setText("");
                editTextPassword.setText("");
                if (sharingEngine.getErrorReason() != null) {
                    textViewComment.setText(getString(R.string.hint_connection_error, serverUrl));
                }
                break;
            case Const.STATE_CONNECTING:
                textViewComment.setText(getString(R.string.hint_connecting, serverUrl));
                break;
            case Const.STATE_DISCONNECTING:
                textViewComment.setText(getString(R.string.hint_disconnecting));
                break;
            case Const.STATE_CONNECTED:
                editTextSessionId.setText(sessionId);
                editTextPassword.setText(password);
                textViewComment.setText(adminName != null ?
                        getString(R.string.hint_sharing, adminName) :
                        getString(R.string.hint_connected, serverUrl)
                        );
                break;
        }
    }

    private void setDefaultSettings() {
        if (settingsHelper.getString(SettingsHelper.KEY_DEVICE_NAME) == null) {
            settingsHelper.setString(SettingsHelper.KEY_DEVICE_NAME, Build.MANUFACTURER + " " + Build.MODEL);
        }
        if (settingsHelper.getInt(SettingsHelper.KEY_BITRATE) == 0) {
            settingsHelper.setInt(SettingsHelper.KEY_BITRATE, Const.DEFAULT_BITRATE);
        }
        if (settingsHelper.getInt(SettingsHelper.KEY_FRAME_RATE) == 0) {
            settingsHelper.setInt(SettingsHelper.KEY_FRAME_RATE, Const.DEFAULT_FRAME_RATE);
        }
        if (settingsHelper.getInt(SettingsHelper.KEY_IDLE_TIMEOUT) == 0) {
            settingsHelper.setInt(SettingsHelper.KEY_IDLE_TIMEOUT, Const.DEFAULT_IDLE_TIMEOUT);
        }
        if (settingsHelper.getInt(SettingsHelper.KEY_PING_TIMEOUT) == 0) {
            settingsHelper.setInt(SettingsHelper.KEY_PING_TIMEOUT, Const.DEFAULT_PING_TIMEOUT);
        }
    }

    private void sendLink() {
        String url = settingsHelper.getString(SettingsHelper.KEY_SERVER_URL);
        url += "?session=" + sessionId + "&pin=" + password;
        try {
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("text/plain");
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, getString(R.string.send_link_subject));
            String shareMessage= getString(R.string.send_link_message, url, settingsHelper.getString(SettingsHelper.KEY_DEVICE_NAME));
            shareIntent.putExtra(Intent.EXTRA_TEXT, shareMessage);
            startActivity(Intent.createChooser(shareIntent, getString(R.string.send_link_chooser)));
        } catch(Exception e) {
            e.printStackTrace();
            Toast.makeText(this, R.string.send_link_failed, Toast.LENGTH_LONG).show();
        }
    }

    private void showAbout() {
        ImageView imageView = new ImageView(this);
        imageView.setImageDrawable(getResources().getDrawable(R.mipmap.ic_launcher));
        new AlertDialog.Builder(this)
                .setTitle(R.string.about_title)
                .setMessage(getString(R.string.about_message, BuildConfig.VERSION_NAME, BuildConfig.VARIANT))
                .setPositiveButton(R.string.ok, (dialog, which) -> dialog.dismiss())
                .create()
                .show();
    }

    private void connect() {
        if (sessionId == null || password == null) {
            if (shouldFetchMdmSession()) {
                final int fetchId = ++sessionFetchGeneration;
                Log.i(Const.LOG_TAG, "Fetching remote session credentials from MDM");
                MdmSessionFetcher.fetch(settingsHelper, (fetchedSessionId, fetchedPassword, error) -> handler.post(() -> {
                    if (fetchId != sessionFetchGeneration) {
                        return;
                    }
                    if (fetchedSessionId != null && fetchedPassword != null) {
                        sessionId = fetchedSessionId;
                        password = fetchedPassword;
                        connectWithCredentials();
                        return;
                    }
                    // Credentials may have arrived via launcher intent while the fetch was in flight.
                    if (sessionId != null && password != null) {
                        Log.i(Const.LOG_TAG, "MDM session fetch failed after credentials arrived via intent, connecting");
                        connectWithCredentials();
                        return;
                    }
                    if (isEngineBusyOrConnected()) {
                        Log.w(Const.LOG_TAG, "Ignoring MDM session fetch failure while already connected: " + error);
                        return;
                    }
                    Log.w(Const.LOG_TAG, "MDM session fetch failed: " + error);
                    String message = getString(R.string.connection_error,
                            settingsHelper.getString(SettingsHelper.KEY_SERVER_URL),
                            error != null ? error : getString(R.string.state_disconnected));
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
                }));
                return;
            }
            sessionId = Utils.randomString(8, true);
            password = Utils.randomString(4, true);
        }
        connectWithCredentials();
    }

    private boolean isEngineBusyOrConnected() {
        int state = sharingEngine.getState();
        return state == Const.STATE_CONNECTING
                || state == Const.STATE_CONNECTED
                || state == Const.STATE_SHARING;
    }

    private boolean shouldFetchMdmSession() {
        return settingsHelper.getBoolean(SettingsHelper.KEY_AUTO_CONNECT, false)
                && settingsHelper.getString(SettingsHelper.KEY_MDM_DEVICE_NUMBER) != null
                && settingsHelper.getString(SettingsHelper.KEY_MDM_SERVER_URL) != null;
    }

    private boolean tryReconnectAfterIceFailure() {
        if (sessionId == null || password == null) {
            return false;
        }
        if (!settingsHelper.getBoolean(SettingsHelper.KEY_AUTO_CONNECT, false)) {
            return false;
        }
        if (iceFailureReconnectAttempts >= ICE_FAILURE_RECONNECT_MAX) {
            return false;
        }
        iceFailureReconnectAttempts++;
        Log.i(Const.LOG_TAG, "ICE failed, auto-reconnect attempt " + iceFailureReconnectAttempts);
        adminName = null;
        sharingActive = false;
        lastShareStartMs = 0;
        ScreenSharingHelper.stopSharing(this, false);
        int engineState = sharingEngine.getState();
        Runnable reconnect = () -> reconnectExistingSession();
        if (engineState != Const.STATE_DISCONNECTED && engineState != Const.STATE_DISCONNECTING) {
            sharingEngine.disconnect(this, (success, errorReason) -> handler.postDelayed(reconnect, 1000));
        } else {
            sharingEngine.setState(Const.STATE_DISCONNECTED);
            handler.postDelayed(reconnect, 1000);
        }
        return true;
    }

    private void reconnectExistingSession() {
        screenCaptureRequestPending = false;
        screenCaptureConsentRetried = false;
        sharingEngine.setUsername(settingsHelper.getString(SettingsHelper.KEY_DEVICE_NAME));
        sharingEngine.connect(this, sessionId, password, (success, errorReason) -> {
            if (!success) {
                Log.w(Const.LOG_TAG, "ICE reconnect failed: " + errorReason);
                MdmReporter.reportAgentStatus(settingsHelper, sessionId, "failed");
            } else {
                MdmReporter.reportAgentStatus(settingsHelper, sessionId, "connected");
            }
        });
        scheduleExitOnIdle();
    }

    private void connectWithCredentials() {
        screenCaptureGranted = false;
        screenCaptureRequestPending = false;
        screenCaptureConsentRetried = false;
        screenCaptureResultData = null;
        sharingActive = false;
        lastShareStartMs = 0;
        sharingEngine.setUsername(settingsHelper.getString(SettingsHelper.KEY_DEVICE_NAME));
        sharingEngine.connect(this, sessionId, password, (success, errorReason) -> {
            if (!success) {
                String message = getString(R.string.connection_error, settingsHelper.getString(SettingsHelper.KEY_SERVER_URL), errorReason);
                Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
                editTextSessionId.setText(null);
                editTextPassword.setText(null);
                MdmReporter.reportAgentStatus(settingsHelper, sessionId, "failed");
            } else {
                MdmReporter.reportAgentStatus(settingsHelper, sessionId, "connected");
            }
        });

        scheduleExitOnIdle();
    }

    @Override
    public void onStartSharing(String adminName) {
        // This event is raised when the admin joins the text room
        Log.i(Const.LOG_TAG, "Admin joined textroom, starting screen share request, admin=" + adminName);
        cancelPendingStopSharing();
        this.adminName = adminName;
        updateUI();
        cancelExitOnIdle();
        scheduleSharingTimeout();
        MdmReporter.reportAgentStatus(settingsHelper, sessionId, "sharing");
        // Browser join/leave/rejoin after share already started must not re-prompt consent
        // (token was consumed on first start; a second dialog is what makes "first attempt fail").
        if (isScreenShareRunning()) {
            Log.i(Const.LOG_TAG, "Screen share already active, skipping consent on admin rejoin");
            return;
        }
        if (screenCaptureGranted && screenCaptureResultData != null) {
            consumeAndStartSharing(screenCaptureResultCode, screenCaptureResultData);
        } else if (screenCaptureGranted) {
            // Consent flag without Intent — cannot reuse; ask again.
            clearScreenCaptureConsent();
            requestScreenCapturePermission();
        } else {
            requestScreenCapturePermission();
        }
    }

    @Override
    public void onStopSharing() {
        // ICE restart / DataChannel backlog can deliver join+leave in one burst while consent is open.
        // Stopping here clears adminName and kills ScreenSharingService before RTP is configured again.
        if (screenCaptureRequestPending) {
            Log.w(Const.LOG_TAG, "Ignoring admin leave while MediaProjection consent is pending");
            return;
        }
        // Browser often joins then briefly leaves/rejoins; destroying MediaProjection mid-start
        // forces a new consent, and reusing the same Intent crashes on Android 14+.
        if (lastShareStartMs > 0
                && System.currentTimeMillis() - lastShareStartMs < SHARE_START_GRACE_MS) {
            Log.w(Const.LOG_TAG, "Ignoring admin leave during share-start grace window");
            return;
        }
        // Debounce leave: ICE reconnect can flush join then leave; a real disconnect still stops.
        if (pendingStopSharingRunnable == null) {
            pendingStopSharingRunnable = new Runnable() {
                @Override
                public void run() {
                    pendingStopSharingRunnable = null;
                    stopSharingAfterAdminLeft();
                }
            };
            handler.postDelayed(pendingStopSharingRunnable, SHARE_LEAVE_DEBOUNCE_MS);
            Log.w(Const.LOG_TAG, "Admin leave debounced, will stop in "
                    + SHARE_LEAVE_DEBOUNCE_MS + "ms unless admin rejoins");
        }
    }

    private void cancelPendingStopSharing() {
        if (pendingStopSharingRunnable != null) {
            handler.removeCallbacks(pendingStopSharingRunnable);
            pendingStopSharingRunnable = null;
            Log.d(Const.LOG_TAG, "Cancelled pending share stop (admin rejoined)");
        }
    }

    private void stopSharingAfterAdminLeft() {
        sharingActive = false;
        clearScreenCaptureConsent();
        lastShareStartMs = 0;
        notifySharingStop();
        adminName = null;
        updateUI();
        cancelSharingTimeout();
        scheduleExitOnIdle();
        MdmReporter.reportAgentStatus(settingsHelper, sessionId, "stopped");
        ScreenSharingHelper.stopSharing(this, true);
    }

    @Override
    public void onRemoteControlEvent(String event) {
        Intent intent = new Intent(MainActivity.this, GestureDispatchService.class);
        intent.setAction(Const.ACTION_GESTURE);
        intent.putExtra(Const.EXTRA_EVENT, event);
        startService(intent);
    }

    @Override
    public void onPing() {
        if (adminName != null) {
            cancelSharingTimeout();
            scheduleSharingTimeout();
        }
    }

    @Override
    public void onSharingApiStateChanged(int state) {
        updateUI();
        if (state == Const.STATE_CONNECTED) {
            iceFailureReconnectAttempts = 0;
            String rtpHost = Utils.getRtpUrl(settingsHelper.getString(SettingsHelper.KEY_SERVER_URL));
            int rtpAudioPort = sharingEngine.getAudioPort();
            int rtpVideoPort = sharingEngine.getVideoPort();
            String testDstIp = settingsHelper.getString(SettingsHelper.KEY_TEST_DST_IP);
            if (testDstIp != null && !testDstIp.trim().equals("")) {
                rtpHost = testDstIp;
                rtpVideoPort = Const.TEST_RTP_PORT;
                Toast.makeText(this, "Test mode: sending stream to " + rtpHost + ":" + rtpVideoPort, Toast.LENGTH_LONG).show();
            }

            ScreenSharingHelper.configure(this, settingsHelper.getBoolean(SettingsHelper.KEY_TRANSLATE_AUDIO),
                    settingsHelper.getInt(SettingsHelper.KEY_FRAME_RATE),
                    settingsHelper.getInt(SettingsHelper.KEY_BITRATE),
                    rtpHost,
                    rtpAudioPort,
                    rtpVideoPort
                    );
            // Ask for MediaProjection as soon as Janus is ready so the dialog is not racing
            // admin join through a flaky TextRoom ICE reconnect.
            prepareScreenCapturePermission();
        }
    }

    private void scheduleExitOnIdle() {
        int exitOnIdleTimeout = settingsHelper.getInt(SettingsHelper.KEY_IDLE_TIMEOUT);
        if (exitOnIdleTimeout > 0) {
            exitCounter = EXIT_PROMPT_SEC;
            handler.postDelayed(warningOnIdleRunnable, exitOnIdleTimeout * 1000);
            Log.d(Const.LOG_TAG, "Scheduling exit in " + exitOnIdleTimeout + " sec");
        }
    }

    private void cancelExitOnIdle() {
        Log.d(Const.LOG_TAG, "Cancelling scheduled exit");
        handler.removeCallbacks(warningOnIdleRunnable);
        handler.removeCallbacks(exitRunnable);
    }

    private Runnable exitRunnable = () -> {
        exitCounter--;
        if (exitCounter > 0) {
            TextView messageView = exitOnIdleDialog.findViewById(android.R.id.message);
            if (messageView != null) {
                messageView.setText(MainActivity.this.getResources().getString(R.string.app_idle_warning, exitCounter));
            }
            scheduleExitRunnable();

        } else {
            gracefulExit();
        }
    };

    private Runnable warningOnIdleRunnable = () -> {
         exitOnIdleDialog = new AlertDialog.Builder(MainActivity.this)
                .setMessage(MainActivity.this.getResources().getString(R.string.app_idle_warning, exitCounter))
                .setPositiveButton(R.string.button_exit, (dialog1, which) -> {
                    gracefulExit();
                })
                .setNegativeButton(R.string.button_keep_idle, (dialog1, which) -> {
                    scheduleExitOnIdle();
                    handler.removeCallbacks(exitRunnable);
                    dialog1.dismiss();
                })
                .setCancelable(false)
                .create();
        exitOnIdleDialog.show();
        scheduleExitRunnable();
    };

    private void scheduleExitRunnable() {
        handler.postDelayed(exitRunnable, 1000);
    }

    private void scheduleSharingTimeout() {
        int pingTimeout = settingsHelper.getInt(SettingsHelper.KEY_PING_TIMEOUT);
        if (pingTimeout > 0) {
            Log.d(Const.LOG_TAG, "Scheduling sharing stop in " + (pingTimeout * 1000) + " sec");
            handler.postDelayed(sharingStopByPingTimeoutRunnable, pingTimeout * 1000);
        }
    }

    private void cancelSharingTimeout() {
        Log.d(Const.LOG_TAG, "Cancelling scheduled sharing stop");
        handler.removeCallbacks(sharingStopByPingTimeoutRunnable);
    }

    private Runnable sharingStopByPingTimeoutRunnable = new Runnable() {
        @Override
        public void run() {
            Toast.makeText(MainActivity.this, R.string.app_sharing_session_ping_timeout, Toast.LENGTH_LONG).show();
            if (adminName != null) {
                notifySharingStop();
                ScreenSharingHelper.stopSharing(MainActivity.this, false);
            }
            adminName = null;
            updateUI();
            cancelSharingTimeout();
            scheduleExitOnIdle();
            sharingEngine.disconnect(MainActivity.this, (success, errorReason) -> connect());
        }
    };

    private Runnable overlayDotRunnable = new Runnable() {
        @Override
        public void run() {
            if (overlayDotDirection == 0) {
                return;
            }
            overlayDotAlpha += OVERLAY_DOT_ANIMATION_INCREMENT * overlayDotDirection;
            if (overlayDotAlpha > 255) {
                overlayDotAlpha = 255;
                overlayDotDirection = -overlayDotDirection;
            }
            if (overlayDotAlpha < 128) {
                overlayDotAlpha = 128;
                overlayDotDirection = -overlayDotDirection;
            }
            overlayDot.setImageAlpha(overlayDotAlpha);
            handler.postDelayed(overlayDotRunnable, OVERLAY_DOT_ANIMATION_DELAY);
        }
    };

    private void notifySharingStart() {
        notifyGestureService(Const.ACTION_SCREEN_SHARING_START);
        if (settingsHelper.getBoolean(SettingsHelper.KEY_NOTIFY_SHARING)) {
            // Show a flashing dot
            Utils.lockDeviceRotation(this, true);
            overlayDot = createOverlayDot();
            overlayDotAlpha = 0;
            overlayDotDirection = 1;
            handler.postDelayed(overlayDotRunnable, OVERLAY_DOT_ANIMATION_DELAY);

        } else {
            // Just show some dialog to trigger the traffic
            final AlertDialog dialog = new AlertDialog.Builder(MainActivity.this)
                    .setMessage(R.string.share_start_text)
                    .setPositiveButton(R.string.ok, (dialog1, which) -> dialog1.dismiss())
                    .create();
            dialog.show();
            handler.postDelayed(() -> {
                if (dialog != null && dialog.isShowing()) {
                    try {
                        dialog.dismiss();
                    } catch (Exception e) {
                    }
                }
            }, 3000);
        }
    }

    private void notifySharingStop() {
        notifyGestureService(Const.ACTION_SCREEN_SHARING_STOP);
        if (settingsHelper.getBoolean(SettingsHelper.KEY_NOTIFY_SHARING)) {
            overlayDotDirection = 0;
            if (overlayDot != null) {
                WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
                wm.removeView(overlayDot);
                overlayDot = null;
            }
            Utils.lockDeviceRotation(this, false);
        }
    }

    private void notifyGestureService(String action) {
        Intent intent = new Intent(MainActivity.this, GestureDispatchService.class);
        intent.setAction(action);
        startService(intent);
    }

    public ImageView createOverlayDot() {
        int size = getResources().getDimensionPixelOffset(R.dimen.overlay_dot_size);
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(size, size,
                Utils.OverlayWindowType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        |WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        |WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.LEFT | Gravity.TOP;
        params.x = getResources().getDimensionPixelOffset(R.dimen.overlay_dot_offset);
        params.y = getResources().getDimensionPixelOffset(R.dimen.overlay_dot_offset);

        ImageView view = new ImageView(this);
        view.setImageResource(R.drawable.flash_dot);
        view.setImageAlpha(0);
        WindowManager wm = (WindowManager)getSystemService(Context.WINDOW_SERVICE);
        wm.addView(view, params);
        return view;
    }
}
