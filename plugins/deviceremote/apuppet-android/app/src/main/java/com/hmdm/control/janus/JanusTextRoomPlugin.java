package com.hmdm.control.janus;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.util.Log;

import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.hmdm.control.Const;
import com.hmdm.control.ServerApiHelper;
import com.hmdm.control.SharingEngine;
import com.hmdm.control.Utils;
import com.hmdm.control.janus.json.JanusJsepRequest;
import com.hmdm.control.janus.json.JanusMessageRequest;
import com.hmdm.control.janus.json.JanusPollResponse;
import com.hmdm.control.janus.json.JanusResponse;
import com.hmdm.control.janus.json.JanusTrickleRequest;
import com.hmdm.control.janus.json.Jsep;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.webrtc.DataChannel;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.RtpReceiver;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import retrofit2.Response;

public class JanusTextRoomPlugin extends JanusPlugin {

    private static final String DATA_CHANNEL_LABEL = "JanusDataChannel";
    private static final long DC_KEEPALIVE_INTERVAL_MS = 4000L;

    private String roomId;
    private String password;
    private String pendingJoinUsername;
    private PeerConnectionFactory peerConnectionFactory;
    private PeerConnection peerConnection;
    private DataChannel dataChannel;
    private boolean joined;
    private SharingEngine.EventListener eventListener;

    private boolean dcResult;
    private boolean dcResultReceived;
    private Object dcResultLock = new Object();
    private final Object dcOpenLock = new Object();
    private volatile boolean dataChannelOpen;
    private volatile boolean webRtcUp;
    private volatile boolean iceConnected;
    private volatile boolean dataChannelReadyNotified;
    private volatile boolean iceRestartAttempted;
    private volatile boolean iceRestartInProgress;
    /** True after teardown — ignore stale PeerConnection ICE callbacks from a disposed session. */
    private volatile boolean disposed;

    private Handler handler = new Handler();
    private Context appContext;
    private final Runnable dcKeepaliveRunnable = new Runnable() {
        @Override
        public void run() {
            if (!joined || dataChannel == null || dataChannel.state() != DataChannel.State.OPEN) {
                return;
            }
            try {
                JSONObject list = new JSONObject();
                list.put("textroom", "list");
                list.put("transaction", Utils.generateTransactionId());
                ByteBuffer data = Utils.stringToByteBuffer(list.toString());
                dataChannel.send(new DataChannel.Buffer(data, false));
            } catch (Exception e) {
                Log.d(Const.LOG_TAG, "DataChannel keepalive skipped: " + e.getMessage());
            }
            handler.postDelayed(this, DC_KEEPALIVE_INTERVAL_MS);
        }
    };

    @Override
    public String getName() {
        return Const.JANUS_PLUGIN_TEXTROOM;
    }

    public String getRoomId() {
        return roomId;
    }

    public PeerConnection getPeerConnection() {
        return peerConnection;
    }

    /**
     * True when TextRoom DataChannel can deliver join/ping/pong (viewer must not connect before this).
     */
    public boolean isControlChannelHealthy() {
        return iceConnected && dataChannelOpen
                && dataChannel != null
                && dataChannel.state() == DataChannel.State.OPEN;
    }

    @Override
    public void init(Context context) {
        appContext = context.getApplicationContext();
        super.init(context);
        PeerConnectionFactory.InitializationOptions initializationOptions =
                PeerConnectionFactory.InitializationOptions.builder(context)
                        .createInitializationOptions();
        PeerConnectionFactory.initialize(initializationOptions);
        peerConnectionFactory = PeerConnectionFactory.builder()
                .setOptions(new PeerConnectionFactory.Options())
                .createPeerConnectionFactory();
    }

