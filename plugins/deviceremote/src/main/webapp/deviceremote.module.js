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
        $scope.viewerBaseUrl = '';

        // Plain copy avoids ngResource Resource quirks (toLowerCase / truthiness on wrapped fields).
        var applyStatus = function (data) {
            data = data || {};
            var agent = data.agentStatus != null ? String(data.agentStatus).trim() : '';
            $scope.status = {
                status: data.status,
                agentStatus: agent || undefined,
                sessionId: data.sessionId,
                password: data.password,
                viewerUrl: data.viewerUrl,
                serverUrl: data.serverUrl,
                requestedAt: data.requestedAt,
                updatedAt: data.updatedAt
            };
            if (data.serverUrl) {
                $scope.viewerBaseUrl = String(data.serverUrl).trim();
            }
        };

        var normalizeAgent = function () {
            return String(($scope.status && $scope.status.agentStatus) || '').trim().toLowerCase();
        };

        var isAgentViewerReady = function () {
            var agent = normalizeAgent();
            // ready = capture + stable TextRoom; sharing = admin already joined.
            return agent === 'ready' || agent === 'sharing';
        };

        var buildViewerUrl = function (base, sessionId, password) {
            if (!base || !sessionId || !password) {
                return null;
            }
            var url = String(base).trim();
            if (url.length === 0) {
                return null;
            }
            if (url.charAt(url.length - 1) !== '/') {
                url += '/';
            }
            return url.indexOf('?') >= 0
                ? (url + '&session=' + encodeURIComponent(sessionId) + '&pin=' + encodeURIComponent(password))
                : (url + '?session=' + encodeURIComponent(sessionId) + '&pin=' + encodeURIComponent(password));
        };

        var resolveViewerUrl = function () {
            if (!$scope.status) {
                return null;
            }
            if ($scope.status.viewerUrl) {
                return String($scope.status.viewerUrl).trim();
            }
            var base = $scope.viewerBaseUrl || $scope.status.serverUrl || '';
            return buildViewerUrl(base, $scope.status.sessionId, $scope.status.password);
        };

        pluginDeviceRemoteService.getSettings({}, function (response) {
            if (response.status === 'OK' && response.data && response.data.serverUrl) {
                $scope.viewerBaseUrl = String(response.data.serverUrl).trim();
            }
        });

        var refreshStatus = function () {
            pluginDeviceRemoteService.getStatus({deviceId: device.id}, function (response) {
                if (response.status === 'OK') {
                    applyStatus(response.data);
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
            return isAgentViewerReady() && !!resolveViewerUrl();
        };

        $scope.isWaitingForReady = function () {
            // Never keep "wait for ready" once the agent already reports ready/sharing.
            if (!$scope.status || isAgentViewerReady() || $scope.canOpenViewer()) {
                return false;
            }
            var agent = normalizeAgent();
            return !agent || agent === 'connected' || agent === 'launched';
        };

        $scope.isReadyButViewerBlocked = function () {
            return isAgentViewerReady() && !$scope.canOpenViewer();
        };

        var runAction = function (requestFactory, onSuccess) {
            $scope.errorMessage = undefined;
            $scope.busy = true;
            requestFactory().$promise.then(function (response) {
                $scope.busy = false;
                if (response.status === 'OK') {
                    applyStatus(response.data);
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
            var url = resolveViewerUrl();
            if (url) {
                $window.open(url, '_blank');
                return;
            }
            if (isAgentViewerReady()) {
                $scope.errorMessage = localization.localize('plugin.deviceremote.error.missing.viewerUrl');
            }
        };

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        };
    })
    .run(function ($rootScope, $modal, localization) {
        $rootScope.$on('plugin-deviceremote-device-selected', function (event, device) {
            $modal.open({
                // Cache-bust so admins pick up Open Viewer gating fixes after WAR deploy.
                templateUrl: 'app/components/plugins/deviceremote/views/deviceremote.modal.html?v=20260717b',
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
