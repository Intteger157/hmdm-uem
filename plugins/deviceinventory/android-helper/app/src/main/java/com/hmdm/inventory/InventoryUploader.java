package com.hmdm.inventory;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class InventoryUploader {

    private InventoryUploader() {
    }

    public static boolean upload(String serverUrl, String deviceId, JSONArray applications) {
        if (serverUrl == null || deviceId == null || deviceId.isEmpty()) {
            Log.w(Const.LOG_TAG, "Upload skipped: server or deviceId missing");
            return false;
        }

        try {
            String base = serverUrl.endsWith("/") ? serverUrl : serverUrl + "/";
            String endpoint = base + "rest/plugins/deviceinventory/public/upload";
            String hash = CryptoUtil.md5(deviceId + BuildConfig.REQUEST_SIGNATURE);

            JSONObject body = new JSONObject();
            body.put("deviceId", deviceId);
            body.put("hash", hash);
            body.put("applications", applications);

            HttpURLConnection conn = (HttpURLConnection) new URL(endpoint).openConnection();
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(60000);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setDoOutput(true);

            byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload);
            }

            int code = conn.getResponseCode();
            BufferedReader reader = new BufferedReader(new InputStreamReader(
                    code >= 400 ? conn.getErrorStream() : conn.getInputStream(),
                    StandardCharsets.UTF_8));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();

            Log.i(Const.LOG_TAG, "Upload to " + endpoint + " HTTP " + code
                    + " apps=" + applications.length() + " response=" + response);
            return code >= 200 && code < 300;
        } catch (Exception e) {
            Log.e(Const.LOG_TAG, "Upload failed", e);
            return false;
        }
    }
}