    public void createPeerConnection(final SharingEngine.EventListener eventListener) {
        this.eventListener = eventListener;
        disposed = false;
        iceConnected = false;
        dataChannelOpen = false;
        webRtcUp = false;
        dataChannelReadyNotified = false;
        iceRestartAttempted = false;
        iceRestartInProgress = false;
        List<PeerConnection.IceServer> iceServers = new ArrayList<>();
        iceServers.add(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer());
        iceServers.add(PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer());
        PeerConnection.RTCConfiguration rtcConfig = new PeerConnection.RTCConfiguration(iceServers);
        rtcConfig.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;
        rtcConfig.continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY;
        rtcConfig.iceTransportsType = PeerConnection.IceTransportsType.ALL;
        rtcConfig.tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.ENABLED;
        rtcConfig.bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE;
        rtcConfig.rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE;
        rtcConfig.iceCandidatePoolSize = 4;
        peerConnection = peerConnectionFactory.createPeerConnection(rtcConfig, new PeerConnection.Observer() {
            @Override
            public void onSignalingChange(PeerConnection.SignalingState signalingState) {
                Log.d(Const.LOG_TAG, "Textroom plugin: signalingState changed to " + signalingState);
            }

            @Override
            public void onIceConnectionChange(PeerConnection.IceConnectionState iceConnectionState) {
                if (disposed) {
                    return;
                }
                Log.i(Const.LOG_TAG, "Textroom plugin: iceConnectionState changed to " + iceConnectionState);
                if (iceConnectionState == PeerConnection.IceConnectionState.CONNECTED
                        || iceConnectionState == PeerConnection.IceConnectionState.COMPLETED) {
                    iceConnected = true;
                    iceRestartAttempted = false;
                    iceRestartInProgress = false;
                    maybeNotifyDataChannelReady();
                    startDataChannelKeepalive();
                } else if (iceConnectionState == PeerConnection.IceConnectionState.DISCONNECTED) {
                    iceConnected = false;
                    // Transient; WebRTC often recovers without restart.
                    Log.w(Const.LOG_TAG, "ICE temporarily disconnected, waiting for recovery");
                    startDataChannelKeepalive();
                } else if (iceConnectionState == PeerConnection.IceConnectionState.FAILED && appContext != null) {
                    iceConnected = false;
                    if (!iceRestartAttempted && !iceRestartInProgress && peerConnection != null && !disposed) {
                        iceRestartAttempted = true;
                        iceRestartInProgress = true;
                        Log.w(Const.LOG_TAG, "ICE failed, attempting Janus TextRoom ICE restart");
                        new Thread(this::runJanusIceRestart, "janus-ice-restart").start();
                        return;
                    }
                    notifyIceConnectionFailed();
                } else if (iceConnectionState == PeerConnection.IceConnectionState.CLOSED) {
                    iceConnected = false;
                }
            }

            private void runJanusIceRestart() {
                if (disposed) {
                    iceRestartInProgress = false;
                    return;
                }
                boolean ok = performJanusIceRestart();
                iceRestartInProgress = false;
                if (disposed) {
                    return;
                }
                if (ok) {
                    Log.i(Const.LOG_TAG, "Janus ICE restart completed");
                    return;
                }
                Log.w(Const.LOG_TAG, "Janus ICE restart failed, requesting full reconnect");
                notifyIceConnectionFailed();
            }

            private void notifyIceConnectionFailed() {
                if (disposed || appContext == null) {
                    return;
                }
                stopDataChannelKeepalive();
                errorReason = "ICE connection failed";
                Log.e(Const.LOG_TAG, errorReason);
                handler.post(() -> {
                    if (disposed || appContext == null) {
                        return;
                    }
                    LocalBroadcastManager.getInstance(appContext)
                            .sendBroadcast(new Intent(Const.ACTION_CONNECTION_FAILURE));
                });
            }

            @Override
            public void onIceConnectionReceivingChange(boolean b) {
                Log.d(Const.LOG_TAG, "Textroom plugin: iceConnectionReceivingChange: " + b);
            }

            @Override
            public void onIceGatheringChange(PeerConnection.IceGatheringState iceGatheringState) {
                Log.d(Const.LOG_TAG, "Textroom plugin: iceGatheringState changed to " + iceGatheringState);
                if (iceGatheringState == PeerConnection.IceGatheringState.COMPLETE) {
                    sendTrickleComplete();
                }
            }

            @Override
            public void onIceCandidate(IceCandidate iceCandidate) {
                Log.d(Const.LOG_TAG, "Textroom plugin: iceCandidate: " + iceCandidate.toString());
                sendTrickleCandidate(iceCandidate);
            }

            @Override
            public void onIceCandidatesRemoved(IceCandidate[] iceCandidates) {
                Log.d(Const.LOG_TAG, "Textroom plugin: iceCandidateRemoved");
            }

            @Override
            public void onAddStream(MediaStream mediaStream) {
                Log.d(Const.LOG_TAG, "Textroom plugin: onAddStream: " + mediaStream.toString());
            }

            @Override
            public void onRemoveStream(MediaStream mediaStream) {
                Log.d(Const.LOG_TAG, "Textroom plugin: onRemoveStream: " + mediaStream.toString());
            }

            @Override
            public void onDataChannel(DataChannel incomingChannel) {
                Log.d(Const.LOG_TAG, "Textroom plugin: onDataChannel, id=" + incomingChannel.id() + ", label=" + incomingChannel.label());
                if (DATA_CHANNEL_LABEL.equals(incomingChannel.label())) {
                    dataChannel = incomingChannel;
                    registerDataChannelObserver(incomingChannel, eventListener);
                }
            }

            @Override
            public void onRenegotiationNeeded() {
                Log.d(Const.LOG_TAG, "Textroom plugin: onRenegotiationNeeded");
            }

            @Override
            public void onAddTrack(RtpReceiver rtpReceiver, MediaStream[] mediaStreams) {
                Log.d(Const.LOG_TAG, "Textroom plugin: onAddTrack");
            }
        });
        if (peerConnection == null) {
            errorReason = "Failed to create WebRTC peer connection";
            Log.e(Const.LOG_TAG, errorReason);
        }
    }

