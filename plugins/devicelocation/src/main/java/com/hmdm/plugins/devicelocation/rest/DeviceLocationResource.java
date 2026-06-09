package com.hmdm.plugins.devicelocation.rest;

import com.hmdm.persistence.DeviceDAO;
import com.hmdm.persistence.domain.Device;
import com.hmdm.plugins.devicelocation.persistence.DeviceLocationDAO;
import com.hmdm.plugins.devicelocation.persistence.domain.DeviceLocationHistoryRecord;
import com.hmdm.plugins.devicelocation.persistence.domain.DeviceLocationLatestRecord;
import com.hmdm.plugins.devicelocation.rest.json.DeviceLocationView;
import com.hmdm.plugins.devicelocation.rest.json.LocationPointView;
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
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import java.util.List;
import java.util.stream.Collectors;

@Singleton
@Path("/plugins/devicelocation")
@Api(tags = {"Device Location plugin"})
public class DeviceLocationResource {

    private static final Logger logger = LoggerFactory.getLogger(DeviceLocationResource.class);
    private static final String PERMISSION = "plugin_devicelocation_access";

    private final DeviceLocationDAO deviceLocationDAO;
    private final DeviceDAO deviceDAO;

    public DeviceLocationResource() {
        this.deviceLocationDAO = null;
        this.deviceDAO = null;
    }

    @Inject
    public DeviceLocationResource(DeviceLocationDAO deviceLocationDAO, DeviceDAO deviceDAO) {
        this.deviceLocationDAO = deviceLocationDAO;
        this.deviceDAO = deviceDAO;
    }

    @ApiOperation(value = "Get latest device location and history", authorizations = {@Authorization("Bearer Token")})
    @GET
    @Path("/private/{deviceNumber}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getLocation(@PathParam("deviceNumber") String deviceNumber) {
        if (!hasAccess()) {
            return Response.PERMISSION_DENIED();
        }

        Device device = deviceDAO.getDeviceByNumber(deviceNumber);
        if (device == null || !isDeviceAccessible(device)) {
            return Response.DEVICE_NOT_FOUND_ERROR();
        }

        DeviceLocationLatestRecord latest = deviceLocationDAO.getLatestByDeviceId(device.getId());
        List<DeviceLocationHistoryRecord> history = deviceLocationDAO.getHistory(device.getId());

        DeviceLocationView view = new DeviceLocationView();
        view.setDeviceNumber(device.getNumber());
        if (latest != null) {
            view.setLat(latest.getLat());
            view.setLon(latest.getLon());
            view.setTs(latest.getTs());
            view.setSource(latest.getSource());
        }
        view.setHistory(history.stream().map(this::toPointView).collect(Collectors.toList()));
        return Response.OK(view);
    }

    private LocationPointView toPointView(DeviceLocationHistoryRecord record) {
        LocationPointView point = new LocationPointView();
        point.setLat(record.getLat());
        point.setLon(record.getLon());
        point.setTs(record.getTs());
        point.setSource(record.getSource());
        return point;
    }

    private boolean hasAccess() {
        if (!SecurityContext.get().hasPermission(PERMISSION)) {
            logger.error("Unauthorized attempt to use device location plugin",
                    SecurityException.onCustomerDataAccessViolation(0, "device location"));
            return false;
        }
        return true;
    }

    private boolean isDeviceAccessible(Device device) {
        return SecurityContext.get().getCurrentCustomerId().get().equals(device.getCustomerId());
    }
}
