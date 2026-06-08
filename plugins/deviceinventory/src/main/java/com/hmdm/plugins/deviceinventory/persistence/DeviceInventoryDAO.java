package com.hmdm.plugins.deviceinventory.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.hmdm.plugins.deviceinventory.persistence.domain.DeviceInventoryRecord;
import com.hmdm.plugins.deviceinventory.persistence.mapper.DeviceInventoryMapper;
import com.hmdm.plugins.deviceinventory.rest.json.InstalledAppEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.LinkedList;
import java.util.List;

@Singleton
public class DeviceInventoryDAO {

    private static final Logger logger = LoggerFactory.getLogger(DeviceInventoryDAO.class);

    private final DeviceInventoryMapper mapper;
    private final ObjectMapper objectMapper;

    @Inject
    public DeviceInventoryDAO(DeviceInventoryMapper mapper) {
        this.mapper = mapper;
        this.objectMapper = new ObjectMapper();
    }

    public DeviceInventoryRecord getByDeviceId(int deviceId) {
        return mapper.findByDeviceId(deviceId);
    }

    public void saveInventory(int customerId, int deviceId, List<InstalledAppEntry> applications) {
        String appsJson = toJson(applications);
        long now = System.currentTimeMillis();

        DeviceInventoryRecord existing = mapper.findByDeviceId(deviceId);
        if (existing == null) {
            DeviceInventoryRecord record = new DeviceInventoryRecord();
            record.setCustomerId(customerId);
            record.setDeviceId(deviceId);
            record.setLastUpdate(now);
            record.setApps(appsJson);
            mapper.insertRecord(record);
        } else {
            existing.setLastUpdate(now);
            existing.setApps(appsJson);
            mapper.updateRecord(existing);
        }
    }

    public List<InstalledAppEntry> parseApps(String appsJson) {
        if (appsJson == null || appsJson.trim().isEmpty()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(
                    appsJson,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, InstalledAppEntry.class)
            );
        } catch (JsonProcessingException e) {
            logger.error("Failed to parse device inventory JSON", e);
            return Collections.emptyList();
        }
    }

    private String toJson(List<InstalledAppEntry> applications) {
        try {
            return objectMapper.writeValueAsString(applications != null ? applications : Collections.emptyList());
        } catch (JsonProcessingException e) {
            logger.error("Failed to serialize device inventory", e);
            return "[]";
        }
    }
}
