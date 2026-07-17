package com.hmdm.control;

import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MdmSessionFetcher {

    public interface Callback {
        void onResult(String sessionId, String password, String error);
    }

    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final int FETCH_RETRIES = 5;
    private static final int FETCH_RETRY_DELAY_MS = 2000;

    private MdmSessionFetcher() {
    }

    public static void fetch(SettingsHelper settingsHelper, Callback callback) {
        if (settingsHelper == null || callback == null) {
            return;
        }
        final String deviceNumber = settingsHelper.getString(SettingsHelper.KEY_MDM_DEVICE_NUMBER);
        final String serverUrl = settingsHelper.getString(SettingsHelper.KEY_MDM_SERVER_URL);
        final String serverProject = settingsHelper.getString(SettingsHelper.KEY_MDM_SERVER_PROJECT);
        if (deviceNumber == null || serverUrl == null) {
            callback.onResult(null, null, "MDM device number or server URL not configured");
            return;
        }

        EXECUTOR.execute(() -> fetchAttempt(settingsHelper, deviceNumber, serverUrl, serverProject, 0, callback));
    }

    private static void fetchAttempt(SettingsHelper settingsHelper,
                                     String deviceNumber,
                                     String serverUrl,
                                     String serverProject,
                                     int attempt,
                                     Callback callback) {
        HttpURLConnection connection = null;
        String endpoint = MdmApiUrls.buildRestUrl(
                serverUrl,
                serverProject,
                "/plugins/deviceremote/public/session/" + deviceNumber);
        try {
            Log.i(Const.LOG_TAG, "MDM session fetch attempt " + (attempt + 1) + "/" + FETCH_RETRIES
                    + " url=" + endpoint
                    + " baseUrl=" + serverUrl
                    + " project=" + (serverProject != null ? serverProject : "")
                    + " device=" + deviceNumber);

            URL url = new URL(endpoint);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(15000);

            int code = connection.getResponseCode();
            BufferedReader reader = new BufferedReader(new InputStreamReader(
                    code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream(),
                    StandardCharsets.UTF_8));
            StringBuilder responseBody = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                responseBody.append(line);
            }
            reader.close();
            String body = responseBody.toString();

            if (code < 200 || code >= 300) {
                Log.w(Const.LOG_TAG, "MDM session fetch failed: HTTP " + code
                        + " url=" + endpoint
                        + " body=" + body);
                if (shouldRetry(code, attempt)) {
                    Thread.sleep(FETCH_RETRY_DELAY_MS);
                    fetchAttempt(settingsHelper, deviceNumber, serverUrl, serverProject, attempt + 1, callback);
                    return;
                }
                callback.onResult(null, null, "HTTP " + code);
                return;
            }

            JSONObject root = new JSONObject(body);
            if (!"OK".equalsIgnoreCase(root.optString("status"))) {
                String message = root.optString("message", "MDM session unavailable");
                Log.w(Const.LOG_TAG, "MDM session fetch rejected: " + message + " url=" + endpoint + " body=" + body);
                if (shouldRetryMessage(message, attempt)) {
                    Thread.sleep(FETCH_RETRY_DELAY_MS);
                    fetchAttempt(settingsHelper, deviceNumber, serverUrl, serverProject, attempt + 1, callback);
                    return;
                }
                callback.onResult(null, null, message);
                return;
            }
            JSONObject data = root.optJSONObject("data");
            if (data == null) {
                callback.onResult(null, null, "Empty MDM session response");
                return;
            }
            String sessionId = data.optString("sessionId", null);
            String password = data.optString("password", null);
            if (sessionId == null || sessionId.isEmpty() || password == null || password.isEmpty()) {
                Log.w(Const.LOG_TAG, "MDM session credentials missing in response url=" + endpoint + " body=" + body);
                if (attempt + 1 < FETCH_RETRIES) {
                    Thread.sleep(FETCH_RETRY_DELAY_MS);
                    fetchAttempt(settingsHelper, deviceNumber, serverUrl, serverProject, attempt + 1, callback);
                    return;
                }
                callback.onResult(null, null, "MDM session credentials missing");
                return;
            }
            Log.i(Const.LOG_TAG, "Fetched MDM remote session " + sessionId + " from " + endpoint);
            callback.onResult(sessionId, password, null);
        } catch (Exception e) {
            Log.w(Const.LOG_TAG, "Failed to fetch MDM session from " + endpoint + ": " + e.getMessage());
            if (attempt + 1 < FETCH_RETRIES) {
                try {
                    Thread.sleep(FETCH_RETRY_DELAY_MS);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
                fetchAttempt(settingsHelper, deviceNumber, serverUrl, serverProject, attempt + 1, callback);
                return;
            }
            callback.onResult(null, null, e.getMessage());
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private static boolean shouldRetry(int httpCode, int attempt) {
        return attempt + 1 < FETCH_RETRIES && (httpCode == 404 || httpCode == 502 || httpCode == 503);
    }

    private static boolean shouldRetryMessage(String message, int attempt) {
        if (attempt + 1 >= FETCH_RETRIES || message == null) {
            return false;
        }
        String lower = message.toLowerCase();
        return lower.contains("no active remote session")
                || lower.contains("notfound")
                || lower.contains("not found");
    }
}
