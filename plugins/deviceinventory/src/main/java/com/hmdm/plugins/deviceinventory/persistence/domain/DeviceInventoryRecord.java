package com.hmdm.plugins.deviceinventory.persistence.domain;

import java.io.Serializable;

public class DeviceInventoryRecord implements Serializable {

    private static final long serialVersionUID = 1L;

    private Integer id;
    private int customerId;
    private int deviceId;
    private long lastUpdate;
    private String apps;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

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

    public long getLastUpdate() {
        return lastUpdate;
    }

    public void setLastUpdate(long lastUpdate) {
        this.lastUpdate = lastUpdate;
    }

    public String getApps() {
        return apps;
    }

    public void setApps(String apps) {
        this.apps = apps;
    }
}
