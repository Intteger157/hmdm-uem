package com.hmdm.inventory;

public final class Const {
    public static final String LOG_TAG = "com.hmdm.inventory";
    public static final String PUSH_TYPE_INVENTORY_SCAN = "inventoryScan";
    public static final long SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000L;
    public static final String ACTION_SCAN = "com.hmdm.inventory.ACTION_SCAN";

    /** Optional API key from launcher configuration (leave empty if not set). */
    public static final String API_KEY = "";

    private Const() {
    }
}
