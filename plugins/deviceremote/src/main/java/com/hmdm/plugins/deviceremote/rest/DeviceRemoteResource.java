package com.hmdm.plugins.deviceremote.rest;

import com.hmdm.notification.PushService;
import com.hmdm.notification.persistence.domain.PushMessage;
import com.hmdm.persistence.DeviceDAO;
import com.hmdm.persistence.UnsecureDAO;
import com.hmdm.persistence.domain.Device;
import com.hmdm.plugins.deviceremote.persistence.DeviceRemoteDAO;
import com.hmdm.plugins.deviceremote.persistence.domain.DeviceRemoteSession;
import com.hmdm.plugins.deviceremote.persistence.domain.DeviceRemoteSettings;
import com.hmdm.plugins.deviceremote.rest.json.DeviceRemoteAgentReport;
import com.hmdm.plugins.deviceremote.rest.json.DeviceRemoteRequest;
import com.hmdm.plugins.deviceremote.rest.json.DeviceRemoteSettingsView;
import com.hmdm.plugins.deviceremote.rest.json.DeviceRemoteStatusView;
import com.hmdm.rest.json.DeviceInfo;
import com.hmdm.rest.json.Response;
import com.hmdm.security.SecurityContext;
import com.hmdm.security.SecurityException;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.Authorization;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import java.security.SecureRandom;

@Singleton
@Path("/plugins/deviceremote")
@Api(tags = {"Device Remote Control plugin"})
public class DeviceRemoteResource {

    private static final Logger logger = LoggerFactory.getLogger(DeviceRemoteResource.class);
    private static final String PERMISSION = "plugin_deviceremote_access";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

    private final DeviceRemoteDAO deviceRemoteDAO;
    private final DeviceDAO deviceDAO;
    private final UnsecureDAO unsecureDAO;
    private final PushService pushService;

    public DeviceRemoteResource() {
        this.deviceRemoteDAO = null;
        this.deviceDAO = null;
        this.unsecureDAO = null;
        this.pushService = null;
    }

    @Inject
    public DeviceRemoteResource(DeviceRemoteDAO deviceRemoteDAO,
                                DeviceDAO deviceDAO,
                                UnsecureDAO unsecureDAO,
                                PushService pushService) {
        this.deviceRemoteDAO = deviceRemoteDAO;
        this.deviceDAO = deviceDAO;
        this.unsecureDAO = unsecureDAO;
        this.pushService = pushService;
    }

    @ApiOperation(value = "Get remote control settings", authorizations = {@Authorization("Bearer Token")})
    @GET
    @Path("/private/settings")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getSettings() {
        if (!hasAccess()) {
            return Response.PERMISSION_DENIED();
        }
        DeviceRemoteSettings settings = deviceRemoteDAO.getSettings(getCustomerId());
        DeviceRemoteSettingsView view = new DeviceRemoteSettingsView();
        if (settings != null) {
            view.setServerUrl(settings.getServerUrl());
            view.setServerSecret(settings.getServerSecret());
        } else {
            view.setServerUrl("");
            view.setServerSecret("");
        }
        return Response.OK(view);
    }

    @ApiOperation(value = "Save remote control settings", authorizations = {@Authorization("Bearer Token")})
    @PUT
    @Path("/private/settings")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response saveSettings(DeviceRemoteSettingsView view) {
        if (!hasAccess()) {
            return Response.PERMISSION_DENIED();
        }
        if (view == null || view.getServerUrl() == null || view.getServerUrl().trim().isEmpty()) {
            return Response.ERROR("Remote server URL is required");
        }
        DeviceRemoteSettings settings = new DeviceRemoteSettings();
        settings.setCustomerId(getCustomerId());
        settings.setServerUrl(normalizeServerUrl(view.getServerUrl()));
        settings.setServerSecret(view.getServerSecret() != null ? view.getServerSecret().trim() : "");
        deviceRemoteDAO.saveSettings(settings);
        return Response.OK();
    }

