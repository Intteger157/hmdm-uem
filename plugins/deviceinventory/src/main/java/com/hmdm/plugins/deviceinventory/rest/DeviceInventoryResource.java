package com.hmdm.plugins.deviceinventory.rest;

import com.hmdm.notification.PushService;
import com.hmdm.notification.persistence.domain.PushMessage;
import com.hmdm.persistence.DeviceDAO;
import com.hmdm.persistence.UnsecureDAO;
import com.hmdm.persistence.domain.Device;
import com.hmdm.plugin.service.PluginStatusCache;
import com.hmdm.plugins.deviceinventory.persistence.DeviceInventoryDAO;
import com.hmdm.plugins.deviceinventory.persistence.domain.DeviceInventoryRecord;
import com.hmdm.plugins.deviceinventory.rest.json.DeviceInventoryView;
import com.hmdm.plugins.deviceinventory.rest.json.InventoryUploadRequest;
import com.hmdm.rest.json.Response;
import com.hmdm.security.SecurityContext;
import com.hmdm.security.SecurityException;
import com.hmdm.util.CryptoUtil;
import com.hmdm.util.StringUtil;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.Authorization;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Named;
import javax.inject.Singleton;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import static com.hmdm.plugins.deviceinventory.DeviceInventoryPluginConfigurationImpl.PLUGIN_ID;

@Singleton
@Path("/plugins/deviceinventory")
@Api(tags = {"Device Inventory plugin"})
public class DeviceInventoryResource {

    private static final Logger logger = LoggerFactory.getLogger(DeviceInventoryResource.class);
    private static final String PERMISSION = "plugin_deviceinventory_access";

    private final DeviceInventoryDAO deviceInventoryDAO;
    private final DeviceDAO deviceDAO;
    private final UnsecureDAO unsecureDAO;
    private final PluginStatusCache pluginStatusCache;
    private final PushService pushService;
    private final String hashSecret;

    public DeviceInventoryResource() {
        this.deviceInventoryDAO = null;
        this.deviceDAO = null;
        this.unsecureDAO = null;
        this.pluginStatusCache = null;
        this.pushService = null;
        this.hashSecret = null;
    }

    @Inject
    public DeviceInventoryResource(DeviceInventoryDAO deviceInventoryDAO,
                                   DeviceDAO deviceDAO,
                                   UnsecureDAO unsecureDAO,
                                   PluginStatusCache pluginStatusCache,
                                   PushService pushService,
                                   @Named("hash.secret") String hashSecret) {
        this.deviceInventoryDAO = deviceInventoryDAO;
        this.deviceDAO = deviceDAO;
        this.unsecureDAO = unsecureDAO;
        this.pluginStatusCache = pluginStatusCache;
        this.pushService = pushService;
        this.hashSecret = hashSecret;
    }

    @ApiOperation(value = "Get installed applications for device", authorizations = {@Authorization("Bearer Token")})
    @GET
    @Path("/private/{deviceNumber}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getInventory(@PathParam("deviceNumber") String deviceNumber) {
        if (!hasAccess()) {
            return Response.PERMISSION_DENIED();
        }

        Device device = deviceDAO.getDeviceByNumber(deviceNumber);
        if (device == null || !isDeviceAccessible(device)) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }

        DeviceInventoryRecord record = deviceInventoryDAO.getByDeviceId(device.getId());
        DeviceInventoryView view = new DeviceInventoryView();
        view.setDeviceNumber(device.getNumber());
        if (record != null) {
            view.setLastUpdate(record.getLastUpdate());
            view.setApplications(deviceInventoryDAO.parseApps(record.getApps()));
        }
        return Response.OK(view);
    }

    @ApiOperation(value = "Request inventory scan on device", authorizations = {@Authorization("Bearer Token")})
    @POST
    @Path("/private/scan/{deviceNumber}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response requestScan(@PathParam("deviceNumber") String deviceNumber) {
        if (!hasAccess()) {
            return Response.PERMISSION_DENIED();
        }

        Device device = deviceDAO.getDeviceByNumber(deviceNumber);
        if (device == null || !isDeviceAccessible(device)) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }

        PushMessage message = new PushMessage();
        message.setDeviceId(device.getId());
        message.setMessageType(PushMessage.TYPE_INVENTORY_SCAN);
        pushService.send(message);
        logger.info("Inventory scan requested for device {}", device.getNumber());
        return Response.OK();
    }

    @ApiOperation(value = "Upload installed applications from device")
    @POST
    @Path("/public/upload")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response uploadInventory(InventoryUploadRequest request) {
        if (request == null) {
            return Response.ERROR("Request body is required");
        }

        String deviceId = StringUtil.stripOffTrailingCharacter(request.getDeviceId(), "\"");
        String hash = StringUtil.stripOffTrailingCharacter(request.getHash(), "\"");

        if (deviceId == null || deviceId.isEmpty()) {
            return Response.ERROR("deviceId is required");
        }
        if (hash == null || hash.isEmpty()) {
            return Response.ERROR("hash is required");
        }

        String expectedHash = CryptoUtil.getMD5String(deviceId + this.hashSecret);
        if (!expectedHash.equalsIgnoreCase(hash)) {
            logger.error("Invalid hash for inventory upload from device {}", deviceId);
            return Response.ERROR("Invalid hash");
        }

        Device device = unsecureDAO.getDeviceByNumber(deviceId);
        if (device == null) {
            device = unsecureDAO.getDeviceByOldNumber(deviceId);
        }
        if (device == null) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }

        if (pluginStatusCache.isPluginDisabled(PLUGIN_ID)) {
            return Response.PLUGIN_DISABLED();
        }

        deviceInventoryDAO.saveInventory(
                device.getCustomerId(),
                device.getId(),
                request.getApplications()
        );
        logger.info("Inventory updated for device {} ({} apps)",
                device.getNumber(),
                request.getApplications() != null ? request.getApplications().size() : 0);
        return Response.OK();
    }

    private boolean hasAccess() {
        if (!SecurityContext.get().hasPermission(PERMISSION)) {
            logger.error("Unauthorized attempt to use device inventory plugin",
                    SecurityException.onCustomerDataAccessViolation(0, "device inventory"));
            return false;
        }
        return true;
    }

    private boolean isDeviceAccessible(Device device) {
        return SecurityContext.get().getCurrentCustomerId().get().equals(device.getCustomerId());
    }
}