    private void registerDataChannelObserver(DataChannel channel, final SharingEngine.EventListener eventListener) {
        updateDataChannelOpenState(channel);
        channel.registerObserver(new DataChannel.Observer() {
            @Override
            public void onBufferedAmountChange(long l) {
                Log.d(Const.LOG_TAG, "Textroom plugin: dataChannel - onBufferedAmountChange=" + l);
            }

            @Override
            public void onStateChange() {
                Log.d(Const.LOG_TAG, "Textroom plugin: dataChannel - onStateChange, state=" + channel.state());
                updateDataChannelOpenState(channel);
            }

            @Override
            public void onMessage(DataChannel.Buffer buffer) {
                String message = Utils.byteBufferToString(buffer.data);
                Log.d(Const.LOG_TAG, "Textroom plugin: got message from DataChannel: " + message);

                try {
                    JSONObject jsonObject = new JSONObject(message);
                    String type = jsonObject.optString("textroom");
                    if ("join".equalsIgnoreCase(type)) {
                        String username = jsonObject.optString("username");
                        // Some Janus builds echo a join event for ourselves before/without a
                        // separate success ack. Treat that as join confirmation.
                        if (!joined && pendingJoinUsername != null
                                && pendingJoinUsername.equals(username)) {
                            Log.i(Const.LOG_TAG, "Textroom join confirmed via self join event");
                            notifyDataChannelResult(true);
                            return;
                        }
                        if (!checkJoined()) {
                            return;
                        }
                        Log.d(Const.LOG_TAG, "Remote control agent connected, starting sharing");
                        if (eventListener != null) {
                            handler.post(() -> eventListener.onStartSharing(username));
                        }
                    } else if ("message".equalsIgnoreCase(type)) {
                        if (!checkJoined()) {
                            return;
                        }
                        String text = jsonObject.optString("text");
                        if (text.startsWith("ping,")) {
                            String[] parts = text.split(",");
                            sendMessage("pong," + parts[1], false);
                            handler.post(() -> eventListener.onPing());
                        } else if (text.startsWith("pong,")) {
                            // Echo from our response, do nothing
                        } else if (eventListener != null) {
                            Log.d(Const.LOG_TAG, "Dispatching message: " + text);
                            handler.post(() -> eventListener.onRemoteControlEvent(text));
                        }
                    } else if ("leave".equalsIgnoreCase(type)) {
                        if (!checkJoined()) {
                            return;
                        }
                        Log.d(Const.LOG_TAG, "Remote control agent disconnected, stopping sharing");
                        if (eventListener != null) {
                            handler.post(() -> eventListener.onStopSharing());
                        }
                    } else if ("success".equalsIgnoreCase(type)) {
                        // list rooms → "list"; join/leave/message ack → no list (often "participants")
                        JSONArray list = jsonObject.optJSONArray("list");
                        if (list != null && !jsonObject.has("participants")
                                && !jsonObject.has("transaction")) {
                            Log.d(Const.LOG_TAG, "Ignoring textroom list response");
                            return;
                        }
                        Log.i(Const.LOG_TAG, "Textroom plugin: success response on DataChannel");
                        notifyDataChannelResult(true);
                    } else if ("error".equalsIgnoreCase(type) || ("event".equalsIgnoreCase(type) && jsonObject.has("error"))) {
                        Log.w(Const.LOG_TAG, "Textroom plugin: error response: " + message);
                        notifyDataChannelResult(false);
                    } else {
                        Log.d(Const.LOG_TAG, "Ignoring this message");
                    }

                } catch (JSONException e) {
                    Log.w(Const.LOG_TAG, "Failed to parse JSON, ignoring!");
                }
            }
        });
    }

    private void updateDataChannelOpenState(DataChannel channel) {
        boolean open = channel != null && channel.state() == DataChannel.State.OPEN;
        synchronized (dcOpenLock) {
            dataChannelOpen = open;
            if (open) {
                dcOpenLock.notifyAll();
            }
        }
        if (open) {
            maybeNotifyDataChannelReady();
        }
    }

    private void maybeNotifyDataChannelReady() {
        if (!webRtcUp || !dataChannelOpen) {
            return;
        }
        handler.post(this::notifyDataChannelReadyOnce);
    }

    private void notifyDataChannelReadyOnce() {
        if (dataChannelReadyNotified) {
            return;
        }
        dataChannelReadyNotified = true;
        notifyDataChannelReady();
    }

