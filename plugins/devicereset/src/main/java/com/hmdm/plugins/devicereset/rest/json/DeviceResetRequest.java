package com.hmdm.plugins.devicereset.rest.json;

import java.io.Serializable;

public class DeviceResetRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    private Integer deviceId;
    private String lockMessage;
    private String password;

    public Integer getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(Integer deviceId) {
        this.deviceId = deviceId;
    }

    public String getLockMessage() {
        return lockMessage;
    }

    public void setLockMessage(String lockMessage) {
        this.lockMessage = lockMessage;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
