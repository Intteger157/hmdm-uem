package com.hmdm.plugins.deviceinventory.guice.module;

import com.hmdm.guice.module.AbstractPersistenceModule;

import javax.servlet.ServletContext;

public class DeviceInventoryPersistenceModule extends AbstractPersistenceModule {

    public DeviceInventoryPersistenceModule(ServletContext context) {
        super(context);
    }

    @Override
    protected String getMapperPackageName() {
        return "com.hmdm.plugins.deviceinventory.persistence.mapper";
    }

    @Override
    protected String getDomainObjectsPackageName() {
        return "com.hmdm.plugins.deviceinventory.persistence.domain";
    }
}
