package com.hmdm.plugins.devicereset.persistence;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.hmdm.persistence.AbstractDAO;
import com.hmdm.plugins.devicereset.persistence.domain.DeviceResetStatus;
import com.hmdm.plugins.devicereset.persistence.mapper.DeviceResetMapper;
import org.mybatis.guice.transactional.Transactional;

@Singleton
public class DeviceResetDAO extends AbstractDAO<DeviceResetStatus> {

    private final DeviceResetMapper deviceResetMapper;

    @Inject
    public DeviceResetDAO(DeviceResetMapper deviceResetMapper) {
        this.deviceResetMapper = deviceResetMapper;
    }

    public DeviceResetStatus getByDeviceId(int deviceId) {
        return deviceResetMapper.findByDeviceId(deviceId);
    }

    @Transactional
    public void saveStatus(DeviceResetStatus status) {
        DeviceResetStatus existing = getByDeviceId(status.getDeviceId());
        if (existing == null) {
            deviceResetMapper.insertStatus(status);
        } else {
            deviceResetMapper.updateStatus(status);
        }
    }

    @Transactional
    public void clearFactoryReset(int deviceId) {
        DeviceResetStatus status = getByDeviceId(deviceId);
        if (status != null) {
            status.setFactoryReset(false);
            deviceResetMapper.updateStatus(status);
        }
    }

    @Transactional
    public void clearReboot(int deviceId) {
        DeviceResetStatus status = getByDeviceId(deviceId);
        if (status != null) {
            status.setReboot(false);
            deviceResetMapper.updateStatus(status);
        }
    }

    @Transactional
    public void clearPasswordReset(int deviceId) {
        DeviceResetStatus status = getByDeviceId(deviceId);
        if (status != null) {
            status.setPasswordReset(null);
            deviceResetMapper.updateStatus(status);
        }
    }
}
