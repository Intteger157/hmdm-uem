package com.hmdm.control;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Point;
import android.os.Build;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.view.WindowManager;

/**
 * Helper API for interaction between MainActivity and ScreenSharingService
 */
public class ScreenSharingHelper {
    private static final String PREFS = "com.hmdm.control.SCREEN_SHARING";
    private static final String KEY_SCREEN_WIDTH = "screenWidth";
    private static final String KEY_SCREEN_HEIGHT = "screenHeight";
    private static final String KEY_SCREEN_DENSITY = "screenDensity";
    private static final String KEY_FRAME_RATE = "frameRate";
    private static final String KEY_BITRATE = "bitrate";
    private static final String KEY_RTP_HOST = "rtpHost";
    private static final String KEY_RTP_HOST_IP = "rtpHostIp";
    private static final String KEY_RTP_AUDIO_PORT = "rtpAudioPort";
    private static final String KEY_RTP_VIDEO_PORT = "rtpVideoPort";

    // Scale down screen size to reduce the video traffic
    public static float adjustScreenMetrics(DisplayMetrics metrics) {
        int srcWidth = metrics.widthPixels;
        // Adjust translated screencast size for phones with high screen resolutions
        if (metrics.widthPixels > Const.MAX_SHARED_SCREEN_WIDTH || metrics.heightPixels > Const.MAX_SHARED_SCREEN_HEIGHT) {
            float widthScale = (float)metrics.widthPixels / Const.MAX_SHARED_SCREEN_WIDTH;
            float heightScale = (float)metrics.heightPixels / Const.MAX_SHARED_SCREEN_HEIGHT;
            float maxScale = widthScale > heightScale ? widthScale : heightScale;
            metrics.widthPixels /= maxScale;
            metrics.heightPixels /= maxScale;
        }

        float videoScale = (float)metrics.widthPixels / srcWidth;
        Log.i(Const.LOG_TAG, "screenWidth=" + metrics.widthPixels + ", screenHeight=" + metrics.heightPixels + ", scale=" + videoScale);
        // Workaround against the codec bug: https://stackoverflow.com/questions/36915383/what-does-error-code-1010-in-android-mediacodec-mean
        // Making height and width divisible by 2
        metrics.heightPixels = metrics.heightPixels & 0xFFFE;
        metrics.widthPixels = metrics.widthPixels & 0xFFFE;
        return videoScale;
    }

    // getDefaultDisplay() excludes status bar and nav bar, so we need to get the full screen size
    public static void getRealScreenSize(Activity activity, DisplayMetrics metrics) {
        WindowManager wm = ((WindowManager)
                activity.getSystemService(Context.WINDOW_SERVICE));
        Display display = wm.getDefaultDisplay();

        // This gets correct screen density, but wrong width and height
        display.getMetrics(metrics);

        Point screenSize = new Point();
        display.getRealSize(screenSize);
        metrics.widthPixels = screenSize.x;
        metrics.heightPixels = screenSize.y;
    }

    public static void setScreenMetrics(Activity activity, int screenWidth, int screenHeight, int screenDensity) {
        saveScreenMetrics(activity, screenWidth, screenHeight, screenDensity);
        Intent intent = new Intent(activity, ScreenSharingService.class);
        intent.setAction(ScreenSharingService.ACTION_SET_METRICS);
        intent.putExtra(ScreenSharingService.ATTR_SCREEN_WIDTH, screenWidth);
        intent.putExtra(ScreenSharingService.ATTR_SCREEN_HEIGHT, screenHeight);
        intent.putExtra(ScreenSharingService.ATTR_SCREEN_DENSITY, screenDensity);
        executeCommand(activity, intent);
    }

