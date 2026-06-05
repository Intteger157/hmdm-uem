package com.hmdm.plugins.devicereset.rest;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.hmdm.plugins.devicereset.persistence.DeviceResetDAO;
import com.hmdm.plugins.devicereset.persistence.domain.DeviceResetStatus;
import com.hmdm.rest.json.SyncResponseHook;
import com.hmdm.rest.json.SyncResponseInt;

@Singleton
public class DeviceResetSyncResponseHook implements SyncResponseHook {

    private final DeviceResetDAO deviceResetDAO;

    @Inject
    public DeviceResetSyncResponseHook(DeviceResetDAO deviceResetDAO) {
        this.deviceResetDAO = deviceResetDAO;
    }

    @Override
    public SyncResponseInt handle(int deviceId, SyncResponseInt original) {
        DeviceResetStatus status = deviceResetDAO.getByDeviceId(deviceId);
        if (status == null) {
            return original;
        }

        if (status.isFactoryReset()) {
            original.setFactoryReset(true);
        }
        if (status.isReboot()) {
            original.setReboot(true);
        }
        if (status.isLock()) {
            original.setLock(true);
            if (status.getLockMessage() != null && !status.getLockMessage().trim().isEmpty()) {
                original.setLockMessage(status.getLockMessage());
            }
        }
        if (status.getPasswordReset() != null && !status.getPasswordReset().trim().isEmpty()) {
            original.setPasswordReset(status.getPasswordReset());
        }
        return original;
    }
}
