package com.hmdm.plugins.devicelocation.rest.json;

import java.util.ArrayList;
import java.util.List;

public class DeviceLocationView {

    private String deviceNumber;
    private Double lat;
    private Double lon;
    private Long ts;
    private String source;
    private List<LocationPointView> history = new ArrayList<>();

    public String getDeviceNumber() {
        return deviceNumber;
    }

    public void setDeviceNumber(String deviceNumber) {
        this.deviceNumber = deviceNumber;
    }

    public Double getLat() {
        return lat;
    }

    public void setLat(Double lat) {
        this.lat = lat;
    }

    public Double getLon() {
        return lon;
    }

    public void setLon(Double lon) {
        this.lon = lon;
    }

    public Long getTs() {
        return ts;
    }

    public void setTs(Long ts) {
        this.ts = ts;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public List<LocationPointView> getHistory() {
        return history;
    }

    public void setHistory(List<LocationPointView> history) {
        this.history = history;
    }
}
