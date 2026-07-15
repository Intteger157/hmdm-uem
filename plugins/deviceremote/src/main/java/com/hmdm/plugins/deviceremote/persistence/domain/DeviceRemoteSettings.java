package com.hmdm.plugins.deviceremote.persistence.domain;

import com.hmdm.persistence.domain.CustomerData;

import java.io.Serializable;

public class DeviceRemoteSettings implements CustomerData, Serializable {

    private static final long serialVersionUID = 1L;

    private Integer id;
    private int customerId;
    private String serverUrl;
    private String serverSecret;

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

    public String getServerUrl() {
        return serverUrl;
    }

    public void setServerUrl(String serverUrl) {
        this.serverUrl = serverUrl;
    }

    public String getServerSecret() {
        return serverSecret;
    }

    public void setServerSecret(String serverSecret) {
        this.serverSecret = serverSecret;
    }
}
