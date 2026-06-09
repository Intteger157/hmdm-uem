package com.hmdm.plugins.devicelocation.guice.module;

import com.hmdm.guice.module.AbstractLiquibaseModule;
import com.hmdm.plugin.guice.module.PluginLiquibaseResourceAccessor;
import liquibase.resource.ResourceAccessor;

import javax.servlet.ServletContext;

public class DeviceLocationLiquibaseModule extends AbstractLiquibaseModule {

    public DeviceLocationLiquibaseModule(ServletContext context) {
        super(context);
    }

    @Override
    protected String getChangeLogResourcePath() {
        String path = this.getClass().getResource("/liquibase/devicelocation.changelog.xml").getPath();
        if (!path.startsWith("jar:")) {
            path = "jar:" + path;
        }
        return path;
    }

    @Override
    protected ResourceAccessor getResourceAccessor() {
        return new PluginLiquibaseResourceAccessor();
    }
}
