package com.hmdm.control;

import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MdmReporter {

    public interface Callback {
        void onResult(boolean ok, String message);
    }

    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    private MdmReporter() {
    }

    public static void reportAgentStatus(SettingsHelper settingsHelper, String sessionId, String agentStatus) {
        reportAgentStatus(settingsHelper, sessionId, agentStatus, null);
    }

    public static void reportAgentStatus(SettingsHelper settingsHelper, String sessionId, String agentStatus,
                                         Callback callback) {
        if (settingsHelper == null) {
            if (callback != null) {
                callback.onResult(false, "settingsHelper is null");
            }
            return;
        }
        final String deviceNumber = settingsHelper.getString(SettingsHelper.KEY_MDM_DEVICE_NUMBER);
        final String serverUrl = settingsHelper.getString(SettingsHelper.KEY_MDM_SERVER_URL);
        final String serverProject = settingsHelper.getString(SettingsHelper.KEY_MDM_SERVER_PROJECT);
        if (deviceNumber == null || serverUrl == null) {
            if (callback != null) {
                callback.onResult(false, "MDM device number or server URL not configured");
            }
            return;
        }

        EXECUTOR.execute(() -> {
            HttpURLConnection connection = null;
            try {
                String endpoint = MdmApiUrls.buildRestUrl(
                        serverUrl,
                        serverProject,
                        "/plugins/deviceremote/public/status/" + deviceNumber);
                Log.d(Const.LOG_TAG, "MDM remote status report url=" + endpoint
                        + " sessionId=" + sessionId + " agentStatus=" + agentStatus);
                URL url = new URL(endpoint);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                String payload = "{\"sessionId\":\"" + escape(sessionId) + "\",\"agentStatus\":\""
                        + escape(agentStatus) + "\"}";
                OutputStream os = connection.getOutputStream();
                os.write(payload.getBytes(StandardCharsets.UTF_8));
                os.flush();
                os.close();
                int code = connection.getResponseCode();
                String body = readBody(connection, code);
                Log.d(Const.LOG_TAG, "MDM remote status report HTTP " + code + " body=" + body);

                boolean ok = code >= 200 && code < 300;
                String message = null;
                if (body != null && !body.isEmpty()) {
                    try {
                        JSONObject json = new JSONObject(body);
                        String status = json.optString("status", "");
                        message = json.optString("message", null);
                        if ("ERROR".equalsIgnoreCase(status)) {
                            ok = false;
                        }
                    } catch (Exception ignored) {
                        // Non-JSON body — rely on HTTP code only.
                    }
                }
                if (callback != null) {
                    callback.onResult(ok, message);
                }
            } catch (Exception e) {
                Log.w(Const.LOG_TAG, "Failed to report remote status to MDM: " + e.getMessage());
                if (callback != null) {
                    callback.onResult(false, e.getMessage());
                }
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    private static String readBody(HttpURLConnection connection, int code) {
        InputStream stream = null;
        try {
            stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) {
                return "";
            }
            BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        } finally {
            if (stream != null) {
                try {
                    stream.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
