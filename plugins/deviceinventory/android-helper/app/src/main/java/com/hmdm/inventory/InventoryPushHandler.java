package com.hmdm.inventory;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.hmdm.MDMPushHandler;
import com.hmdm.MDMPushMessage;

public class InventoryPushHandler extends MDMPushHandler {

    @Override
    public void onMessageReceived(MDMPushMessage message) {
        if (message == null || message.getType() == null) {
            return;
        }
        if (Const.PUSH_TYPE_INVENTORY_SCAN.equals(message.getType())) {
            Log.i(Const.LOG_TAG, "Push received: inventoryScan");
            Context context = InventoryService.getAppContext();
            if (context != null) {
                Intent intent = new Intent(context, InventoryService.class);
                intent.setAction(Const.ACTION_SCAN);
                context.startService(intent);
            }
        }
    }
}