    private void sendTrickleCandidate(final IceCandidate iceCandidate) {
        new Thread(() -> {
            JanusTrickleRequest request = new JanusTrickleRequest(secret, "trickle", getSessionId(), getHandleId());
            JanusTrickleRequest.Candidate candidate = new JanusTrickleRequest.Candidate();
            candidate.setSdpMid(iceCandidate.sdpMid);
            candidate.setSdpMLineIndex(iceCandidate.sdpMLineIndex);
            candidate.setCandidate(iceCandidate.sdp);
            request.setCandidate(candidate);
            request.generateTransactionId();
            ServerApiHelper.execute(apiInstance.sendTrickle(getSessionId(), getHandleId(), request), "trickle");
        }).start();
    }

    private void sendTrickleComplete() {
        new Thread(() -> {
            JanusTrickleRequest request = new JanusTrickleRequest(secret, "trickle", getSessionId(), getHandleId());
            JanusTrickleRequest.Candidate candidate = new JanusTrickleRequest.Candidate();
            candidate.setCompleted(true);
            request.setCandidate(candidate);
            request.generateTransactionId();
            ServerApiHelper.execute(apiInstance.sendTrickle(getSessionId(), getHandleId(), request), "trickle complete");
        }).start();
    }

    private boolean ensureDataChannelCreated() {
        if (dataChannel != null) {
            return true;
        }
        DataChannel.Init init = new DataChannel.Init();
        init.ordered = true;
        dataChannel = peerConnection.createDataChannel(DATA_CHANNEL_LABEL, init);
        if (dataChannel == null) {
            errorReason = "Failed to create WebRTC data channel";
            Log.e(Const.LOG_TAG, errorReason);
            return false;
        }
        Log.i(Const.LOG_TAG, "Created DataChannel before SDP answer, label=" + DATA_CHANNEL_LABEL);
        registerDataChannelObserver(dataChannel, eventListener);
        return true;
    }

    private void startDataChannelKeepalive() {
        handler.removeCallbacks(dcKeepaliveRunnable);
        handler.postDelayed(dcKeepaliveRunnable, DC_KEEPALIVE_INTERVAL_MS);
    }

    private void stopDataChannelKeepalive() {
        handler.removeCallbacks(dcKeepaliveRunnable);
    }

    /**
     * Janus TextRoom ICE restart: request "restart" → new JSEP offer from Janus → answer via "ack".
     * Bare {@code PeerConnection.restartIce()} without this renegotiation does not recover.
     */
    private boolean performJanusIceRestart() {
        if (disposed || peerConnection == null) {
            return false;
        }
        try {
            JanusJsepRequest restartRequest = createJsepRequest("restart");
            Response<JanusResponse> response = ServerApiHelper.execute(
                    apiInstance.sendJsep(getSessionId(), getHandleId(), restartRequest), "ICE restart");
            if (response == null) {
                Log.w(Const.LOG_TAG, "ICE restart: network error");
                return false;
            }
            if (response.body() == null || !response.body().getJanus().equalsIgnoreCase("ack")) {
                Log.w(Const.LOG_TAG, "ICE restart: unexpected response "
                        + (response.body() != null ? response.body().toString() : response.code()));
                return false;
            }

            JanusPollResponse jsepEvent = waitForPollingEventWithJsep(Const.CONNECTION_TIMEOUT);
            if (jsepEvent == null || jsepEvent.getJsep() == null) {
                Log.w(Const.LOG_TAG, "ICE restart: no JSEP offer from Janus");
                return false;
            }

            final CountDownLatch answerLatch = new CountDownLatch(1);
            final AtomicBoolean answerOk = new AtomicBoolean(false);
            SessionDescription remoteOffer = new SessionDescription(
                    SessionDescription.Type.OFFER, jsepEvent.getJsep().getSdp());

            peerConnection.setRemoteDescription(new SdpObserver() {
                @Override
                public void onCreateSuccess(SessionDescription sessionDescription) {
                }

                @Override
                public void onSetSuccess() {
                    MediaConstraints constraints = new MediaConstraints();
                    peerConnection.createAnswer(new SdpObserver() {
                        @Override
                        public void onCreateSuccess(SessionDescription sessionDescription) {
                            peerConnection.setLocalDescription(new SdpObserver() {
                                @Override
                                public void onCreateSuccess(SessionDescription sessionDescription) {
                                }

                                @Override
                                public void onSetSuccess() {
                                    answerOk.set(true);
                                    answerLatch.countDown();
                                }

                                @Override
                                public void onCreateFailure(String s) {
                                    answerLatch.countDown();
                                }

                                @Override
                                public void onSetFailure(String s) {
                                    Log.w(Const.LOG_TAG, "ICE restart setLocal failed: " + s);
                                    answerLatch.countDown();
                                }
                            }, sessionDescription);
                        }

                        @Override
                        public void onSetSuccess() {
                        }

                        @Override
                        public void onCreateFailure(String s) {
                            Log.w(Const.LOG_TAG, "ICE restart createAnswer failed: " + s);
                            answerLatch.countDown();
                        }

                        @Override
                        public void onSetFailure(String s) {
                            answerLatch.countDown();
                        }
                    }, constraints);
                }

                @Override
                public void onCreateFailure(String s) {
                    answerLatch.countDown();
                }

                @Override
                public void onSetFailure(String s) {
                    Log.w(Const.LOG_TAG, "ICE restart setRemote failed: " + s);
                    answerLatch.countDown();
                }
            }, remoteOffer);

            if (!answerLatch.await(Const.CONNECTION_TIMEOUT, TimeUnit.MILLISECONDS) || !answerOk.get()) {
                Log.w(Const.LOG_TAG, "ICE restart: timed out waiting for local answer");
                return false;
            }

            SessionDescription local = peerConnection.getLocalDescription();
            if (local == null) {
                return false;
            }
            JanusJsepRequest ackRequest = createJsepRequest("ack");
            ackRequest.setJsep(new Jsep("answer", local.description));
            Response<JanusResponse> ackResponse = ServerApiHelper.execute(
                    apiInstance.sendJsep(getSessionId(), getHandleId(), ackRequest), "ICE restart ack");
            if (ackResponse == null || ackResponse.body() == null
                    || !ackResponse.body().getJanus().equalsIgnoreCase("ack")) {
                Log.w(Const.LOG_TAG, "ICE restart: ack failed");
                return false;
            }
            // Plugin may emit ok / webrtcup; do not fail hard if only keepalive arrives.
            waitForPollingEventWithPluginOk(Math.min(5000L, Const.CONNECTION_TIMEOUT));
            return true;
        } catch (Exception e) {
            Log.w(Const.LOG_TAG, "ICE restart exception: " + e.getMessage());
            return false;
        }
    }

