package com.hmdm.plugins.devicereset.rest;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.hmdm.plugins.devicereset.persistence.DeviceResetDAO;
import com.hmdm.plugins.devicereset.persistence.domain.DeviceResetStatus;
import com.hmdm.rest.json.SyncResponse;
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
        if (!(original instanceof SyncResponse)) {
            return original;
        }

        DeviceResetStatus status = deviceResetDAO.getByDeviceId(deviceId);
        if (status == null) {
            return original;
        }

        SyncResponse response = (SyncResponse) original;
        if (status.isFactoryReset()) {
            response.setFactoryReset(true);
        }
        if (status.isReboot()) {
            response.setReboot(true);
        }
        if (status.isLock()) {
            response.setLock(true);
            if (status.getLockMessage() != null && !status.getLockMessage().trim().isEmpty()) {
                response.setLockMessage(status.getLockMessage());
            }
        }
        if (status.getPasswordReset() != null && !status.getPasswordReset().trim().isEmpty()) {
            response.setPasswordReset(status.getPasswordReset());
        }
        return response;
    }
}
