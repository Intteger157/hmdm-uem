package com.hmdm.plugins.deviceinventory.rest.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.LinkedList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class InventoryUploadRequest {

    private String deviceId;
    private String hash;
    private List<InstalledAppEntry> applications = new LinkedList<>();

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public List<InstalledAppEntry> getApplications() {
        return applications;
    }

    public void setApplications(List<InstalledAppEntry> applications) {
        this.applications = applications;
    }
}
