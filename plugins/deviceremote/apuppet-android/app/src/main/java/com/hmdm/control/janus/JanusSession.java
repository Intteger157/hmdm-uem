package com.hmdm.control.janus;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.util.Log;

import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.hmdm.control.Const;
import com.hmdm.control.ServerApiHelper;
import com.hmdm.control.janus.json.JanusAttachRequest;
import com.hmdm.control.janus.json.JanusPollResponse;
import com.hmdm.control.janus.json.JanusRequest;
import com.hmdm.control.janus.json.JanusResponse;
import com.hmdm.control.janus.server.JanusServerApi;
import com.hmdm.control.janus.server.JanusServerApiFactory;

import java.util.HashMap;
import java.util.Map;

import retrofit2.Response;

public class JanusSession {
    private JanusServerApi apiInstance;
    private String secret;
    private String sessionId;
    private String errorReason;
    private Map<String,JanusPlugin> pluginMap = new HashMap<>();

    public void init(Context context) {
        apiInstance = JanusServerApiFactory.getApiInstance(context);
        secret = JanusServerApiFactory.getSecret(context);
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getErrorReason() {
        return errorReason;
    }

    private BroadcastReceiver pollServiceReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String event = intent.getStringExtra(Const.EXTRA_EVENT);
            if (Const.EXTRA_WEBRTCUP.equalsIgnoreCase(event)) {
                for (JanusPlugin plugin : pluginMap.values()) {
                    plugin.onWebRtcUp(context);
                }
                return;
            }
            if (!Const.EXTRA_EVENT.equalsIgnoreCase(event)) {
                return;
            }

            JanusPollResponse message = (JanusPollResponse) intent.getSerializableExtra(Const.EXTRA_MESSAGE);
            if (message == null) {
                return;
            }

            JanusPlugin target = null;
            String sender = message.getSender();
            if (sender != null) {
                for (JanusPlugin plugin : pluginMap.values()) {
                    if (sender.equals(plugin.getHandleId())) {
                        target = plugin;
                        break;
                    }
                }
            }
            if (target == null && message.getPlugindata() != null) {
                target = pluginMap.get(message.getPlugindata().getPlugin());
            }
            if (target == null && message.getJsep() != null && pluginMap.size() == 1) {
                target = pluginMap.values().iterator().next();
            }
            if (target != null) {
                target.onPollingEvent(message);
            } else {
                Log.w(Const.LOG_TAG, "Ignored Janus poll event for unknown handle: " + message);
            }
        }
    };

    // Must be run in the background thread
    public int create() {
        errorReason = null;
        Response<JanusResponse> response = ServerApiHelper.execute(apiInstance.createSession(new JanusRequest(secret, "create", true)), "create session");
        if (response == null) {
            errorReason = "Network error";
            return Const.NETWORK_ERROR;
        }
        if (response.body() != null && response.body().getJanus().equalsIgnoreCase("success") && response.body().getData() != null) {
            sessionId = response.body().getData().getId();
        } else {
            errorReason = "Server error";
            Log.w(Const.LOG_TAG, "Wrong server response: " + response.code());
            return Const.SERVER_ERROR;
        }
        Log.i(Const.LOG_TAG, "Created Janus session, id=" + sessionId);
        return Const.SUCCESS;
    }

    public int attachPlugin(JanusPlugin plugin) {
        JanusAttachRequest attachRequest = new JanusAttachRequest(secret, plugin.getName());
        Response<JanusResponse> response = ServerApiHelper.execute(apiInstance.attachPlugin(sessionId, attachRequest), "attach textroom");
        if (response == null) {
            errorReason = "Network error";
            return Const.NETWORK_ERROR;
        }
        if (response.body() != null && response.body().getJanus().equalsIgnoreCase("success") && response.body().getData() != null) {
            plugin.setHandleId(response.body().getData().getId());
            plugin.setSessionId(sessionId);
            pluginMap.put(plugin.getName(), plugin);
            Log.i(Const.LOG_TAG, "Attached plugin " + plugin.getName() + ", handle_id=" + plugin.getHandleId());
       } else {
            errorReason = "Server error";
            Log.w(Const.LOG_TAG, "Wrong server response: " + response.body().toString());
            return Const.SERVER_ERROR;
        }
        return Const.SUCCESS;

    }

    public void startPolling(Context context) {
        LocalBroadcastManager.getInstance(context).registerReceiver(
                pollServiceReceiver, new IntentFilter(Const.ACTION_JANUS_SESSION_POLL));
        Intent intent = new Intent(context, JanusSessionPollService.class);
        intent.putExtra(Const.EXTRA_SESSION, sessionId);
        context.startService(intent);
    }

    public void stopPolling(Context context) {
        Intent intent = new Intent(context, JanusSessionPollService.class);
        context.stopService(intent);
        try {
            LocalBroadcastManager.getInstance(context).unregisterReceiver(pollServiceReceiver);
        } catch (Exception e) {
            // IllegalArgumentException: receiver not registered
            e.printStackTrace();
        }
    }

    // Must be run in the background thread
    public int destroy() {
        for (Map.Entry<String,JanusPlugin> entry : pluginMap.entrySet()) {
            entry.getValue().destroy();
        }

        Response<JanusResponse> response = ServerApiHelper.execute(apiInstance.destroySession(sessionId, new JanusRequest(secret, "destroy", true)), "create session");
        sessionId = null;
        if (response == null) {
            errorReason = "Network error";
            return Const.NETWORK_ERROR;
        }
        return Const.SUCCESS;
    }
}
