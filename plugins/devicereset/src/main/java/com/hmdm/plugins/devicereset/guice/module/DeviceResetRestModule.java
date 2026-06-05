package com.hmdm.plugins.devicereset.guice.module;

import com.google.inject.servlet.ServletModule;
import com.hmdm.plugin.rest.PluginAccessFilter;
import com.hmdm.plugins.devicereset.rest.DeviceResetResource;
import com.hmdm.plugins.devicereset.rest.DeviceResetSyncResponseHook;
import com.hmdm.rest.filter.AuthFilter;
import com.hmdm.rest.filter.PrivateIPFilter;
import com.hmdm.rest.filter.PublicIPFilter;
import com.hmdm.security.jwt.JWTFilter;

import java.util.Arrays;
import java.util.List;

public class DeviceResetRestModule extends ServletModule {

    private static final List<String> protectedResources = Arrays.asList(
            "/rest/plugins/devicereset/private/*"
    );

    private static final List<String> publicResources = Arrays.asList(
            "/rest/plugins/devicereset/public/*"
    );

    @Override
    protected void configureServlets() {
        this.filter(protectedResources).through(JWTFilter.class);
        this.filter(protectedResources).through(AuthFilter.class);
        this.filter(protectedResources).through(PluginAccessFilter.class);
        this.filter(protectedResources).through(PrivateIPFilter.class);
        this.filter(publicResources).through(PublicIPFilter.class);
        this.bind(DeviceResetResource.class);
        this.bind(DeviceResetSyncResponseHook.class);
    }
}
