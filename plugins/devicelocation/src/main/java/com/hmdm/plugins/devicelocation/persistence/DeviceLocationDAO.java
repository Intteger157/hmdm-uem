package com.hmdm.plugins.devicelocation.persistence;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.hmdm.persistence.domain.Device;
import com.hmdm.plugins.devicelocation.persistence.domain.DeviceLocationHistoryRecord;
import com.hmdm.plugins.devicelocation.persistence.domain.DeviceLocationLatestRecord;
import com.hmdm.plugins.devicelocation.persistence.mapper.DeviceLocationMapper;
import com.hmdm.rest.json.DeviceLocation;
import org.mybatis.guice.transactional.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Singleton
public class DeviceLocationDAO {

    private static final Logger logger = LoggerFactory.getLogger(DeviceLocationDAO.class);
    private static final int HISTORY_LIMIT = 100;
    private static final int HISTORY_RETENTION_DAYS = 90;

    private final DeviceLocationMapper mapper;

    @Inject
    public DeviceLocationDAO(DeviceLocationMapper mapper) {
        this.mapper = mapper;
    }

    public DeviceLocationLatestRecord getLatestByDeviceId(int deviceId) {
        return mapper.findLatestByDeviceId(deviceId);
    }

    public List<DeviceLocationHistoryRecord> getHistory(int deviceId) {
        List<DeviceLocationHistoryRecord> history = mapper.findHistory(deviceId, HISTORY_LIMIT);
        return history != null ? history : Collections.emptyList();
    }

    @Transactional
    public void saveLocation(Device device, DeviceLocation location, String source) {
        if (device == null || location == null || location.getLat() == null || location.getLon() == null) {
            return;
        }

        long ts = location.getTs() != null ? location.getTs() : System.currentTimeMillis();
        double lat = location.getLat();
        double lon = location.getLon();

        DeviceLocationLatestRecord existing = mapper.findLatestByDeviceId(device.getId());
        if (existing == null) {
            DeviceLocationLatestRecord record = new DeviceLocationLatestRecord();
            record.setCustomerId(device.getCustomerId());
            record.setDeviceId(device.getId());
            record.setLat(lat);
            record.setLon(lon);
            record.setTs(ts);
            record.setSource(source);
            mapper.insertLatest(record);
        } else {
            existing.setLat(lat);
            existing.setLon(lon);
            existing.setTs(ts);
            existing.setSource(source);
            mapper.updateLatest(existing);
        }

        DeviceLocationHistoryRecord historyRecord = new DeviceLocationHistoryRecord();
        historyRecord.setCustomerId(device.getCustomerId());
        historyRecord.setDeviceId(device.getId());
        historyRecord.setLat(lat);
        historyRecord.setLon(lon);
        historyRecord.setTs(ts);
        historyRecord.setSource(source);
        mapper.insertHistory(historyRecord);
    }

    public void purgeHistory() {
        long olderThan = System.currentTimeMillis() - TimeUnit.DAYS.toMillis(HISTORY_RETENTION_DAYS);
        int removed = mapper.purgeHistory(olderThan);
        if (removed > 0) {
            logger.info("Purged {} device location history records older than {} days", removed, HISTORY_RETENTION_DAYS);
        }
    }
}
