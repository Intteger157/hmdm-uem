package com.hmdm.plugins.devicelocation.persistence;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.hmdm.event.DeviceLocationUpdatedEvent;
import com.hmdm.event.EventListener;
import com.hmdm.event.EventType;
import com.hmdm.persistence.UnsecureDAO;
import com.hmdm.persistence.domain.Device;
import com.hmdm.rest.json.DeviceLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Singleton
public class DeviceLocationUpdatedEventListener implements EventListener<DeviceLocationUpdatedEvent> {

    private static final Logger logger = LoggerFactory.getLogger(DeviceLocationUpdatedEventListener.class);

    private final DeviceLocationDAO deviceLocationDAO;
    private final UnsecureDAO unsecureDAO;

    @Inject
    public DeviceLocationUpdatedEventListener(DeviceLocationDAO deviceLocationDAO, UnsecureDAO unsecureDAO) {
        this.deviceLocationDAO = deviceLocationDAO;
        this.unsecureDAO = unsecureDAO;
    }

    @Override
    public void onEvent(DeviceLocationUpdatedEvent event) {
        if (event.getLocations() == null || event.getLocations().isEmpty()) {
            return;
        }

        Device device = unsecureDAO.getDeviceById(event.getDeviceId());
        if (device == null) {
            logger.warn("Device {} not found while saving location update", event.getDeviceId());
            return;
        }

        String source = event.isFromDetailedInfo() ? "deviceinfo" : "sync";
        for (DeviceLocation location : event.getLocations()) {
            deviceLocationDAO.saveLocation(device, location, source);
        }
    }

    @Override
    public EventType getSupportedEventType() {
        return EventType.DEVICE_LOCATION_UPDATED;
    }
}
