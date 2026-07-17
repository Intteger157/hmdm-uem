/*

 * Intermark MDM: remote control integration for Headwind Remote (aPuppet).

 */



package com.hmdm.launcher.util;



import android.content.ComponentName;

import android.content.Context;

import android.content.Intent;

import android.content.pm.PackageManager;

import android.os.Build;

import android.util.Log;



import com.hmdm.launcher.Const;

import com.hmdm.launcher.helper.SettingsHelper;

import com.hmdm.launcher.json.ServerConfig;



import java.util.ArrayList;

import java.util.List;



public class RemoteControlHelper {



    public static final String EXTRA_SESSION_ID = "remoteSessionId";

    public static final String EXTRA_PASSWORD = "remotePassword";

    public static final String EXTRA_SERVER_URL = "remoteServerUrl";

    public static final String EXTRA_SECRET = "remoteSecret";

    public static final String EXTRA_AUTO_CONNECT = "autoConnect";

    public static final String EXTRA_MDM_DEVICE_NUMBER = "mdmDeviceNumber";



    private RemoteControlHelper() {

    }



    public static boolean isAgentInstalled(Context context) {

        try {

            context.getPackageManager().getPackageInfo(Const.APUPPET_PACKAGE_NAME, 0);

            return true;

        } catch (PackageManager.NameNotFoundException e) {

            return false;

        }

    }



    public static void prepareAgent(Context context, String appPermissionStrategy) {

        if (!isAgentInstalled(context)) {

            Log.w(Const.LOG_TAG, "Remote control agent is not installed: " + Const.APUPPET_PACKAGE_NAME);

            return;

        }

        if (!Utils.isDeviceOwner(context) && !com.hmdm.launcher.BuildConfig.SYSTEM_PRIVILEGES) {

            return;

        }

        Utils.autoGrantRequestedPermissions(context, Const.APUPPET_PACKAGE_NAME, appPermissionStrategy, false);

        try {

            SystemUtils.autoSetOverlayPermission(context, Const.APUPPET_PACKAGE_NAME);

            enableAccessibilityService(context, Const.APUPPET_PACKAGE_NAME, Const.APUPPET_SERVICE_CLASS_NAME);

        } catch (Exception e) {

            Log.w(Const.LOG_TAG, "Failed to prepare remote control agent permissions: " + e.getMessage());

        }

    }



    public static boolean startAgent(Context context, ServerConfig config) {

        if (config == null || config.getRemoteControlSessionId() == null) {

            return false;

        }

        if (!isAgentInstalled(context)) {

            RemoteLogger.log(context, Const.LOG_WARN, "Remote control agent not installed");

            return false;

        }



        prepareAgent(context, config.getAppPermissions());



        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(Const.APUPPET_PACKAGE_NAME);

        if (launchIntent == null) {

            RemoteLogger.log(context, Const.LOG_WARN, "Cannot launch remote control agent");

            return false;

        }



        launchIntent.putExtra(EXTRA_SESSION_ID, config.getRemoteControlSessionId());

        launchIntent.putExtra(EXTRA_PASSWORD, config.getRemoteControlPassword());

        if (config.getRemoteControlServerUrl() != null) {

            launchIntent.putExtra(EXTRA_SERVER_URL, config.getRemoteControlServerUrl());

        }

        if (config.getRemoteControlSecret() != null) {

            launchIntent.putExtra(EXTRA_SECRET, config.getRemoteControlSecret());

        }

        launchIntent.putExtra(EXTRA_AUTO_CONNECT, true);

        launchIntent.putExtra(EXTRA_MDM_DEVICE_NUMBER, SettingsHelper.getInstance(context).getDeviceId());

        launchIntent.putExtra("mdmServerUrl", SettingsHelper.getInstance(context).getBaseUrl());

        launchIntent.putExtra("mdmServerProject", SettingsHelper.getInstance(context).getServerProject() != null

                ? SettingsHelper.getInstance(context).getServerProject() : "");

        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);



        try {

            context.startActivity(launchIntent);

            RemoteLogger.log(context, Const.LOG_INFO, "Remote control agent started");

            return true;

        } catch (Exception e) {

            RemoteLogger.log(context, Const.LOG_WARN, "Failed to start remote control agent: " + e.getMessage());

            return false;

        }

    }



    public static void stopAgent(Context context) {

        if (!isAgentInstalled(context)) {

            return;

        }

        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(Const.APUPPET_PACKAGE_NAME);

        if (launchIntent == null) {

            return;

        }

        launchIntent.putExtra(EXTRA_AUTO_CONNECT, false);

        launchIntent.putExtra("stopRemote", true);

        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);

        try {

            context.startActivity(launchIntent);

        } catch (Exception e) {

            Log.w(Const.LOG_TAG, "Failed to stop remote control agent: " + e.getMessage());

        }

    }



    private static void enableAccessibilityService(Context context, String packageName, String className) {

        if (!Utils.isDeviceOwner(context)) {

            return;

        }

        String flatName = packageName + "/" + className;

        try {

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

                android.app.admin.DevicePolicyManager dpm = (android.app.admin.DevicePolicyManager)

                        context.getSystemService(Context.DEVICE_POLICY_SERVICE);

                ComponentName admin = LegacyUtils.getAdminComponentName(context);

                List<String> permitted = buildPermittedAccessibilityPackages(dpm, admin, packageName);

                boolean permittedResult = dpm.setPermittedAccessibilityServices(admin, permitted);

                Log.i(Const.LOG_TAG, "setPermittedAccessibilityServices(" + permitted + ") => " + permittedResult);

                if (!permittedResult) {

                    dpm.setPermittedAccessibilityServices(admin, null);

                    Log.i(Const.LOG_TAG, "Reset permitted accessibility services to allow all packages");

                }

            }

            if (SystemUtils.autoSetAccessibilityPermission(context, packageName, className)) {

                Log.i(Const.LOG_TAG, "Accessibility enabled for remote control agent");

                RemoteLogger.log(context, Const.LOG_INFO, "Accessibility enabled for remote control agent");

            } else {

                Log.w(Const.LOG_TAG, "Accessibility service not enabled after auto-set: " + flatName);

                RemoteLogger.log(context, Const.LOG_WARN,

                        "Failed to enable accessibility for remote control agent (grant WRITE_SECURE_SETTINGS to launcher?)");

            }

        } catch (Exception e) {

            Log.w(Const.LOG_TAG, "Failed to enable accessibility for remote agent: " + e.getMessage());

            RemoteLogger.log(context, Const.LOG_WARN,

                    "Failed to enable accessibility for remote agent: " + e.getMessage());

        }

    }



    private static List<String> buildPermittedAccessibilityPackages(

            android.app.admin.DevicePolicyManager dpm,

            ComponentName admin,

            String packageName) {

        List<String> permitted = new ArrayList<>();

        permitted.add(packageName);

        List<String> current = dpm.getPermittedAccessibilityServices(admin);

        if (current != null) {

            for (String pkg : current) {

                if (pkg != null && !permitted.contains(pkg)) {

                    permitted.add(pkg);

                }

            }

        }

        return permitted;

    }

}


