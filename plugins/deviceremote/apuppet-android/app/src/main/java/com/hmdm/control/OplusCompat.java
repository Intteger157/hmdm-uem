package com.hmdm.control;

import android.os.Build;
import android.util.Log;
import android.view.View;

import java.lang.reflect.Method;
import java.util.Locale;

/**
 * Compatibility helpers for Oplus/ColorOS framework hooks.
 */
public final class OplusCompat {

    private static final String TAG = "MDM";

    /**
     * ColorOS/OPPO: first AUTO_MIRROR VirtualDisplay created immediately after
     * MediaProjection consent often mirrors black for the whole session; waiting
     * lets the projection link attach to the default display (StreamPack / CPH2173).
     */
    private static final long VIRTUAL_DISPLAY_SETTLE_MS = 800L;

    private OplusCompat() {
    }

    public static boolean isOplusFamily() {
        String manufacturer = safeLower(Build.MANUFACTURER);
        String brand = safeLower(Build.BRAND);
        if (containsOplusToken(manufacturer) || containsOplusToken(brand)) {
            return true;
        }
        try {
            Class.forName("com.oplus.os.OplusBuild");
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    /**
     * Delay before {@code MediaProjection.createVirtualDisplay} on ColorOS family.
     * Returns 0 on other devices.
     */
    public static long virtualDisplaySettleDelayMs() {
        return isOplusFamily() ? VIRTUAL_DISPLAY_SETTLE_MS : 0L;
    }

    private static boolean containsOplusToken(String value) {
        return value.contains("oppo")
                || value.contains("realme")
                || value.contains("oneplus")
                || value.contains("oplus");
    }

    private static String safeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.US);
    }

    /**
     * Best-effort call into Oplus ViewRootImpl GC suppression hook.
     * Safe on non-Oplus devices and when the hook is unavailable.
     */
    public static void callGcSupression(View view) {
        try {
            if (view == null) {
                return;
            }
            Method getViewRootImpl = View.class.getDeclaredMethod("getViewRootImpl");
            getViewRootImpl.setAccessible(true);
            Object viewRootImpl = getViewRootImpl.invoke(view);
            if (viewRootImpl == null) {
                return;
            }
            Method gcMethod = viewRootImpl.getClass().getDeclaredMethod("callGcSupression");
            gcMethod.setAccessible(true);
            gcMethod.invoke(viewRootImpl);
        } catch (Exception e) {
            Log.w(TAG, "GC suppression skipped");
        }
    }
}