    public static void saveScreenMetrics(Context context, int screenWidth, int screenHeight, int screenDensity) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putInt(KEY_SCREEN_WIDTH, screenWidth)
                .putInt(KEY_SCREEN_HEIGHT, screenHeight)
                .putInt(KEY_SCREEN_DENSITY, screenDensity)
                .apply();
    }

    public static void applyPersistedMetrics(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        intent.putExtra(ScreenSharingService.ATTR_SCREEN_WIDTH, prefs.getInt(KEY_SCREEN_WIDTH, 0));
        intent.putExtra(ScreenSharingService.ATTR_SCREEN_HEIGHT, prefs.getInt(KEY_SCREEN_HEIGHT, 0));
        intent.putExtra(ScreenSharingService.ATTR_SCREEN_DENSITY, prefs.getInt(KEY_SCREEN_DENSITY, 0));
        intent.putExtra(ScreenSharingService.ATTR_FRAME_RATE, prefs.getInt(KEY_FRAME_RATE, 0));
        intent.putExtra(ScreenSharingService.ATTR_BITRATE, prefs.getInt(KEY_BITRATE, 0));
    }

    public static void configure(Activity activity, boolean audio, int videoFrameRate, int videoBitRate, String host, int audioPort, int videoPort) {
        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putInt(KEY_FRAME_RATE, videoFrameRate)
                .putInt(KEY_BITRATE, videoBitRate)
                .putString(KEY_RTP_HOST, host)
                .remove(KEY_RTP_HOST_IP)
                .putInt(KEY_RTP_AUDIO_PORT, audioPort)
                .putInt(KEY_RTP_VIDEO_PORT, videoPort)
                .apply();
        Intent intent = new Intent(activity, ScreenSharingService.class);
        intent.setAction(ScreenSharingService.ACTION_CONFIGURE);
        intent.putExtra(ScreenSharingService.ATTR_AUDIO, audio);
        intent.putExtra(ScreenSharingService.ATTR_FRAME_RATE, videoFrameRate);
        intent.putExtra(ScreenSharingService.ATTR_BITRATE, videoBitRate);
        intent.putExtra(ScreenSharingService.ATTR_HOST, host);
        intent.putExtra(ScreenSharingService.ATTR_AUDIO_PORT, audioPort);
        intent.putExtra(ScreenSharingService.ATTR_VIDEO_PORT, videoPort);
        executeCommand(activity, intent);
    }

    public static String getPersistedRtpHost(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_RTP_HOST, null);
    }

    public static String getPersistedRtpHostIp(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_RTP_HOST_IP, null);
    }

    public static void persistRtpHostIp(Context context, String ip) {
        if (ip == null || ip.isEmpty()) {
            return;
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_RTP_HOST_IP, ip)
                .apply();
    }

    public static int getPersistedRtpVideoPort(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_RTP_VIDEO_PORT, 0);
    }

    public static int getPersistedRtpAudioPort(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_RTP_AUDIO_PORT, 0);
    }

    public static void requestSharing(Activity activity) {
        Intent intent = new Intent(activity, ScreenSharingService.class);
        intent.setAction(ScreenSharingService.ACTION_REQUEST_SHARING);
        applyPersistedMetrics(activity, intent);
        executeCommand(activity, intent);
    }

    public static void startSharing(Activity activity, int resultCode, Intent data) {
        Intent intent = new Intent(activity, ScreenSharingService.class);
        intent.setAction(ScreenSharingService.ACTION_START_SHARING);
        intent.putExtra(ScreenSharingService.ATTR_RESULT_CODE, resultCode);
        intent.putExtra(ScreenSharingService.ATTR_DATA, data);
        applyPersistedMetrics(activity, intent);
        executeCommand(activity, intent);
    }

    public static void stopSharing(Activity activity, boolean finalStop) {
        Intent intent = new Intent(activity, ScreenSharingService.class);
        intent.setAction(ScreenSharingService.ACTION_STOP_SHARING);
        intent.putExtra(ScreenSharingService.ATTR_DESTROY_MEDIA_PROJECTION, finalStop);
        executeCommand(activity, intent);
    }

    private static void executeCommand(Activity activity, Intent intent) {
        String action = intent.getAction();
        boolean needsForeground = ScreenSharingService.ACTION_START_SHARING.equals(action);
        if (needsForeground && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            activity.startForegroundService(intent);
        } else {
            activity.startService(intent);
        }
    }
}
