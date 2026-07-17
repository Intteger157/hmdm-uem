package com.hmdm.control;

import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MdmReporter {

    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    private MdmReporter() {
    }

    public static void reportAgentStatus(SettingsHelper settingsHelper, String sessionId, String agentStatus) {
        if (settingsHelper == null) {
            return;
        }
        final String deviceNumber = settingsHelper.getString(SettingsHelper.KEY_MDM_DEVICE_NUMBER);
        final String serverUrl = settingsHelper.getString(SettingsHelper.KEY_MDM_SERVER_URL);
        final String serverProject = settingsHelper.getString(SettingsHelper.KEY_MDM_SERVER_PROJECT);
        if (deviceNumber == null || serverUrl == null) {
            return;
        }

        EXECUTOR.execute(() -> {
            HttpURLConnection connection = null;
            try {
                String endpoint = MdmApiUrls.buildRestUrl(
                        serverUrl,
                        serverProject,
                        "/plugins/deviceremote/public/status/" + deviceNumber);
                Log.d(Const.LOG_TAG, "MDM remote status report url=" + endpoint);
                URL url = new URL(endpoint);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                String payload = "{\"sessionId\":\"" + escape(sessionId) + "\",\"agentStatus\":\"" + escape(agentStatus) + "\"}";
                OutputStream os = connection.getOutputStream();
                os.write(payload.getBytes(StandardCharsets.UTF_8));
                os.flush();
                os.close();
                int code = connection.getResponseCode();
                Log.d(Const.LOG_TAG, "MDM remote status report HTTP " + code);
            } catch (Exception e) {
                Log.w(Const.LOG_TAG, "Failed to report remote status to MDM: " + e.getMessage());
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