    private void notifyDataChannelResult(boolean success) {
        synchronized (dcResultLock) {
            dcResult = success;
            dcResultReceived = true;
            dcResultLock.notifyAll();
        }
    }

    private boolean waitForDataChannelOpen(long timeoutMs) {
        if (dataChannel == null) {
            errorReason = "DataChannel is not created";
            return false;
        }
        if (dataChannel.state() == DataChannel.State.OPEN) {
            return true;
        }
        synchronized (dcOpenLock) {
            long deadline = System.currentTimeMillis() + timeoutMs;
            while (!dataChannelOpen && dataChannel.state() != DataChannel.State.OPEN) {
                long remaining = deadline - System.currentTimeMillis();
                if (remaining <= 0) {
                    errorReason = "Timeout waiting for DataChannel to open";
                    Log.w(Const.LOG_TAG, errorReason + ", state=" + dataChannel.state());
                    return false;
                }
                try {
                    dcOpenLock.wait(remaining);
                } catch (InterruptedException e) {
                    errorReason = "Interrupted";
                    Thread.currentThread().interrupt();
                    return false;
                }
            }
            dataChannelOpen = true;
            return true;
        }
    }

    private boolean checkJoined() {
        if (!joined) {
            Log.w(Const.LOG_TAG, "Ignoring message because we're not yet joined the textroom");
            return false;
        }
        return true;
    }


    private JanusJsepRequest createJsepRequest(String requestType) {
        JanusJsepRequest request = new JanusJsepRequest(secret, "message", getSessionId(), getHandleId());
        request.setBody(new JanusMessageRequest.Body(requestType, null));
        return request;
    }

