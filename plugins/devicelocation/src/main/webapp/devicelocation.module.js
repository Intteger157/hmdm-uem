angular.module('plugin-devicelocation', ['ngResource', 'ui.bootstrap', 'ui.router', 'ncy-angular-breadcrumb'])
    .config(function ($stateProvider) {
        try {
            $stateProvider.state('plugin-devicelocation', {
                url: "/" + 'plugin-devicelocation/{deviceNumber}',
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
                        return 'plugin-devicelocation';
                    }
                },
            });
        } catch (e) {
            console.log('An error when adding state plugin-devicelocation', e);
        }
    })
    .factory('pluginDeviceLocationService', function ($resource) {
        return $resource('', {}, {
            getLocation: {
                url: 'rest/plugins/devicelocation/private/:deviceNumber',
                method: 'GET'
            }
        });
    })
    .controller('PluginDeviceLocationTabController', function ($scope) {
        $scope.placeholder = true;
    })
    .controller('PluginDeviceLocationController', function ($scope, $rootScope, $stateParams, $filter, $timeout,
                                                             pluginDeviceLocationService, localization,
                                                             externalLibLoader) {
        $scope.deviceNumber = $stateParams.deviceNumber;
        $scope.busy = false;
        $scope.errorMessage = undefined;
        $scope.location = null;
        $scope.mapUrl = null;
        $rootScope.settingsTabActive = false;
        $rootScope.pluginsTabActive = true;

        var mapInstance = null;
        var mapMarker = null;
        var mapPolyline = null;

        var destroyMap = function () {
            if (mapInstance) {
                mapInstance.remove();
                mapInstance = null;
                mapMarker = null;
                mapPolyline = null;
            }
        };

        var renderMap = function (locationData) {
            if (!locationData || locationData.lat == null || locationData.lon == null) {
                destroyMap();
                return;
            }

            externalLibLoader.getLoader('leaflet')().then(function () {
                $timeout(function () {
                    destroyMap();

                    var lat = locationData.lat;
                    var lon = locationData.lon;
                    mapInstance = L.map('device-location-map', {center: [lat, lon], zoom: 15});
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; OpenStreetMap contributors'
                    }).addTo(mapInstance);

                    mapMarker = L.marker([lat, lon]).addTo(mapInstance);
                    mapMarker.bindPopup(locationData.deviceNumber || $scope.deviceNumber).openPopup();

                    if (locationData.history && locationData.history.length > 1) {
                        var points = locationData.history.slice().reverse().map(function (p) {
                            return [p.lat, p.lon];
                        });
                        mapPolyline = L.polyline(points, {color: '#3388ff'}).addTo(mapInstance);
                        mapInstance.fitBounds(mapPolyline.getBounds(), {padding: [20, 20]});
                    }
                }, 100);
            });
        };

        $scope.getLastUpdateText = function () {
            if (!$scope.location || !$scope.location.ts) {
                return localization.localize('plugin.devicelocation.no.data');
            }
            return $filter('date')($scope.location.ts, 'yyyy/MM/dd HH:mm:ss');
        };

        $scope.getSourceText = function () {
            if (!$scope.location || !$scope.location.source) {
                return '-';
            }
            return localization.localize('plugin.devicelocation.source.' + $scope.location.source);
        };

        $scope.loadLocation = function () {
            $scope.busy = true;
            $scope.errorMessage = undefined;
            pluginDeviceLocationService.getLocation({deviceNumber: $scope.deviceNumber}, function (response) {
                $scope.busy = false;
                if (response.status === 'OK') {
                    $scope.location = response.data || {};
                    if ($scope.location.lat != null && $scope.location.lon != null) {
                        $scope.mapUrl = 'https://www.openstreetmap.org/?mlat=' + $scope.location.lat
                            + '&mlon=' + $scope.location.lon + '#map=16/' + $scope.location.lat + '/' + $scope.location.lon;
                    } else {
                        $scope.mapUrl = null;
                    }
                    renderMap($scope.location);
                } else {
                    $scope.errorMessage = localization.localizeServerResponse(response);
                }
            }, function () {
                $scope.busy = false;
                $scope.errorMessage = localization.localize('error.request.failure');
            });
        };

        $scope.$on('$destroy', destroyMap);
        $scope.loadLocation();
    })
    .run(function ($rootScope, $location, localization) {
        $rootScope.$on('plugin-devicelocation-device-selected', function (event, device) {
            $location.url('/plugin-devicelocation/' + device.number);
        });
        localization.loadPluginResourceBundles('devicelocation');
    });
