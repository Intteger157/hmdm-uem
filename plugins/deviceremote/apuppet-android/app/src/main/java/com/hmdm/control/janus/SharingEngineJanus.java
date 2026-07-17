package com.hmdm.control.janus;

import android.content.Context;
import android.os.AsyncTask;
import android.os.Handler;

import com.hmdm.control.Const;
import com.hmdm.control.SharingEngine;
import com.hmdm.control.janus.server.JanusServerApi;
import com.hmdm.control.janus.server.JanusServerApiFactory;

public class SharingEngineJanus extends SharingEngine {
    private static final int OP_CANCELLED = -1;

    private JanusServerApi apiInstance;

    private JanusSession janusSession;
    private JanusTextRoomPlugin janusTextRoomPlugin;
    private JanusStreamingPlugin janusStreamingPlugin;

    private Handler handler = new Handler();
    private volatile int connectToken = 0;

    private boolean isConnectActive(int token) {
        return token == connectToken;
    }

    private void stopActiveSession(Context context) {
        JanusTextRoomPlugin textRoom = janusTextRoomPlugin;
        JanusSession session = janusSession;
        janusSession = null;
        janusStreamingPlugin = null;
        janusTextRoomPlugin = null;
        // Close PeerConnection immediately so stale ICE FAILED from the old PC
        // cannot fire CONNECTION_FAILURE after a soft reconnect has started.
        if (textRoom != null) {
            textRoom.disposePeerConnection();
        }
        if (context != null && session != null) {
            session.stopPolling(context.getApplicationContext());
        }
    }

    @Override
    public void connect(final Context context, final String sessionId, final String password, final CompletionHandler completionHandler) {
        try {
            JanusServerApiFactory.resetApiInstance();
            apiInstance = JanusServerApiFactory.getApiInstance(context);
        } catch (Exception e) {
            e.printStackTrace();
            completionHandler.onComplete(false, "Wrong server URL");
            return;
        }

        if (state != Const.STATE_DISCONNECTED) {
            completionHandler.onComplete(false, "Not disconnected");
            return;
        }

        final int token = ++connectToken;
        stopActiveSession(context);
        this.sessionId = sessionId;
        this.password = password;
        setState(Const.STATE_CONNECTING);

        final JanusSession session = new JanusSession();
        session.init(context);
        janusSession = session;

        // This must be initialized in the main thread because it uses a handler to run commands in UI thread
        final JanusTextRoomPlugin textRoomPlugin = new JanusTextRoomPlugin();
        janusTextRoomPlugin = textRoomPlugin;

        // Start Janus connection flow
        new AsyncTask<Void, Void, Integer>() {
            @Override
            protected Integer doInBackground(Void... voids) {
                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }

                int result = session.create();
                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }
                if (result != Const.SUCCESS) {
                    errorReason = session.getErrorReason();
                    return result;
                }

                session.startPolling(context);

                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }

