package com.hmdm.plugins.deviceinventory.rest.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class InstalledAppEntry {

    private String pkg;
    private String name;
    private String version;
    private Boolean system;

    public String getPkg() {
        return pkg;
    }

    public void setPkg(String pkg) {
        this.pkg = pkg;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public Boolean getSystem() {
        return system;
    }

    public void setSystem(Boolean system) {
        this.system = system;
    }
}
