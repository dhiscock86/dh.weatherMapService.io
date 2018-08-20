/*
 * Title: define.js
 * Purpose: To initialize the browser map interface, define modules,create widgets
 *          and send API requests for goecoding user selected weather information
 * Author: Daniel Hiscock
 * Date: July, 7, 2018
 * Disclaimer: This web application was created at the request of con*terra for to exhibit
 *             web development skills for recruitment.
 */
define([
    "esri/map",
    "esri/layers/FeatureLayer",
    "esri/InfoTemplate",
    "esri/symbols/SimpleMarkerSymbol",
    "esri/geometry/webMercatorUtils",
    "esri/dijit/Scalebar",
    "esri/dijit/Legend",
    "esri/config",
    "esri/request",
    "dojo/_base/array",
    "dojo/_base/Color",
    "dojo/dom",
    "dojo/on",
    "dojo/parser",
    "dojo/_base/json",
    "dojo/domReady!"
], function (
        Map,
        FeatureLayer,
        InfoTemplate,
        SimpleMarkerSymbol,
        webMercatorUtils,
        Scalebar,
        Legend,
        esriConfig,
        esriRequest,
        arrayUtils,
        Color,
        dom,
        on,
        parser,
        dojoJson
        ) {



    // Callback function to require script
    return {
        initialize: initialize,
        toggleCities: toggleCities
    };

    // global variables
    var map, url, cities;

    function initialize() {
        initMap()
                .then(loadCities)
                .then(createLegend)
                .catch(requestFailed);
    }

    //****************************************************************************************
    //Function to initialize map and esri widgets
    //****************************************************************************************
    async function initMap() {

        map = new Map("map", {
            basemap: "gray-vector",
            center: [26, 55],
            zoom: 3,
            slider: true
        });

        var scalebar = new Scalebar({
            map: map,
            scalebarUnit: "metric"
        });

        map.on("click", function (evt) {
            showCoordinates(evt)
                    .then(getPlace)
                    .then(placeRequestSucceeded)
                    .then(getWeather)
                    .then(weatherRequestSucceeded)
                    .catch(requestFailed);
        });


    }


    //****************************************************************************************
    // load the cities feature layer function, apply rendering and infotemplate
    //****************************************************************************************
    function loadCities() {
        // Use CORS
        esriConfig.defaults.io.corsEnabledServers.push("https://services1.arcgis.com");
        // infotemplate - not a required component
        var template = new InfoTemplate("${CITY_NAME}", "Population: ${POP}");
        
        url = "https://services1.arcgis.com/XRQ58kpEa17kSlHX/ArcGIS/rest/services/World_Cities/FeatureServer/0";

        cities = new FeatureLayer(url, {
            mode: FeatureLayer.MODE_SNAPSHOT,
            orderByFields: ["POP DESC"],
            outFields: ["CITY_NAME", "POP"],
            opacity: 0.5,
            infoTemplate: template
        });

        // required data for proportional symbols based on city population
        var sizeInfo = {
            field: "POP",
            valueUnit: "unknown",
            minDataValue: 50000,
            maxDataValue: 1500000,
            minSize: 6,
            maxSize: 25
        };

        var marker = new SimpleMarkerSymbol();
        marker.setColor(new Color("#00FFFF"));
        marker.setStyle(SimpleMarkerSymbol.STYLE_CIRCLE);
        var renderer = new esri.renderer.SimpleRenderer(marker);
        cities.setRenderer(renderer);

        cities.on("load", function () {
            cities.renderer.setSizeInfo(sizeInfo);
        });

        map.addLayer(cities);
    }

    function createLegend() {
        // create a legend for the city feature based on population
        var legend = new Legend({
            map: map,
            minSize: 0,
            layerInfos: [{
                    layer: cities,
                    title: "City Population"
                }]
        }, "legendDiv");
    }
    ;

    //****************************************************************************************
    // retrieve an display DD coordinates to display in HTML and use for reverse geocoding
    //****************************************************************************************
    async function showCoordinates(evt) {
        var mp = webMercatorUtils.webMercatorToGeographic(evt.mapPoint);
        //display mouse coordinates
        dom.byId("latitude").innerHTML = mp.y.toFixed(3);
        dom.byId("longitude").innerHTML = mp.x.toFixed(3);
        dom.byId("degrees1").innerHTML = "9&#176";
        dom.byId("degrees2").innerHTML = "9&#176";

        lat = mp.y.toFixed(3);
        lon = mp.x.toFixed(3);

        return [lat, lon];

    }

    //****************************************************************************************
    // Enable access to the location API for reverse geocoding (CORS enabled)
    //****************************************************************************************
    function getPlace(coords) {
        console.log(coords[0]);
        console.log(coords[1]);
        // Use CORS
        esriConfig.defaults.io.corsEnabledServers.push("https://api.opencagedata.com");

        var opendataApi = "https://api.opencagedata.com/geocode/v1/geojson?q=" + coords[0] + "+"
                + coords[1] + "&min_confidence=1&key=ac6c34cf21764d31b9d3ef6aa4a0047d";

        var placeRequest = esriRequest({
            "url": opendataApi
        });
        
        return placeRequest;
        
    }

    //****************************************************************************************
    // If request succeeds, pull in data location info from JSON
    //****************************************************************************************
    function placeRequestSucceeded(response) {

        var jsonstring = dojoJson.toJson(response, true);
        var json = JSON.parse(jsonstring);


        var city = json.features[0].properties.components.city;
        var country = json.features[0].properties.components.country;
        var ccode = json.features[0].properties.components.country_code;

        dom.byId("jsonplace").innerHTML = city + ", " + country;
        dom.byId("jsonweather").innerHTML = city + ", " + country;
        
        console.log(city + " " + typeof city);
        
        return [city, ccode];
    }

    //****************************************************************************************
    // Results from location are used to forward geocode to retrieve weather information
    //****************************************************************************************
    function getWeather(locate) {

        // Use CORS
        esriConfig.defaults.io.corsEnabledServers.push("https://api.openweathermap.org");
        var weatherAPI = "https://api.openweathermap.org/data/2.5/forecast?q=" + locate[0] + "," + locate[1]
                + "&lang=de&APPID=6b904086651c872d0e2c58c1529d2dcb";
        var weatherRequest = esriRequest({
            "url": weatherAPI
        });

        return weatherRequest;
    }

    //****************************************************************************************
    // retrieve and display weather forcast information from API
    //****************************************************************************************
    function weatherRequestSucceeded(response) {

        //convert json string to JSON with dojo
        var jsonstring = dojoJson.toJson(response, true);
        var json = JSON.parse(jsonstring);

        // remove any child elements within the weather content container
        var nodeRemove = dom.byId("weatherContent");
        while (nodeRemove.firstChild) {
            nodeRemove.removeChild(nodeRemove.firstChild);
        }

        // apply parameters for the date/time
        var dateOptions = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric'};
        // Procedurally generate elements containing forecasts every 3 hours for the next 5 days
        for (var i = 0; i < Object.keys(json.list).length; i++) {

            // create an image to represent the conditions icon
            var weatherIcon = new Image(40, 40);
            var img = json.list[i].weather[0].icon;
            weatherIcon.src = "https://openweathermap.org/img/w/" + img + ".png";

            // Procedurally create elements to hold forecast data based on the length of the JSON data
            var newParagraph = document.createElement("P");
            newParagraph.id = "weatherinfo" + i;
            dom.byId("weatherContent").appendChild(newParagraph);

            // Fill the element with weather forecast data. (Note: temp converted from Kelvin to celcius)
            dom.byId("weatherinfo" + i).innerHTML =
                    //Use German date formatting
                    new Date(json.list[i].dt * 1000).toLocaleDateString('de-DE', dateOptions)
                    + "<br>" + "Temperatur: " + Math.round((json.list[i].main.temp - 273.15), 1)
                    + "&#x2103<br>" + "Bedingungen: " + json.list[i].weather[0].description + "<br>";
            dom.byId("weatherinfo" + i).appendChild(weatherIcon);
        }
    }

    // Function for exceptipon handling
    function requestFailed(error) {
        // If a server request fails display an error within the browser console
        console.log(error);
    }

    //****************************************************************************************
    // Function to toggle city layer on/off based on toggle button
    //****************************************************************************************
    function toggleCities() {

        var cityTgl = dom.byId("cityTgl");

        // Ternery logic for button events
        cityTgl.value === "Remove Cities" ? cities.hide() : cities.show();
        cityTgl.value === "Remove Cities" ? cityTgl.value = "Add Cities" : cityTgl.value = "Remove Cities";
    }

});
