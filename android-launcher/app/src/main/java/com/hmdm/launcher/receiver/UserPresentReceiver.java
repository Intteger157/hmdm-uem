/*
 * Headwind MDM: Open Source Android MDM Software
 * https://h-mdm.com
 *
 * Copyright (C) 2019 Headwind Solutions LLC (http://h-sms.com)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.hmdm.launcher.receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.hmdm.launcher.Const;
import com.hmdm.launcher.helper.ConfigUpdater;
import com.hmdm.launcher.helper.SettingsHelper;
import com.hmdm.launcher.util.RemoteLogger;

/**
 * Sync configuration immediately when the user unlocks the device
 * (keyguard dismissed / USER_PRESENT).
 */
public class UserPresentReceiver extends BroadcastReceiver {

    private static long lastSyncAtMs = 0L;
    private static final long MIN_INTERVAL_MS = 5_000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }
        if (!Intent.ACTION_USER_PRESENT.equals(intent.getAction())
                && !"android.intent.action.USER_UNLOCKED".equals(intent.getAction())) {
            return;
        }

        SettingsHelper settingsHelper = SettingsHelper.getInstance(context);
        if (settingsHelper == null || !settingsHelper.isBaseUrlSet() || settingsHelper.getConfig() == null) {
            return;
        }

        long now = System.currentTimeMillis();
        if (now - lastSyncAtMs < MIN_INTERVAL_MS) {
            Log.d(Const.LOG_TAG, "UserPresentReceiver: skipping duplicate sync");
            return;
        }
        lastSyncAtMs = now;

        RemoteLogger.log(context, Const.LOG_DEBUG, "User unlock: requesting configuration update");
        ConfigUpdater.notifyConfigUpdate(context);
    }
}
