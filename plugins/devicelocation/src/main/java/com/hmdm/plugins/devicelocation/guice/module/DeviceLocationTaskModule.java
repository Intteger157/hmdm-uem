package com.hmdm.plugins.devicelocation.guice.module;

import com.google.inject.Inject;
import com.hmdm.event.EventService;
import com.hmdm.plugin.PluginTaskModule;
import com.hmdm.plugins.devicelocation.persistence.DeviceLocationDAO;
import com.hmdm.plugins.devicelocation.persistence.DeviceLocationUpdatedEventListener;
import com.hmdm.util.BackgroundTaskRunnerService;

import java.util.concurrent.TimeUnit;

public class DeviceLocationTaskModule implements PluginTaskModule {

    private final EventService eventService;
    private final DeviceLocationDAO deviceLocationDAO;
    private final DeviceLocationUpdatedEventListener locationUpdatedEventListener;
    private final BackgroundTaskRunnerService taskRunner;

    @Inject
    public DeviceLocationTaskModule(EventService eventService,
                                    DeviceLocationDAO deviceLocationDAO,
                                    DeviceLocationUpdatedEventListener locationUpdatedEventListener,
                                    BackgroundTaskRunnerService taskRunner) {
        this.eventService = eventService;
        this.deviceLocationDAO = deviceLocationDAO;
        this.locationUpdatedEventListener = locationUpdatedEventListener;
        this.taskRunner = taskRunner;
    }

    @Override
    public void init() {
        this.eventService.addEventListener(this.locationUpdatedEventListener);
        this.taskRunner.submitRepeatableTask(this.deviceLocationDAO::purgeHistory, 1, 24, TimeUnit.HOURS);
    }
}