    public void setupRtcSession(final SharingEngine.CompletionHandler completionHandler) {
        errorReason = null;
        if (peerConnection == null) {
            errorReason = "WebRTC peer connection is not initialized";
            completionHandler.onComplete(false, errorReason);
            return;
        }
        JanusJsepRequest offerRequest = createJsepRequest("setup");
        Response<JanusResponse> response = ServerApiHelper.execute(apiInstance.sendJsep(getSessionId(), getHandleId(), offerRequest), "get JSEP offer");
        if (response == null) {
            errorReason = "Network error";
            completionHandler.onComplete(false, errorReason);
            return;
        }
        if (response.body() == null || !response.body().getJanus().equalsIgnoreCase("ack")) {
            errorReason = "Server error";
            Log.w(Const.LOG_TAG, "Unexpected setup response: " + (response.body() != null ? response.body().toString() : response.code()));
            completionHandler.onComplete(false, errorReason);
            return;
        }
        Log.i(Const.LOG_TAG, "Got response to JSEP offer, waiting for event");
        JanusPollResponse jsepEvent = waitForPollingEventWithJsep(Const.CONNECTION_TIMEOUT);
        if (jsepEvent == null) {
            completionHandler.onComplete(false, errorReason != null ? errorReason : "Timeout waiting for JSEP offer");
            return;
        }
        Jsep jsepData = jsepEvent.getJsep();
        if (jsepData == null) {
            errorReason = "Server error";
            Log.w(Const.LOG_TAG, "Missing JSEP in polling event");
            completionHandler.onComplete(false, errorReason);
            return;
        }
        peerConnection.setRemoteDescription(new SdpObserver() {
                @Override
                public void onCreateSuccess(SessionDescription sessionDescription) {
                    Log.i(Const.LOG_TAG, "RemoteDescription - create success");
                }

                @Override
                public void onSetSuccess() {
                    Log.i(Const.LOG_TAG, "RemoteDescription - success");
                    if (!ensureDataChannelCreated()) {
                        completionHandler.onComplete(false, errorReason);
                        return;
                    }
                    createSessionAnswer(completionHandler);
                }

                @Override
                public void onCreateFailure(String s) {
                    Log.i(Const.LOG_TAG, "RemoteDescription - create failure: " + s);
                }

                @Override
                public void onSetFailure(String s) {
                    errorReason = "RemoteDescription - failure: " + s;
                    Log.w(Const.LOG_TAG, errorReason);
                    completionHandler.onComplete(false, errorReason);
                }
            }, new SessionDescription(SessionDescription.Type.OFFER, jsepData.getSdp()));
    }

