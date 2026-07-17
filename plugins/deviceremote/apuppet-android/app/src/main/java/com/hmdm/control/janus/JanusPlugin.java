package com.hmdm.control.janus;

import android.content.Context;

import com.hmdm.control.janus.json.JanusPollResponse;
import com.hmdm.control.janus.server.JanusServerApi;
import com.hmdm.control.janus.server.JanusServerApiFactory;

public abstract class JanusPlugin {
    protected JanusServerApi apiInstance;
    protected String secret;
    protected String sessionId;
    protected String handleId;
    protected String errorReason;

    protected JanusPollResponse pollingEvent;
    protected final Object pollingEventLock = new Object();

    private Runnable dataChannelReadyCallback;

    public String getHandleId() {
        return handleId;
    }

    public String getErrorReason() {
        return errorReason;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public void setHandleId(String handleId) {
        this.handleId = handleId;
    }

    public void init(Context context) {
        apiInstance = JanusServerApiFactory.getApiInstance(context);
        secret = JanusServerApiFactory.getSecret(context);
    }

    public void onWebRtcUp(final Context context) {
    }

    public void onPollingEvent(JanusPollResponse event) {
        synchronized (pollingEventLock) {
            pollingEvent = event;
            pollingEventLock.notifyAll();
        }
    }

    public void setDataChannelReadyCallback(Runnable callback) {
        dataChannelReadyCallback = callback;
    }

    protected void clearPollingEvent() {
        synchronized (pollingEventLock) {
            pollingEvent = null;
        }
    }

    protected boolean waitForPollingEvent(long timeoutMs) {
        synchronized (pollingEventLock) {
            long deadline = System.currentTimeMillis() + timeoutMs;
            while (pollingEvent == null) {
                long remaining = deadline - System.currentTimeMillis();
                if (remaining <= 0) {
                    errorReason = "Timeout waiting for Janus event";
                    return false;
                }
                try {
                    pollingEventLock.wait(remaining);
                } catch (InterruptedException e) {
                    errorReason = "Interrupted";
                    Thread.currentThread().interrupt();
                    return false;
                }
            }
            return true;
        }
    }

    protected void notifyDataChannelReady() {
        if (dataChannelReadyCallback != null) {
            dataChannelReadyCallback.run();
        }
    }

    public abstract String getName();
    public abstract int destroy();
}
