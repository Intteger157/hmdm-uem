package com.hmdm.plugins.devicelocation;

import com.google.inject.Module;
import com.hmdm.plugin.PluginConfiguration;
import com.hmdm.plugin.PluginTaskModule;
import com.hmdm.plugins.devicelocation.guice.module.DeviceLocationLiquibaseModule;
import com.hmdm.plugins.devicelocation.guice.module.DeviceLocationPersistenceModule;
import com.hmdm.plugins.devicelocation.guice.module.DeviceLocationRestModule;
import com.hmdm.plugins.devicelocation.guice.module.DeviceLocationTaskModule;

import javax.servlet.ServletContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class DeviceLocationPluginConfigurationImpl implements PluginConfiguration {

    public static final String PLUGIN_ID = "devicelocation";

    @Override
    public String getPluginId() {
        return PLUGIN_ID;
    }

    @Override
    public String getRootPackage() {
        return "com.hmdm.plugins.devicelocation";
    }

    @Override
    public List<Module> getPluginModules(ServletContext context) {
        List<Module> modules = new ArrayList<>();
        modules.add(new DeviceLocationLiquibaseModule(context));
        modules.add(new DeviceLocationPersistenceModule(context));
        modules.add(new DeviceLocationRestModule());
        return modules;
    }

    @Override
    public Optional<List<Class<? extends PluginTaskModule>>> getTaskModules(ServletContext context) {
        List<Class<? extends PluginTaskModule>> modules = new ArrayList<>();
        modules.add(DeviceLocationTaskModule.class);
        return Optional.of(modules);
    }
}
