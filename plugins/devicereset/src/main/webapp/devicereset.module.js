angular.module('plugin-devicereset', ['ngResource', 'ui.bootstrap', 'ui.router', 'ncy-angular-breadcrumb'])
    .config(function ($stateProvider) {
        try {
            $stateProvider.state('plugin-devicereset', {
                url: "/" + 'plugin-devicereset',
                templateUrl: 'app/components/main/view/content.html',
                controller: 'TabController',
                ncyBreadcrumb: {
                    label: '{{"breadcrumb.plugin.devicereset.main" | localize}}',
                },
                resolve: {
                    openTab: function () {
                        return 'plugin-devicereset';
                    }
                },
            });
        } catch (e) {
            console.log('An error when adding state plugin-devicereset', e);
        }
    })
    .factory('pluginDeviceResetService', function ($resource) {
        return $resource('', {}, {
            getStatus: {url: 'rest/plugins/devicereset/private/status/:deviceId', method: 'GET'},
            reset: {url: 'rest/plugins/devicereset/private/reset', method: 'PUT'},
            reboot: {url: 'rest/plugins/devicereset/private/reboot', method: 'PUT'},
            lock: {url: 'rest/plugins/devicereset/private/lock', method: 'PUT'},
            unlock: {url: 'rest/plugins/devicereset/private/unlock', method: 'PUT'},
            password: {url: 'rest/plugins/devicereset/private/password', method: 'PUT'}
        });
    })
    .controller('PluginDeviceResetTabController', function ($scope) {
        $scope.placeholder = true;
    })
    .controller('DeviceResetModalController', function ($scope, $modalInstance, device, confirmModal,
                                                         localization, pluginDeviceResetService) {
        $scope.device = device;
        $scope.lockMessage = '';
        $scope.password = '';
        $scope.busy = false;
        $scope.errorMessage = undefined;

        pluginDeviceResetService.getStatus({deviceId: device.id}, function (response) {
            if (response.status === 'OK') {
                $scope.status = response.data || {};
            }
        });

        var runAction = function (actionName, requestFactory, confirmKey) {
            $scope.errorMessage = undefined;
            var execute = function () {
                $scope.busy = true;
                requestFactory().$promise.then(function (response) {
                    $scope.busy = false;
                    if (response.status === 'OK') {
                        pluginDeviceResetService.getStatus({deviceId: device.id}, function (statusResponse) {
                            if (statusResponse.status === 'OK') {
                                $scope.status = statusResponse.data || {};
                            }
                        });
                    } else {
                        $scope.errorMessage = localization.localizeServerResponse(response);
                    }
                }, function () {
                    $scope.busy = false;
                    $scope.errorMessage = localization.localizeServerResponse('error.request.failure');
                });
            };

            if (confirmKey) {
                confirmModal.getUserConfirmation(localization.localize(confirmKey), execute);
            } else {
                execute();
            }
        };

        $scope.rebootDevice = function () {
            runAction('reboot', function () {
                return pluginDeviceResetService.reboot({deviceId: device.id});
            }, 'plugin.devicereset.confirm.reboot');
        };

        $scope.lockDevice = function () {
            runAction('lock', function () {
                return pluginDeviceResetService.lock({
                    deviceId: device.id,
                    lockMessage: $scope.lockMessage
                });
            }, 'plugin.devicereset.confirm.lock');
        };

        $scope.unlockDevice = function () {
            runAction('unlock', function () {
                return pluginDeviceResetService.unlock({deviceId: device.id});
            });
        };

        $scope.resetPassword = function () {
            if (!$scope.password || $scope.password.trim() === '') {
                $scope.errorMessage = localization.localize('plugin.devicereset.error.empty.password');
                return;
            }
            runAction('password', function () {
                return pluginDeviceResetService.password({
                    deviceId: device.id,
                    password: $scope.password
                });
            }, 'plugin.devicereset.confirm.password');
        };

        $scope.factoryResetDevice = function () {
            runAction('reset', function () {
                return pluginDeviceResetService.reset({deviceId: device.id});
            }, 'plugin.devicereset.confirm.reset');
        };

        $scope.closeModal = function () {
            $modalInstance.dismiss();
        };
    })
    .run(function ($rootScope, $modal, localization) {
        $rootScope.$on('plugin-devicereset-device-selected', function (event, device) {
            $modal.open({
                templateUrl: 'app/components/plugins/devicereset/views/devicereset.modal.html',
                controller: 'DeviceResetModalController',
                resolve: {
                    device: function () {
                        return device;
                    }
                }
            });
        });
        localization.loadPluginResourceBundles("devicereset");
    });
