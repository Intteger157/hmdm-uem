package com.hmdm.plugins.deviceinventory.rest.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.LinkedList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class DeviceInventoryView {

    private String deviceNumber;
    private Long lastUpdate;
    private List<InstalledAppEntry> applications = new LinkedList<>();

    public String getDeviceNumber() {
        return deviceNumber;
    }

    public void setDeviceNumber(String deviceNumber) {
        this.deviceNumber = deviceNumber;
    }

    public Long getLastUpdate() {
        return lastUpdate;
    }

    public void setLastUpdate(Long lastUpdate) {
        this.lastUpdate = lastUpdate;
    }

    public List<InstalledAppEntry> getApplications() {
        return applications;
    }

    public void setApplications(List<InstalledAppEntry> applications) {
        this.applications = applications;
    }
}
