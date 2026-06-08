package com.hmdm.plugins.deviceinventory.guice.module;

import com.google.inject.servlet.ServletModule;
import com.hmdm.plugin.rest.PluginAccessFilter;
import com.hmdm.plugins.deviceinventory.rest.DeviceInventoryResource;
import com.hmdm.rest.filter.AuthFilter;
import com.hmdm.rest.filter.PrivateIPFilter;
import com.hmdm.rest.filter.PublicIPFilter;
import com.hmdm.security.jwt.JWTFilter;

import java.util.Arrays;
import java.util.List;

public class DeviceInventoryRestModule extends ServletModule {

    private static final List<String> protectedResources = Arrays.asList(
            "/rest/plugins/deviceinventory/private/*"
    );

    private static final List<String> publicResources = Arrays.asList(
            "/rest/plugins/deviceinventory/public/*"
    );

    @Override
    protected void configureServlets() {
        this.filter(protectedResources).through(JWTFilter.class);
        this.filter(protectedResources).through(AuthFilter.class);
        this.filter(protectedResources).through(PluginAccessFilter.class);
        this.filter(protectedResources).through(PrivateIPFilter.class);
        this.filter(publicResources).through(PublicIPFilter.class);
        this.bind(DeviceInventoryResource.class);
    }
}
