package com.hmdm.control;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.AsyncTask;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.view.Surface;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import net.majorkernelpanic.streaming.rtp.AbstractPacketizer;
import net.majorkernelpanic.streaming.rtp.H264Packetizer;
import net.majorkernelpanic.streaming.rtp.MediaCodecInputStream;

import java.io.IOException;
import java.net.InetAddress;

public class ScreenSharingService extends Service {
    public static String CHANNEL_ID = "com.hmdm.control";
    private static final int NOTIFICATION_ID = 111;

    private static final String MIME_TYPE_VIDEO = "video/avc";

    private int mScreenDensity;
    private int mScreenWidth;
    private int mScreenHeight;

    private boolean mRecordAudio;
    private String mRtpHost;
    private int mRtpAudioPort;
    private int mRtpVideoPort;
    private int mVideoFrameRate;
    private int mVideoBitrate;

    private MediaProjectionManager mProjectionManager;
    private MediaProjection mMediaProjection;
    private MediaProjection.Callback mMediaProjectionCallback;
    private VirtualDisplay mVirtualDisplay;

    private MediaCodec mMediaCodec;
    private Surface mInputSurface;

    private AbstractPacketizer mPacketizer;
    private boolean foregroundStarted = false;

    /** Guards start/stop races when admin join/leave arrive in the same DataChannel burst. */
    private final Object sharingLock = new Object();
    private volatile boolean stopRequested;
    private int sharingGeneration;

    private final Handler mKeyframeHandler = new Handler(Looper.getMainLooper());
    private int mKeyframeRequestCount = 0;
    private static final int KEYFRAME_BURST_COUNT = 8;
    private static final long KEYFRAME_BURST_INTERVAL_MS = 500;
    private static final long KEYFRAME_STEADY_INTERVAL_MS = 2000;
    private Runnable mPendingVirtualDisplayStart;
    private final Runnable mKeyframeRunnable = new Runnable() {
        @Override
        public void run() {
            requestSyncFrame();
            mKeyframeRequestCount++;
            long delay = mKeyframeRequestCount < KEYFRAME_BURST_COUNT
                    ? KEYFRAME_BURST_INTERVAL_MS
                    : KEYFRAME_STEADY_INTERVAL_MS;
            mKeyframeHandler.postDelayed(this, delay);
        }
    };

