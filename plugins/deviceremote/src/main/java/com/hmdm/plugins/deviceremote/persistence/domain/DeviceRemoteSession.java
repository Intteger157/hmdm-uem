package com.hmdm.plugins.deviceremote.persistence.domain;

import com.hmdm.persistence.domain.CustomerData;

import java.io.Serializable;

public class DeviceRemoteSession implements CustomerData, Serializable {

    private static final long serialVersionUID = 1L;

    public static final String STATUS_IDLE = "idle";
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_LAUNCHED = "launched";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_FAILED = "failed";
    public static final String STATUS_STOPPED = "stopped";

    private Integer id;
    private int customerId;
    private int deviceId;
    private String sessionId;
    private String password;
    private String status;
    private String agentStatus;
    private Long requestedAt;
    private Long updatedAt;

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

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getAgentStatus() {
        return agentStatus;
    }

    public void setAgentStatus(String agentStatus) {
        this.agentStatus = agentStatus;
    }

    public Long getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(Long requestedAt) {
        this.requestedAt = requestedAt;
    }

    public Long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Long updatedAt) {
        this.updatedAt = updatedAt;
    }
}
