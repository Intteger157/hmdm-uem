package com.hmdm.inventory;

import android.app.Activity;
import android.os.Bundle;

/**
 * Headwind MDM "Run at boot" launches the main activity. It starts the inventory service and exits.
 */
public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        InventoryService.start(this);
        finish();
    }
}
