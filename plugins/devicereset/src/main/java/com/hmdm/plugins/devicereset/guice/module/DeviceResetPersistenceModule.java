package com.hmdm.plugins.devicereset.guice.module;

import com.hmdm.guice.module.AbstractPersistenceModule;

import javax.servlet.ServletContext;

public class DeviceResetPersistenceModule extends AbstractPersistenceModule {

    public DeviceResetPersistenceModule(ServletContext context) {
        super(context);
    }

    @Override
    protected String getMapperPackageName() {
        return "com.hmdm.plugins.devicereset.persistence.mapper";
    }

    @Override
    protected String getDomainObjectsPackageName() {
        return "com.hmdm.plugins.devicereset.persistence.domain";
    }
}
