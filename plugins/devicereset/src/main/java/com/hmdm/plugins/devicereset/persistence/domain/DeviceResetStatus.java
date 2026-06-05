package com.hmdm.plugins.devicereset.persistence.domain;

import com.hmdm.persistence.domain.CustomerData;

import java.io.Serializable;

public class DeviceResetStatus implements CustomerData, Serializable {

    private static final long serialVersionUID = 1L;

    private Integer id;
    private int customerId;
    private int deviceId;
    private boolean factoryReset;
    private boolean reboot;
    private boolean lock;
    private String lockMessage;
    private String passwordReset;

    @Override
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    @Override
    public int getCustomerId() {
        return customerId;
    }

    public void setCustomerId(int customerId) {
        this.customerId = customerId;
    }

    public int getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(int deviceId) {
        this.deviceId = deviceId;
    }

    public boolean isFactoryReset() {
        return factoryReset;
    }

    public void setFactoryReset(boolean factoryReset) {
        this.factoryReset = factoryReset;
    }

    public boolean isReboot() {
        return reboot;
    }

    public void setReboot(boolean reboot) {
        this.reboot = reboot;
    }

    public boolean isLock() {
        return lock;
    }

    public void setLock(boolean lock) {
        this.lock = lock;
    }

    public String getLockMessage() {
        return lockMessage;
    }

    public void setLockMessage(String lockMessage) {
        this.lockMessage = lockMessage;
    }

    public String getPasswordReset() {
        return passwordReset;
    }

    public void setPasswordReset(String passwordReset) {
        this.passwordReset = passwordReset;
    }
}