    public static final String ACTION_SET_METRICS = "metrics";
    public static final String ACTION_CONFIGURE = "configure";
    public static final String ACTION_REQUEST_SHARING = "request";
    public static final String ACTION_START_SHARING = "start";
    public static final String ACTION_STOP_SHARING = "stop";
    public static final String ATTR_SCREEN_WIDTH = "screenWidth";
    public static final String ATTR_SCREEN_HEIGHT = "screenHeight";
    public static final String ATTR_SCREEN_DENSITY = "screenDensity";
    public static final String ATTR_AUDIO = "audio";
    public static final String ATTR_FRAME_RATE = "frameRate";
    public static final String ATTR_BITRATE = "bitrate";
    public static final String ATTR_HOST = "host";
    public static final String ATTR_AUDIO_PORT = "audioPort";
    public static final String ATTR_VIDEO_PORT = "videoPort";
    public static final String ATTR_RESULT_CODE = "resultCode";
    public static final String ATTR_DATA = "data";
    public static final String ATTR_DESTROY_MEDIA_PROJECTION = "destroyMediaProjection";

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        Log.d(Const.LOG_TAG, "ScreenSharingService created");
        mPacketizer = new H264Packetizer();
        mProjectionManager = (MediaProjectionManager)getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        loadPersistedMetrics();
    }

    private void ensureForeground() {
        if (foregroundStarted) {
            return;
        }
        startAsForeground();
        foregroundStarted = true;
    }

    private void startAsForeground() {
        NotificationCompat.Builder builder;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Notification Channel", NotificationManager.IMPORTANCE_DEFAULT);
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            notificationManager.createNotificationChannel(channel);
            builder = new NotificationCompat.Builder(this, CHANNEL_ID);
        } else {
            builder = new NotificationCompat.Builder(this);
        }
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, Const.REQUEST_FROM_NOTIFICATION, intent, pendingFlags);
        Notification notification = builder
                .setContentTitle(getString(R.string.app_name))
                .setTicker(getString(R.string.app_name))
                .setContentText(getString(R.string.notification_text))
                .setContentIntent(pendingIntent)
                .setSmallIcon(R.drawable.ic_notification).build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            return Service.START_NOT_STICKY;
        }
        String action = intent.getAction();
        Log.d(Const.LOG_TAG, "ScreenSharingService got command: " + action);
        if (action.equals(ACTION_SET_METRICS)) {
            applyMetrics(intent);
            Log.d(Const.LOG_TAG, "ScreenSharingService: width=" + mScreenWidth + ", height=" + mScreenHeight + ", density=" + mScreenDensity);

        } else if (action.equals(ACTION_CONFIGURE)) {
            configure(intent.getBooleanExtra(ATTR_AUDIO, false),
                    intent.getIntExtra(ATTR_FRAME_RATE, 0),
                    intent.getIntExtra(ATTR_BITRATE, 0),
                    intent.getStringExtra(ATTR_HOST),
                    intent.getIntExtra(ATTR_AUDIO_PORT, 0),
                    intent.getIntExtra(ATTR_VIDEO_PORT, 0));

        } else if (action.equals(ACTION_REQUEST_SHARING)) {
            applyMetrics(intent);
            requestSharing();

        } else if (action.equals(ACTION_START_SHARING)) {
            // Must promote to FGS before any work that can block or throw (DNS, MediaProjection).
            ensureForeground();
            applyMetrics(intent);
            int resultCode = intent.getIntExtra(ATTR_RESULT_CODE, 0);
            Intent data = intent.getParcelableExtra(ATTR_DATA);
            if (resultCode != Activity.RESULT_OK || data == null) {
                Log.w(Const.LOG_TAG, "Ignoring stale screen sharing start, resultCode=" + resultCode);
                stopSelf();
                return Service.START_NOT_STICKY;
            }
            synchronized (sharingLock) {
                stopRequested = false;
                sharingGeneration++;
            }
            startSharing(resultCode, data, sharingGeneration);

        } else if (action.equals(ACTION_STOP_SHARING)) {
            synchronized (sharingLock) {
                stopRequested = true;
                sharingGeneration++;
            }
            // Android 14+: MediaProjection tokens are single-use; always destroy.
            stopSharing(true);
            stopSelf();
        }

        return Service.START_NOT_STICKY;
    }

    private void applyMetrics(Intent intent) {
        int width = intent.getIntExtra(ATTR_SCREEN_WIDTH, 0);
        int height = intent.getIntExtra(ATTR_SCREEN_HEIGHT, 0);
        int density = intent.getIntExtra(ATTR_SCREEN_DENSITY, 0);
        if (width > 0 && height > 0) {
            mScreenWidth = width;
            mScreenHeight = height;
            if (density > 0) {
                mScreenDensity = density;
            }
            ScreenSharingHelper.saveScreenMetrics(this, mScreenWidth, mScreenHeight, mScreenDensity);
        } else {
            loadPersistedMetrics();
        }
        int frameRate = intent.getIntExtra(ATTR_FRAME_RATE, 0);
        int bitrate = intent.getIntExtra(ATTR_BITRATE, 0);
        if (frameRate > 0) {
            mVideoFrameRate = frameRate;
        }
        if (bitrate > 0) {
            mVideoBitrate = bitrate;
        }
    }

    private void loadPersistedMetrics() {
        android.content.SharedPreferences prefs = getSharedPreferences("com.hmdm.control.SCREEN_SHARING", MODE_PRIVATE);
        mScreenWidth = prefs.getInt("screenWidth", mScreenWidth);
        mScreenHeight = prefs.getInt("screenHeight", mScreenHeight);
        mScreenDensity = prefs.getInt("screenDensity", mScreenDensity);
        if (mVideoFrameRate <= 0) {
            mVideoFrameRate = prefs.getInt("frameRate", mVideoFrameRate);
        }
        if (mVideoBitrate <= 0) {
            mVideoBitrate = prefs.getInt("bitrate", mVideoBitrate);
        }
    }

    private void configure(boolean audio, int videoFrameRate, int videoBitRate, String host, int audioPort, int videoPort) {
        mRecordAudio = audio;
        mVideoFrameRate = videoFrameRate;
        mVideoBitrate = videoBitRate;
        mRtpHost = host;
        mRtpAudioPort = audioPort;
        mRtpVideoPort = videoPort;
        Log.d(Const.LOG_TAG, "ScreenSharingService: frameRate=" + mVideoFrameRate
                + ", bitrate=" + mVideoBitrate
                + ", rtp=" + host + ":" + videoPort);

        // Resolve destination off the main thread; startSharing re-applies from prefs if service restarts.
        new AsyncTask<Void, Void, Void>() {
            @Override
            protected Void doInBackground(Void... voids) {
                applyRtpDestination(host, videoPort);
                return null;
            }
        }.execute();
    }

    /**
     * RTP destination lives only in the packetizer instance. After ACTION_STOP_SHARING → stopSelf(),
     * a new service is created and must restore host/port from prefs or configure() is lost and
     * H.264 frames are encoded but never sent — browser stays blank while gestures still work.
     * <p>
     * Prefer a previously resolved IP so this can run on the main thread without DNS
     * (InetAddress.getByName(hostname) throws NetworkOnMainThreadException on Android).
     */
    private boolean applyRtpDestination(String host, int videoPort) {
        if (host == null || host.trim().isEmpty() || videoPort <= 0) {
            Log.e(Const.LOG_TAG, "RTP destination missing: host=" + host + ", videoPort=" + videoPort);
            return false;
        }
        try {
            String trimmed = host.trim();
            // RTCP = videoPort+1 (conventional); RTCP unused, but 0/-1 breaks libstreaming
            InetAddress dest = InetAddress.getByName(trimmed);
            mPacketizer.setDestination(dest, videoPort, videoPort + 1);
            mPacketizer.setTimeToLive(64);
            mRtpHost = trimmed;
            mRtpVideoPort = videoPort;
            String ip = dest.getHostAddress();
            if (ip != null && !ip.equals(trimmed)) {
                ScreenSharingHelper.persistRtpHostIp(this, ip);
            } else if (looksLikeIpLiteral(trimmed)) {
                ScreenSharingHelper.persistRtpHostIp(this, trimmed);
            }
            Log.i(Const.LOG_TAG, "RTP destination set to " + mRtpHost + ":" + mRtpVideoPort
                    + (ip != null ? " (" + ip + ")" : ""));
            return true;
        } catch (Exception e) {
            Log.e(Const.LOG_TAG, "Failed to set RTP destination " + host + ":" + videoPort, e);
            return false;
        }
    }

    private static boolean looksLikeIpLiteral(String host) {
        if (host == null || host.isEmpty()) {
            return false;
        }
        // IPv4 or IPv6 literal — getByName does not hit the network for these.
        return host.indexOf(':') >= 0 || host.matches("^\\d{1,3}(\\.\\d{1,3}){3}$");
    }

    /**
     * @return true if destination is already applied (safe on main thread);
     *         false if DNS is still required (caller must resolve off the main thread).
     */
    private boolean tryEnsureRtpDestinationOnMainThread() {
        int videoPort = mRtpVideoPort;
        if (videoPort <= 0) {
            videoPort = ScreenSharingHelper.getPersistedRtpVideoPort(this);
            mRtpAudioPort = ScreenSharingHelper.getPersistedRtpAudioPort(this);
        }
        String ip = ScreenSharingHelper.getPersistedRtpHostIp(this);
        if (ip != null && !ip.isEmpty() && videoPort > 0) {
            return applyRtpDestination(ip, videoPort);
        }
        String host = mRtpHost;
        if (host == null || host.trim().isEmpty()) {
            host = ScreenSharingHelper.getPersistedRtpHost(this);
        }
        if (host != null && looksLikeIpLiteral(host.trim()) && videoPort > 0) {
            return applyRtpDestination(host.trim(), videoPort);
        }
        return false;
    }

    private boolean resolveAndApplyRtpDestination() {
        String host = mRtpHost;
        int videoPort = mRtpVideoPort;
        if (host == null || host.trim().isEmpty() || videoPort <= 0) {
            host = ScreenSharingHelper.getPersistedRtpHost(this);
            videoPort = ScreenSharingHelper.getPersistedRtpVideoPort(this);
            mRtpAudioPort = ScreenSharingHelper.getPersistedRtpAudioPort(this);
        }
        return applyRtpDestination(host, videoPort);
    }

    private void requestSharing() {
        if (!initRecorder()) {
            // Some initialization error, report to activity
            Intent intent = new Intent(Const.ACTION_SCREEN_SHARING_FAILED);
            intent.putExtra(Const.EXTRA_MESSAGE, getString(R.string.sharing_error));
            LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
            return;
        }
        tryShareScreen();
    }


    private void tryShareScreen() {
        if (mMediaProjection == null) {
            LocalBroadcastManager.getInstance(this).sendBroadcast(new Intent(Const.ACTION_SCREEN_SHARING_PERMISSION_NEEDED));
            return;
        }
        if (mVirtualDisplay != null) {
            LocalBroadcastManager.getInstance(this).sendBroadcast(new Intent(Const.ACTION_SCREEN_SHARING_START));
            return;
        }
        if (tryEnsureRtpDestinationOnMainThread()) {
            mVirtualDisplay = createVirtualDisplay();
            mMediaCodec.start();
            startSending();
            return;
        }
        new AsyncTask<Void, Void, Boolean>() {
            @Override
            protected Boolean doInBackground(Void... voids) {
                return resolveAndApplyRtpDestination();
            }

            @Override
            protected void onPostExecute(Boolean ok) {
                if (!Boolean.TRUE.equals(ok)) {
                    notifySharingFailed();
                    return;
                }
                mVirtualDisplay = createVirtualDisplay();
                mMediaCodec.start();
                startSending();
            }
        }.execute();
    }

    private void startSharing(int resultCode, Intent data, final int generation) {
        if (mVirtualDisplay != null) {
            LocalBroadcastManager.getInstance(this).sendBroadcast(new Intent(Const.ACTION_SCREEN_SHARING_START));
            return;
        }
        if (mScreenWidth <= 0 || mScreenHeight <= 0) {
            loadPersistedMetrics();
        }
        if (mScreenWidth <= 0 || mScreenHeight <= 0) {
            Log.e(Const.LOG_TAG, "Cannot start sharing, invalid screen metrics: "
                    + mScreenWidth + "x" + mScreenHeight);
            notifySharingFailed();
            stopSelf();
            return;
        }
        // FGS already started in onStartCommand; keep calling for re-entry safety.
        ensureForeground();
        if (tryEnsureRtpDestinationOnMainThread()) {
            continueStartSharing(resultCode, data, generation);
            return;
        }
        // Hostname needs DNS — must not run on main (crash → FGS timeout).
        new AsyncTask<Void, Void, Boolean>() {
            @Override
            protected Boolean doInBackground(Void... voids) {
                return resolveAndApplyRtpDestination();
            }

            @Override
            protected void onPostExecute(Boolean ok) {
                if (!Boolean.TRUE.equals(ok)) {
                    notifySharingFailed();
                    stopSelf();
                    return;
                }
                continueStartSharing(resultCode, data, generation);
            }
        }.execute();
    }

    private void continueStartSharing(int resultCode, Intent data, int generation) {
        synchronized (sharingLock) {
            if (stopRequested || generation != sharingGeneration) {
                Log.w(Const.LOG_TAG, "Abort continueStartSharing: stop requested or stale generation");
                return;
            }
            if (mVirtualDisplay != null) {
                LocalBroadcastManager.getInstance(this).sendBroadcast(new Intent(Const.ACTION_SCREEN_SHARING_START));
                return;
            }
            if (!initRecorder()) {
                notifySharingFailed();
                stopSelf();
                return;
            }
            try {
                mMediaProjection = mProjectionManager.getMediaProjection(resultCode, data);
                if (mMediaProjection == null) {
                    Log.e(Const.LOG_TAG, "MediaProjection is null after consent");
                    notifySharingFailed();
                    stopSelf();
                    return;
                }
                mMediaProjectionCallback = new MediaProjection.Callback() {
                    @Override
                    public void onStop() {
                        super.onStop();
                        stopSharing(true);
                        LocalBroadcastManager.getInstance(ScreenSharingService.this)
                                .sendBroadcast(new Intent(Const.ACTION_SCREEN_SHARING_STOP));
                    }
                };
                mMediaProjection.registerCallback(mMediaProjectionCallback, null);
            } catch (SecurityException e) {
                Log.e(Const.LOG_TAG, "MediaProjection token invalid or already used", e);
                destroyMediaProjection();
                notifySharingFailed();
                stopSelf();
                return;
            }
            scheduleVirtualDisplayStart(generation);
        }
    }

    /**
     * On ColorOS, creating AUTO_MIRROR VirtualDisplay immediately after consent can mirror
     * black for the entire session. Delay createVirtualDisplay so the projection link warms up.
     */
    private void scheduleVirtualDisplayStart(final int generation) {
        cancelPendingVirtualDisplayStart();
        final long settleMs = OplusCompat.virtualDisplaySettleDelayMs();
        Runnable startMirror = new Runnable() {
            @Override
            public void run() {
                mPendingVirtualDisplayStart = null;
                synchronized (sharingLock) {
                    if (stopRequested || generation != sharingGeneration) {
                        Log.w(Const.LOG_TAG, "Abort VirtualDisplay start: stop requested or stale generation");
                        return;
                    }
                    if (mVirtualDisplay != null) {
                        LocalBroadcastManager.getInstance(ScreenSharingService.this)
                                .sendBroadcast(new Intent(Const.ACTION_SCREEN_SHARING_START));
                        return;
                    }
                    if (mMediaProjection == null || mInputSurface == null || mMediaCodec == null) {
                        Log.e(Const.LOG_TAG, "Cannot create VirtualDisplay: projection/codec not ready");
                        notifySharingFailed();
                        stopSelf();
                        return;
                    }
                    try {
                        mVirtualDisplay = createVirtualDisplay();
                    } catch (SecurityException e) {
                        Log.e(Const.LOG_TAG, "MediaProjection token invalid or already used", e);
                        destroyMediaProjection();
                        notifySharingFailed();
                        stopSelf();
                        return;
                    } catch (Exception e) {
                        Log.e(Const.LOG_TAG, "createVirtualDisplay failed", e);
                        destroyMediaProjection();
                        notifySharingFailed();
                        stopSelf();
                        return;
                    }
                    mMediaCodec.start();
                    startSending();
                    startKeyframeRequests();
                }
            }
        };
        if (settleMs > 0) {
            Log.i(Const.LOG_TAG, "ColorOS: delaying VirtualDisplay create by " + settleMs
                    + "ms after MediaProjection consent");
            mPendingVirtualDisplayStart = startMirror;
            mKeyframeHandler.postDelayed(startMirror, settleMs);
        } else {
            startMirror.run();
        }
    }

    private void cancelPendingVirtualDisplayStart() {
        if (mPendingVirtualDisplayStart != null) {
            mKeyframeHandler.removeCallbacks(mPendingVirtualDisplayStart);
            mPendingVirtualDisplayStart = null;
        }
    }

    private void notifySharingFailed() {
        Intent intent = new Intent(Const.ACTION_SCREEN_SHARING_FAILED);
        intent.putExtra(Const.EXTRA_MESSAGE, getString(R.string.sharing_error));
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
    }

    public void stopSharing(boolean destroyMediaProjection) {
        cancelPendingVirtualDisplayStart();
        stopKeyframeRequests();
        try {
            if (mPacketizer != null) {
                mPacketizer.stop();
            }
            if (mMediaCodec != null) {
                mMediaCodec.stop();
            }
            Log.v(Const.LOG_TAG, "Stopping Recording");
            stopScreenSharing(destroyMediaProjection);
        } catch (Exception e) {
            e.printStackTrace();
        }
        if (foregroundStarted) {
            stopForeground(true);
            foregroundStarted = false;
        }
    }

    private void stopScreenSharing(boolean destroyMediaProjection) {
        if (mVirtualDisplay != null) {
            mVirtualDisplay.release();
            mVirtualDisplay = null;
        }
        if (mMediaCodec != null) {
            mMediaCodec.release();
            mMediaCodec = null;
        }
        // Always destroy on Android 14+: createVirtualDisplay cannot be called twice
        // on the same MediaProjection, and resultData Intent is single-use.
        if (destroyMediaProjection || Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            destroyMediaProjection();
        }
    }

    private void destroyMediaProjection() {
        if (mMediaProjection != null) {
            try {
                if (mMediaProjectionCallback != null) {
                    mMediaProjection.unregisterCallback(mMediaProjectionCallback);
                }
            } catch (Exception e) {
                Log.w(Const.LOG_TAG, "unregister MediaProjection callback failed", e);
            }
            try {
                mMediaProjection.stop();
            } catch (Exception e) {
                Log.w(Const.LOG_TAG, "MediaProjection.stop failed", e);
            }
            mMediaProjection = null;
            mMediaProjectionCallback = null;
        }
        Log.i(Const.LOG_TAG, "MediaProjection Stopped");
    }

    private void startSending() {
        MediaCodecInputStream mcis = new MediaCodecInputStream(mMediaCodec);
        mPacketizer.setInputStream(mcis);
        mcis.setH264Packetizer((H264Packetizer) mPacketizer);
        mPacketizer.start();
        LocalBroadcastManager.getInstance(this).sendBroadcast(new Intent(Const.ACTION_SCREEN_SHARING_START));
    }

    private void startKeyframeRequests() {
        stopKeyframeRequests();
        mKeyframeRequestCount = 0;
        // Immediate IDR so Janus/browser can decode without waiting for UI motion.
        mKeyframeHandler.post(mKeyframeRunnable);
    }

    private void stopKeyframeRequests() {
        mKeyframeHandler.removeCallbacks(mKeyframeRunnable);
        mKeyframeRequestCount = 0;
    }

    private void requestSyncFrame() {
        if (mMediaCodec == null) {
            return;
        }
        try {
            Bundle params = new Bundle();
            params.putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0);
            mMediaCodec.setParameters(params);
            Log.d(Const.LOG_TAG, "Requested encoder sync frame");
        } catch (Exception e) {
            Log.w(Const.LOG_TAG, "Failed to request sync frame", e);
        }
    }

    private VirtualDisplay createVirtualDisplay() {
        return mMediaProjection.createVirtualDisplay("MainActivity",
                mScreenWidth, mScreenHeight, mScreenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                mInputSurface, null /*Callbacks*/, null
                /*Handler*/);
    }

    private boolean initRecorder() {
        try {
            mMediaCodec = MediaCodec.createEncoderByType(MIME_TYPE_VIDEO);
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }

        MediaFormat mediaFormat = MediaFormat.createVideoFormat(MIME_TYPE_VIDEO, mScreenWidth, mScreenHeight);
        mediaFormat.setInteger(MediaFormat.KEY_BIT_RATE, mVideoBitrate);
        mediaFormat.setInteger(MediaFormat.KEY_FRAME_RATE, mVideoFrameRate);
        mediaFormat.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface);
        // Frequent IDRs: static Realme screens otherwise produce no decodable frame until UI changes.
        mediaFormat.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Repeat last captured frame when the display is idle (no dirty regions).
            mediaFormat.setLong(MediaFormat.KEY_REPEAT_PREVIOUS_FRAME_AFTER, 200_000L);
        }
        // This method call may throw CodecException!
        try {
            mMediaCodec.configure(mediaFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
        } catch (Exception e) {
            Log.e(Const.LOG_TAG, "Failed to configure codec with parameters: screenWidth=" + mScreenWidth +
                    ", screenHeight=" + mScreenHeight + ", bitrate=" + mVideoBitrate + ", frameRate=" + mVideoFrameRate +
                    ", colorFormat=" + MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface + ", frameInterval=1");
            e.printStackTrace();
            return false;
        }
        mInputSurface = mMediaCodec.createInputSurface();
        return true;
    }

}