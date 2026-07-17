angular.module('plugin-deviceremote', ['ngResource', 'ui.bootstrap', 'ui.router', 'ncy-angular-breadcrumb'])
    .config(function ($stateProvider) {
        try {
            $stateProvider.state('plugin-deviceremote', {
                url: "/" + 'plugin-deviceremote',
                templateUrl: 'app/components/main/view/content.html',
                controller: 'TabController',
                ncyBreadcrumb: {
                    label: '{{"breadcrumb.plugin.deviceremote.main" | localize}}',
                },
                resolve: {
                    openTab: function () {
                        return 'plugin-deviceremote';
                    }
                },
            });
        } catch (e) {
            console.log('An error when adding state plugin-deviceremote', e);
        }

        try {
            $stateProvider.state('plugin-settings-deviceremote', {
                url: "/" + 'plugin-settings-deviceremote',
                templateUrl: 'app/components/main/view/content.html',
                controller: 'TabController',
                ncyBreadcrumb: {
                    label: '{{"breadcrumb.plugin.deviceremote.main" | localize}}',
                },
                resolve: {
                    openTab: function () {
                        return 'plugin-settings-deviceremote';
                    }
                },
            });
        } catch (e) {
            console.log('An error when adding state plugin-settings-deviceremote', e);
        }
    })
    .factory('pluginDeviceRemoteService', function ($resource) {
        return $resource('', {}, {
            getSettings: {url: 'rest/plugins/deviceremote/private/settings', method: 'GET'},
            saveSettings: {url: 'rest/plugins/deviceremote/private/settings', method: 'PUT'},
            getStatus: {url: 'rest/plugins/deviceremote/private/status/:deviceId', method: 'GET'},
            start: {url: 'rest/plugins/deviceremote/private/start', method: 'PUT'},
            stop: {url: 'rest/plugins/deviceremote/private/stop', method: 'PUT'}
        });
    })
    .controller('PluginDeviceRemoteTabController', function ($scope) {
        $scope.placeholder = true;
    })
    .controller('PluginDeviceRemoteSettingsController', function ($scope, pluginDeviceRemoteService, localization) {
        $scope.busy = false;
        $scope.errorMessage = undefined;
        $scope.successMessage = undefined;
        $scope.settings = {
            serverUrl: '',
            serverSecret: ''
        };

        $scope.loadSettings = function () {
            $scope.busy = true;
            pluginDeviceRemoteService.getSettings({}, function (response) {
                $scope.busy = false;
                if (response.status === 'OK' && response.data) {
                    $scope.settings.serverUrl = response.data.serverUrl || '';
                    $scope.settings.serverSecret = response.data.serverSecret || '';
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, function () {
                $scope.busy = false;
                $scope.errorMessage = localization.localizeServerResponse('error.request.failure');
            });
        };

        $scope.saveSettings = function () {
            $scope.errorMessage = undefined;
            $scope.successMessage = undefined;
            if (!$scope.settings.serverUrl || $scope.settings.serverUrl.trim() === '') {
                $scope.errorMessage = localization.localize('plugin.deviceremote.error.empty.serverUrl');
                return;
            }
            $scope.busy = true;
            pluginDeviceRemoteService.saveSettings({}, $scope.settings).$promise.then(function (response) {
                $scope.busy = false;
                if (response.status === 'OK') {
                    $scope.successMessage = localization.localize('plugin.deviceremote.settings.saved');
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, function () {
                $scope.busy = false;
                $scope.errorMessage = localization.localizeServerResponse('error.request.failure');
            });
        };

        $scope.loadSettings();
    })
    .controller('DeviceRemoteModalController', function ($scope, $modalInstance, $window, $interval, device,
                                                         localization, pluginDeviceRemoteService) {
        $scope.device = device;
        $scope.busy = false;
        $scope.errorMessage = undefined;
        $scope.status = {};

        var refreshStatus = function () {
            pluginDeviceRemoteService.getStatus({deviceId: device.id}, function (response) {
                if (response.status === 'OK') {
                    $scope.status = response.data || {};
                }
            });
        };

        refreshStatus();
        var pollTimer = $interval(refreshStatus, 1500);
        $scope.$on('$destroy', function () {
            if (pollTimer) {
                $interval.cancel(pollTimer);
            }
        });

        $scope.canOpenViewer = function () {
            if (!$scope.status || !$scope.status.viewerUrl) {
                return false;
            }
            var agent = ($scope.status.agentStatus || '').toLowerCase();
            // ready = capture + stable TextRoom; sharing = admin already joined.
            // connected alone is too early (before MediaProjection on Realme).
            return agent === 'ready' || agent === 'sharing';
        };

        var runAction = function (requestFactory, onSuccess) {
            $scope.errorMessage = undefined;
            $scope.busy = true;
            requestFactory().$promise.then(function (response) {
                $scope.busy = false;
                if (response.status === 'OK') {
                    $scope.status = response.data || {};
                    if (onSuccess) {
                        onSuccess();
                    }
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, function () {
                $scope.busy = false;
                $scope.errorMessage = localization.localizeServerResponse('error.request.failure');
            });
        };

        $scope.startRemote = function () {
            runAction(function () {
                return pluginDeviceRemoteService.start({deviceId: device.id});
            });
        };

        $scope.stopRemote = function () {
            runAction(function () {
                return pluginDeviceRemoteService.stop({deviceId: device.id});
            });
        };

        $scope.openViewer = function () {
            if ($scope.status.viewerUrl) {
                $window.open($scope.status.viewerUrl, '_blank');
            }
        };

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        };
    })
    .run(function ($rootScope, $modal, localization) {
        $rootScope.$on('plugin-deviceremote-device-selected', function (event, device) {
            $modal.open({
                templateUrl: 'app/components/plugins/deviceremote/views/deviceremote.modal.html',
                controller: 'DeviceRemoteModalController',
                size: 'lg',
                resolve: {
                    device: function () {
                        return device;
                    }
                }
            });
        });
        localization.loadPluginResourceBundles("deviceremote");
    });