    @ApiOperation(value = "Get remote session status", authorizations = {@Authorization("Bearer Token")})
    @GET
    @Path("/private/status/{deviceId}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getStatus(@PathParam("deviceId") int deviceId) {
        if (!hasAccess()) {
            return Response.PERMISSION_DENIED();
        }
        Device device = deviceDAO.getDeviceById(deviceId);
        if (device == null || !isDeviceAccessible(device)) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }
        return Response.OK(toStatusView(device.getCustomerId(), device.getId()));
    }

    @ApiOperation(value = "Start remote control session", authorizations = {@Authorization("Bearer Token")})
    @PUT
    @Path("/private/start")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response startSession(DeviceRemoteRequest request) {
        if (!hasAccess()) {
            return Response.PERMISSION_DENIED();
        }
        if (request == null || request.getDeviceId() == null) {
            return Response.ERROR("Device id is required");
        }

        Device device = deviceDAO.getDeviceById(request.getDeviceId());
        if (device == null || !isDeviceAccessible(device)) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }

        DeviceRemoteSettings settings = deviceRemoteDAO.getSettings(device.getCustomerId());
        if (settings == null || settings.getServerUrl() == null || settings.getServerUrl().trim().isEmpty()) {
            return Response.ERROR("Configure the remote server URL in plugin settings first");
        }

        long now = System.currentTimeMillis();
        DeviceRemoteSession session = deviceRemoteDAO.getSessionByDeviceId(device.getId());
        if (session == null) {
            session = new DeviceRemoteSession();
            session.setCustomerId(device.getCustomerId());
            session.setDeviceId(device.getId());
        }
        session.setSessionId(randomToken(8));
        session.setPassword(randomToken(4));
        session.setStatus(DeviceRemoteSession.STATUS_PENDING);
        session.setAgentStatus(null);
        session.setRequestedAt(now);
        session.setUpdatedAt(now);
        deviceRemoteDAO.saveSession(session);

        notifyDevice(device.getId());
        return Response.OK(toStatusView(device.getCustomerId(), device.getId()));
    }

    @ApiOperation(value = "Stop remote control session", authorizations = {@Authorization("Bearer Token")})
    @PUT
    @Path("/private/stop")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response stopSession(DeviceRemoteRequest request) {
        if (!hasAccess()) {
            return Response.PERMISSION_DENIED();
        }
        if (request == null || request.getDeviceId() == null) {
            return Response.ERROR("Device id is required");
        }

        Device device = deviceDAO.getDeviceById(request.getDeviceId());
        if (device == null || !isDeviceAccessible(device)) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }

        DeviceRemoteSession session = deviceRemoteDAO.getSessionByDeviceId(device.getId());
        if (session != null) {
            session.setStatus(DeviceRemoteSession.STATUS_STOPPED);
            session.setUpdatedAt(System.currentTimeMillis());
            deviceRemoteDAO.saveSession(session);
            notifyDevice(device.getId());
        }
        return Response.OK(toStatusView(device.getCustomerId(), device.getId()));
    }

    @ApiOperation(value = "Get remote session credentials for device agent")
    @GET
    @Path("/public/session/{number}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getSessionForDevice(@PathParam("number") String number) {
        Device device = resolveDevice(number, null);
        if (device == null) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }
        DeviceRemoteSession session = deviceRemoteDAO.getSessionByDeviceId(device.getId());
        if (session == null || session.getSessionId() == null || session.getPassword() == null) {
            return Response.ERROR("No active remote session");
        }
        String status = session.getStatus();
        if (DeviceRemoteSession.STATUS_IDLE.equals(status)
                || DeviceRemoteSession.STATUS_STOPPED.equals(status)
                || DeviceRemoteSession.STATUS_FAILED.equals(status)) {
            return Response.ERROR("No active remote session");
        }
        return Response.OK(toStatusView(device.getCustomerId(), device.getId()));
    }

    @ApiOperation(value = "Confirm remote agent launch from device")
    @POST
    @Path("/public/launch/{number}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response confirmLaunch(@PathParam("number") String number, DeviceInfo deviceInfo) {
        return updateFromDevice(number, deviceInfo, DeviceRemoteSession.STATUS_LAUNCHED, "launched", false);
    }

    @POST
    @Path("/public/stop/{number}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response confirmStop(@PathParam("number") String number, DeviceInfo deviceInfo) {
        Device device = resolveDevice(number, deviceInfo);
        if (device == null) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }
        DeviceRemoteSession session = deviceRemoteDAO.getSessionByDeviceId(device.getId());
        if (session != null) {
            session.setStatus(DeviceRemoteSession.STATUS_IDLE);
            session.setAgentStatus("stopped");
            session.setUpdatedAt(System.currentTimeMillis());
            deviceRemoteDAO.saveSession(session);
        }
        return Response.OK();
    }

    @ApiOperation(value = "Report remote agent status from device")
    @POST
    @Path("/public/status/{number}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response reportStatus(@PathParam("number") String number, DeviceRemoteAgentReport report) {
        Device device = resolveDevice(number, null);
        if (device == null) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }
        DeviceRemoteSession session = deviceRemoteDAO.getSessionByDeviceId(device.getId());
        if (session == null || session.getSessionId() == null) {
            return Response.ERROR("No active remote session");
        }
        if (report != null && report.getSessionId() != null && !report.getSessionId().isEmpty()
                && !report.getSessionId().equals(session.getSessionId())) {
            // Device is on a stale room while MDM already rotated the session (e.g. Start clicked again).
            // Keep rejecting the update so Open Viewer stays tied to the MDM session; agent must re-sync.
            return Response.ERROR("Session mismatch: device=" + report.getSessionId()
                    + " mdm=" + session.getSessionId());
        }
        if (report != null && report.getAgentStatus() != null) {
            String incoming = report.getAgentStatus().trim();
            if (isAgentStatusDowngrade(session.getAgentStatus(), incoming)) {
                logger.info("Ignoring agentStatus downgrade for device {}: {} -> {}",
                        device.getNumber(), session.getAgentStatus(), incoming);
            } else {
                session.setAgentStatus(incoming);
                if ("sharing".equalsIgnoreCase(incoming)
                        || "connected".equalsIgnoreCase(incoming)
                        || "ready".equalsIgnoreCase(incoming)) {
                    session.setStatus(DeviceRemoteSession.STATUS_ACTIVE);
                } else if ("failed".equalsIgnoreCase(incoming)) {
                    session.setStatus(DeviceRemoteSession.STATUS_FAILED);
                }
            }
        }
        session.setUpdatedAt(System.currentTimeMillis());
        deviceRemoteDAO.saveSession(session);
        return Response.OK();
    }

    /**
     * Keep Open Viewer enabled once the agent has reached ready/sharing.
     * Soft TextRoom reconnects used to re-report "connected" and disable the button.
     */
    static boolean isAgentStatusDowngrade(String current, String incoming) {
        if (current == null || incoming == null) {
            return false;
        }
        String from = current.trim().toLowerCase();
        String to = incoming.trim().toLowerCase();
        if (from.equals(to)) {
            return false;
        }
        if ("sharing".equals(from)) {
            return "ready".equals(to) || "connected".equals(to) || "launched".equals(to);
        }
        if ("ready".equals(from)) {
            return "connected".equals(to) || "launched".equals(to);
        }
        return false;
    }

    private Response updateFromDevice(String number, DeviceInfo deviceInfo, String status,
                                      String agentStatus, boolean allowMissingSession) {
        Device device = resolveDevice(number, deviceInfo);
        if (device == null) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }
        DeviceRemoteSession session = deviceRemoteDAO.getSessionByDeviceId(device.getId());
        if (session == null) {
            if (allowMissingSession) {
                return Response.OK();
            }
            return Response.ERROR("No active remote session");
        }
        session.setStatus(status);
        session.setAgentStatus(agentStatus);
        session.setUpdatedAt(System.currentTimeMillis());
        deviceRemoteDAO.saveSession(session);
        return Response.OK();
    }

    private DeviceRemoteStatusView toStatusView(int customerId, int deviceId) {
        DeviceRemoteSession session = deviceRemoteDAO.getSessionByDeviceId(deviceId);
        DeviceRemoteSettings settings = deviceRemoteDAO.getSettings(customerId);
        DeviceRemoteStatusView view = new DeviceRemoteStatusView();
        if (session == null) {
            view.setStatus(DeviceRemoteSession.STATUS_IDLE);
            return view;
        }
        view.setStatus(session.getStatus());
        view.setAgentStatus(session.getAgentStatus() != null ? session.getAgentStatus().trim() : null);
        view.setSessionId(session.getSessionId());
        view.setPassword(session.getPassword());
        view.setRequestedAt(session.getRequestedAt());
        view.setUpdatedAt(session.getUpdatedAt());
        if (settings != null && settings.getServerUrl() != null && !settings.getServerUrl().trim().isEmpty()) {
            view.setServerUrl(normalizeServerUrl(settings.getServerUrl()));
            if (session.getSessionId() != null && session.getPassword() != null) {
                view.setViewerUrl(buildViewerUrl(settings.getServerUrl(), session.getSessionId(), session.getPassword()));
            }
        }
        return view;
    }

    static String buildViewerUrl(String serverUrl, String sessionId, String password) {
        if (serverUrl == null || serverUrl.trim().isEmpty() || sessionId == null || password == null) {
            return null;
        }
        String base = normalizeServerUrl(serverUrl);
        if (base.contains("?")) {
            return base + "&session=" + sessionId + "&pin=" + password;
        }
        return base + "?session=" + sessionId + "&pin=" + password;
    }

    static String normalizeServerUrl(String serverUrl) {
        if (serverUrl == null) {
            return "";
        }
        String url = serverUrl.trim();
        if (url.isEmpty()) {
            return "";
        }
        if (!url.endsWith("/")) {
            url += "/";
        }
        return url;
    }

    private void notifyDevice(int deviceId) {
        PushMessage message = new PushMessage();
        message.setDeviceId(deviceId);
        message.setMessageType(PushMessage.TYPE_CONFIG_UPDATED);
        pushService.send(message);
    }

    private Device resolveDevice(String number, DeviceInfo deviceInfo) {
        Device device = unsecureDAO.getDeviceByNumber(number);
        if (device == null && deviceInfo != null && deviceInfo.getDeviceId() != null) {
            device = unsecureDAO.getDeviceByNumber(deviceInfo.getDeviceId());
        }
        return device;
    }

    private boolean hasAccess() {
        try {
            return SecurityContext.get().hasPermission(PERMISSION);
        } catch (SecurityException e) {
            return false;
        }
    }

    private boolean isDeviceAccessible(Device device) {
        return SecurityContext.get().getCurrentCustomerId().get().equals(device.getCustomerId());
    }

    private int getCustomerId() {
        return SecurityContext.get().getCurrentCustomerId().get();
    }

    private static String randomToken(int length) {
        StringBuilder builder = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            builder.append(TOKEN_CHARS.charAt(RANDOM.nextInt(TOKEN_CHARS.length())));
        }
        return builder.toString();
    }
}