                textRoomPlugin.init(context);
                result = session.attachPlugin(textRoomPlugin);
                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }
                if (result != Const.SUCCESS) {
                    return result;
                }

                textRoomPlugin.setDataChannelReadyCallback(() ->
                        dataChannelCreated(context, token, session, textRoomPlugin, completionHandler));

                // The successful flow is continued after WebRTC data channel is ready
                textRoomPlugin.createPeerConnection(new EventListener() {
                            @Override
                            public void onStartSharing(String username) {
                                // Send screen resolution before starting sharing
                                textRoomPlugin.sendMessage(screenResolutionMessage(), false);
                                if (eventListener != null) {
                                    eventListener.onStartSharing(username);
                                }
                            }

                            @Override
                            public void onStopSharing() {
                                if (eventListener != null) {
                                    eventListener.onStopSharing();
                                }
                            }

                            @Override
                            public void onPing() {
                                if (eventListener != null) {
                                    eventListener.onPing();
                                }
                            }

                            @Override
                            public void onRemoteControlEvent(String event) {
                                if (eventListener != null) {
                                    eventListener.onRemoteControlEvent(event);
                                }
                            }
                        });

                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }

                if (textRoomPlugin.getPeerConnection() == null) {
                    errorReason = textRoomPlugin.getErrorReason();
                    return Const.INTERNAL_ERROR;
                }

                // Completion handler is needed here to handle errors
                textRoomPlugin.setupRtcSession((success, errorReason) -> {
                    if (!isConnectActive(token)) {
                        return;
                    }
                    handler.post(() -> completionHandler.onComplete(false, errorReason));
                });

                return Const.SUCCESS;
            }

            @Override
            protected void onPostExecute(Integer result) {
                if (result == OP_CANCELLED) {
                    return;
                }
                if (result != Const.SUCCESS) {
                    setState(Const.STATE_DISCONNECTED);
                    completionHandler.onComplete(false, errorReason);
                    if (isConnectActive(token)) {
                        ++connectToken;
                        stopActiveSession(context);
                        resetFields();
                    }
                }
                // On success, the flow is continued in createPeerConnection when data channel is created
            }
        }.execute();
    }

    private void dataChannelCreated(Context context, int token, JanusSession session,
                                    JanusTextRoomPlugin textRoomPlugin, CompletionHandler completionHandler) {
        new AsyncTask<Void, Void, Integer>() {

            @Override
            protected Integer doInBackground(Void... voids) {
                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }

                int result = textRoomPlugin.createRoom(SharingEngineJanus.this.sessionId, SharingEngineJanus.this.password);
                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }
                if (result != Const.SUCCESS) {
                    return result;
                }

                result = textRoomPlugin.joinRoom("device:" + username, username);
                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }
                if (result != Const.SUCCESS) {
                    return result;
                }

                // Streaming
                JanusStreamingPlugin streamingPlugin = new JanusStreamingPlugin();
                streamingPlugin.init(context);
                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }

                janusStreamingPlugin = streamingPlugin;
                result = session.attachPlugin(streamingPlugin);
                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }
                if (result != Const.SUCCESS) {
                    return result;
                }

                result = streamingPlugin.create(SharingEngineJanus.this.sessionId, SharingEngineJanus.this.password, isAudio());

                return result;
            }

            @Override
            protected void onPostExecute(Integer result) {
                if (result == OP_CANCELLED) {
                    return;
                }
                if (result != Const.SUCCESS) {
                    setState(Const.STATE_DISCONNECTED);
                    if (errorReason == null && textRoomPlugin != null) {
                        errorReason = textRoomPlugin.getErrorReason();
                    }
                    if (errorReason == null && janusStreamingPlugin != null) {
                        errorReason = janusStreamingPlugin.getErrorReason();
                    }
                    completionHandler.onComplete(false, errorReason);
                    if (isConnectActive(token)) {
                        ++connectToken;
                        stopActiveSession(context);
                        resetFields();
                    }
                } else {
                    setState(Const.STATE_CONNECTED);
                    completionHandler.onComplete(true, null);
                }
            }
        }.execute();
    }

    @Override
    public void disconnect(final Context context, final CompletionHandler completionHandler) {
        final int token = ++connectToken;
        errorReason = null;
        setState(Const.STATE_DISCONNECTING);

        // Invalidate PC immediately (before async Janus destroy) so soft-reconnect
        // cannot race with stale ICE FAILED from the old PeerConnection.
        JanusTextRoomPlugin textRoom = janusTextRoomPlugin;
        if (textRoom != null) {
            textRoom.disposePeerConnection();
        }

        final JanusSession session = janusSession;

        new AsyncTask<Void, Void, Integer>() {
            @Override
            protected Integer doInBackground(Void... voids) {
                if (!isConnectActive(token)) {
                    return OP_CANCELLED;
                }
                // Registered plugins are destroyed in janusSession.destroy()
                if (session != null) {
                    session.destroy();
                }
                return Const.SUCCESS;
            }

            @Override
            protected void onPostExecute(Integer result) {
                if (result == OP_CANCELLED) {
                    return;
                }
                if (session != null) {
                    session.stopPolling(context.getApplicationContext());
                }
                // Not really fair, but it's unclear how to handle destroying errors!
                setState(Const.STATE_DISCONNECTED);
                if (isConnectActive(token)) {
                    stopActiveSession(context);
                    resetFields();
                }
                completionHandler.onComplete(result == Const.SUCCESS, errorReason);
            }
        }.execute();

    }

    private void resetFields() {
        sessionId = null;
        password = null;
    }

    /**
     * TextRoom WebRTC is up and DataChannel is open — safe for the browser to join.
     */
    public boolean isControlChannelHealthy() {
        JanusTextRoomPlugin plugin = janusTextRoomPlugin;
        return plugin != null && plugin.isControlChannelHealthy();
    }

    @Override
    public int getAudioPort() {
        if (janusStreamingPlugin != null) {
            return janusStreamingPlugin.getAudioPort();
        }
        return 0;
    }

    @Override
    public int getVideoPort() {
        if (janusStreamingPlugin != null) {
            return janusStreamingPlugin.getVideoPort();
        }
        return 0;
    }

    private String screenResolutionMessage() {
        return "streamingVideoResolution," + screenWidth + "," + screenHeight;
    }
}
