package com.hmdm.plugins.deviceinventory;

import com.google.inject.Module;
import com.hmdm.plugin.PluginConfiguration;
import com.hmdm.plugins.deviceinventory.guice.module.DeviceInventoryLiquibaseModule;
import com.hmdm.plugins.deviceinventory.guice.module.DeviceInventoryPersistenceModule;
import com.hmdm.plugins.deviceinventory.guice.module.DeviceInventoryRestModule;

import javax.servlet.ServletContext;
import java.util.ArrayList;
import java.util.List;

public class DeviceInventoryPluginConfigurationImpl implements PluginConfiguration {

    public static final String PLUGIN_ID = "deviceinventory";

    @Override
    public String getPluginId() {
        return PLUGIN_ID;
    }

    @Override
    public String getRootPackage() {
        return "com.hmdm.plugins.deviceinventory";
    }

    @Override
    public List<Module> getPluginModules(ServletContext context) {
        List<Module> modules = new ArrayList<>();
        modules.add(new DeviceInventoryLiquibaseModule(context));
        modules.add(new DeviceInventoryPersistenceModule(context));
        modules.add(new DeviceInventoryRestModule());
        return modules;
    }
}
