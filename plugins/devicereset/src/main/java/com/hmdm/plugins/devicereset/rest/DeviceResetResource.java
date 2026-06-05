package com.hmdm.plugins.devicereset.rest;

import com.hmdm.notification.PushService;
import com.hmdm.notification.persistence.domain.PushMessage;
import com.hmdm.persistence.DeviceDAO;
import com.hmdm.persistence.UnsecureDAO;
import com.hmdm.persistence.domain.Device;
import com.hmdm.plugins.devicereset.persistence.DeviceResetDAO;
import com.hmdm.plugins.devicereset.persistence.domain.DeviceResetStatus;
import com.hmdm.plugins.devicereset.rest.json.DeviceResetRequest;
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

@Singleton
@Path("/plugins/devicereset")
@Api(tags = {"Device Reset plugin"})
public class DeviceResetResource {

    private static final Logger logger = LoggerFactory.getLogger(DeviceResetResource.class);
    private static final String PERMISSION = "plugin_devicereset_access";

    private final DeviceResetDAO deviceResetDAO;
    private final DeviceDAO deviceDAO;
    private final UnsecureDAO unsecureDAO;
    private final PushService pushService;

    public DeviceResetResource() {
        this.deviceResetDAO = null;
        this.deviceDAO = null;
        this.unsecureDAO = null;
        this.pushService = null;
    }

    @Inject
    public DeviceResetResource(DeviceResetDAO deviceResetDAO,
                               DeviceDAO deviceDAO,
                               UnsecureDAO unsecureDAO,
                               PushService pushService) {
        this.deviceResetDAO = deviceResetDAO;
        this.deviceDAO = deviceDAO;
        this.unsecureDAO = unsecureDAO;
        this.pushService = pushService;
    }

    @ApiOperation(value = "Get device reset status", authorizations = {@Authorization("Bearer Token")})
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
        return Response.OK(deviceResetDAO.getByDeviceId(deviceId));
    }

    @ApiOperation(value = "Request factory reset", authorizations = {@Authorization("Bearer Token")})
    @PUT
    @Path("/private/reset")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response requestReset(DeviceResetRequest request) {
        return setAction(request, ActionType.FACTORY_RESET);
    }

    @ApiOperation(value = "Request reboot", authorizations = {@Authorization("Bearer Token")})
    @PUT
    @Path("/private/reboot")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response requestReboot(DeviceResetRequest request) {
        return setAction(request, ActionType.REBOOT);
    }

    @ApiOperation(value = "Lock device", authorizations = {@Authorization("Bearer Token")})
    @PUT
    @Path("/private/lock")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response requestLock(DeviceResetRequest request) {
        return setAction(request, ActionType.LOCK);
    }

    @ApiOperation(value = "Unlock device", authorizations = {@Authorization("Bearer Token")})
    @PUT
    @Path("/private/unlock")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response requestUnlock(DeviceResetRequest request) {
        return setAction(request, ActionType.UNLOCK);
    }

    @ApiOperation(value = "Reset device password", authorizations = {@Authorization("Bearer Token")})
    @PUT
    @Path("/private/password")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response requestPasswordReset(DeviceResetRequest request) {
        if (request == null || request.getDeviceId() == null) {
            return Response.ERROR("Device id is required");
        }
        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            return Response.ERROR("Password is required");
        }
        return setAction(request, ActionType.PASSWORD_RESET);
    }

    @ApiOperation(value = "Confirm factory reset from device")
    @POST
    @Path("/public/{number}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response confirmReset(@PathParam("number") String number, DeviceInfo deviceInfo) {
        return confirmAction(number, () -> deviceResetDAO.clearFactoryReset(resolveDeviceId(number, deviceInfo)));
    }

    @ApiOperation(value = "Confirm reboot from device")
    @POST
    @Path("/public/reboot/{number}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response confirmReboot(@PathParam("number") String number, DeviceInfo deviceInfo) {
        return confirmAction(number, () -> deviceResetDAO.clearReboot(resolveDeviceId(number, deviceInfo)));
    }

    @ApiOperation(value = "Confirm password reset from device")
    @POST
    @Path("/public/password/{number}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response confirmPasswordReset(@PathParam("number") String number, DeviceInfo deviceInfo) {
        return confirmAction(number, () -> deviceResetDAO.clearPasswordReset(resolveDeviceId(number, deviceInfo)));
    }

    private Response setAction(DeviceResetRequest request, ActionType actionType) {
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

        DeviceResetStatus status = deviceResetDAO.getByDeviceId(device.getId());
        if (status == null) {
            status = new DeviceResetStatus();
            status.setCustomerId(device.getCustomerId());
            status.setDeviceId(device.getId());
        }

        switch (actionType) {
            case FACTORY_RESET:
                status.setFactoryReset(true);
                break;
            case REBOOT:
                status.setReboot(true);
                break;
            case LOCK:
                status.setLock(true);
                status.setLockMessage(request.getLockMessage());
                break;
            case UNLOCK:
                status.setLock(false);
                status.setLockMessage(null);
                break;
            case PASSWORD_RESET:
                status.setPasswordReset(request.getPassword());
                break;
            default:
                return Response.ERROR();
        }

        deviceResetDAO.saveStatus(status);
        notifyDevice(device.getId());
        logger.info("Device reset action '{}' requested for device {}", actionType, device.getNumber());
        return Response.OK();
    }

    private Response confirmAction(String number, Runnable clearAction) {
        Device device = unsecureDAO.getDeviceByNumber(number);
        if (device == null) {
            device = unsecureDAO.getDeviceByOldNumber(number);
        }
        if (device == null) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }
        clearAction.run();
        return Response.OK();
    }

    private int resolveDeviceId(String number, DeviceInfo deviceInfo) {
        Device device = unsecureDAO.getDeviceByNumber(number);
        if (device == null) {
            device = unsecureDAO.getDeviceByOldNumber(number);
        }
        return device != null ? device.getId() : 0;
    }

    private void notifyDevice(int deviceId) {
        PushMessage message = new PushMessage();
        message.setDeviceId(deviceId);
        message.setMessageType(PushMessage.TYPE_CONFIG_UPDATED);
        pushService.send(message);
    }

    private boolean hasAccess() {
        if (!SecurityContext.get().hasPermission(PERMISSION)) {
            logger.error("Unauthorized attempt to use device reset plugin",
                    SecurityException.onCustomerDataAccessViolation(0, "device reset"));
            return false;
        }
        return true;
    }

    private boolean isDeviceAccessible(Device device) {
        return SecurityContext.get().getCurrentCustomerId().get().equals(device.getCustomerId());
    }

    private enum ActionType {
        FACTORY_RESET,
        REBOOT,
        LOCK,
        UNLOCK,
        PASSWORD_RESET
    }
}