    private JanusPollResponse waitForPollingEventWithJsep(long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            synchronized (pollingEventLock) {
                if (pollingEvent != null && pollingEvent.getJsep() != null) {
                    JanusPollResponse result = pollingEvent;
                    pollingEvent = null;
                    return result;
                }
            }
            synchronized (pollingEventLock) {
                if (pollingEvent != null && pollingEvent.getJsep() == null) {
                    pollingEvent = null;
                }
            }
            if (!waitForPollingEvent(Math.max(1, deadline - System.currentTimeMillis()))) {
                return null;
            }
            if (pollingEvent != null && pollingEvent.getJsep() != null) {
                JanusPollResponse result = pollingEvent;
                pollingEvent = null;
                return result;
            }
            Log.d(Const.LOG_TAG, "Ignoring Janus poll event without JSEP: " + pollingEvent);
        }
        errorReason = "Timeout waiting for JSEP offer";
        return null;
    }

    private void resetDataChannelResult() {
        synchronized (dcResultLock) {
            dcResult = false;
            dcResultReceived = false;
        }
    }

    private boolean waitForDataChannelResult(long timeoutMs) {
        synchronized (dcResultLock) {
            long deadline = System.currentTimeMillis() + timeoutMs;
            while (!dcResultReceived) {
                long remaining = deadline - System.currentTimeMillis();
                if (remaining <= 0) {
                    errorReason = "Timeout waiting for textroom response";
                    return false;
                }
                try {
                    dcResultLock.wait(remaining);
                } catch (InterruptedException e) {
                    errorReason = "Interrupted";
                    Thread.currentThread().interrupt();
                    return false;
                }
            }
            return dcResult;
        }
    }

    private void createSessionAnswer(final SharingEngine.CompletionHandler completionHandler) {
        MediaConstraints constraints = new MediaConstraints();
        peerConnection.createAnswer(new SdpObserver() {
            @Override
            public void onCreateSuccess(SessionDescription sessionDescription) {
                Log.i(Const.LOG_TAG, "createAnswer - create success");
                // Proceed with setting local session description asynchronously
                setLocalSessionDescription(sessionDescription, completionHandler);
            }

            @Override
            public void onSetSuccess() {
                Log.i(Const.LOG_TAG, "createAnswer - success");
            }

            @Override
            public void onCreateFailure(String s) {
                errorReason = "createAnswer - create failure: " + s;
                Log.w(Const.LOG_TAG, errorReason);
                completionHandler.onComplete(false, errorReason);
            }

            @Override
            public void onSetFailure(String s) {
                Log.i(Const.LOG_TAG, "createAnswer - failure: " + s);
            }
        }, constraints);
    }

    private void setLocalSessionDescription(final SessionDescription sessionDescription, final SharingEngine.CompletionHandler completionHandler) {
        peerConnection.setLocalDescription(new SdpObserver() {
            @Override
            public void onCreateSuccess(SessionDescription sessionDescription) {
                Log.i(Const.LOG_TAG, "LocalDescription - create success");
            }

            @Override
            public void onSetSuccess() {
                Log.i(Const.LOG_TAG, "LocalDescription - success");
                // Proceed with SDP asynchronously
                sendSessionDescriptionAck(completionHandler);
            }

            @Override
            public void onCreateFailure(String s) {
                Log.i(Const.LOG_TAG, "LocalDescription - create failure: " + s);
            }

            @Override
            public void onSetFailure(String s) {
                errorReason = "LocalDescription - failure: " + s;
                Log.w(Const.LOG_TAG, errorReason);
                completionHandler.onComplete(false, errorReason);
            }
        }, sessionDescription);
    }

    private void sendSessionDescriptionAck(final SharingEngine.CompletionHandler completionHandler) {
        JanusJsepRequest offerRequest = createJsepRequest("ack");
        offerRequest.setJsep(new Jsep("answer", peerConnection.getLocalDescription().description));
        Response<JanusResponse> response = ServerApiHelper.execute(apiInstance.sendJsep(getSessionId(), getHandleId(), offerRequest), "send JSEP ack");
        if (response == null) {
            errorReason = "Network error";
            completionHandler.onComplete(false, errorReason);
            return;
        }
        if (response.body() != null && response.body().getJanus().equalsIgnoreCase("ack")) {
            Log.i(Const.LOG_TAG, "Got response to JSEP ack, waiting for event");
            if (!waitForPollingEventWithPluginOk(Const.CONNECTION_TIMEOUT)) {
                completionHandler.onComplete(false, errorReason);
                return;
            }
            if (!isPluginOkEvent(pollingEvent)) {
                errorReason = "Server error";
                Log.w(Const.LOG_TAG, "Wrong server response: " + pollingEvent.toString());
                completionHandler.onComplete(false, errorReason);
            }
        }
    }

    private boolean isPluginOkEvent(JanusPollResponse event) {
        return event != null && event.getPlugindata() != null && event.getPlugindata().getData() != null
                && "ok".equalsIgnoreCase(event.getPlugindata().getData().getResult());
    }

    private boolean waitForPollingEventWithPluginOk(long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            synchronized (pollingEventLock) {
                if (isPluginOkEvent(pollingEvent)) {
                    return true;
                }
            }
            synchronized (pollingEventLock) {
                if (pollingEvent != null && !isPluginOkEvent(pollingEvent)) {
                    pollingEvent = null;
                }
            }
            if (!waitForPollingEvent(Math.max(1, deadline - System.currentTimeMillis()))) {
                return false;
            }
            if (isPluginOkEvent(pollingEvent)) {
                return true;
            }
            Log.d(Const.LOG_TAG, "Ignoring Janus poll event without plugin ok: " + pollingEvent);
        }
        errorReason = "Timeout waiting for textroom ack";
        return false;
    }

    @Override
    public void onWebRtcUp(final Context context) {
        Log.i(Const.LOG_TAG, "WebRTC is up!");
        webRtcUp = true;
        new Thread(() -> {
            if (waitForDataChannelOpen(Const.CONNECTION_TIMEOUT)) {
                maybeNotifyDataChannelReady();
            } else {
                Log.e(Const.LOG_TAG, "DataChannel did not open after WebRTC up: " + errorReason);
                handler.post(() -> LocalBroadcastManager.getInstance(context)
                        .sendBroadcast(new Intent(Const.ACTION_CONNECTION_FAILURE)));
            }
        }).start();
    }

    private boolean sendToDataChannel(String message) {
        if (!waitForDataChannelOpen(Const.CONNECTION_TIMEOUT)) {
            return false;
        }
        Log.d(Const.LOG_TAG, "Sending message: " + message);
        ByteBuffer data = Utils.stringToByteBuffer(message);
        DataChannel.Buffer buffer = new DataChannel.Buffer(data, false);
        boolean sent = dataChannel.send(buffer);
        if (!sent) {
            errorReason = "Failed to send DataChannel message";
            Log.w(Const.LOG_TAG, errorReason);
        }
        return sent;
    }

    public int createRoom(String roomId, String password) {
        this.roomId = roomId;
        this.password = password;

        JanusMessageRequest createRequest = new JanusMessageRequest(secret, "message", getSessionId(), getHandleId());
        JanusMessageRequest.Body body = new JanusMessageRequest.Body("create", null, roomId);
        body.setPin(password);
        body.setIs_private(false);
        body.setPermanent(false);
        createRequest.setBody(body);
        createRequest.generateTransactionId();

        Response<JanusResponse> response = ServerApiHelper.execute(
                apiInstance.sendMessage(getSessionId(), getHandleId(), createRequest), "create textroom");
        if (response == null) {
            errorReason = "Network error";
            return Const.NETWORK_ERROR;
        }
        if (response.body() == null || !response.body().getJanus().equalsIgnoreCase("success")) {
            errorReason = "Server error";
            Log.w(Const.LOG_TAG, "Failed to create textroom via HTTP: " + (response.body() != null ? response.body().toString() : response.code()));
            return Const.SERVER_ERROR;
        }
        Log.i(Const.LOG_TAG, "Created textroom via HTTP, room=" + roomId);
        return Const.SUCCESS;
    }

    public int joinRoom(String username, String displayName) {
        try {
            JSONObject joinMessage = new JSONObject();
            joinMessage.put("textroom", "join");
            joinMessage.put("room", roomId);
            joinMessage.put("username", username);
            joinMessage.put("display", displayName);
            joinMessage.put("pin", password);
            joinMessage.put("transaction", Utils.generateTransactionId());

            // Reset BEFORE send so a fast ack cannot be lost to a race.
            resetDataChannelResult();
            pendingJoinUsername = username;
            Log.i(Const.LOG_TAG, "Joining textroom via DataChannel, room=" + roomId + ", username=" + username);
            if (!sendToDataChannel(joinMessage.toString())) {
                pendingJoinUsername = null;
                if (errorReason == null) {
                    errorReason = "Failed to send join room message";
                }
                return Const.SERVER_ERROR;
            }
        } catch (JSONException e) {
            pendingJoinUsername = null;
            errorReason = "Failed to build join room message";
            Log.w(Const.LOG_TAG, errorReason, e);
            return Const.INTERNAL_ERROR;
        }
        if (!waitForDataChannelResult(Const.CONNECTION_TIMEOUT)) {
            pendingJoinUsername = null;
            if (errorReason == null) {
                errorReason = "Failed to join a text room";
            }
            return Const.SERVER_ERROR;
        }
        joined = true;
        pendingJoinUsername = null;
        Log.i(Const.LOG_TAG, "Joined textroom, room=" + roomId);
        startDataChannelKeepalive();
        return Const.SUCCESS;
    }

    public int sendMessage(String message, boolean ack) {
        String sendCommand = "{\"textroom\":\"message\",\"room\":\"" + roomId + "\",\"text\":\"" + message + "\",\"ack\":" + ack + "," +
                "\"transaction\":\"" + Utils.generateTransactionId() + "\"}";

        if (ack) {
            resetDataChannelResult();
        }
        if (!sendToDataChannel(sendCommand)) {
            if (errorReason == null) {
                errorReason = "Failed to send message to room";
            }
            return Const.SERVER_ERROR;
        }
        if (ack) {
            if (!waitForDataChannelResult(Const.CONNECTION_TIMEOUT)) {
                if (errorReason == null) {
                    errorReason = "Failed to send a message to room";
                }
                return Const.SERVER_ERROR;
            }
        }
        return Const.SUCCESS;
    }

    /**
     * Invalidate this plugin immediately so stale PeerConnection ICE events cannot
     * trigger ICE restart / CONNECTION_FAILURE against a destroyed Janus session.
     * Safe to call more than once; called from destroy() and SharingEngine teardown.
     */
    public void disposePeerConnection() {
        disposed = true;
        stopDataChannelKeepalive();
        iceConnected = false;
        dataChannelOpen = false;
        iceRestartInProgress = false;
        webRtcUp = false;
        dataChannelReadyNotified = false;
        eventListener = null;
        DataChannel dc = dataChannel;
        dataChannel = null;
        if (dc != null) {
            try {
                dc.close();
            } catch (Exception ignored) {
            }
            try {
                dc.dispose();
            } catch (Exception ignored) {
            }
        }
        PeerConnection pc = peerConnection;
        peerConnection = null;
        if (pc != null) {
            try {
                pc.close();
            } catch (Exception ignored) {
            }
            try {
                pc.dispose();
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public int destroy() {
        disposePeerConnection();
 /*       if (dataChannel != null) {
            String destroyMessage = "{\"textroom\":\"destroy\",\"room\":\"" + roomId + "\",\"permanent\":false,\"transaction\":\"" + Utils.generateTransactionId() + "\"}";
            sendToDataChannel(destroyMessage);
        }*/
        // DataChannel may be broken, so we destroy using HTTP
        destroyViaHttp();
        return Const.SUCCESS;
    }

    private int destroyViaHttp() {
        JanusMessageRequest destroyRequest = new JanusMessageRequest(secret, "message", sessionId, getHandleId());
        destroyRequest.setBody(new JanusMessageRequest.Body("destroy", null, roomId));
        destroyRequest.generateTransactionId();

        Response<JanusResponse> response = ServerApiHelper.execute(apiInstance.sendMessage(sessionId, getHandleId(), destroyRequest), "destroy textroom");
        if (response == null) {
            errorReason = "Network error";
            return Const.NETWORK_ERROR;
        }
        if (response.body() == null || !response.body().getJanus().equalsIgnoreCase("success")) {
            errorReason = "Server error";
            Log.w(Const.LOG_TAG, "Wrong server response: " + response.body().toString());
            return Const.SERVER_ERROR;
        }
        return Const.SUCCESS;
    }
}
