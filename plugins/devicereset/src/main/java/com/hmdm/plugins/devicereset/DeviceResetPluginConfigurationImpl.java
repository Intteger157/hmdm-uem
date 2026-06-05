package com.hmdm.plugins.devicereset;

import com.google.inject.Module;
import com.hmdm.plugin.PluginConfiguration;
import com.hmdm.plugins.devicereset.guice.module.DeviceResetLiquibaseModule;
import com.hmdm.plugins.devicereset.guice.module.DeviceResetPersistenceModule;
import com.hmdm.plugins.devicereset.guice.module.DeviceResetRestModule;

import javax.servlet.ServletContext;
import java.util.ArrayList;
import java.util.List;

public class DeviceResetPluginConfigurationImpl implements PluginConfiguration {

    public static final String PLUGIN_ID = "devicereset";

    @Override
    public String getPluginId() {
        return PLUGIN_ID;
    }

    @Override
    public String getRootPackage() {
        return "com.hmdm.plugins.devicereset";
    }

    @Override
    public List<Module> getPluginModules(ServletContext context) {
        List<Module> modules = new ArrayList<>();
        modules.add(new DeviceResetLiquibaseModule(context));
        modules.add(new DeviceResetPersistenceModule(context));
        modules.add(new DeviceResetRestModule());
        return modules;
    }
}
