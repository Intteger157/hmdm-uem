angular.module('plugin-deviceinventory', ['ngResource', 'ui.bootstrap', 'ui.router', 'ncy-angular-breadcrumb'])
    .config(function ($stateProvider) {
        try {
            $stateProvider.state('plugin-deviceinventory', {
                url: "/" + 'plugin-deviceinventory/{deviceNumber}',
                params: {
                    deviceNumber: {
                        value: null,
                        squash: true
                    }
                },
                templateUrl: 'app/components/main/view/content.html',
                controller: 'TabController',
                ncyBreadcrumb: {
                    label: '{{deviceNumber}}',
                },
                resolve: {
                    openTab: function () {
                        return 'plugin-deviceinventory';
                    }
                },
            });
        } catch (e) {
            console.log('An error when adding state plugin-deviceinventory', e);
        }
    })
    .factory('pluginDeviceInventoryService', function ($resource) {
        return $resource('', {}, {
            getInventory: {
                url: 'rest/plugins/deviceinventory/private/:deviceNumber',
                method: 'GET'
            },
            requestScan: {
                url: 'rest/plugins/deviceinventory/private/scan/:deviceNumber',
                method: 'GET',
                params: {deviceNumber: '@deviceNumber'}
            }
        });
    })
    .controller('PluginDeviceInventoryTabController', function ($scope) {
        $scope.placeholder = true;
    })
    .controller('PluginDeviceInventoryController', function ($scope, $rootScope, $stateParams, $filter,
                                                             pluginDeviceInventoryService, localization) {
        $scope.deviceNumber = $stateParams.deviceNumber;
        $scope.filterText = '';
        $scope.busy = false;
        $scope.errorMessage = undefined;
        $scope.inventory = null;
        $rootScope.settingsTabActive = false;
        $rootScope.pluginsTabActive = true;

        $scope.loadInventory = function () {
            $scope.busy = true;
            $scope.errorMessage = undefined;
            pluginDeviceInventoryService.getInventory({deviceNumber: $scope.deviceNumber}, function (response) {
                $scope.busy = false;
                if (response.status === 'OK') {
                    $scope.inventory = response.data || {};
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, function () {
                $scope.busy = false;
                $scope.errorMessage = localization.localize('error.request.failure');
            });
        };

        $scope.getLastUpdateText = function () {
            if (!$scope.inventory || !$scope.inventory.lastUpdate) {
                return localization.localize('plugin.deviceinventory.no.data');
            }
            return $filter('date')($scope.inventory.lastUpdate, 'yyyy/MM/dd HH:mm:ss');
        };

        $scope.filterApps = function (app) {
            if (!$scope.filterText) {
                return true;
            }
            var lower = $scope.filterText.toLowerCase();
            return (app.name && app.name.toLowerCase().indexOf(lower) > -1)
                || (app.pkg && app.pkg.toLowerCase().indexOf(lower) > -1)
                || (app.version && app.version.toLowerCase().indexOf(lower) > -1);
        };

        $scope.requestScan = function () {
            $scope.busy = true;
            $scope.errorMessage = undefined;
            $scope.successMessage = undefined;
            pluginDeviceInventoryService.requestScan({deviceNumber: $scope.deviceNumber}, function (response) {
                $scope.busy = false;
                if (response.status === 'OK') {
                    $scope.errorMessage = undefined;
                    $scope.successMessage = localization.localize('plugin.deviceinventory.scan.requested');
                } else {
                    $scope.successMessage = undefined;
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, function (response) {
                $scope.busy = false;
                $scope.successMessage = undefined;
                $scope.errorMessage = localization.localize('error.request.failure');
                if (response && response.status) {
                    console.error('Inventory scan request failed:', response.status, response.data);
                }
            });
        };

        $scope.loadInventory();
    })
    .run(function ($rootScope, $location, localization) {
        $rootScope.$on('plugin-deviceinventory-device-selected', function (event, device) {
            $location.url('/plugin-deviceinventory/' + device.number);
        });
        localization.loadPluginResourceBundles('deviceinventory');
    });
