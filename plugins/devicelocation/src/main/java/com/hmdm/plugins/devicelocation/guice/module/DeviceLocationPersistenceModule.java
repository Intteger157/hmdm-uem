package com.hmdm.plugins.devicelocation.guice.module;

import com.hmdm.guice.module.AbstractPersistenceModule;

import javax.servlet.ServletContext;

public class DeviceLocationPersistenceModule extends AbstractPersistenceModule {

    public DeviceLocationPersistenceModule(ServletContext context) {
        super(context);
    }

    @Override
    protected String getMapperPackageName() {
        return "com.hmdm.plugins.devicelocation.persistence.mapper";
    }

    @Override
    protected String getDomainObjectsPackageName() {
        return "com.hmdm.plugins.devicelocation.persistence.domain";
    }
}
